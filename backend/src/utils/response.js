'use strict';

/**
 * Genera una respuesta HTTP estándar para API Gateway
 * CORS y headers de seguridad incluidos
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

function getOriginHeader(requestOrigin) {
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  // Si no está en whitelist, no devolver el origin (bloquea CORS)
  return ALLOWED_ORIGINS[0];
}

function response(statusCode, body, requestOrigin = '') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': getOriginHeader(requestOrigin),
      'Access-Control-Allow-Credentials': 'true',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
    body: JSON.stringify(body),
  };
}

function ok(data, requestOrigin) {
  return response(200, { success: true, data }, requestOrigin);
}

function created(data, requestOrigin) {
  return response(201, { success: true, data }, requestOrigin);
}

function badRequest(message, requestOrigin) {
  return response(400, { success: false, error: message }, requestOrigin);
}

function unauthorized(requestOrigin) {
  return response(401, { success: false, error: 'Unauthorized' }, requestOrigin);
}

function forbidden(requestOrigin) {
  return response(403, { success: false, error: 'Forbidden' }, requestOrigin);
}

function notFound(requestOrigin) {
  return response(404, { success: false, error: 'Not found' }, requestOrigin);
}

function serverError(requestOrigin) {
  return response(500, { success: false, error: 'Internal server error' }, requestOrigin);
}

/**
 * Extrae el userId del JWT validado por Cognito Authorizer
 * El authorizer de API Gateway inyecta el sub del token en requestContext
 */
function getUserId(event) {
  try {
    return event.requestContext.authorizer.claims.sub;
  } catch {
    return null;
  }
}

module.exports = { ok, created, badRequest, unauthorized, forbidden, notFound, serverError, getUserId };
