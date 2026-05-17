# JobMatchAgent 🎯

Agente de IA para búsqueda inteligente de empleo. Subís tu CV, el agente extrae tu perfil y busca los trabajos que más te convienen en portales de LATAM.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Vite + AWS Amplify |
| Auth | Amazon Cognito |
| API | API Gateway + AWS Lambda (Node.js 20) |
| Agente IA | Anthropic Claude (tool use) |
| Base de datos | Amazon DynamoDB |
| Storage | Amazon S3 |
| IaC | AWS CDK v2 (JavaScript) |
| CI/CD | GitHub Actions |

## Estructura del proyecto

```
busquedaDeTrabajo/
├── docs/
│   ├── Agente.md          ← Definición del agente AI
│   ├── arquitectura.md    ← Arquitectura técnica completa
│   ├── producto.md        ← Product definition
│   └── compliance.md      ← Seguridad y cumplimiento normativo
├── infrastructure/        ← CDK stacks
│   ├── bin/app.js         ← Entry point CDK
│   └── lib/
│       ├── auth-stack.js      ← Cognito User Pool
│       ├── storage-stack.js   ← DynamoDB + S3 + Secrets
│       ├── backend-stack.js   ← Lambda + API Gateway
│       └── frontend-stack.js  ← Amplify hosting
├── backend/
│   └── src/
│       ├── handlers/
│       │   ├── cv/        ← Upload CV, presigned URLs
│       │   ├── agent/     ← Agente IA con tool use
│       │   ├── profile/   ← CRUD perfil de usuario
│       │   └── jobs/      ← Historial de búsquedas
│       └── utils/
│           ├── response.js    ← Helpers HTTP con headers de seguridad
│           ├── dynamodb.js    ← Cliente DynamoDB
│           └── secrets.js     ← Secrets Manager helper
├── frontend/
│   └── src/
│       ├── pages/         ← Dashboard, Upload, Search, Results, Profile
│       ├── components/    ← Layout, navegación
│       └── utils/api.js   ← API client con auth automático
└── .github/workflows/
    └── deploy.yml         ← CI/CD: security → lint → test → deploy
```

## Setup inicial

### Pre-requisitos

- Node.js 20+
- AWS CLI configurado (`aws configure`)
- Cuenta AWS con permisos de CDK

### 1. Clonar e instalar

```bash
git clone https://github.com/mcanteros52/jobmatch-agent
cd busquedaDeTrabajo
npm install
```

### 2. Bootstrap CDK (primera vez por cuenta/región)

```bash
cd infrastructure
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
```

### 3. Cargar el API Key de Anthropic en Secrets Manager

```bash
aws secretsmanager put-secret-value \
  --secret-id "jobmatch/dev/anthropic-api-key" \
  --secret-string '{"apiKey":"sk-ant-api03-..."}'
```

### 4. Deploy infraestructura

```bash
# Desde la raíz del proyecto
npm run deploy:dev
```

El output muestra:
- `ApiUrl`: URL del API Gateway
- `AmplifyUrl`: URL del frontend deployado
- `UserPoolId` y `UserPoolClientId` para Cognito

### 5. Configurar frontend local

```bash
cd frontend
cp .env.example .env.local
# Editar .env.local con los valores del output de CDK
npm run dev
```

## Comandos útiles

```bash
# Ver diferencias antes de deployar
npm run diff

# Deploy a dev
npm run deploy:dev

# Deploy a prod
npm run deploy:prod

# Tests
npm test

# Ver logs de una Lambda en tiempo real
aws logs tail /aws/lambda/jobmatch-agent-dev --follow
```

## Variables de entorno requeridas

### Frontend (.env.local)
```
VITE_API_URL=         # Output de CDK: ApiUrl
VITE_COGNITO_USER_POOL_ID=   # Output de CDK: UserPoolId
VITE_COGNITO_CLIENT_ID=      # Output de CDK: UserPoolClientId
VITE_AWS_REGION=us-east-1
```

### Backend (Lambda — se configuran automáticamente via CDK)
```
TABLE_NAME            # DynamoDB table name
CV_BUCKET             # S3 bucket name
ANTHROPIC_SECRET_ARN  # ARN del secreto en Secrets Manager
ENV                   # dev | staging | prod
```

## Seguridad

- CVs almacenados cifrados en S3 (SSE-S3)
- DynamoDB cifrado en reposo
- Tokens JWT de Cognito (RS256), TTL 1 hora
- Cada Lambda tiene permisos IAM mínimos
- CORS configurado con origins específicos
- Headers de seguridad en cada response
- Sin secretos en código ni variables de entorno

Ver [`docs/compliance.md`](docs/compliance.md) para el checklist completo.

## Arquitectura del agente

El agente usa Claude con **tool use** en un loop agentic:

1. **parse_cv** → extrae perfil estructurado del CV
2. **search_jobs** → busca en portales (GetOnBoard, Computrabajo, Bumeran, Indeed)
3. **calculate_match_scores** → rankea por relevancia con explicaciones

Ver [`docs/Agente.md`](docs/Agente.md) para la spec completa.

## Roadmap

- [ ] Integración real con APIs de portales (actualmente mock)
- [ ] Parsing de PDF con `pdf-parse`
- [ ] Auto-postulación con aprobación del usuario
- [ ] Notificaciones por email
- [ ] Análisis de brecha de skills
- [ ] Separar stacks dev y prod en ramas independientes

## Licencia

MIT
