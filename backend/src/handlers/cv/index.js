'use strict';

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const { docClient } = require('../../utils/dynamodb');
const { ok, created, badRequest, unauthorized, serverError, getUserId } = require('../../utils/response');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.TABLE_NAME;
const CV_BUCKET = process.env.CV_BUCKET;

// Schema de validación para solicitud de upload
const uploadSchema = Joi.object({
  fileName: Joi.string().pattern(/\.pdf$/i).max(255).required(),
  fileSize: Joi.number().integer().min(1).max(5 * 1024 * 1024).required(), // 5MB max
});

exports.handler = async (event) => {
  const origin = event.headers?.origin || '';

  try {
    const userId = getUserId(event);
    if (!userId) return unauthorized(origin);

    const httpMethod = event.httpMethod;

    // POST /cv — generar presigned URL para upload
    if (httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');

      const { error, value } = uploadSchema.validate(body);
      if (error) return badRequest(error.details[0].message, origin);

      const { fileName, fileSize } = value;
      const timestamp = Date.now();
      const cvId = uuidv4();
      const s3Key = `cvs/${userId}/${timestamp}-${cvId}.pdf`;

      // Generar presigned URL para que el frontend suba directamente a S3
      const putCommand = new PutObjectCommand({
        Bucket: CV_BUCKET,
        Key: s3Key,
        ContentType: 'application/pdf',
        ContentLength: fileSize,
        // Metadata para trazabilidad
        Metadata: {
          'user-id': userId,
          'cv-id': cvId,
          'original-name': encodeURIComponent(fileName),
        },
      });

      const presignedUrl = await getSignedUrl(s3Client, putCommand, {
        expiresIn: 900, // 15 minutos
      });

      // Registrar metadatos del CV en DynamoDB (estado: pending)
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: `CV#${timestamp}`,
          cvId,
          userId,
          s3Key,
          originalName: fileName,
          fileSize,
          status: 'pending', // pending → processing → ready → failed
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // TTL de 90 días para CVs inactivos
          ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
        },
        // Condición de seguridad: no sobreescribir
        ConditionExpression: 'attribute_not_exists(PK)',
      }));

      return created(
        {
          cvId,
          uploadUrl: presignedUrl,
          s3Key,
          expiresIn: 900,
        },
        origin
      );
    }

    return badRequest('Method not allowed', origin);
  } catch (err) {
    console.error('CVHandler error:', JSON.stringify({ error: err.message, stack: err.stack }));
    return serverError(origin);
  }
};
