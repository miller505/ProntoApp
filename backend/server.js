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
import jwt from "jsonwebtoken"; // NECESARIO: npm install jsonwebtoken
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
    origin: [
      "http://localhost:3000",
      "https://prontomx.com",
      "https://www.prontomx.com",
    ], // Producción Real
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

// --- MIDDLEWARES DE SEGURIDAD ---

const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Acceso denegado" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ error: "Token inválido" });
  }
};

// Función auxiliar para calcular distancia (Haversine) en el servidor
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio tierra km
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

// --- RUTAS ---

// 1. Inicialización (Cargar datos iniciales)
app.get("/api/init", async (req, res) => {
  try {
    // Crear Master por defecto si no existe
    const masterExists = await User.findOne({ role: "MASTER" });
    if (!masterExists) {
      console.log("Creando usuario Master por defecto...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("123", salt);
      await User.create({
        role: "MASTER",
        firstName: "Master",
        lastName: "Admin",
        phone: "0000000000",
        email: "admin@red.com",
        password: hashedPassword,
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

// 2. Autenticación
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ error: "Credenciales inválidas" });
    if (!user.approved)
      return res.status(403).json({ error: "Cuenta no aprobada" });

    // Generar Token JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    const userObj = user.toObject();
    delete userObj.password;

    // Retornar usuario y token
    res.json({ user: userObj, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    let userData = req.body;

    // Verificar si ya existe
    const emailExists = await User.findOne({ email: userData.email });
    if (emailExists)
      return res.status(400).json({ error: "El correo ya está registrado" });

    const phoneExists = await User.findOne({ phone: userData.phone });
    if (phoneExists)
      return res.status(400).json({ error: "El teléfono ya está registrado" });

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

    // Generar token para auto-login al registrarse
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    const userObj = newUser.toObject();
    delete userObj.password;
    io.emit("user_update", userObj); // Notificar nuevo usuario

    res.json({ user: userObj, token });
  } catch (error) {
    // Log the full error on the server for better debugging
    console.error("Error en registro:", error);

    // Mongoose validation error (e.g. required field is missing)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res
        .status(400)
        .json({ error: `Error de validación: ${messages.join(", ")}` });
    }

    // Mongoose duplicate key error (this is a fallback for other unique fields)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res
        .status(400)
        .json({ error: `El campo '${field}' ya existe y debe ser único.` });
    }

    res
      .status(400)
      .json({ error: "Ocurrió un error inesperado durante el registro." });
  }
});

// 3. Gestión Usuarios
app.put("/api/users/:id", verifyToken, async (req, res) => {
  try {
    const userIdToUpdate = req.params.id;
    const requesterId = req.user.id; // Viene del Token JWT
    const requester = await User.findById(requesterId);

    if (!requester) {
      return res.status(403).json({ error: "Acción no autorizada" });
    }

    let allowedUpdates = {};
    const { _id, role, approved, ...updateData } = req.body;

    // Si el Master está actualizando, tiene más permisos.
    if (requester.role === "MASTER") {
      // Confiar solo en el rol del token
      allowedUpdates = updateData;
      // Si el master cambia la contraseña, hashearla.
      if (updateData.password && updateData.password.length > 0) {
        const salt = await bcrypt.genSalt(10);
        allowedUpdates.password = await bcrypt.hash(updateData.password, salt);
      }
    } else if (requesterId === userIdToUpdate) {
      // Un usuario solo puede actualizar sus propios datos permitidos.
      // Tiendas:
      if (requester.role === "STORE") {
        allowedUpdates = {
          prepTime: updateData.prepTime,
          description: updateData.description,
          logo: updateData.logo,
          coverImage: updateData.coverImage,
          isOpen: updateData.isOpen,
        };
      }
      // Aquí iría la lógica para otros roles (CLIENT, DELIVERY)
    } else {
      return res.status(403).json({ error: "Acción no autorizada" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      allowedUpdates,
      {
        new: true,
      },
    );

    const userObj = updated.toObject();
    delete userObj.password;
    io.emit("user_update", userObj); // Notificar actualización
    res.json(userObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", verifyToken, async (req, res) => {
  if (req.user.role !== "MASTER")
    return res.status(403).json({ error: "Solo Master" });
  await User.findByIdAndDelete(req.params.id);
  io.emit("user_delete", req.params.id); // Notificar eliminación
  res.json({ success: true });
});

// 4. Gestión Productos
app.post("/api/products", verifyToken, async (req, res) => {
  try {
    let prodData = req.body;

    // Autorización: Solo la tienda dueña puede añadir productos a su ID.
    if (req.user.role !== "STORE" || req.user.id !== prodData.storeId) {
      return res
        .status(403)
        .json({ error: "No autorizado para añadir productos a esta tienda." });
    }

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

app.put("/api/products/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ error: "Producto no encontrado." });

    // Autorización: Solo la tienda dueña puede editar.
    if (
      req.user.role !== "STORE" ||
      product.storeId.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "No autorizado para editar este producto." });
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    io.emit("product_update", updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/products/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ error: "Producto no encontrado." });

    if (
      req.user.role !== "STORE" ||
      product.storeId.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ error: "No autorizado para eliminar este producto." });
    }
    await Product.findByIdAndDelete(req.params.id);
    io.emit("product_delete", req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Gestión Pedidos
app.post("/api/orders", verifyToken, async (req, res) => {
  try {
    const { items, deliveryAddress, storeId, paymentMethod } = req.body;

    // 1. Validar Precios de Productos (Evitar hackeo de precios)
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product.id);
      if (!product) continue;
      subtotal += product.price * item.quantity;
      validatedItems.push({ ...item, product }); // Usar datos de DB
    }

    // 2. Calcular Envío en Servidor (Evitar hackeo de tarifa)
    const settings = await Settings.findOne({});
    const clientColony = await Colony.findById(deliveryAddress.colonyId);
    const storeUser = await User.findById(storeId);
    const storeColony = storeUser.storeAddress?.colonyId
      ? await Colony.findById(storeUser.storeAddress.colonyId)
      : null;

    let deliveryFee = 0;
    let driverFee = 0;

    if (clientColony && storeColony && settings) {
      const dist = calculateDistance(
        clientColony.lat,
        clientColony.lng,
        storeColony.lat,
        storeColony.lng,
      );
      driverFee = Math.ceil(dist * settings.kmRate);
      if (driverFee < settings.kmRate) driverFee = settings.kmRate; // Mínimo 1km
      deliveryFee = driverFee + settings.baseFee;
    }

    const total = subtotal + deliveryFee;

    const newOrder = await Order.create({
      customerId: req.user.id,
      storeId,
      items: validatedItems,
      status: "PENDING",
      total,
      deliveryFee,
      driverFee,
      paymentMethod,
      deliveryAddress,
      createdAt: Date.now(),
    });

    io.emit("order_update", newOrder);
    res.json(newOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/orders/:id/status", verifyToken, async (req, res) => {
  const { status, driverId } = req.body;
  const updateData = { status };
  if (driverId) updateData.driverId = driverId;

  // Lógica Atómica para evitar que dos repartidores tomen el mismo pedido
  let query = { _id: req.params.id };
  if (status === "ON_WAY" && driverId) {
    query.driverId = null; // Solo actualizar si no tiene driver asignado
  }

  const updated = await Order.findOneAndUpdate(query, updateData, {
    new: true,
  });

  if (!updated && status === "ON_WAY") {
    return res
      .status(409)
      .json({ error: "Este pedido ya fue tomado por otro repartidor." });
  }

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

// --- UTILIDADES DE DESARROLLO ---

// ADVERTENCIA: Endpoint para borrar todos los datos (SOLO PARA DESARROLLO)
// Para usarlo, envía una petición POST a /api/admin/wipe-all-data
// con un body JSON: { "password": "mi_clave_secreta_para_borrar" }
app.post("/api/admin/wipe-all-data", async (req, res) => {
  const { password } = req.body;
  if (password !== "mi_clave_secreta_para_borrar") {
    return res.status(403).json({ error: "Contraseña incorrecta." });
  }

  try {
    console.log("⚠️  Iniciando borrado de la base de datos...");
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      console.log(` -> Borrando colección: ${collection.collectionName}`);
      await collection.drop();
    }
    console.log("✅ Todas las colecciones han sido borradas.");

    // Opcional: Re-crear el usuario Master y las configuraciones
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("123", salt);
    await User.create({
      role: "MASTER",
      firstName: "Master",
      lastName: "Admin",
      phone: "0000000000",
      email: "admin@red.com",
      password: hashedPassword,
      approved: true,
    });
    await Settings.create({ baseFee: 15, kmRate: 5 });
    console.log("✅ Usuario Master y configuraciones recreados.");

    res.json({ message: "Base de datos reseteada exitosamente." });
  } catch (error) {
    console.error("❌ Error durante el reseteo:", error);
    res.status(500).json({ error: "Error al resetear la base de datos." });
  }
});

httpServer.listen(PORT, () =>
  console.log(`Servidor corriendo en puerto ${PORT}`),
);
