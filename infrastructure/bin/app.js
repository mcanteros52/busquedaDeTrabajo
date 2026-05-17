#!/usr/bin/env node
'use strict';

const cdk = require('aws-cdk-lib');
const { AuthStack } = require('../lib/auth-stack');
const { StorageStack } = require('../lib/storage-stack');
const { BackendStack } = require('../lib/backend-stack');
const { FrontendStack } = require('../lib/frontend-stack');

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

const stackEnv = { account, region };
const stackPrefix = `JobMatch-${env}`;

// Stack 1: Auth (Cognito)
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, {
  env: stackEnv,
  stackName: `${stackPrefix}-Auth`,
  envName: env,
});

// Stack 2: Storage (DynamoDB + S3 + Secrets)
const storageStack = new StorageStack(app, `${stackPrefix}-Storage`, {
  env: stackEnv,
  stackName: `${stackPrefix}-Storage`,
  envName: env,
});

// Stack 3: Backend (Lambda + API Gateway)
const backendStack = new BackendStack(app, `${stackPrefix}-Backend`, {
  env: stackEnv,
  stackName: `${stackPrefix}-Backend`,
  envName: env,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  table: storageStack.table,
  cvBucket: storageStack.cvBucket,
  anthropicSecret: storageStack.anthropicSecret,
});

backendStack.addDependency(authStack);
backendStack.addDependency(storageStack);

// Stack 4: Frontend (Amplify)
const frontendStack = new FrontendStack(app, `${stackPrefix}-Frontend`, {
  env: stackEnv,
  stackName: `${stackPrefix}-Frontend`,
  envName: env,
  apiUrl: backendStack.apiUrl,
  userPoolId: authStack.userPool.userPoolId,
  userPoolClientId: authStack.userPoolClient.userPoolClientId,
});

frontendStack.addDependency(backendStack);

cdk.Tags.of(app).add('Project', 'JobMatchAgent');
cdk.Tags.of(app).add('Environment', env);
cdk.Tags.of(app).add('ManagedBy', 'CDK');