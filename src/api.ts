import axios from "axios";

// CONFIGURACIÓN DE PRODUCCIÓN REAL
// Si tu backend y frontend están en el mismo dominio (ej. servidos por Nginx), usa "/api".
// Si están separados (ej. Vercel + Render), usa la URL completa.
const API_URL = (import.meta as any).env.PROD
  ? "https://prontoapp-backend.onrender.com/api" // URL de tu backend en Render
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
    // Solo redirigir si es 401 Y NO es un intento de login
    if (
      error.response?.status === 401 &&
      !error.config.url.includes("/login")
    ) {
      // Si el token expiró o es inválido, cerrar sesión
      localStorage.removeItem("token");
      localStorage.removeItem("currentUser");
      window.location.href = "/";
    }
    // Solo loguear el error si NO es un error de credenciales (401 en login)
    if (
      error.response?.status !== 401 ||
      !error.config.url.includes("/login")
    ) {
      console.error("API Error:", error);
    }
    return Promise.reject(error);
  },
);
