import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import bcrypt from 'bcryptjs';
import { User, Product, Order, Colony } from './models.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Aumentado para aceptar imágenes base64

// Configuración Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Conexión MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Conectado Exitosamente'))
  .catch(err => {
    console.error('❌ Error conectando a MongoDB:', err.message);
    console.error('CONSEJO: Verifica que hayas reemplazado <password> en el archivo .env por tu contraseña real de Atlas.');
  });

// --- RUTAS ---

// 1. Inicialización (Cargar datos iniciales)
app.get('/api/init', async (req, res) => {
  try {
    // Crear Master por defecto si no existe
    const masterExists = await User.findOne({ role: 'MASTER' });
    if (!masterExists) {
      console.log("Creando usuario Master por defecto...");
      await User.create({
        role: 'MASTER',
        firstName: 'Master',
        lastName: 'Admin',
        phone: '0000000000',
        email: 'admin@red.com',
        password: '123', // Demo
        approved: true
      });
    }

    const users = await User.find({});
    const products = await Product.find({});
    const orders = await Order.find({});
    const colonies = await Colony.find({});

    res.json({ users, products, orders, colonies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UTILIDAD: Resetear Base de Datos (Solo para desarrollo)
// Llama a esta ruta (POST /api/admin/reset) para borrar todo y recrear el Master
app.post('/api/admin/reset', async (req, res) => {
  try {
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Colony.deleteMany({});

    // Recrear Master
    await User.create({
      role: 'MASTER',
      firstName: 'Master',
      lastName: 'Admin',
      phone: '0000000000',
      email: 'admin@red.com',
      password: '123',
      approved: true
    });

    res.json({ message: "Base de datos reseteada completamente. Usuario Master recreado." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Autenticación
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    // Verificar si la contraseña está hasheada (si empieza con $2...)
    let isMatch = false;
    if (user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // Fallback para usuarios antiguos sin hash
      isMatch = user.password === password;
    }

    if (!isMatch) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (!user.approved) return res.status(403).json({ error: 'Cuenta no aprobada' });

    // Retornamos el usuario (sin password)
    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    let userData = req.body;

    // Verificar si ya existe
    const exists = await User.findOne({ email: userData.email });
    if (exists) return res.status(400).json({ error: 'El correo ya está registrado' });

    // Hashear password
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);

    // Subir imagen a Cloudinary si existe
    if (userData.ineImage && userData.ineImage.startsWith('data:image')) {
      const upload = await cloudinary.uploader.upload(userData.ineImage, { folder: 'red_delivery/users' });
      userData.ineImage = upload.secure_url;
    }

    const newUser = await User.create(userData);
    const userObj = newUser.toObject();
    delete userObj.password;

    res.json(userObj);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Gestión Usuarios
app.put('/api/users/:id', async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// 4. Gestión Productos
app.post('/api/products', async (req, res) => {
  try {
    let prodData = req.body;
    // Imagen de producto (simulada o subida)
    if (prodData.image && prodData.image.startsWith('data:image')) {
      const upload = await cloudinary.uploader.upload(prodData.image, { folder: 'red_delivery/products' });
      prodData.image = upload.secure_url;
    }
    const newProd = await Product.create(prodData);
    res.json(newProd);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/products/:id', async (req, res) => {
  const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

app.delete('/api/products/:id', async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// 5. Gestión Pedidos
app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = await Order.create(req.body);
    res.json(newOrder);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { status, driverId } = req.body;
  const updateData = { status };
  if (driverId) updateData.driverId = driverId;

  const updated = await Order.findByIdAndUpdate(req.params.id, updateData, { new: true });
  res.json(updated);
});

// 6. Gestión Colonias
app.post('/api/colonies', async (req, res) => {
  const col = await Colony.create(req.body);
  res.json(col);
});

app.put('/api/colonies/:id', async (req, res) => {
  const col = await Colony.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(col);
});

app.delete('/api/colonies/:id', async (req, res) => {
  await Colony.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));