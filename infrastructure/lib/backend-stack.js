'use strict';

const { Stack, Duration, CfnOutput } = require('aws-cdk-lib');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const iam = require('aws-cdk-lib/aws-iam');
const logs = require('aws-cdk-lib/aws-logs');
const cognito = require('aws-cdk-lib/aws-cognito');
const path = require('path');

class BackendStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { envName, userPool, userPoolClient, table, cvBucket, anthropicSecret } = props;
    const isProd = envName === 'prod';

    // ─── Shared Lambda Environment ────────────────────────────────────────
    const sharedEnv = {
      TABLE_NAME: table.tableName,
      CV_BUCKET: cvBucket.bucketName,
      ANTHROPIC_SECRET_ARN: anthropicSecret.secretArn,
      ENV: envName,
      NODE_OPTIONS: '--enable-source-maps',
    };

    // ─── Lambda: CV Handler ───────────────────────────────────────────────
    const cvHandler = new lambda.Function(this, 'CVHandler', {
      functionName: `jobmatch-cv-${envName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/src/handlers/cv')),
      environment: sharedEnv,
      timeout: Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Permisos mínimos para cvHandler
    cvBucket.grantPut(cvHandler);
    table.grantReadWriteData(cvHandler);
    anthropicSecret.grantRead(cvHandler);

    // ─── Lambda: Agent Handler ────────────────────────────────────────────
    const agentHandler = new lambda.Function(this, 'AgentHandler', {
      functionName: `jobmatch-agent-${envName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/src/handlers/agent')),
      environment: sharedEnv,
      timeout: Duration.seconds(300),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    cvBucket.grantRead(agentHandler);
    table.grantReadWriteData(agentHandler);
    anthropicSecret.grantRead(agentHandler);

    // ─── Lambda: Profile Handler ──────────────────────────────────────────
    const profileHandler = new lambda.Function(this, 'ProfileHandler', {
      functionName: `jobmatch-profile-${envName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/src/handlers/profile')),
      environment: sharedEnv,
      timeout: Duration.seconds(10),
      memorySize: 128,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    table.grantReadWriteData(profileHandler);

    // ─── Lambda: Jobs Handler ─────────────────────────────────────────────
    const jobHandler = new lambda.Function(this, 'JobHandler', {
      functionName: `jobmatch-jobs-${envName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/src/handlers/jobs')),
      environment: sharedEnv,
      timeout: Duration.seconds(15),
      memorySize: 128,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    table.grantReadData(jobHandler);

    // ─── API Gateway ──────────────────────────────────────────────────────
    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/aws/apigateway/jobmatch-${envName}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    const api = new apigateway.RestApi(this, 'JobMatchApi', {
      restApiName: `jobmatch-api-${envName}`,
      description: 'JobMatchAgent REST API',
      deployOptions: {
        stageName: envName,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
        throttlingBurstLimit: 50,
        throttlingRateLimit: 20,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: isProd
          ? ['https://your-domain.com']
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        maxAge: Duration.hours(1),
      },
    });

    // ─── Cognito Authorizer ───────────────────────────────────────────────
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    const authOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ─── Routes ───────────────────────────────────────────────────────────
    // /cv
    const cvResource = api.root.addResource('cv');
    cvResource.addMethod('POST', new apigateway.LambdaIntegration(cvHandler), authOptions);

    // /profile
    const profileResource = api.root.addResource('profile');
    profileResource.addMethod('GET', new apigateway.LambdaIntegration(profileHandler), authOptions);
    profileResource.addMethod('PUT', new apigateway.LambdaIntegration(profileHandler), authOptions);

    // /match
    const matchResource = api.root.addResource('match');
    matchResource.addMethod('POST', new apigateway.LambdaIntegration(agentHandler), authOptions);

    // /jobs
    const jobsResource = api.root.addResource('jobs');
    jobsResource.addMethod('GET', new apigateway.LambdaIntegration(jobHandler), authOptions);

    // /user/me (DELETE — baja de cuenta)
    const userResource = api.root.addResource('user');
    const meResource = userResource.addResource('me');
    meResource.addMethod('DELETE', new apigateway.LambdaIntegration(profileHandler), authOptions);
    meResource.addMethod('GET', new apigateway.LambdaIntegration(profileHandler), authOptions);

    // ─── Outputs ──────────────────────────────────────────────────────────
    this.apiUrl = api.url;

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      exportName: `JobMatch-${envName}-ApiUrl`,
    });
  }
}

module.exports = { BackendStack };