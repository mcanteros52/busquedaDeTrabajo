// src/amplify-config.js
// Configuración de AWS Amplify — los valores se inyectan desde variables de entorno
// (definidas en CDK y en .env.local para desarrollo)

const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
      },
    },
  },
};

export default amplifyConfig;
