import axios from 'axios';

// En desarrollo local usamos localhost:5000. 
// Cuando despliegues en Vercel, deberás cambiar esto por la URL de Render.
const API_URL = 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para manejar errores
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
