# Agente de Búsqueda de Trabajo — Definición del Sistema

## Visión General

El **JobMatchAgent** es un agente de IA que automatiza la búsqueda de empleo. A partir de un CV subido por el usuario, construye un perfil semántico enriquecido y lo compara contra publicaciones de portales de trabajo, devolviendo sugerencias rankeadas por relevancia.

---

## Identidad del Agente

| Atributo        | Valor                                         |
|-----------------|-----------------------------------------------|
| Nombre          | JobMatchAgent                                 |
| Versión         | 1.0.0                                         |
| Modelo base     | Claude Sonnet (via Anthropic API)             |
| Rol             | Asistente de reclutamiento autónomo           |
| Lenguaje        | ES / EN (multilingüe)                         |

---

## Capacidades del Agente

### 1. Extracción de Perfil (CV → Profile)
- Recibe un PDF o texto de CV
- Extrae: nombre, experiencia, skills, tecnologías, años de experiencia, nivel educativo, idiomas, ubicación
- Produce un objeto JSON estructurado `CandidateProfile`
- Infiere rol objetivo si no está explícito

### 2. Búsqueda en Portales (Tool: `searchPortals`)
- Consulta APIs públicas de portales de trabajo (LinkedIn, Indeed, Computrabajo, GetOnBoard)
- Parámetros de búsqueda derivados del perfil: `role`, `skills[]`, `location`, `seniority`
- Paginación automática hasta N resultados configurables
- Rate limiting respetado por portal

### 3. Matching Semántico (Tool: `matchJobs`)
- Compara el perfil del candidato contra cada oferta laboral
- Calcula un `matchScore` (0–100) basado en:
  - Skills requeridos vs. skills del candidato (peso: 40%)
  - Seniority y años de experiencia (peso: 25%)
  - Industria / tecnologías clave (peso: 20%)
  - Ubicación / modalidad (remoto/híbrido/presencial) (peso: 15%)
- Genera `matchReason`: texto explicativo del score

### 4. Ranking y Recomendación
- Ordena resultados por `matchScore` descendente
- Filtra por umbral mínimo configurable (default: 60)
- Agrupa por: "Muy recomendado (>80)", "Buena coincidencia (60–79)", "Para explorar (<60)"

### 5. Generación de Resumen
- Por cada trabajo sugerido, genera un blurb personalizado: por qué aplica al perfil
- Opcionalmente redacta carta de presentación adaptada

---

## Herramientas (Tools) del Agente

```json
[
  {
    "name": "parseCV",
    "description": "Extrae información estructurada de un CV en PDF o texto plano",
    "input_schema": {
      "type": "object",
      "properties": {
        "cvContent": { "type": "string", "description": "Contenido textual del CV" }
      },
      "required": ["cvContent"]
    }
  },
  {
    "name": "searchPortals",
    "description": "Busca ofertas de trabajo en portales externos según un perfil",
    "input_schema": {
      "type": "object",
      "properties": {
        "role": { "type": "string" },
        "skills": { "type": "array", "items": { "type": "string" } },
        "location": { "type": "string" },
        "remoteOk": { "type": "boolean" },
        "portals": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["role", "skills"]
    }
  },
  {
    "name": "matchJobs",
    "description": "Calcula el score de coincidencia entre perfil y lista de trabajos",
    "input_schema": {
      "type": "object",
      "properties": {
        "profile": { "$ref": "#/definitions/CandidateProfile" },
        "jobs": { "type": "array", "items": { "$ref": "#/definitions/JobListing" } }
      },
      "required": ["profile", "jobs"]
    }
  },
  {
    "name": "generateCoverLetter",
    "description": "Redacta una carta de presentación personalizada para una oferta",
    "input_schema": {
      "type": "object",
      "properties": {
        "profile": { "$ref": "#/definitions/CandidateProfile" },
        "job": { "$ref": "#/definitions/JobListing" }
      },
      "required": ["profile", "job"]
    }
  }
]
```

---

## Flujo de Ejecución

```
Usuario sube CV
       │
       ▼
[parseCV] → CandidateProfile (JSON)
       │
       ▼
[searchPortals] → JobListing[] por portal
       │
       ▼
[matchJobs] → ScoredJobListing[] (con matchScore + matchReason)
       │
       ▼
Ranking + Agrupación → Response al usuario
       │
       ▼
(Opcional) [generateCoverLetter] para trabajos top
```

---

## Tipos de Datos

### CandidateProfile
```typescript
interface CandidateProfile {
  userId: string;
  name: string;
  email?: string;
  location: string;
  targetRole: string;
  seniority: 'junior' | 'semi-senior' | 'senior' | 'lead' | 'manager';
  yearsOfExperience: number;
  skills: string[];
  technologies: string[];
  languages: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  remotePreference: 'remote' | 'hybrid' | 'onsite' | 'any';
  createdAt: string;
  updatedAt: string;
}
```

### JobListing
```typescript
interface JobListing {
  id: string;
  portal: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  description: string;
  requiredSkills: string[];
  seniority?: string;
  salary?: string;
  url: string;
  postedAt: string;
  matchScore?: number;
  matchReason?: string;
}
```

---

## Portales Soportados (v1)

| Portal       | Método       | Auth requerida | Región       |
|--------------|--------------|----------------|--------------|
| LinkedIn     | API/Scraping | OAuth          | Global       |
| Indeed       | API pública  | API Key        | Global       |
| Computrabajo | Scraping     | No             | LATAM        |
| GetOnBoard   | API pública  | No             | LATAM        |
| Bumeran      | Scraping     | No             | Argentina    |

---

## Limitaciones y Consideraciones Éticas

- El agente **no postula automáticamente** sin confirmación del usuario
- Datos del CV almacenados cifrados (AES-256 en reposo)
- Scraping respeta `robots.txt` y rate limits de los portales
- No se almacenan contraseñas de portales de terceros
- Resultados son sugerencias, no decisiones definitivas

---

## Evolución Futura (v2+)

- Auto-postulación con confirmación por email
- Tracking del estado de postulaciones (aplicado / en proceso / rechazado)
- Alertas de nuevas búsquedas por email/SMS
- Integración con calendario para agendar entrevistas
- Análisis de brecha de skills vs. mercado
