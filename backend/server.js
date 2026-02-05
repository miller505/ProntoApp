import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
dotenv.config();
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import {
  User,
  Product,
  Order,
  Colony,
  Message,
  Settings,
  Review,
} from "./models.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // En producción, restringe esto a tu dominio frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Aumentado para aceptar imágenes base64

// Configuración Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 6. Conexión y Server
const PORT = process.env.PORT || 5000;

// Cargar variables de entorno robustamente
// Intentar cargar desde backend/.env también por si acaso (usuario custom setup)
try {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  // Root (default) se cargó arriba, intentamos cargar backend/.env
  dotenv.config({ path: path.join(currentDir, ".env") });
} catch (e) {
  console.log("Info: No extra .env in backend dir");
}

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(
    "❌ Error de configuración: No se encontró MONGODB_URI ni MONGO_URI en el archivo .env",
  );
  console.error(
    "   Asegúrate de que el archivo .env tenga la variable definida.",
  );
} else {
  mongoose
    .connect(MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch((err) =>
      console.error("❌ Error conectando a MongoDB:", err.message),
    );
}

// --- RUTAS ---

// 1. Inicialización (Cargar datos iniciales)
app.get("/api/init", async (req, res) => {
  try {
    // Crear Master por defecto si no existe
    const masterExists = await User.findOne({ role: "MASTER" });
    if (!masterExists) {
      console.log("Creando usuario Master por defecto...");
      await User.create({
        role: "MASTER",
        firstName: "Master",
        lastName: "Admin",
        phone: "0000000000",
        email: "admin@red.com",
        password: "123", // Demo
        approved: true,
      });
    }

    const users = await User.find({});
    const products = await Product.find({}).lean();
    const orders = await Order.find({});
    const colonies = await Colony.find({});

    let settings = await Settings.findOne({});
    if (!settings) {
      settings = await Settings.create({ baseFee: 15, kmRate: 5 });
    }

    res.json({ users, products, orders, colonies, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UTILIDAD: Resetear Base de Datos (Solo para desarrollo)
// Llama a esta ruta (POST /api/admin/reset) para borrar todo y recrear el Master
app.post("/api/admin/reset", async (req, res) => {
  try {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Colony.deleteMany({});

    // Recrear Master
    await User.create({
      role: "MASTER",
      firstName: "Master",
      lastName: "Admin",
      phone: "0000000000",
      email: "admin@red.com",
      password: "123",
      approved: true,
    });

    res.json({
      message:
        "Base de datos reseteada completamente. Usuario Master recreado.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Autenticación
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    // Verificar si la contraseña está hasheada (si empieza con $2...)
    let isMatch = false;
    if (user.password.startsWith("$2")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Fallback para usuarios antiguos sin hash
      isMatch = user.password === password;
    }

    if (!isMatch)
      return res.status(401).json({ error: "Credenciales inválidas" });
    if (!user.approved)
      return res.status(403).json({ error: "Cuenta no aprobada" });

    // Retornamos el usuario (sin password)
    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    let userData = req.body;

    // Verificar si ya existe
    const exists = await User.findOne({ email: userData.email });
    if (exists)
      return res.status(400).json({ error: "El correo ya está registrado" });

    // Hashear password
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);

    // Subir imagen a Cloudinary si existe
    if (userData.ineImage && userData.ineImage.startsWith("data:image")) {
      const upload = await cloudinary.uploader.upload(userData.ineImage, {
        folder: "red_delivery/users",
      });
      userData.ineImage = upload.secure_url;
    }

    const newUser = await User.create(userData);
    const userObj = newUser.toObject();
    delete userObj.password;
    io.emit("user_update", userObj); // Notificar nuevo usuario

    res.json(userObj);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Gestión Usuarios
app.put("/api/users/:id", async (req, res) => {
  try {
    const { _id, ...updateData } = req.body;
    const updated = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    const userObj = updated.toObject();
    delete userObj.password;
    io.emit("user_update", userObj); // Notificar actualización
    res.json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  io.emit("user_delete", req.params.id); // Notificar eliminación
  res.json({ success: true });
});

// 4. Gestión Productos
app.post("/api/products", async (req, res) => {
  try {
    let prodData = req.body;
    // Imagen de producto (simulada o subida)
    if (prodData.image && prodData.image.startsWith("data:image")) {
      const upload = await cloudinary.uploader.upload(prodData.image, {
        folder: "red_delivery/products",
      });
      prodData.image = upload.secure_url;
    }
    const newProd = await Product.create(prodData);
    io.emit("product_update", newProd);
    res.json(newProd);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  io.emit("product_update", updated);
  res.json(updated);
});

app.delete("/api/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  io.emit("product_delete", req.params.id);
  res.json({ success: true });
});

// 5. Gestión Pedidos
app.post("/api/orders", async (req, res) => {
  try {
    const newOrder = await Order.create(req.body);
    io.emit("order_update", newOrder);
    res.json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", async (req, res) => {
  const { status, driverId } = req.body;
  const updateData = { status };
  if (driverId) updateData.driverId = driverId;

  const updated = await Order.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
  });
  io.emit("order_update", updated);
  res.json(updated);
});

// 6. Gestión Colonias
app.post("/api/colonies", async (req, res) => {
  const col = await Colony.create(req.body);
  io.emit("colony_update", col);
  res.json(col);
});

app.put("/api/colonies/:id", async (req, res) => {
  const col = await Colony.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  io.emit("colony_update", col);
  res.json(col);
});

app.delete("/api/colonies/:id", async (req, res) => {
  await Colony.findByIdAndDelete(req.params.id);
  io.emit("colony_delete", req.params.id);
  res.json({ success: true });
});

// 7. Gestión de Mensajes (Chat)
app.get("/api/messages/:orderId", async (req, res) => {
  try {
    const messages = await Message.find({ orderId: req.params.orderId }).sort({
      createdAt: "asc",
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    const newMessage = await Message.create(req.body);
    // Emitir a la sala específica del pedido
    io.to(`order_${newMessage.orderId}`).emit("new_message", newMessage);
    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Lógica de Sockets ---
io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("join_order_room", (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`Usuario ${socket.id} se unió a la sala order_${orderId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

// 8. Configuración Global
app.put("/api/settings", async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
    });
    io.emit("settings_update", settings);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Reseñas y Calificaciones
app.post("/api/reviews", async (req, res) => {
  try {
    const { orderId, storeId, customerId, rating, comment } = req.body;

    // Verificar si ya existe
    const existing = await Review.findOne({ orderId });
    if (existing)
      return res.status(400).json({ error: "Ya calificaste este pedido" });

    const review = await Review.create({
      orderId,
      storeId,
      customerId,
      rating,
      comment,
    });

    // Recalcular promedio de la tienda
    const reviews = await Review.find({ storeId });
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = total / reviews.length;

    // Actualizar tienda
    const updatedStore = await User.findByIdAndUpdate(
      storeId,
      {
        averageRating: avg,
        ratingCount: reviews.length,
      },
      { new: true },
    );
    const storeObj = updatedStore.toObject();
    delete storeObj.password;
    io.emit("user_update", storeObj); // Notificar a todos el nuevo rating

    // Marcar pedido como revisado
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { isReviewed: true },
      { new: true },
    );
    io.emit("order_update", updatedOrder);

    res.json(review);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reviews/:storeId", async (req, res) => {
  try {
    const reviews = await Review.find({ storeId: req.params.storeId })
      .populate("customerId", "firstName lastName")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

httpServer.listen(PORT, () =>
  console.log(`Servidor corriendo en puerto ${PORT}`),
);
