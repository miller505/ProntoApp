import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Order } from "./models.js";

// Configuración para leer variables de entorno y rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del backend (igual que en server.js)
dotenv.config({ path: path.join(__dirname, "../.env") });

const clearHistory = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "No se encontró la variable MONGO_URI. Revisa tu archivo .env",
      );
    }

    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado.");

    console.log("🗑️  Eliminando todos los pedidos...");
    const result = await Order.deleteMany({});

    console.log(
      `✨ Éxito: Se han eliminado ${result.deletedCount} pedidos del historial.`,
    );
  } catch (error) {
    console.error("❌ Error al eliminar pedidos:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

clearHistory();
