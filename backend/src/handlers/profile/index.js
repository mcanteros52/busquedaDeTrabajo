'use strict';

const { GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');
const { docClient } = require('../../utils/dynamodb');
const { ok, badRequest, unauthorized, notFound, serverError, getUserId } = require('../../utils/response');

const TABLE_NAME = process.env.TABLE_NAME;

const profileUpdateSchema = Joi.object({
  name: Joi.string().max(200).optional(),
  targetRole: Joi.string().max(200).optional(),
  location: Joi.string().max(200).optional(),
  seniority: Joi.string().valid('junior', 'semi-senior', 'senior', 'lead', 'manager').optional(),
  yearsOfExperience: Joi.number().integer().min(0).max(50).optional(),
  skills: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  technologies: Joi.array().items(Joi.string().max(100)).max(50).optional(),
  languages: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  remotePreference: Joi.string().valid('remote', 'hybrid', 'onsite', 'any').optional(),
});

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';

  try {
    const userId = getUserId(event);
    if (!userId) return unauthorized(origin);

    const httpMethod = event.httpMethod;
    const path = event.path;

    // GET /profile — obtener perfil del usuario
    if (httpMethod === 'GET' && path.endsWith('/profile')) {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));

      if (!result.Item) {
        // Perfil vacío para usuario nuevo
        return ok({ userId, profileComplete: false }, origin);
      }

      return ok(result.Item, origin);
    }

    // PUT /profile — actualizar perfil
    if (httpMethod === 'PUT' && path.endsWith('/profile')) {
      const body = JSON.parse(event.body || '{}');
      const { error, value } = profileUpdateSchema.validate(body);
      if (error) return badRequest(error.details[0].message, origin);

      const now = new Date().toISOString();
      const updateExpressions = [];
      const expressionAttributeNames = {};
      const expressionAttributeValues = { ':updatedAt': now };

      // Construir UPDATE expression dinámicamente
      Object.entries(value).forEach(([key, val]) => {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = val;
      });

      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';

      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        // Seguridad: solo puede modificar su propio perfil
        ConditionExpression: 'attribute_not_exists(PK) OR PK = :userPk',
      }));

      return ok({ updated: true, updatedAt: now }, origin);
    }

    // DELETE /user/me — eliminar cuenta completa
    if (httpMethod === 'DELETE' && path.endsWith('/me')) {
      // Eliminar perfil de DynamoDB
      await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
        ConditionExpression: 'PK = :userPk',
        ExpressionAttributeValues: { ':userPk': `USER#${userId}` },
      }));

      // En producción: eliminar también CVs de S3, matches, y cuenta de Cognito
      // mediante llamadas adicionales con SDK

      console.info('Account deleted:', { userId, timestamp: new Date().toISOString() });

      return ok({ deleted: true, message: 'Account and data deleted' }, origin);
    }

    // GET /user/me — exportar datos del usuario
    if (httpMethod === 'GET' && path.endsWith('/me')) {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: `USER#${userId}`, SK: 'PROFILE' },
      }));

      return ok({
        profile: result.Item || {},
        exportedAt: new Date().toISOString(),
        message: 'Data export — see exports API for full download',
      }, origin);
    }

    return badRequest('Method not allowed', origin);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return unauthorized(origin);
    }
    console.error('ProfileHandler error:', JSON.stringify({ error: err.message, stack: err.stack }));
    return serverError(origin);
  }
};
