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

// CORS: Configuración robusta e integral (Añadido el puerto 3000)
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "https://www.prontomx.com",
  "https://prontomx.com",
  process.env.FRONTEND_URL,
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (
        !origin ||
        allowedOrigins.some((o) => origin?.startsWith(o) || o === origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS no permitido"), false);
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(helmet());
app.use(express.json({ limit: "50mb" }));

// --- CORRECCIÓN DE SEGURIDAD: NORMALIZACIÓN Y LIMPIEZA DE MONGOOSE ---
// Esto convierte los _id en id y elimina las contraseñas y __v de TODAS las respuestas al frontend
mongoose.set("toJSON", {
  virtuals: true,
  transform: (doc, converted) => {
    delete converted._id;
    delete converted.__v;
    delete converted.password; // NUNCA viaja la contraseña al frontend
  },
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error Mongo:", err));

// --- SOCKET.IO (CHAT EN TIEMPO REAL) ---
// Se añaden credentials: true y orígenes permitidos explícitos
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("join_room", (orderId) => {
    socket.join(orderId);
  });

  socket.on("send_message", async (data) => {
    try {
      const newMessage = await Message.create(data);
      io.to(data.orderId).emit("receive_message", newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("disconnect", () => {
    // Limpieza al desconectar
  });
});

// ==========================================
// RUTAS DE LA API
// ==========================================

// --- AUTH ---
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    // Esto mantendrá la compatibilidad con tus usuarios de prueba que ya tienen contraseña (hasheada por bcrypt)
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: "Credenciales inválidas" });

    // Lógica original: requiere que estén aprobados (excepto MASTER)
    if (!user.approved)
      return res.status(403).json({ error: "Cuenta no aprobada" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);

    const newUser = await User.create({
      ...req.body,
      password: hashedPassword,
    });
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ORDERS ---
app.get("/api/orders", async (req, res) => {
  try {
    const { userId, role } = req.query;
    let filter = {};

    if (role === "CLIENT") filter.customerId = userId;
    else if (role === "STORE") filter.storeId = userId;
    else if (role === "DELIVERY") {
      filter = {
        $or: [
          { driverId: userId },
          { status: "READY", driverId: { $exists: false } },
        ],
      };
    }

    // Paginación sugerida (limita a 100 para no colapsar la app en frontend)
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const newOrder = await Order.create(req.body);

    // CORRECCIÓN CRÍTICA: Enviar solo la orden actualizada con evento singular
    io.emit("order_updated", newOrder);

    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", async (req, res) => {
  try {
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );

    // CORRECCIÓN CRÍTICA: Enviar la orden específica a todos los clientes
    io.emit("order_updated", updatedOrder);

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USERS & STORES ---
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stores", async (req, res) => {
  try {
    const stores = await User.find({ role: "STORE" }).select("-password");
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", verifyToken, async (req, res) => {
  try {
    // PREVENCIÓN IDOR: Nadie puede inyectar un cambio de rol desde el frontend, excepto un MASTER.
    if (req.user.role !== "MASTER" && req.body.role) {
      delete req.body.role;
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- PRODUCTS ---
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/products", verifyToken, async (req, res) => {
  try {
    // Validar límites de suscripción para tiendas
    if (req.user.role === "STORE") {
      const user = await User.findById(req.user.id);
      const count = await Product.countDocuments({ storeId: req.user.id });

      let limit = 10; // Standard
      if (user.subscription === "PREMIUM") limit = 30;
      if (user.subscription === "ULTRA") limit = 50;

      if (count >= limit) {
        return res
          .status(403)
          .json({
            error: `Has alcanzado el límite de ${limit} productos de tu plan ${user.subscription}.`,
          });
      }
    }

    const newProduct = await Product.create(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
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
    io.emit("product_updated", updatedProduct);
    res.json(updatedProduct);
  } catch (error) {
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

// --- COLONIES, SETTINGS & REVIEWS ---
app.get("/api/colonies", async (req, res) => {
  try {
    const cols = await Colony.find();
    res.json(cols);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  try {
    const set = await Settings.findOne();
    res.json(set || { baseFee: 15, kmRate: 5 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

app.get("/api/reviews/:storeId", async (req, res) => {
  try {
    const reviews = await Review.find({ storeId: req.params.storeId }).populate(
      "customerId",
      "firstName lastName",
    );
    res.json(reviews);
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

// Inicialización del servidor
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
