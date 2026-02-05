import axios from "axios";

// CONFIGURACIÓN DE PRODUCCIÓN REAL
// Si tu backend y frontend están en el mismo dominio (ej. servidos por Nginx), usa "/api".
// Si están separados (ej. Vercel + Render), usa la URL completa.
const API_URL = import.meta.env.PROD
  ? "https://prontomx.com/api" // Tu dominio real
  : "http://localhost:5000/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para inyectar el Token de Seguridad (JWT) en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Si el token expiró o es inválido, cerrar sesión
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      window.location.href = "/";
    }
    console.error("API Error:", error);
    return Promise.reject(error);
  },
);
