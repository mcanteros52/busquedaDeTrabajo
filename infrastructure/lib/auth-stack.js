'use strict';

const { Stack, RemovalPolicy, Duration } = require('aws-cdk-lib');
const cognito = require('aws-cdk-lib/aws-cognito');

class AuthStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { envName } = props;
    const isProd = envName === 'prod';

    // ─── Cognito User Pool ────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `jobmatch-users-${envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: false, mutable: true },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      // Advanced Security Mode (requires paid tier in prod)
      // advancedSecurityMode: isProd ? cognito.AdvancedSecurityMode.ENFORCED : cognito.AdvancedSecurityMode.OFF,
    });

    // ─── User Pool Client ─────────────────────────────────────────────────
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `jobmatch-web-${envName}`,
      generateSecret: false, // SPA — no secret
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: isProd
          ? ['https://your-domain.com/callback']
          : ['http://localhost:5173/callback', 'https://localhost:5173/callback'],
        logoutUrls: isProd
          ? ['https://your-domain.com/logout']
          : ['http://localhost:5173/logout'],
      },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // ─── Identity Pool ────────────────────────────────────────────────────
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: `jobmatch_identity_${envName}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName,
        },
      ],
    });
  }
}

module.exports = { AuthStack };
