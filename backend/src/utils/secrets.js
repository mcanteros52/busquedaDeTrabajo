'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Cache en memoria para evitar llamadas repetidas en la misma ejecución Lambda
const cache = new Map();

async function getSecret(secretArn) {
  if (cache.has(secretArn)) {
    return cache.get(secretArn);
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await client.send(command);

  let value;
  if (response.SecretString) {
    try {
      value = JSON.parse(response.SecretString);
    } catch {
      value = response.SecretString;
    }
  } else {
    value = Buffer.from(response.SecretBinary, 'base64').toString('ascii');
  }

  cache.set(secretArn, value);
  return value;
}

module.exports = { getSecret };
