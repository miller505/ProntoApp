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

// SEGURIDAD: Importamos middlewares
import { verifyToken, verifyRole, verifySocketToken } from "./middleware.js";

// Modelos
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

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- HELPER: Subida de Imágenes ---
const uploadImage = async (base64String) => {
  if (!base64String || !base64String.startsWith("data:image"))
    return base64String; // Si ya es URL o vacío, retornar
  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: "prontoapp",
      resource_type: "image",
    });
    return result.secure_url;
  } catch (error) {
    console.error("Error subiendo imagen a Cloudinary:", error);
    throw new Error("Error al subir imagen");
  }
};

// --- HELPER: Cálculo de Distancia (Haversine) ---
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "https://www.prontomx.com",
  "https://prontomx.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Bloqueado por CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(helmet());
app.use(express.json({ limit: "50mb" }));

mongoose.set("toJSON", {
  virtuals: true,
  transform: (doc, converted) => {
    delete converted._id;
    delete converted.__v;
    delete converted.password;
  },
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch((err) => console.error("❌ Error Mongo:", err));

// --- SOCKET.IO ---
const io = new Server(httpServer, {
  cors: corsOptions,
});

io.use(verifySocketToken);

io.on("connection", (socket) => {
  // RENDIMIENTO: Logs eliminados para producción
  // console.log(`🔌 Cliente conectado: ${socket.id}`);

  // SEGURIDAD: Auto-unir al usuario a su sala privada y salas de rol
  const userId = socket.user.id;
  const userRole = socket.user.role;

  socket.join(userId); // Sala privada del usuario

  if (userRole === "MASTER") {
    socket.join("MASTER_ROOM");
  } else if (userRole === "DELIVERY") {
    socket.join("DRIVERS_ROOM"); // Sala para recibir alertas de pedidos listos
  }

  // Permitir unirse a salas de órdenes específicas (para chat y tracking)
  socket.on("join_order_room", async (orderId) => {
    try {
      // SEGURIDAD: Verificar que el usuario tiene permiso para ver esta orden
      const order = await Order.findById(orderId);
      if (!order) return;

      const uid = socket.user.id;
      const role = socket.user.role;

      // Permitir si es Master
      if (role === "MASTER") {
        socket.join(orderId);
        return;
      }

      // Permitir si es participante directo (Cliente, Tienda, Repartidor asignado)
      const isParticipant =
        order.customerId.toString() === uid ||
        order.storeId.toString() === uid ||
        (order.driverId && order.driverId.toString() === uid);

      if (isParticipant) {
        socket.join(orderId);
      } else {
        // Opcional: Log de intento de acceso no autorizado
        // console.warn(`Acceso denegado a sala ${orderId} para usuario ${uid}`);
      }
    } catch (error) {
      console.error("Error al unir a room:", error);
    }
  });

  socket.on("send_message", async (data) => {
    if (data.senderId !== socket.user.id) return;
    try {
      const newMessage = await Message.create(data);
      // Emitir a la sala de la orden
      io.to(data.orderId).emit("receive_message", newMessage);
      // Notificar al receptor específicamente
      io.to(data.receiverId).emit("new_message", newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("disconnect", (reason) => {
    // console.log(`🔌 Cliente desconectado: ${socket.id}`);
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

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: "Credenciales inválidas" });

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
    const ineImageUrl = await uploadImage(req.body.ineImage);

    const newUser = await User.create({
      ...req.body,
      password: hashedPassword,
      ineImage: ineImageUrl,
    });

    // Notificar SOLO al Master
    io.to("MASTER_ROOM").emit("user_update", newUser);

    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- FINANZAS ---
app.get("/api/finances/stats", verifyToken, async (req, res) => {
  try {
    const { id, role } = req.user;
    let filter = { status: "DELIVERED" };

    if (role === "STORE") filter.storeId = id;
    else if (role === "DELIVERY") filter.driverId = id;

    const orders = await Order.find(filter);

    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    let stats = {
      totalVolume: 0,
      earnings: 0,
      fee: 0,
      count: orders.length,
      weeklyEarnings: 0,
      weeklyCount: 0,
    };

    const weeklyOrders = orders.filter(
      (o) => new Date(o.createdAt) >= startOfWeek,
    );
    stats.weeklyCount = weeklyOrders.length;

    if (role === "STORE") {
      const totalSales = orders.reduce((acc, o) => acc + (o.subtotal || 0), 0);
      stats.totalVolume = totalSales;
      stats.earnings = totalSales;
      stats.weeklyEarnings = weeklyOrders.reduce(
        (acc, o) => acc + (o.subtotal || 0),
        0,
      );
    } else if (role === "DELIVERY") {
      stats.earnings = orders.reduce((acc, o) => acc + (o.driverFee || 0), 0);
      stats.totalVolume = stats.earnings;
      stats.weeklyEarnings = weeklyOrders.reduce(
        (acc, o) => acc + (o.driverFee || 0),
        0,
      );
    } else if (role === "MASTER") {
      const allDelivered = await Order.find({ status: "DELIVERED" });
      stats.totalVolume = allDelivered.reduce((acc, o) => acc + o.total, 0);

      stats.earnings = allDelivered.reduce((acc, o) => {
        const baseFee = (o.deliveryFee || 0) - (o.driverFee || 0);
        return acc + Math.max(0, baseFee);
      }, 0);

      const weeklyAll = allDelivered.filter(
        (o) => new Date(o.createdAt) >= startOfWeek,
      );
      stats.weeklyCount = weeklyAll.length;
      stats.weeklyEarnings = weeklyAll.reduce((acc, o) => {
        const baseFee = (o.deliveryFee || 0) - (o.driverFee || 0);
        return acc + Math.max(0, baseFee);
      }, 0);
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- ORDERS ---
app.get("/api/orders", verifyToken, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "CLIENT") filter.customerId = req.user.id;
    else if (req.user.role === "STORE") filter.storeId = req.user.id;
    else if (req.user.role === "DELIVERY") {
      filter = {
        $or: [{ driverId: req.user.id }, { status: "READY", driverId: null }],
      };
    }
    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", verifyToken, async (req, res) => {
  try {
    const { storeId, items, deliveryAddress, paymentMethod } = req.body;
    if (!storeId || !items || !items.length || !deliveryAddress) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const settings = (await Settings.findOne()) || { baseFee: 15, kmRate: 5 };
    const store = await User.findById(storeId);
    if (!store) return res.status(404).json({ error: "Tienda no encontrada" });

    const storeColony = await Colony.findById(store.storeAddress.colonyId);
    const clientColony = await Colony.findById(deliveryAddress.colonyId);

    // VALIDACIÓN: Asegurar que las colonias existen para calcular tarifas
    if (!storeColony || !clientColony) {
      return res.status(400).json({
        error:
          "Ubicación de tienda o cliente inválida (Colonia no encontrada).",
      });
    }

    let calculatedDeliveryFee = settings.baseFee;
    let calculatedDriverFee = 0;

    if (storeColony && clientColony) {
      const distKm = calculateDistance(
        clientColony.lat,
        clientColony.lng,
        storeColony.lat,
        storeColony.lng,
      );
      const driverPart = Math.ceil(distKm * settings.kmRate);
      calculatedDriverFee =
        driverPart < settings.kmRate ? settings.kmRate : driverPart;
      calculatedDeliveryFee = calculatedDriverFee + settings.baseFee;
    }

    let calculatedSubtotal = 0;
    const secureItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;

      // INTEGRIDAD: Verificar disponibilidad
      if (!product.isAvailable) {
        return res
          .status(400)
          .json({ error: `El producto ${product.name} no está disponible.` });
      }

      const price = product.price;
      const quantity = parseInt(item.quantity);

      // VALIDACIÓN: Cantidad positiva
      if (!quantity || quantity <= 0) {
        return res
          .status(400)
          .json({ error: "Cantidad de producto inválida." });
      }

      calculatedSubtotal += price * quantity;

      secureItems.push({
        product: product.toObject(),
        productId: product._id,
        quantity: quantity,
        price: price,
        customizations: [],
      });
    }

    const calculatedTotal = calculatedSubtotal + calculatedDeliveryFee;

    const newOrder = await Order.create({
      customerId: req.user.id,
      storeId,
      driverId: null,
      items: secureItems,
      subtotal: calculatedSubtotal,
      deliveryFee: calculatedDeliveryFee,
      driverFee: calculatedDriverFee,
      total: calculatedTotal,
      status: "PENDING",
      deliveryAddress,
      paymentMethod,
      isReviewed: false,
    });

    const orderJSON = newOrder.toJSON();

    // SEGURIDAD: Emitir SOLO a los interesados
    io.to(storeId.toString()).emit("order_update", orderJSON); // A la tienda
    io.to(req.user.id.toString()).emit("order_update", orderJSON); // Al cliente
    io.to("MASTER_ROOM").emit("order_update", orderJSON); // Al master

    res.status(201).json(newOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    const role = req.user.role;
    const userId = req.user.id;

    // 1. Obtener orden actual para validaciones
    const currentOrder = await Order.findById(orderId);
    if (!currentOrder)
      return res.status(404).json({ error: "Orden no encontrada" });

    let updatedOrder;

    // 2. Lógica específica por Rol y Estado
    if (role === "STORE") {
      if (currentOrder.storeId.toString() !== userId)
        return res.status(403).json({ error: "No autorizado" });

      updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status },
        { new: true },
      );
    } else if (role === "DELIVERY") {
      if (status === "ON_WAY") {
        // INTEGRIDAD DE DATOS: Operación atómica para evitar que dos repartidores tomen la misma orden
        updatedOrder = await Order.findOneAndUpdate(
          { _id: orderId, status: "READY", driverId: null }, // Condición estricta
          { status: "ON_WAY", driverId: userId },
          { new: true },
        );

        if (!updatedOrder) {
          return res
            .status(409)
            .json({ error: "La orden ya fue tomada o no está lista." });
        }
      } else if (status === "DELIVERED") {
        if (currentOrder.driverId?.toString() !== userId)
          return res.status(403).json({ error: "No es tu orden" });

        updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          { status },
          { new: true },
        );
      }
    } else if (role === "CLIENT") {
      // SEGURIDAD: El cliente solo puede cancelar, y solo si está pendiente.
      if (status !== "CANCELLED") {
        return res
          .status(403)
          .json({ error: "Acción no permitida para clientes." });
      }
      if (currentOrder.status !== "PENDING") {
        return res
          .status(400)
          .json({ error: "No se puede cancelar una orden en proceso." });
      }
      updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status: "CANCELLED" },
        { new: true },
      );
    } else if (role === "MASTER") {
      updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status },
        { new: true },
      );
    }

    if (!updatedOrder)
      return res.status(400).json({ error: "No se pudo actualizar" });

    const orderJSON = updatedOrder.toJSON();

    // 3. Notificaciones Inteligentes (SEGURIDAD)
    // Siempre notificar a los participantes directos
    io.to(updatedOrder.customerId.toString()).emit("order_update", orderJSON);
    io.to(updatedOrder.storeId.toString()).emit("order_update", orderJSON);
    io.to("MASTER_ROOM").emit("order_update", orderJSON);

    if (updatedOrder.driverId) {
      io.to(updatedOrder.driverId.toString()).emit("order_update", orderJSON);
    }

    // Si la orden está lista, notificar a TODOS los repartidores disponibles
    if (status === "READY") {
      io.to("DRIVERS_ROOM").emit("order_update", orderJSON);
    }
    // Si la orden fue tomada, notificar a los repartidores para que la quiten de su lista "Disponibles"
    if (status === "ON_WAY") {
      io.to("DRIVERS_ROOM").emit("order_update", orderJSON);
    }

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USERS & STORES ---
app.get(
  "/api/admin/users",
  verifyToken,
  verifyRole(["MASTER", "DELIVERY"]),
  async (req, res) => {
    try {
      const users = await User.find().select("-password");
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get("/api/stores", async (req, res) => {
  try {
    const stores = await User.find({
      role: "STORE",
      isOpen: true,
      approved: true,
    }).select(
      "storeName storeAddress coverImage logo averageRating ratingCount description prepTime isOpen role subscription approved",
    );
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "MASTER" && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    if (req.user.role !== "MASTER") {
      delete req.body.role;
      delete req.body.approved;
      delete req.body.subscription;
    }

    // SEGURIDAD: Hashear contraseña si se envía
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    } else {
      delete req.body.password; // Evitar sobrescribir con vacío
    }

    if (req.body.logo && req.body.logo.startsWith("data:")) {
      req.body.logo = await uploadImage(req.body.logo);
    }
    if (req.body.coverImage && req.body.coverImage.startsWith("data:")) {
      req.body.coverImage = await uploadImage(req.body.coverImage);
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    // Notificar cambios solo a interesados
    io.to("MASTER_ROOM").emit("user_update", updatedUser);
    io.to(updatedUser._id.toString()).emit("user_update", updatedUser); // Al propio usuario
    if (updatedUser.role === "STORE") {
      // Si es tienda, actualizar la lista pública (podría optimizarse)
      io.emit("store_update", updatedUser);
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete(
  "/api/users/:id",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      io.to("MASTER_ROOM").emit("user_delete", req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

// --- PRODUCTS ---
app.get("/api/products", async (req, res) => {
  try {
    res.json(await Product.find());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/products",
  verifyToken,
  verifyRole(["STORE", "MASTER"]),
  async (req, res) => {
    try {
      if (req.user.role === "STORE") {
        const user = await User.findById(req.user.id);
        const count = await Product.countDocuments({ storeId: req.user.id });
        let limit =
          user.subscription === "PREMIUM"
            ? 30
            : user.subscription === "ULTRA"
              ? 50
              : 10;
        if (count >= limit)
          return res
            .status(403)
            .json({ error: `Límite excedido: ${limit} productos.` });
      }

      if (req.body.image && req.body.image.startsWith("data:")) {
        req.body.image = await uploadImage(req.body.image);
      }

      const newProduct = await Product.create({
        ...req.body,
        storeId: req.user.role === "MASTER" ? req.body.storeId : req.user.id,
      });

      io.emit("product_update", newProduct);
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.put(
  "/api/products/:id",
  verifyToken,
  verifyRole(["STORE", "MASTER"]),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (
        req.user.role !== "MASTER" &&
        product.storeId.toString() !== req.user.id
      ) {
        return res.status(403).json({ error: "No autorizado" });
      }

      if (req.body.image && req.body.image.startsWith("data:")) {
        req.body.image = await uploadImage(req.body.image);
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      io.emit("product_update", updatedProduct);
      res.json(updatedProduct);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.delete("/api/products/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "No encontrado" });

    if (
      req.user.role !== "MASTER" &&
      product.storeId.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: "No autorizado" });
    }

    await Product.findByIdAndDelete(req.params.id);
    io.emit("product_delete", req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- COLONIES, SETTINGS & REVIEWS ---
app.get("/api/colonies", async (req, res) => {
  try {
    res.json(await Colony.find());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post(
  "/api/colonies",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      const col = await Colony.create(req.body);
      io.emit("colony_update", col);
      res.json(col);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.put(
  "/api/colonies/:id",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      const col = await Colony.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      io.emit("colony_update", col);
      res.json(col);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete(
  "/api/colonies/:id",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      await Colony.findByIdAndDelete(req.params.id);
      io.emit("colony_delete", req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.get("/api/settings", async (req, res) => {
  try {
    const set = await Settings.findOne();
    res.json(set || { baseFee: 15, kmRate: 5 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put(
  "/api/settings",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      const set = await Settings.findOneAndUpdate({}, req.body, {
        new: true,
        upsert: true,
      });
      io.emit("settings_update", set);
      res.json(set);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.get("/api/reviews/:storeId", async (req, res) => {
  try {
    res.json(
      await Review.find({ storeId: req.params.storeId }).populate(
        "customerId",
        "firstName lastName",
      ),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/reviews", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.body.orderId);
    if (order && order.isReviewed)
      return res.status(400).json({ error: "Ya calificado." });

    const newReview = await Review.create(req.body);
    const reviews = await Review.find({ storeId: req.body.storeId });
    const count = reviews.length;
    const avg =
      count > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

    const updatedStore = await User.findByIdAndUpdate(
      req.body.storeId,
      {
        averageRating: avg,
        ratingCount: count,
      },
      { new: true },
    );

    await Order.findByIdAndUpdate(req.body.orderId, { isReviewed: true });

    io.emit("store_update", updatedStore.toJSON());

    res.status(201).json(newReview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/messages/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: "Orden no encontrada" });

    if (
      req.user.role !== "MASTER" &&
      req.user.id !== order.customerId.toString() &&
      req.user.id !== order.storeId.toString() &&
      req.user.id !== (order.driverId ? order.driverId.toString() : "")
    ) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const messages = await Message.find({ orderId: req.params.orderId }).sort({
      createdAt: 1,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/messages/read/:orderId", verifyToken, async (req, res) => {
  try {
    await Message.updateMany(
      { orderId: req.params.orderId, receiverId: req.user.id, read: false },
      { read: true },
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/init", async (req, res) => {
  try {
    const [users, products, colonies, settings] = await Promise.all([
      User.find({ role: "STORE", isOpen: true, approved: true }).select(
        "-password",
      ),
      Product.find(),
      Colony.find(),
      Settings.findOne(),
    ]);

    res.json({
      users,
      products,
      orders: [], // No enviar órdenes públicas
      colonies,
      settings,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
