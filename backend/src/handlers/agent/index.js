'use strict';

const { GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { docClient } = require('../../utils/dynamodb');
const { getSecret } = require('../../utils/secrets');
const { ok, badRequest, unauthorized, serverError, getUserId } = require('../../utils/response');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.TABLE_NAME;
const CV_BUCKET = process.env.CV_BUCKET;
const ANTHROPIC_SECRET_ARN = process.env.ANTHROPIC_SECRET_ARN;

const matchSchema = Joi.object({
  cvId: Joi.string().uuid().required(),
  searchConfig: Joi.object({
    portals: Joi.array().items(Joi.string().valid('computrabajo', 'getonboard', 'bumeran', 'indeed')).default(['getonboard', 'computrabajo']),
    location: Joi.string().max(100).default('Argentina'),
    remoteOk: Joi.boolean().default(true),
    maxResults: Joi.number().integer().min(5).max(50).default(20),
    minMatchScore: Joi.number().min(0).max(100).default(60),
  }).default({}),
});

// ─── Tool Definitions para Anthropic ──────────────────────────────────────
const TOOLS = [
  {
    name: 'parse_cv',
    description: 'Extrae información estructurada de un CV en texto plano. Devuelve perfil del candidato.',
    input_schema: {
      type: 'object',
      properties: {
        cv_text: { type: 'string', description: 'Contenido textual del CV' },
      },
      required: ['cv_text'],
    },
  },
  {
    name: 'search_jobs',
    description: 'Simula búsqueda de trabajos en portales de empleo basada en el perfil del candidato.',
    input_schema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Rol objetivo del candidato' },
        skills: { type: 'array', items: { type: 'string' }, description: 'Skills principales' },
        location: { type: 'string', description: 'Ubicación preferida' },
        remote_ok: { type: 'boolean', description: 'Acepta trabajo remoto' },
        portals: { type: 'array', items: { type: 'string' }, description: 'Portales a consultar' },
        max_results: { type: 'number', description: 'Máximo de resultados' },
      },
      required: ['role', 'skills'],
    },
  },
  {
    name: 'calculate_match_scores',
    description: 'Calcula scores de coincidencia entre perfil del candidato y lista de trabajos.',
    input_schema: {
      type: 'object',
      properties: {
        candidate_profile: {
          type: 'object',
          description: 'Perfil estructurado del candidato',
        },
        job_listings: {
          type: 'array',
          description: 'Lista de trabajos encontrados',
        },
        min_score: { type: 'number', description: 'Score mínimo para incluir en resultados' },
      },
      required: ['candidate_profile', 'job_listings'],
    },
  },
];

// ─── Ejecutores de Tools (lógica real) ────────────────────────────────────
async function executeTool(toolName, toolInput, context) {
  switch (toolName) {
    case 'parse_cv': {
      // En producción real, esto analizaría el texto con lógica adicional
      // Aquí delegamos al modelo para que lo haga en el siguiente turno
      return {
        parsed: true,
        message: 'CV text received for parsing',
        cv_text_length: toolInput.cv_text?.length || 0,
      };
    }

    case 'search_jobs': {
      // En producción: HTTP requests a APIs de portales con rate limiting
      // Por ahora retornamos estructura de ejemplo para que el agente procese
      const mockJobs = generateMockJobs(toolInput.role, toolInput.skills, toolInput.location);
      return { jobs: mockJobs, total: mockJobs.length, portals_searched: toolInput.portals };
    }

    case 'calculate_match_scores': {
      // El cálculo real lo hace el modelo, esto es un passthrough
      return {
        profile: toolInput.candidate_profile,
        jobs: toolInput.job_listings,
        min_score: toolInput.min_score || 60,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Jobs de ejemplo para desarrollo (en prod: APIs reales)
function generateMockJobs(role, skills, location) {
  const companies = ['MercadoLibre', 'Globant', 'Despegar', 'OLX', 'Auth0', 'Etermax', 'Rappi', 'Uala'];
  const portals = ['getonboard', 'computrabajo', 'bumeran'];
  return Array.from({ length: 8 }, (_, i) => ({
    id: uuidv4(),
    portal: portals[i % portals.length],
    title: `${role} - ${['Sr', 'Semi Sr', 'Jr', 'Lead'][i % 4]}`,
    company: companies[i % companies.length],
    location: i % 3 === 0 ? 'Remoto' : location,
    remote: i % 3 === 0,
    description: `Buscamos ${role} con experiencia en ${skills.slice(0, 3).join(', ')}. Equipo ágil, beneficios competitivos.`,
    required_skills: [...skills.slice(0, 3), 'Git', 'Inglés'],
    seniority: ['Junior', 'Semi Senior', 'Senior', 'Lead'][i % 4],
    salary: i % 2 === 0 ? '$300,000 - $500,000 ARS' : 'A convenir',
    url: `https://getonboard.com/jobs/${uuidv4()}`,
    posted_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

// ─── Handler principal ────────────────────────────────────────────────────
exports.handler = async (event) => {
  const origin = event.headers?.origin || '';

  try {
    const userId = getUserId(event);
    if (!userId) return unauthorized(origin);

    const body = JSON.parse(event.body || '{}');
    const { error, value } = matchSchema.validate(body);
    if (error) return badRequest(error.details[0].message, origin);

    const { cvId, searchConfig } = value;

    // Verificar que el CV pertenece al usuario
    const cvQuery = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'CV#',
      },
    }));

    const cvRecord = cvQuery.Items?.find(item => item.cvId === cvId);
    if (!cvRecord) return badRequest('CV not found or access denied', origin);

    // Obtener texto del CV desde S3
    let cvText = '';
    try {
      const s3Response = await s3Client.send(new GetObjectCommand({
        Bucket: CV_BUCKET,
        Key: cvRecord.s3Key,
      }));
      // En producción usarías pdf-parse para extraer texto del PDF
      cvText = `[CV content from ${cvRecord.originalName}]`;
    } catch (s3Err) {
      console.warn('Could not fetch CV from S3, using fallback:', s3Err.message);
      cvText = '[CV not available]';
    }

    // Obtener API Key de Anthropic desde Secrets Manager
    const secrets = await getSecret(ANTHROPIC_SECRET_ARN);
    const apiKey = typeof secrets === 'object' ? secrets.apiKey : secrets;

    const anthropic = new Anthropic({ apiKey });

    // ─── Agentic Loop con Tool Use ────────────────────────────────────────
    const systemPrompt = `Eres JobMatchAgent, un asistente experto en búsqueda de empleo para profesionales IT en Argentina/LATAM.
Tu tarea:
1. Analizar el CV del candidato usando parse_cv
2. Buscar trabajos relevantes usando search_jobs con los parámetros apropiados
3. Calcular scores de coincidencia usando calculate_match_scores
4. Devolver un JSON estructurado con los resultados rankeados

Responde SIEMPRE en español. Sé preciso en los scores y justifica cada recomendación.
Al final, devuelve un JSON con esta estructura exacta:
{
  "candidate_profile": { ... },
  "results": [{ "job": {...}, "match_score": 0-100, "match_reason": "..." }],
  "summary": "texto de resumen"
}`;

    const userMessage = `Analiza este CV y busca los mejores trabajos disponibles.

CV del candidato:
${cvText}

Configuración de búsqueda:
- Portales: ${searchConfig.portals.join(', ')}
- Ubicación: ${searchConfig.location}
- Acepta remoto: ${searchConfig.remoteOk}
- Score mínimo: ${searchConfig.minMatchScore}
- Máximo resultados: ${searchConfig.maxResults}`;

    let messages = [{ role: 'user', content: userMessage }];
    let finalResult = null;
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      // Si el modelo terminó sin tool use
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find(b => b.type === 'text');
        if (textBlock) {
          try {
            // Intentar parsear JSON del response
            const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              finalResult = JSON.parse(jsonMatch[0]);
            }
          } catch {
            finalResult = { summary: textBlock.text, results: [] };
          }
        }
        break;
      }

      // Procesar tool calls
      if (response.stop_reason === 'tool_use') {
        const toolResults = [];

        for (const block of response.content) {
          if (block.type === 'tool_use') {
            const toolResult = await executeTool(block.name, block.input, { userId });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(toolResult),
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });
      }
    }

    // Guardar resultado en DynamoDB
    const matchId = uuidv4();
    const matchRecord = {
      PK: `USER#${userId}`,
      SK: `MATCH#${Date.now()}`,
      matchId,
      userId,
      cvId,
      searchConfig,
      result: finalResult,
      status: 'completed',
      createdAt: new Date().toISOString(),
      // TTL de 90 días para matches
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
      // GSI attributes
      matchScore: finalResult?.results?.[0]?.match_score || 0,
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: matchRecord,
    }));

    return ok(
      {
        matchId,
        result: finalResult,
        iterations,
      },
      origin
    );
  } catch (err) {
    console.error('AgentHandler error:', JSON.stringify({ error: err.message, stack: err.stack }));
    return serverError(origin);
  }
};
