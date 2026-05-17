'use strict';

const { QueryCommand } = require('@aws-sdk/lib-dynamodb');
const Joi = require('joi');
const { docClient } = require('../../utils/dynamodb');
const { ok, badRequest, unauthorized, serverError, getUserId } = require('../../utils/response');

const TABLE_NAME = process.env.TABLE_NAME;

const querySchema = Joi.object({
  matchId: Joi.string().uuid().optional(),
  limit: Joi.number().integer().min(1).max(50).default(20),
  minScore: Joi.number().min(0).max(100).default(0),
  lastKey: Joi.string().optional(), // para paginación
});

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';

  try {
    const userId = getUserId(event);
    if (!userId) return unauthorized(origin);

    const queryParams = event.queryStringParameters || {};
    const { error, value } = querySchema.validate(queryParams);
    if (error) return badRequest(error.details[0].message, origin);

    const { matchId, limit, minScore, lastKey } = value;

    // Recuperar historial de matches del usuario
    const queryResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      FilterExpression: matchId ? 'matchId = :matchId' : undefined,
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'MATCH#',
        ...(matchId ? { ':matchId': matchId } : {}),
      },
      Limit: limit,
      ScanIndexForward: false, // más recientes primero
      ExclusiveStartKey: lastKey
        ? JSON.parse(Buffer.from(lastKey, 'base64').toString('utf-8'))
        : undefined,
    }));

    // Filtrar por score mínimo
    const matches = (queryResult.Items || [])
      .map(item => ({
        matchId: item.matchId,
        createdAt: item.createdAt,
        searchConfig: item.searchConfig,
        summary: item.result?.summary,
        totalResults: item.result?.results?.length || 0,
        topScore: item.result?.results?.[0]?.match_score || 0,
        results: (item.result?.results || []).filter(r => r.match_score >= minScore),
      }));

    // Cursor de paginación (base64 encoded DynamoDB key)
    const nextKey = queryResult.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(queryResult.LastEvaluatedKey)).toString('base64')
      : null;

    return ok(
      {
        matches,
        count: matches.length,
        nextKey,
        hasMore: !!nextKey,
      },
      origin
    );
  } catch (err) {
    console.error('JobHandler error:', JSON.stringify({ error: err.message, stack: err.stack }));
    return serverError(origin);
  }
};
