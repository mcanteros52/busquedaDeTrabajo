# Arquitectura Técnica — JobMatchAgent

## Stack Tecnológico

| Capa              | Tecnología                          |
|-------------------|-------------------------------------|
| Frontend          | React (Vite) + Amplify Hosting      |
| Autenticación     | Amazon Cognito (User Pools + OAuth) |
| API               | API Gateway (REST) + Lambda         |
| Agente IA         | Anthropic Claude (via Lambda)       |
| Base de datos     | Amazon DynamoDB (on-demand)         |
| Almacenamiento    | Amazon S3 (CVs, resultados)         |
| IaC               | AWS CDK v2 (JavaScript/Node.js)     |
| CI/CD             | GitHub Actions                      |
| Observabilidad    | CloudWatch Logs + X-Ray             |
| Secrets           | AWS Secrets Manager                 |

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USUARIO (Browser)                              │
│                    React SPA — Amplify Hosting                          │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Amazon Cognito User Pool                              │
│              (JWT tokens — OAuth 2.0 / PKCE)                           │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │ Bearer Token
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              API Gateway (REST API — Regional)                          │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ POST /cv   │  │ GET /jobs  │  │ POST /match   │  │ GET /profile  │  │
│  └─────┬──────┘  └─────┬──────┘  └───────┬───────┘  └───────┬───────┘  │
└────────┼───────────────┼─────────────────┼───────────────────┼──────────┘
         │               │                 │                   │
         ▼               ▼                 ▼                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AWS Lambda Functions                            │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────┐  │
│  │  cvHandler   │  │  jobHandler  │  │      agentHandler           │  │
│  │  (Node.js)   │  │  (Node.js)   │  │  (Anthropic API + Tools)    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬──────────────┘  │
└─────────┼─────────────────┼────────────────────────┼──────────────────┘
          │                 │                         │
     ┌────▼────┐      ┌─────▼─────┐          ┌───────▼────────┐
     │   S3    │      │ DynamoDB  │          │ Secrets Manager│
     │  (CVs)  │      │(profiles/ │          │(Anthropic Key) │
     └─────────┘      │  jobs/    │          └────────────────┘
                      │  matches) │
                      └───────────┘
                           │
                     ┌─────▼──────────┐
                     │ Portales        │
                     │ LinkedIn/Indeed │
                     │ Computrabajo    │
                     │ GetOnBoard      │
                     └────────────────┘
```

---

## Modelo de Datos DynamoDB

### Tabla: `JobMatchAgent-{env}`

Diseño de tabla única (Single Table Design):

#### Entidades y Patrones de Acceso

| PK                  | SK                        | Entidad         | Descripción                        |
|---------------------|---------------------------|-----------------|------------------------------------|
| `USER#{userId}`     | `PROFILE`                 | UserProfile     | Perfil del candidato               |
| `USER#{userId}`     | `CV#{timestamp}`          | CVDocument      | Metadatos del CV subido            |
| `USER#{userId}`     | `MATCH#{matchId}`         | MatchResult     | Resultado de una búsqueda          |
| `MATCH#{matchId}`   | `JOB#{jobId}`             | JobListing      | Trabajo individual dentro de match |
| `PORTAL#{portal}`   | `CACHE#{queryHash}`       | SearchCache     | Cache de resultados de portales    |

#### Índices Secundarios (GSI)

| GSI Name         | PK                | SK              | Proyección | Uso                              |
|------------------|-------------------|-----------------|------------|----------------------------------|
| `GSI-email`      | `email`           | `USER#{userId}` | KEYS_ONLY  | Buscar usuario por email         |
| `GSI-matchScore` | `USER#{userId}`   | `matchScore`    | ALL        | Top matches de un usuario        |
| `GSI-portal`     | `portal`          | `postedAt`      | ALL        | Trabajos recientes por portal    |

#### Atributos de Tiempo de Vida (TTL)
- `SearchCache`: TTL = 4 horas
- `MatchResult` con score < 50: TTL = 7 días

---

## Almacenamiento S3

### Bucket: `jobmatch-cvs-{env}-{accountId}`

```
/cvs/
  /{userId}/
    /{timestamp}-{originalName}.pdf    ← CV original cifrado en S3
    /{timestamp}-parsed.json           ← Perfil extraído en JSON

/exports/
  /{userId}/
    /{matchId}-results.json            ← Exportación de resultados
```

**Políticas:**
- Bucket privado (no public access)
- SSE-S3 encryption por defecto
- Lifecycle: CVs > 90 días → Glacier; > 365 días → Delete
- Presigned URLs para upload/download (TTL: 15 minutos)

---

## Flujo de Autenticación

```
1. Usuario abre la app
2. Amplify detecta sesión expirada → redirect a Cognito Hosted UI
3. Usuario ingresa email/password (o Google OAuth)
4. Cognito devuelve: AccessToken + IdToken + RefreshToken
5. Amplify almacena tokens en localStorage (httpOnly recomendado en v2)
6. Cada request a API Gateway incluye: Authorization: Bearer {AccessToken}
7. API Gateway valida JWT contra Cognito JWKS endpoint
8. Si válido → invoca Lambda con context.identity.cognitoIdentityId
```

### Cognito User Pool Config
- MFA: Opcional (TOTP)
- Password policy: mín 8 chars, mayúscula, número, símbolo
- Token validity: Access=1h, Refresh=30 días
- Triggers: Pre-signup (validación dominio), Post-confirm (crear perfil en DynamoDB)

---

## Lambda Functions

### `cvHandler`
- **Trigger:** POST /cv (multipart/form-data)
- **Acción:** Genera presigned URL para S3, guarda metadatos en DynamoDB
- **Runtime:** Node.js 20.x
- **Memory:** 256 MB | **Timeout:** 30s

### `agentHandler`
- **Trigger:** POST /match
- **Acción:** Invoca Anthropic API con tool use (parseCV + searchPortals + matchJobs)
- **Runtime:** Node.js 20.x
- **Memory:** 512 MB | **Timeout:** 300s (5 min)
- **Concurrencia reservada:** 10

### `profileHandler`
- **Trigger:** GET/PUT /profile
- **Acción:** CRUD de perfil de candidato en DynamoDB
- **Runtime:** Node.js 20.x
- **Memory:** 128 MB | **Timeout:** 10s

### `jobHandler`
- **Trigger:** GET /jobs
- **Acción:** Devuelve resultados de la última búsqueda paginados
- **Runtime:** Node.js 20.x
- **Memory:** 128 MB | **Timeout:** 15s

---

## CDK Stacks

### Stack 1: `NetworkStack` (base)
- VPC (opcional para Lambdas en VPC)
- Security Groups

### Stack 2: `AuthStack`
- Cognito User Pool
- Cognito App Client
- Identity Pool

### Stack 3: `StorageStack`
- DynamoDB Table (on-demand, PAY_PER_REQUEST)
- S3 Bucket (CVs)
- Secrets Manager (Anthropic API Key)

### Stack 4: `BackendStack`
- Lambda Functions (x4)
- API Gateway REST API
- IAM Roles/Policies (least privilege)
- CloudWatch Log Groups
- X-Ray tracing

### Stack 5: `FrontendStack`
- Amplify App
- Amplify Branch (main)
- Custom Domain (opcional)
- CloudFront + S3 para static assets

---

## CI/CD Pipeline (GitHub Actions)

```yaml
Workflow: deploy.yml
Triggers: push to main / pull_request

Jobs:
  1. test        → npm test (unit + integration)
  2. lint        → eslint + prettier
  3. security    → npm audit + snyk scan
  4. cdk-diff    → cdk diff (en PRs)
  5. cdk-deploy  → cdk deploy --all (en main)
  6. e2e         → Playwright tests post-deploy
```

---

## Seguridad

| Control                        | Implementación                                     |
|--------------------------------|----------------------------------------------------|
| Autenticación                  | Cognito JWT (RS256)                                |
| Autorización API               | Cognito Authorizer en API Gateway                  |
| Cifrado en tránsito            | TLS 1.2+ obligatorio                               |
| Cifrado en reposo              | DynamoDB SSE (AWS managed) + S3 SSE-S3             |
| Secretos                       | Secrets Manager (no env vars para API keys)        |
| IAM Least Privilege            | Cada Lambda tiene rol con permisos mínimos         |
| CORS                           | Origins whitelistados, no `*`                      |
| Rate Limiting                  | API Gateway Usage Plans (1000 req/día por user)    |
| Input Validation               | Joi schemas en cada Lambda                         |
| XSS Protection                 | CSP headers via CloudFront                         |
| Audit Logs                     | CloudTrail habilitado                              |

---

## Costos Estimados (baseline mensual — uso moderado)

| Servicio        | Estimación          |
|-----------------|---------------------|
| Lambda          | ~$0.50 (500K inv.)  |
| DynamoDB        | ~$2.00 (on-demand)  |
| API Gateway     | ~$1.50 (1M req.)    |
| S3              | ~$0.50 (10GB)       |
| Cognito         | $0 (< 50K MAU)      |
| Amplify Hosting | ~$1.00              |
| Secrets Manager | ~$0.40 (2 secrets)  |
| **Total**       | **~$6 USD/mes**     |

---

## Ambientes

| Ambiente | Branch  | Stack Suffix | Auto-deploy |
|----------|---------|--------------|-------------|
| dev      | develop | `-dev`       | Sí          |
| staging  | staging | `-staging`   | Sí          |
| prod     | main    | `-prod`      | Con approval|
