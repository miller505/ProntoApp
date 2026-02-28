/// <reference types="vite/client" />
import axios from "axios";

// Detecta si estamos en prod o dev
// EN VERCEL: Debes configurar la variable de entorno VITE_API_URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 1. Inyectar Token en cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. Manejar expiración de sesión
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config &&
      error.config.url &&
      !error.config.url.includes("/login")
    ) {
      // Si el token falló y no es porque estamos intentando loguearnos
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);
