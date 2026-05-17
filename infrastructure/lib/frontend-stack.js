'use strict';

const { Stack, CfnOutput } = require('aws-cdk-lib');
const amplify = require('@aws-cdk/aws-amplify-alpha');
const codebuild = require('aws-cdk-lib/aws-codebuild');
const iam = require('aws-cdk-lib/aws-iam');

class FrontendStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { envName, apiUrl, userPoolId, userPoolClientId } = props;

    // ─── Amplify App ──────────────────────────────────────────────────────
    const amplifyApp = new amplify.App(this, 'AmplifyApp', {
      appName: `jobmatch-frontend-${envName}`,
      description: 'JobMatchAgent React Frontend',
      // Para conectar con GitHub, configurar el token en Secrets Manager
      // y pasarlo aquí vía sourceCodeProvider
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '1.0',
        frontend: {
          phases: {
            preBuild: {
              commands: ['cd frontend', 'npm ci'],
            },
            build: {
              commands: ['npm run build'],
            },
          },
          artifacts: {
            baseDirectory: 'frontend/dist',
            files: ['**/*'],
          },
          cache: {
            paths: ['frontend/node_modules/**/*'],
          },
        },
      }),
      environmentVariables: {
        VITE_API_URL: apiUrl,
        VITE_COGNITO_USER_POOL_ID: userPoolId,
        VITE_COGNITO_CLIENT_ID: userPoolClientId,
        VITE_AWS_REGION: this.region,
        _LIVE_UPDATES: JSON.stringify([
          { name: 'Amplify CLI', pkg: '@aws-amplify/cli', type: 'npm', version: 'latest' },
        ]),
      },
    });

    // ─── Branch main ─────────────────────────────────────────────────────
    const mainBranch = amplifyApp.addBranch('main', {
      branchName: 'main',
      stage: envName === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT',
      autoBuild: true,
    });

    new CfnOutput(this, 'AmplifyAppId', {
      value: amplifyApp.appId,
      exportName: `JobMatch-${envName}-AmplifyAppId`,
    });

    new CfnOutput(this, 'AmplifyUrl', {
      value: `https://${mainBranch.branchName}.${amplifyApp.defaultDomain}`,
      exportName: `JobMatch-${envName}-AmplifyUrl`,
    });
  }
}

module.exports = { FrontendStack };
