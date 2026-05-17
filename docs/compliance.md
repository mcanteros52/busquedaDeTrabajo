# Compliance y Seguridad — JobMatchAgent

## Marco de Referencia

Este documento establece los controles de seguridad, privacidad y cumplimiento normativo aplicables al sistema JobMatchAgent. Se aplican los principios de:

- **OWASP Top 10** para seguridad en aplicaciones web
- **AWS Well-Architected Framework** (Security Pillar)
- **Ley 25.326 (Argentina)** — Protección de Datos Personales
- **GDPR** (para usuarios europeos, si aplica)
- **Shared Responsibility Model** de AWS

---

## 1. Gestión de Identidad y Acceso (IAM)

### 1.1 Principio de Mínimo Privilegio
Cada componente del sistema tiene permisos mínimos necesarios:

```
Lambda cvHandler         → s3:PutObject (bucket CVs, solo /cvs/{userId}/*)
                         → dynamodb:PutItem, GetItem (tabla JobMatch, solo USER#{cognitoSub})
                         → secretsmanager:GetSecretValue (lectura solo secreto propio)

Lambda agentHandler      → secretsmanager:GetSecretValue (Anthropic API Key)
                         → dynamodb:PutItem, GetItem, Query
                         → s3:GetObject (bucket CVs)

Lambda profileHandler    → dynamodb:GetItem, PutItem, UpdateItem (USER# prefix only)

API Gateway              → Cognito Authorizer (valida JWT antes de invocar Lambda)
```

### 1.2 Roles de Usuario

| Rol               | Permisos en la app                              |
|-------------------|-------------------------------------------------|
| `user` (default)  | CRUD de su propio perfil, CVs y búsquedas       |
| `admin`           | Ver métricas, gestionar usuarios, acceso a logs |

Los roles se asignan como atributo en Cognito User Pool.

### 1.3 Control de Acceso en DynamoDB
Todas las operaciones de Lambda verifican que `userId` del token JWT coincida con la partición `USER#{userId}` consultada. **Un usuario nunca puede acceder a datos de otro usuario.**

---

## 2. Autenticación

### 2.1 Cognito User Pool
- **Algoritmo de tokens:** RS256 (clave asimétrica, Cognito maneja rotación)
- **Access Token TTL:** 1 hora
- **Refresh Token TTL:** 30 días
- **ID Token TTL:** 1 hora

### 2.2 Política de Contraseñas
```
Longitud mínima: 8 caracteres
Requiere: mayúscula, minúscula, número, símbolo
Historial: no reutilizar las últimas 5 contraseñas
Bloqueo: 5 intentos fallidos → cuenta bloqueada 15 minutos (Cognito Advanced Security)
```

### 2.3 MFA
- Opcional para usuarios free
- Recomendado (con nudge en UI) para usuarios con datos sensibles
- TOTP compatible (Google Authenticator, Authy)

### 2.4 Social Login (Google OAuth)
- Scopes solicitados: `email`, `profile` (sin acceso a contactos, drive, etc.)
- Token almacenado en memory/secure storage, nunca en `localStorage` sin HTTPS

---

## 3. Protección de Datos Personales

### 3.1 Datos Recopilados

| Dato                              | Fuente         | Finalidad                    | Retención     |
|-----------------------------------|----------------|------------------------------|---------------|
| Nombre y email                    | Registro       | Autenticación                | Hasta baja    |
| Contenido del CV (PDF)            | Upload usuario | Extracción de perfil         | 90 días activo|
| Skills, experiencia, educación    | Extraído de CV | Matching de trabajos         | Hasta baja    |
| Búsquedas realizadas              | Sistema        | Historial / UX               | 180 días      |
| Resultados de matching            | Sistema        | Historial                    | 90 días       |
| Logs de acceso                    | CloudTrail     | Auditoría de seguridad       | 365 días      |

### 3.2 Cifrado

| Ubicación              | Método de cifrado                       |
|------------------------|-----------------------------------------|
| CVs en S3              | SSE-S3 (AES-256, gestionado por AWS)    |
| Datos en DynamoDB      | SSE con AWS managed key (AES-256)       |
| Tránsito API → Lambda  | TLS 1.2+ (obligatorio en API Gateway)   |
| Tránsito browser → CDN | TLS 1.3 (Amplify/CloudFront)            |
| API Key Anthropic      | Secrets Manager (no env vars)           |

### 3.3 Derecho al Olvido (GDPR / Ley 25.326)
- Endpoint `DELETE /user/me` disponible
- Elimina: perfil DynamoDB, CVs en S3, historial de matches
- Elimina la cuenta de Cognito
- Proceso completado en ≤ 72 horas
- Log de eliminación en CloudTrail (sin datos personales)

### 3.4 Portabilidad de Datos
- Endpoint `GET /user/export` devuelve ZIP con:
  - Perfil en JSON
  - CVs subidos
  - Historial de búsquedas y resultados

---

## 4. Seguridad de la Aplicación (OWASP Top 10)

### A01: Broken Access Control
✅ **Mitigado:** Cognito JWT + validación de `userId` en cada Lambda. DynamoDB conditions en PutItem/UpdateItem.

### A02: Cryptographic Failures
✅ **Mitigado:** TLS 1.2+ forzado. Cifrado en reposo en todos los servicios. Sin secretos hardcodeados.

### A03: Injection
✅ **Mitigado:** DynamoDB no tiene SQL. Parámetros de consulta validados con Joi. Sin `eval()` en Lambda.

### A04: Insecure Design
✅ **Mitigado:** Threat modeling documentado. Principio de mínimo privilegio. Separación de concerns por Lambda.

### A05: Security Misconfiguration
✅ **Mitigado:** S3 Block Public Access habilitado. API Gateway solo HTTPS. CORS configurado con origins específicos.

### A06: Vulnerable Components
⚠️ **Control activo:** `npm audit` en CI/CD. Dependabot habilitado en GitHub. Política de actualización mensual.

### A07: Auth and Session Failures
✅ **Mitigado:** Cognito maneja sesiones. Tokens de corta duración. Refresh token revocable.

### A08: Software and Data Integrity Failures
✅ **Mitigado:** GitHub Actions con pinned action versions. CDK verifica integridad de assets.

### A09: Security Logging and Monitoring
✅ **Mitigado:** CloudTrail habilitado. CloudWatch Logs con retención 365 días. Alarmas para errores 5xx y throttling.

### A10: Server-Side Request Forgery (SSRF)
✅ **Mitigado:** URLs de portales están en whitelist explícita. No se procesa input de URL del usuario directamente.

---

## 5. Seguridad del Frontend

### 5.1 Content Security Policy (CSP)
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline' fonts.googleapis.com;
  img-src 'self' data: https:;
  connect-src 'self' https://*.amazonaws.com https://api.anthropic.com;
  font-src 'self' fonts.gstatic.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

### 5.2 Otros Headers de Seguridad
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 5.3 Validación de Input
- Tipo de archivo permitido: `.pdf` únicamente
- Tamaño máximo: 5 MB
- Validación en frontend Y en Lambda (defense in depth)
- Sanitización de texto antes de enviar a Anthropic API

---

## 6. Gestión de Secretos

### 6.1 Inventario de Secretos

| Secreto                    | Almacenamiento     | Rotación       |
|----------------------------|--------------------|----------------|
| Anthropic API Key          | Secrets Manager    | Manual/anual   |
| LinkedIn API Key           | Secrets Manager    | Manual/anual   |
| Cognito Client Secret      | Secrets Manager    | Auto (Cognito) |

### 6.2 Reglas
- ❌ No secretos en variables de entorno de Lambda (excepto referencias a Secrets Manager ARN)
- ❌ No secretos en código fuente o en `.env` comiteados
- ✅ `.gitignore` incluye: `.env`, `.env.*`, `cdk.context.json` con valores sensibles
- ✅ GitHub Secrets para CI/CD (AWS credentials con permisos de deploy)

---

## 7. Monitoreo y Respuesta a Incidentes

### 7.1 Alarmas CloudWatch

| Alarma                              | Threshold     | Acción                |
|-------------------------------------|---------------|-----------------------|
| Lambda errors > 5%                  | 5 min window  | SNS → Email admin     |
| API Gateway 5xx > 10/min            | 5 min window  | SNS → Email admin     |
| DynamoDB throttled requests > 0     | Inmediato     | SNS → Email admin     |
| Cognito failed logins > 20/min      | 5 min window  | SNS → Email + revisar |
| S3 public access enabled            | Inmediato     | SNS → Email URGENTE   |

### 7.2 Clasificación de Incidentes

| Severidad | Descripción                                  | SLA Respuesta |
|-----------|----------------------------------------------|---------------|
| P1        | Brecha de datos / exposición de CVs          | 1 hora        |
| P2        | Servicio caído / autenticación rota          | 4 horas       |
| P3        | Degradación de performance                   | 24 horas      |
| P4        | Bug menor / UX issue                         | 72 horas      |

### 7.3 Plan de Respuesta a Brecha de Datos
1. Detectar vía CloudTrail / alarma
2. Revocar credenciales comprometidas (Cognito: invalidar tokens)
3. Aislar recurso afectado
4. Evaluar alcance (qué datos, cuántos usuarios)
5. Notificar usuarios afectados en ≤ 72 horas (obligatorio por Ley 25.326)
6. Post-mortem en 7 días

---

## 8. Checklist de Security Review (pre-deploy)

- [ ] `npm audit` sin vulnerabilidades críticas o altas
- [ ] Variables de entorno revisadas (no hay secretos directos)
- [ ] S3 Bucket: Block Public Access = true
- [ ] API Gateway: solo HTTPS habilitado
- [ ] CORS: origins explícitos (no `*`)
- [ ] Lambda: timeout configurado (no valores default)
- [ ] DynamoDB: encriptación habilitada
- [ ] CloudTrail: habilitado en región de deploy
- [ ] Cognito: política de contraseñas configurada
- [ ] Secrets Manager: todos los secretos cargados
- [ ] IAM Roles: revisados con IAM Access Analyzer
- [ ] CSP headers: configurados en CloudFront
- [ ] Alarmas CloudWatch: activas y testeadas
