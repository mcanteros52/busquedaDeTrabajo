# Producto — JobMatchAgent

## Descripción del Producto

**JobMatchAgent** es una aplicación web que ayuda a profesionales a encontrar trabajo de forma inteligente. El usuario sube su CV una sola vez, y el sistema construye un perfil personalizado, busca automáticamente en múltiples portales de empleo, y presenta las oportunidades más relevantes rankeadas por compatibilidad.

---

## Problema que Resuelve

Buscar trabajo es agotador:
- Hay que registrarse en múltiples portales
- Las búsquedas manuales son imprecisas o genéricas
- Es difícil saber qué tan bien aplica tu perfil a cada oferta
- Se pierde tiempo revisando ofertas que no son relevantes

**JobMatchAgent automatiza y personaliza todo ese proceso.**

---

## Propuesta de Valor

| Para el usuario         | El sistema...                                              |
|-------------------------|------------------------------------------------------------|
| Sube el CV una vez      | Extrae skills, experiencia y perfil automáticamente        |
| Ve resultados rankeados | Muestra % de match y razón de cada recomendación           |
| Explora con filtros     | Filtra por modalidad, seniority, industria, salario        |
| Postula con contexto    | Genera carta de presentación personalizada para cada oferta|

---

## Usuarios Objetivo

### Perfil Primario
- Profesionales IT y tecnología en Argentina/LATAM
- Rango de experiencia: 2–15 años
- Buscan trabajo activamente o están en exploración pasiva
- Familiarizados con herramientas digitales

### Perfil Secundario
- Recién graduados con primer CV
- Profesionales de otras industrias (admin, finanzas, RRHH)

---

## Funcionalidades — MVP

### F1: Registro y Autenticación
- Registro con email/contraseña
- Login con Google (OAuth 2.0)
- Recuperación de contraseña por email

### F2: Upload y Procesamiento de CV
- Sube CV en formato PDF (máx. 5MB)
- El agente extrae: nombre, experiencia, skills, tecnologías, educación
- El usuario puede revisar y editar el perfil extraído
- Indicador de progreso durante el procesamiento

### F3: Configuración de Búsqueda
- Definir rol objetivo (si no fue detectado del CV)
- Seleccionar portales a consultar
- Filtros: modalidad (remoto/híbrido/presencial), país/provincia, seniority
- Guardado de preferencias de búsqueda

### F4: Resultados y Matching
- Grid de tarjetas con trabajos sugeridos
- Badge de score (color: verde >80, amarillo 60–79, gris <60)
- Razón del match (tooltip o sección expandible)
- Ordenar por: relevancia, fecha, empresa
- Filtros en tiempo real
- Link directo a la oferta en el portal original

### F5: Generación de Carta de Presentación
- Seleccionar un trabajo del listado
- Generar carta personalizada (máx. 350 palabras)
- Editar antes de usar
- Copiar al portapapeles o descargar .txt

### F6: Historial de Búsquedas
- Ver búsquedas anteriores
- Re-ejecutar una búsqueda con el mismo perfil
- Comparar resultados en el tiempo

---

## Funcionalidades — Roadmap v2

| Funcionalidad                  | Prioridad |
|--------------------------------|-----------|
| Auto-postulación con aprobación| Alta      |
| Notificaciones por email       | Alta      |
| Tracking de postulaciones      | Media     |
| Análisis de brecha de skills   | Media     |
| Múltiples CVs/perfiles         | Media     |
| Integración con LinkedIn       | Baja      |
| App móvil (React Native)       | Baja      |

---

## User Journey Principal

```
[Landing Page]
      │
      ▼ Registro/Login
[Dashboard vacío]
      │
      ▼ "Subir mi CV"
[Upload CV]
      │ (procesando...)
      ▼
[Revisar Perfil] ← editar si necesario
      │
      ▼ "Buscar trabajos"
[Configurar búsqueda]
      │ (buscando en portales...)
      ▼
[Resultados rankeados]
      │
      ├──▶ Ver detalle / ir al portal
      │
      └──▶ Generar carta de presentación
```

---

## Pantallas de la Aplicación

### 1. Landing Page
- Hero con propuesta de valor
- CTA: "Empezar gratis"
- Cómo funciona (3 pasos)
- No requiere login

### 2. Auth (Cognito Hosted UI / Custom)
- Login / Registro
- Forgot password

### 3. Dashboard
- Estado del perfil (con foto opcional)
- Última búsqueda ejecutada (resumen de N resultados)
- Accesos rápidos: nueva búsqueda, editar perfil, historial

### 4. CV Upload
- Dropzone con drag & drop
- Progress bar de procesamiento
- Vista previa del perfil extraído (editable)

### 5. Búsqueda
- Panel de configuración con filtros
- Botón "Buscar ahora"
- Loading state animado (simulando consulta a portales)

### 6. Resultados
- Header con resumen: "Se encontraron X trabajos — Y con >80% match"
- Barra de filtros horizontal
- Grid de tarjetas de trabajos
- Sidebar opcional con detalles del trabajo seleccionado

### 7. Carta de Presentación
- Vista de la oferta seleccionada
- Texto generado editable
- Botones: Copiar / Descargar / Regenerar

### 8. Perfil
- Información extraída del CV
- Edición inline de skills, experiencia, etc.
- Historial de CVs subidos

---

## Métricas de Éxito

| Métrica                             | Objetivo MVP    |
|-------------------------------------|-----------------|
| CVs procesados                      | >100/mes        |
| Búsquedas ejecutadas                | >500/mes        |
| Tasa de click en resultados         | >30%            |
| Tiempo de procesamiento CV          | <30 segundos    |
| NPS del producto                    | >40             |
| Tasa de retorno a la semana         | >25%            |

---

## Restricciones y No-Goals (MVP)

**No incluye en MVP:**
- Postulación automática sin confirmación
- Almacenamiento de contraseñas de portales
- Análisis de brecha de skills detallado
- Múltiples idiomas de interfaz (solo español)
- App móvil nativa

---

## Modelo de Negocio (propuesto)

| Plan       | Precio       | Límites                             |
|------------|--------------|-------------------------------------|
| Free       | $0           | 1 CV, 3 búsquedas/mes, 50 resultados|
| Pro        | $9.99 USD/mes| CVs ilimitados, búsquedas ilimitadas|
| Team       | A negociar   | Múltiples usuarios, analytics       |
