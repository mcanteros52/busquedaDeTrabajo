import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import amplifyConfig from './amplify-config';
import Dashboard from './pages/Dashboard';
import CVUpload from './pages/CVUpload';
import SearchPage from './pages/SearchPage';
import ResultsPage from './pages/ResultsPage';
import ProfilePage from './pages/ProfilePage';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout';
import './App.css';

Amplify.configure(amplifyConfig);

function AuthenticatedRoutes() {
  const { signOut, user } = useAuthenticator((context) => [context.user]);

  return (
    <Layout user={user} onSignOut={signOut}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/upload" element={<CVUpload />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/results/:matchId?" element={<ResultsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

function ProtectedApp() {
  return (
    <Authenticator
      loginMechanisms={['email']}
      signUpAttributes={['name']}
      formFields={{
        signIn: {
          username: { label: 'Email', placeholder: 'tu@email.com' },
        },
        signUp: {
          name: { label: 'Nombre completo', placeholder: 'Juan Pérez', order: 1 },
          email: { label: 'Email', placeholder: 'tu@email.com', order: 2 },
          password: { label: 'Contraseña', order: 3 },
          confirm_password: { label: 'Confirmar contraseña', order: 4 },
        },
      }}
    >
      <AuthenticatedRoutes />
    </Authenticator>
  );
}

export default function App() {
  return (
    <Authenticator.Provider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </BrowserRouter>
    </Authenticator.Provider>
  );
}
