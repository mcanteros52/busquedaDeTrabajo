'use strict';

const { Stack, RemovalPolicy, Duration } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const s3 = require('aws-cdk-lib/aws-s3');
const secretsmanager = require('aws-cdk-lib/aws-secretsmanager');

class StorageStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { envName } = props;
    const isProd = envName === 'prod';

    // ─── DynamoDB Table (Single Table Design) ─────────────────────────────
    this.table = new dynamodb.Table(this, 'JobMatchTable', {
      tableName: `JobMatchAgent-${envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: isProd,
      timeToLiveAttribute: 'ttl',
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // GSI: buscar usuario por email
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI-email',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // GSI: top matches de un usuario rankeados por score
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI-matchScore',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'matchScore', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── S3 Bucket para CVs ───────────────────────────────────────────────
    this.cvBucket = new s3.Bucket(this, 'CVBucket', {
      bucketName: `jobmatch-cvs-${envName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: isProd
            ? ['https://your-domain.com']
            : ['http://localhost:5173', 'https://localhost:5173'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'archive-old-cvs',
          enabled: true,
          prefix: 'cvs/',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: Duration.days(90),
            },
          ],
          expiration: Duration.days(365),
        },
        {
          id: 'delete-old-exports',
          enabled: true,
          prefix: 'exports/',
          expiration: Duration.days(30),
        },
      ],
    });

    // ─── Secrets Manager ─────────────────────────────────────────────────
    this.anthropicSecret = new secretsmanager.Secret(this, 'AnthropicApiKey', {
      secretName: `jobmatch/${envName}/anthropic-api-key`,
      description: 'Anthropic Claude API Key for JobMatchAgent',
      // El valor se carga manualmente o via CDK context — nunca hardcodeado
    });
  }
}

module.exports = { StorageStack };
