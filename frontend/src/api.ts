import axios from "axios";
import { API_URL } from "./constants";

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

// --- UTILIDAD DE SUBIDA PROFESIONAL ---
export const uploadToCloudinary = async (file: File): Promise<string> => {
  // 1. Obtener firma segura del backend (sin exponer secretos)
  const { data: sigData } = await api.get("/api/upload-signature");

  // 2. Preparar el payload para Cloudinary
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sigData.apiKey);
  formData.append("timestamp", sigData.timestamp);
  formData.append("signature", sigData.signature);
  formData.append("folder", "prontoapp");

  // 3. Subir directo a la nube (evitando que el backend procese la imagen)
  const res = await axios.post(
    `https://api.cloudinary.com/v1_1/${sigData.cloudName}/image/upload`,
    formData,
  );

  return res.data.secure_url; // Retorna la URL pública (https://...)
};
