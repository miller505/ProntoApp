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
import { z } from "zod";
import rateLimit from "express-rate-limit";

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
  CommunityMessage,
} from "./models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();
const httpServer = createServer(app);

// --- CONFIGURACIÓN DE SEGURIDAD ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Máximo 10 intentos por IP
  message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
});

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

// --- HELPER: Cálculo unificado de Tarifas (Fuente de Verdad) ---
const calculateOrderFees = async (storeId, deliveryAddress, subtotal) => {
  const settings = (await Settings.findOne()) || {
    commissionRate: 5,
    kmRate: 5,
    companyKmRate: 2,
  };
  const store = await User.findById(storeId);
  if (!store) throw new Error("Tienda no encontrada");

  const storeColony = await Colony.findById(store.storeAddress.colonyId);
  const clientColony = await Colony.findById(deliveryAddress.colonyId);

  if (!storeColony || !clientColony)
    throw new Error("Ubicación geográfica no válida");

  // Si la dirección trae coordenadas exactas (Leaflet), las usamos. Si no, usamos el centro de la colonia.
  const lat1 = deliveryAddress.lat || clientColony.lat;
  const lng1 = deliveryAddress.lng || clientColony.lng;
  const lat2 = store.storeAddress.lat || storeColony.lat;
  const lng2 = store.storeAddress.lng || storeColony.lng;

  const distKm = calculateDistance(lat1, lng1, lat2, lng2);

  const driverFee = Math.max(
    settings.kmRate,
    Math.ceil(distKm * settings.kmRate),
  );
  const appCommission = subtotal * (settings.commissionRate / 100);
  const companyDistanceFee = Math.max(
    settings.companyKmRate || 0,
    Math.ceil(distKm * (settings.companyKmRate || 0)),
  );
  const deliveryFee = appCommission + driverFee + companyDistanceFee;

  return {
    deliveryFee,
    driverFee,
    companyDistanceFee,
    total: subtotal + deliveryFee,
    distKm,
  };
};

// --- SCHEMAS DE VALIDACIÓN (ZOD) ---
const OrderCreateSchema = z.object({
  storeId: z.string().min(20),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().positive(),
        notes: z.string().max(100).optional(),
      }),
    )
    .min(1),
  deliveryAddress: z.object({
    street: z.string().min(1),
    number: z.string().min(1),
    colonyId: z.string().min(1),
    reference: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
  paymentMethod: z.enum(["CASH", "CARD"]),
});

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://localhost:4173", // Puerto de vista previa de Vite
  "https://www.prontomx.com",
  "https://prontomx.com",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman o server-to-server)
    if (!origin) return callback(null, true);

    const isLocalhost =
      origin.includes("localhost") || origin.includes("127.0.0.1");
    const isVercel = origin.includes("vercel.app");
    const isProduction = origin.includes("prontomx.com");
    const isAllowedList = allowedOrigins.includes(origin);
    const isAllowed =
      isAllowedList ||
      origin.includes("vercel.app") ||
      origin.includes("prontomx.com");

    if (isAllowed || process.env.NODE_ENV !== "production") {
      callback(null, true);
    } else {
      console.warn(`CORS Bloqueado para el origen: ${origin}`);
      callback(new Error("Bloqueado por CORS"));
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

// Límites de productos por tipo de suscripción (Fuente de verdad)
const SUBSCRIPTION_LIMITS = {
  STANDARD: 20,
  PREMIUM: 50,
  BLACK: 130,
};

// ==========================================
// RUTAS DE LA API
// ==========================================

// --- CLOUDINARY SIGNED UPLOAD (PROFESIONAL) ---
app.get("/api/upload-signature", async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "prontoapp", // Carpeta en Cloudinary
      },
      process.env.CLOUDINARY_API_SECRET,
    );
    res.json({
      timestamp,
      signature,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- AUTH ---
app.post("/api/login", loginLimiter, async (req, res) => {
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

app.post("/api/auth/google", async (req, res) => {
  try {
    const { token, credential, role } = req.body;
    const finalToken = token || credential;

    // 1. Validar token con Google
    const googleRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${finalToken}`,
    );
    if (!googleRes.ok)
      return res.status(401).json({ error: "Token de Google inválido" });

    const data = await googleRes.json();
    const { email, sub: googleId, given_name, family_name, picture } = data;

    // 2. Buscar usuario existente
    let user = await User.findOne({ email });

    if (user) {
      // Si existe, actualizar Google ID si no lo tiene
      if (!user.googleId) {
        user.googleId = googleId;
        user.authProvider = "GOOGLE"; // Opcional: Marcar que ahora usa Google
        await user.save();
      }
    } else {
      // 3. Si no existe, crear nuevo usuario
      if (!role) {
        // Si viene del Login y no existe, no podemos adivinar el rol.
        // Lo registramos como CLIENT por defecto para no bloquear.
        // O podríamos devolver error pidiendo registro. Asumiremos CLIENTE.
      }

      user = await User.create({
        email,
        firstName: given_name || "Usuario",
        lastName: family_name || "",
        googleId,
        authProvider: "GOOGLE",
        role: role || "CLIENT",
        approved: role === "CLIENT" || !role, // Auto-aprobar SOLO si es cliente. Socios requieren revisión.
        phone: "0000000000", // Placeholder hasta que lo actualice
        ineImage: picture, // Usar foto de perfil como placeholder
      });

      // Notificar al Master si es un rol sensible
      if (user.role === "STORE" || user.role === "DELIVERY") {
        io.to("MASTER_ROOM").emit("user_update", user);
      }
    }

    // 4. Generar Token JWT propio
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({ user, token: jwtToken });
  } catch (error) {
    console.error("Error Google Auth:", error);
    res.status(500).json({ error: "Error en autenticación con Google" });
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
    // CORRECCIÓN: Aceptamos ambos formatos para recuperar historial antiguo
    let filter = { status: { $in: ["ENTREGADO", "Entregado"] } };

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

    // Generar desglose semanal
    const breakdown = {};
    for (const o of orders) {
      const d = new Date(o.createdAt);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes como inicio
      const weekStart = new Date(d.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const key = weekStart.getTime();

      if (!breakdown[key]) {
        breakdown[key] = { startDate: key, total: 0, count: 0 };
      }

      let amount = 0;
      if (role === "STORE") amount = o.subtotal || 0;
      else if (role === "DELIVERY") amount = o.driverFee || 0;
      else if (role === "MASTER") {
        const baseFee = (o.deliveryFee || 0) - (o.driverFee || 0);
        amount = Math.max(0, baseFee);
      }

      breakdown[key].total += amount;
      breakdown[key].count += 1;
    }
    stats.weeklyBreakdown = Object.values(breakdown).sort(
      (a, b) => b.startDate - a.startDate,
    );

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
      const allDelivered = await Order.find({
        status: { $in: ["ENTREGADO", "Entregado"] },
      });
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
    else if (req.user.role === "STORE") {
      filter.storeId = req.user.id;
      // Solo mostrar pedidos que no requieran pago o que ya hayan sido pagados
      filter.status = { $ne: "PAGO_PENDIENTE" };
    } else if (req.user.role === "DELIVERY") {
      filter = {
        $or: [
          { driverId: req.user.id },
          { status: "LISTO PARA RECOGER", driverId: null },
        ],
      };
    }
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("customerId", "firstName lastName phone addresses") // Eliminado email por privacidad/peso
      .populate("storeId", "storeName storeAddress logo coverImage phone");
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/orders", verifyToken, async (req, res) => {
  try {
    const { storeId, items, deliveryAddress, paymentMethod } = req.body;

    // VALIDACIÓN DE ENTRADA BÁSICA (Debería usarse Zod/Joi)
    if (
      !storeId ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !deliveryAddress
    ) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const settings = (await Settings.findOne()) || {
      commissionRate: 5,
      kmRate: 5,
      companyKmRate: 2,
    };
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

      const price = product.price; // Usamos el precio del servidor, NO del req.body
      const quantity = parseInt(item.quantity);

      // VALIDACIÓN: Cantidad positiva
      if (!quantity || quantity <= 0) {
        return res
          .status(400)
          .json({ error: "Cantidad de producto inválida." });
      }

      calculatedSubtotal += price * quantity;

      secureItems.push({
        product: {
          // Creamos el snapshot del producto
          name: product.name,
          price: product.price,
          image: product.image,
        },
        productId: product._id,
        quantity: quantity,
        price: price,
        notes: item.notes || "",
        customizations: [],
      });
    }

    // 2. Usar Helper Unificado (Fuente de Verdad)
    const fees = await calculateOrderFees(
      storeId,
      deliveryAddress,
      calculatedSubtotal,
    );

    const calculatedDeliveryFee = fees.deliveryFee;
    const calculatedDriverFee = fees.driverFee;
    const calculatedCompanyDistanceFee = fees.companyDistanceFee;
    const calculatedTotal = fees.total;
    const isCard = paymentMethod === "CARD";
    const initialStatus = isCard ? "PAGO_PENDIENTE" : "PENDIENTE";

    const newOrder = await Order.create({
      customerId: req.user.id,
      storeId,
      driverId: null,
      items: secureItems,
      subtotal: calculatedSubtotal,
      deliveryFee: calculatedDeliveryFee,
      driverFee: calculatedDriverFee,
      companyDistanceFee: calculatedCompanyDistanceFee,
      total: calculatedTotal,
      status: initialStatus,
      deliveryAddress,
      paymentMethod,
      isReviewed: false,
    });

    if (isCard) {
      newOrder.mercadoPagoPreferenceId = `dummy_pref_${newOrder._id}`;
      await newOrder.save();
    }

    // Poblar datos antes de emitir por socket para que el frontend tenga la info completa
    const populatedOrder = await newOrder.populate(
      "customerId",
      "firstName lastName phone addresses",
    );
    const orderJSON = populatedOrder.toJSON();

    // SEGURIDAD: Emitir SOLO a los interesados y SOLO si ya fue pagada (o es en efectivo)
    if (!isCard) {
      io.to(storeId.toString()).emit("order_update", orderJSON); // A la tienda
      io.to("MASTER_ROOM").emit("order_update", orderJSON); // Al master
    }
    // Siempre notificamos al cliente para que vea su estado de pago pendiente
    io.to(req.user.id.toString()).emit("order_update", orderJSON);

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
      // Tienda acepta/rechaza/prepara/listo
      if (currentOrder.storeId.toString() !== userId)
        return res.status(403).json({ error: "No autorizado" });

      updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status }, // Ej: "Preparando", "Listo para Recoger", "Rechazado"
        { new: true },
      );
    } else if (role === "DELIVERY") {
      // Repartidor toma/entrega
      if (status === "EN CAMINO") {
        // INTEGRIDAD DE DATOS: Operación atómica para evitar que dos repartidores tomen la misma orden
        updatedOrder = await Order.findOneAndUpdate(
          { _id: orderId, status: "LISTO PARA RECOGER", driverId: null }, // Condición estricta
          { status: "EN CAMINO", driverId: userId },
          { new: true },
        );

        if (!updatedOrder) {
          return res
            .status(409)
            .json({ error: "La orden ya fue tomada o no está lista." });
        }
      } else if (status === "LLEGÓ AL DOMICILIO") {
        if (currentOrder.driverId?.toString() !== userId)
          return res.status(403).json({ error: "No es tu orden" });

        updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          { status },
          { new: true },
        );
      } else if (status === "ENTREGADO") {
        if (currentOrder.driverId?.toString() !== userId)
          return res.status(403).json({ error: "No es tu orden" });

        updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          { status },
          { new: true },
        );
      }
    } else if (role === "CLIENT") {
      // Cliente cancela
      // SEGURIDAD: El cliente solo puede cancelar, y solo si está pendiente.
      if (status !== "CANCELADO") {
        return res
          .status(403)
          .json({ error: "Acción no permitida para clientes." });
      }
      if (
        currentOrder.status !== "PENDIENTE" &&
        currentOrder.status !== "PAGO_PENDIENTE"
      ) {
        return res
          .status(400)
          .json({ error: "No se puede cancelar una orden en proceso." });
      }
      updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        { status: "CANCELADO" },
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

    // Cuando se entrega correctamente, sumamos las ventas a los productos (Phase 5)
    if (status === "ENTREGADO") {
      try {
        for (const item of updatedOrder.items) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { salesCount: item.quantity },
          });
        }
      } catch (err) {
        console.error("Error actualizando salesCount:", err);
      }
    }

    // Asegurar que el objeto emitido tenga los datos poblados
    await updatedOrder.populate(
      "customerId",
      "firstName lastName phone addresses",
    );
    await updatedOrder.populate("storeId", "storeName storeAddress logo phone");
    const orderJSON = updatedOrder.toJSON();

    // 3. Notificaciones Inteligentes (SEGURIDAD)
    // Usar .id (string) de los documentos poblados para asegurar el envío al socket correcto
    const cId =
      updatedOrder.customerId.id ||
      updatedOrder.customerId._id ||
      updatedOrder.customerId;
    const sId =
      updatedOrder.storeId.id ||
      updatedOrder.storeId._id ||
      updatedOrder.storeId;
    const dId = updatedOrder.driverId
      ? updatedOrder.driverId.id ||
        updatedOrder.driverId._id ||
        updatedOrder.driverId
      : null;

    // Siempre notificar a los participantes directos
    io.to(cId.toString()).emit("order_update", orderJSON);
    io.to(sId.toString()).emit("order_update", orderJSON);
    io.to("MASTER_ROOM").emit("order_update", orderJSON);

    if (dId) {
      io.to(dId.toString()).emit("order_update", orderJSON);
    }

    // Si la orden está lista, notificar a TODOS los repartidores disponibles
    if (status === "LISTO PARA RECOGER") {
      io.to("DRIVERS_ROOM").emit("order_update", orderJSON);
    }
    // Si la orden fue tomada, notificar a los repartidores para que la quiten de su lista "Disponibles"
    if (status === "EN CAMINO") {
      io.to("DRIVERS_ROOM").emit("order_update", orderJSON);
    }

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- USERS & STORES ---
app.get(
  "/api/users/:id/stats",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findById(userId);
      if (!user)
        return res.status(404).json({ error: "Usuario no encontrado" });

      let totalOrders = 0;
      let weeklyRevenue = 0;
      let weeklyOrders = 0;
      let weeklyChart = [];

      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const weekStart = new Date(now.setDate(diff)).setHours(0, 0, 0, 0);

      if (user.role === "STORE") {
        const orders = await Order.find({
          storeId: userId,
          status: { $in: ["ENTREGADO", "Entregado"] },
        });
        totalOrders = orders.length;

        const breakdown = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          d.setHours(0, 0, 0, 0);
          breakdown[d.getTime()] = { date: d.getTime(), total: 0, count: 0 };
        }

        orders.forEach((o) => {
          const d = new Date(o.createdAt);
          const dayStart = new Date(d).setHours(0, 0, 0, 0);

          const oDay = d.getDay();
          const oDiff = d.getDate() - oDay + (oDay === 0 ? -6 : 1);
          const oWeekStart = new Date(new Date(d).setDate(oDiff)).setHours(
            0,
            0,
            0,
            0,
          );

          if (oWeekStart === weekStart) {
            weeklyOrders++;
            weeklyRevenue += o.subtotal || 0;
          }

          if (breakdown[dayStart]) {
            breakdown[dayStart].total += o.subtotal || 0;
            breakdown[dayStart].count++;
          }
        });
        weeklyChart = Object.values(breakdown).sort((a, b) => a.date - b.date);
      } else if (user.role === "CLIENT") {
        totalOrders = await Order.countDocuments({
          customerId: userId,
          status: { $in: ["ENTREGADO", "Entregado"] },
        });
      } else if (user.role === "DELIVERY") {
        totalOrders = await Order.countDocuments({
          driverId: userId,
          status: { $in: ["ENTREGADO", "Entregado"] },
        });
      }

      res.json({
        totalOrders,
        weeklyRevenue,
        weeklyOrders,
        weeklyChart,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

app.get(
  "/api/admin/users",
  verifyToken,
  verifyRole(["MASTER"]), // ELIMINADO: DELIVERY no debe ver todos los usuarios
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
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (req.user.role !== "MASTER" && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (req.user.role !== "MASTER") {
      delete req.body.role;
      delete req.body.approved;
      delete req.body.subscription;
      delete req.body.subscriptionExpiresAt;
    }

    // SEGURIDAD: Hashear contraseña si se envía
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      req.body.password = await bcrypt.hash(req.body.password, salt);
    } else {
      delete req.body.password; // Evitar sobrescribir con vacío
    }

    // --- LÓGICA DE DOWNGRADE AUTOMÁTICO ---
    const oldSubscription = userToUpdate.subscription;
    const newSubscription = req.body.subscription;

    if (
      userToUpdate.role === "STORE" &&
      newSubscription &&
      newSubscription !== oldSubscription
    ) {
      const oldLimit = SUBSCRIPTION_LIMITS[oldSubscription] || 0;
      const newLimit = SUBSCRIPTION_LIMITS[newSubscription] || 0;

      if (newLimit < oldLimit) {
        // Downgrade: Ocultar excedentes
        const visibleProducts = await Product.find({
          storeId: userToUpdate._id,
          isAvailable: true,
        });
        if (visibleProducts.length > newLimit) {
          const toHide = visibleProducts
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, visibleProducts.length - newLimit);
          await Product.updateMany(
            { _id: { $in: toHide.map((p) => p._id) } },
            { isAvailable: false },
          );
        }
      } else if (newLimit > oldLimit) {
        // Upgrade: Reactivar automáticamente productos que fueron ocultados
        const hiddenProducts = await Product.find({
          storeId: userToUpdate._id,
          isAvailable: false,
        });
        const currentlyVisible = await Product.countDocuments({
          storeId: userToUpdate._id,
          isAvailable: true,
        });
        const space = newLimit - currentlyVisible;

        if (hiddenProducts.length > 0 && space > 0) {
          const toRestore = hiddenProducts
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(0, space);
          await Product.updateMany(
            { _id: { $in: toRestore.map((p) => p._id) } },
            { isAvailable: true },
          );
        }
      }
    }

    // --- SOLUCIÓN: Anti-Mass-Assignment ---
    // 1. Definir campos permitidos por rol
    const allowedFields = {
      MASTER: [
        "firstName",
        "lastName",
        "email",
        "phone",
        "password",
        "storeName",
        "storeAddress",
        "subscription",
        "subscriptionExpiresAt",
        "subscriptionPriority",
        "approved",
        "isOpen",
      ],
      STORE: [
        "isOpen",
        "logo",
        "coverImage",
        "description",
        "prepTime",
        "storeAddress",
      ],
      // Permitir que Clientes y Repartidores editen sus datos básicos y notas
      CLIENT: [
        "firstName",
        "lastName",
        "phone",
        "addresses",
        "ineImage",
        "defaultNotes",
      ],
      DELIVERY: [
        "firstName",
        "lastName",
        "phone",
        "addresses",
        "ineImage",
        "defaultNotes",
      ],
      // Clientes y Repartidores pueden ser editados por el Master, no por ellos mismos (excepto contraseña, etc. en otro endpoint)
    };

    // 2. Construir un objeto de actualización seguro
    const updateData = {};
    const fields =
      allowedFields[
        req.user.role === "MASTER" && req.body.isMasterUpdate
          ? "MASTER"
          : req.user.role
      ] || [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        // Manejo especial para imágenes
        if (
          (field === "logo" || field === "coverImage") &&
          req.body[field].startsWith("data:")
        ) {
          updateData[field] = await uploadImage(req.body[field]);
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    // Si se envió una nueva contraseña, la agregamos al objeto de actualización
    if (req.body.password) {
      updateData.password = req.body.password;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    );
    // --- FIN DE LA SOLUCIÓN ---

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
    const { storeId, search } = req.query;
    const filter = storeId ? { storeId } : {};

    if (search) {
      // Búsqueda insensible a mayúsculas/minúsculas en nombre y descripción
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    res.json(await Product.find(filter));
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
        const limit = SUBSCRIPTION_LIMITS[user.subscription] || 20;
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

// --- COMMUNITY MESSAGES (NEWSLETTER) ---
app.post(
  "/api/community-messages",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      if (req.body.imageUrl && req.body.imageUrl.startsWith("data:")) {
        req.body.imageUrl = await uploadImage(req.body.imageUrl);
      }
      const msg = await CommunityMessage.create(req.body);
      io.emit("community_message_update", msg); // Notificar a todos
      res.status(201).json(msg);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.put(
  "/api/community-messages/:id",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      if (req.body.imageUrl && req.body.imageUrl.startsWith("data:")) {
        req.body.imageUrl = await uploadImage(req.body.imageUrl);
      }
      const msg = await CommunityMessage.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true },
      );
      io.emit("community_message_update", msg); // Notificar a todos
      res.json(msg);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

app.delete(
  "/api/community-messages/:id",
  verifyToken,
  verifyRole(["MASTER"]),
  async (req, res) => {
    try {
      await CommunityMessage.findByIdAndDelete(req.params.id);
      io.emit("community_message_delete", req.params.id); // Notificar a todos
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  },
);

// --- MERCADOPAGO WEBHOOKS ---
app.post("/api/webhooks/mercadopago", async (req, res) => {
  try {
    const payment = req.body;
    // Dummy: simulamos que nos llega el orderId desde external_reference
    const external_reference = payment?.external_reference || req.query.id;
    const status = payment?.status || "approved";

    if (external_reference && status === "approved") {
      const updatedOrder = await Order.findByIdAndUpdate(
        external_reference,
        {
          status: "PENDIENTE",
          paymentStatus: "PAID",
        },
        { new: true },
      ).populate("customerId", "firstName lastName phone addresses");

      if (updatedOrder) {
        const orderJSON = updatedOrder.toJSON();
        io.to(updatedOrder.storeId.toString()).emit("order_update", orderJSON);
        io.to("MASTER_ROOM").emit("order_update", orderJSON);
        io.to(updatedOrder.customerId._id.toString()).emit(
          "order_update",
          orderJSON,
        );
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook MP error:", error);
    res.sendStatus(500);
  }
});

app.get("/api/init", async (req, res) => {
  try {
    const { role, userId } = req.query;

    let productFilter = {};
    let userFilter = { role: "STORE", isOpen: true, approved: true };
    let productSelect = ""; // Por defecto trae todo

    // Si es Master, debe poder ver todos los usuarios para gestión
    if (role === "MASTER") {
      userFilter = {};
    }
    // OPTIMIZACIÓN: Si es tienda, solo descargar sus propios datos
    else if (role === "STORE" && userId) {
      productFilter = { storeId: userId };
      userFilter = { _id: userId }; // Solo traerse a sí mismo
    } else if (role === "CLIENT") {
      // OPTIMIZACIÓN EXTREMA: Carga perezosa (Lazy Loading).
      // El cliente descarga SOLO las tiendas. Los productos se cargan al entrar a la tienda.
      // SELECCIÓN DE CAMPOS: Solo traer lo necesario para la tarjeta de la tienda, evitando datos pesados innecesarios.

      // Filtrar mensajes de comunidad que no hayan expirado
      const now = new Date();
      const [users, colonies, settings, communityMessages] = await Promise.all([
        User.find(userFilter).select(
          "storeName storeAddress logo coverImage description prepTime averageRating ratingCount isOpen subscription role",
        ),
        Colony.find(),
        Settings.findOne(),
        CommunityMessage.find({ expiresAt: { $gt: now } }).sort({
          createdAt: -1,
        }),
      ]);
      // Retornamos array vacío de productos para que la carga sea instantánea
      return res.json({
        users,
        products: [],
        orders: [],
        colonies,
        settings,
        communityMessages,
      });
    }

    // Para el Master, traemos TODOS los mensajes (incluso expirados)
    // Para Store/Delivery, no son necesarios por ahora, pero por consistencia los enviamos si se requieren
    let messagesPromise = Promise.resolve([]);
    if (role === "MASTER") {
      messagesPromise = CommunityMessage.find().sort({ createdAt: -1 });
    }

    const [users, products, colonies, settings, communityMessages] =
      await Promise.all([
        User.find(userFilter).select("-password"),
        Product.find(productFilter).select(productSelect),
        Colony.find(),
        Settings.findOne(),
        messagesPromise,
      ]);

    res.json({
      users,
      products,
      orders: [], // No enviar órdenes públicas
      colonies,
      settings,
      communityMessages,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
