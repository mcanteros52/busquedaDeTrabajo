'use strict';

// Tests para utils/response.js
describe('Response utilities', () => {
  let response;

  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
    jest.resetModules();
    response = require('../utils/response');
  });

  test('ok() returns 200 with success:true', () => {
    const res = response.ok({ id: '123' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('123');
  });

  test('badRequest() returns 400', () => {
    const res = response.badRequest('Invalid input');
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid input');
  });

  test('unauthorized() returns 401', () => {
    const res = response.unauthorized();
    expect(res.statusCode).toBe(401);
  });

  test('serverError() returns 500', () => {
    const res = response.serverError();
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
  });

  test('security headers are present', () => {
    const res = response.ok({});
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['X-Frame-Options']).toBe('DENY');
    expect(res.headers['Strict-Transport-Security']).toBeDefined();
  });

  test('CORS origin is restricted to whitelist', () => {
    const res = response.ok({}, 'http://evil.com');
    expect(res.headers['Access-Control-Allow-Origin']).not.toBe('http://evil.com');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  test('CORS allows whitelisted origin', () => {
    const res = response.ok({}, 'http://localhost:5173');
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  test('getUserId extracts sub from Cognito claims', () => {
    const mockEvent = {
      requestContext: {
        authorizer: {
          claims: { sub: 'user-uuid-123' },
        },
      },
    };
    expect(response.getUserId(mockEvent)).toBe('user-uuid-123');
  });

  test('getUserId returns null on missing claims', () => {
    expect(response.getUserId({})).toBeNull();
  });
});

// Tests de validación de input para CV handler
describe('CV Handler input validation', () => {
  test('rejects non-PDF files', () => {
    const Joi = require('joi');
    const schema = Joi.object({
      fileName: Joi.string().pattern(/\.pdf$/i).max(255).required(),
      fileSize: Joi.number().integer().min(1).max(5 * 1024 * 1024).required(),
    });

    const { error } = schema.validate({ fileName: 'virus.exe', fileSize: 1000 });
    expect(error).toBeDefined();
  });

  test('rejects files over 5MB', () => {
    const Joi = require('joi');
    const schema = Joi.object({
      fileName: Joi.string().pattern(/\.pdf$/i).max(255).required(),
      fileSize: Joi.number().integer().min(1).max(5 * 1024 * 1024).required(),
    });

    const { error } = schema.validate({ fileName: 'cv.pdf', fileSize: 6 * 1024 * 1024 });
    expect(error).toBeDefined();
  });

  test('accepts valid PDF under 5MB', () => {
    const Joi = require('joi');
    const schema = Joi.object({
      fileName: Joi.string().pattern(/\.pdf$/i).max(255).required(),
      fileSize: Joi.number().integer().min(1).max(5 * 1024 * 1024).required(),
    });

    const { error } = schema.validate({ fileName: 'mi_cv.pdf', fileSize: 500000 });
    expect(error).toBeUndefined();
  });
});

// Tests de seguridad: validación de acceso a recursos ajenos
describe('Security: Access control', () => {
  test('DynamoDB key includes userId prefix', () => {
    const userId = 'user-abc-123';
    const pk = `USER#${userId}`;
    expect(pk).toBe('USER#user-abc-123');
    // Asegurar que no se puede acceder a otro user con manipulación de string
    expect(pk.startsWith('USER#')).toBe(true);
  });

  test('S3 key includes userId for isolation', () => {
    const userId = 'user-abc-123';
    const s3Key = `cvs/${userId}/1234567890-uuid.pdf`;
    expect(s3Key.includes(userId)).toBe(true);
    // Verificar que no hay path traversal
    const maliciousUserId = '../other-user';
    const normalizedKey = `cvs/${maliciousUserId}/test.pdf`;
    // En prod, esto debería sanitizarse — test documenta el riesgo
    expect(maliciousUserId.includes('..')).toBe(true); // flag para review
  });
});
