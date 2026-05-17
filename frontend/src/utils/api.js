// src/utils/api.js
import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  timeout: 310000, // 310s para el agente que puede tardar hasta 5min
});

// Interceptor: inyectar token JWT en cada request
api.interceptors.request.use(async (config) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.accessToken?.toString();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('Could not get auth token:', err.message);
  }
  return config;
});

// Interceptor: manejo centralizado de errores
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado — Amplify lo maneja con refresh automático
      window.location.href = '/login';
    }
    return Promise.reject(error.response?.data || error);
  }
);

export const cvAPI = {
  requestUploadUrl: (fileName, fileSize) =>
    api.post('/cv', { fileName, fileSize }),
};

export const profileAPI = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
  getMe: () => api.get('/user/me'),
  deleteMe: () => api.delete('/user/me'),
};

export const matchAPI = {
  run: (cvId, searchConfig) => api.post('/match', { cvId, searchConfig }),
};

export const jobsAPI = {
  getHistory: (params = {}) => api.get('/jobs', { params }),
};

export default api;
