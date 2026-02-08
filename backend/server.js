import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import { verifyToken } from "./middleware.js";

// IMPORTANTE: Asegúrate de que models.js esté en la misma carpeta
import {
  User,
  Product,
  Order,
  Colony,
  Message,
  Settings,
  Review,
} from "./models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// CORS: Configuración robusta para producción
const allowedOrigins = [
  "http://localhost:5173", // Vite local
  process.env.FRONTEND_URL, // Tu URL de Vercel (ej: https://pronto-app.vercel.app)
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.some((o) => origin.startsWith(o) || o === origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(helmet());
app.use(express.json({ limit: "50mb" }));

// Conexión a MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error Mongo:", err));

// --- SOCKET.IO (CHAT EN TIEMPO REAL) ---
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  // Unirse a la "sala" de un pedido específico
  socket.on("join_room", (orderId) => {
    socket.join(orderId);
  });

  // Enviar mensaje
  socket.on("send_message", async (data) => {
    try {
      // 1. Guardar en BD
      const newMessage = await Message.create(data);
      // 2. Emitir a todos en la sala (incluido el remitente para confirmar)
      io.to(data.orderId).emit("receive_message", newMessage);
    } catch (error) {
      console.error("Error socket:", error);
    }
  });
});

// --- RUTAS API ---

// AUTENTICACIÓN
app.post("/api/register", async (req, res) => {
  try {
    const { password, email, ...rest } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email ya registrado" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Auto-aprobar clientes
    const shouldApprove = rest.role === "CLIENT";

    const newUser = await User.create({
      ...rest,
      email,
      password: hashedPassword,
      approved: shouldApprove,
    });

    res.json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass)
      return res.status(401).json({ error: "Contraseña incorrecta" });
    if (!user.approved)
      return res.status(403).json({ error: "Cuenta pendiente de aprobación" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ user: userObj, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DATOS PRINCIPALES
app.get("/api/stores", async (req, res) => {
  try {
    const stores = await User.find({
      role: "STORE",
      approved: true,
      isOpen: true,
    }).select("-password");
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    const newProduct = await Product.create(req.body);
    res.json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protegido: Solo MASTER puede ver todos los usuarios
app.get("/api/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "MASTER" && req.user.role !== "DELIVERY") {
      return res.status(403).json({ error: "No autorizado" });
    }
    // Devolvemos todos los usuarios menos su contraseña
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    } else {
      delete req.body.password;
    }
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    }).select("-password");
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ... dentro de backend/server.js ...

app.get("/api/orders", verifyToken, async (req, res) => {
  // YA NO confiamos en req.query para la seguridad. Usamos req.user del token.
  const { id: userId, role } = req.user;
  let query = {};

  try {
    // PROTECCIÓN: Si llega el string "undefined" o está vacío, no filtramos por ID erróneo
    if (role === "CLIENT") {
      if (userId && userId !== "undefined") query.customerId = userId;
    }

    if (role === "STORE") {
      if (userId && userId !== "undefined") query.storeId = userId;
    }

    if (role === "DELIVERY") {
      if (userId && userId !== "undefined") {
        query = {
          $or: [
            { driverId: userId },
            { status: "READY", driverId: { $exists: false } },
            { status: "READY", driverId: null },
          ],
        };
      } else {
        // Si no hay ID de driver, solo mostrar las disponibles
        query = { status: "READY", driverId: { $exists: false } };
      }
    }

    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (e) {
    console.error("Error fetching orders:", e);
    res.status(500).json({ error: e.message });
  }
});

// CHAT (NUEVO)
app.get("/api/messages/:orderId", async (req, res) => {
  try {
    const messages = await Message.find({ orderId: req.params.orderId }).sort({
      createdAt: 1,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD Genérico (Simplificado para brevedad, expandir según necesidad)
app.post("/api/orders", async (req, res) => {
  try {
    const newOrder = await Order.create(req.body);
    io.emit("orders_updated");
    res.json(newOrder);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const updated = await Order.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    io.emit("orders_updated");
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/colonies", async (req, res) => {
  const cols = await Colony.find();
  res.json(cols);
});

app.post("/api/colonies", async (req, res) => {
  try {
    const newColony = await Colony.create(req.body);
    res.json(newColony);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/colonies/:id", async (req, res) => {
  try {
    await Colony.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/settings", async (req, res) => {
  const set = await Settings.findOne();
  res.json(set || { baseFee: 15, kmRate: 5 });
});

app.put("/api/settings", async (req, res) => {
  try {
    const updatedSettings = await Settings.findOneAndUpdate({}, req.body, {
      new: true,
      upsert: true,
    });
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reviews", async (req, res) => {
  try {
    const newReview = await Review.create(req.body);
    res.json(newReview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/reviews/:storeId", async (req, res) => {
  try {
    const reviews = await Review.find({ storeId: req.params.storeId });
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar Servidor
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
