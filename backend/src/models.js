import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["MASTER", "STORE", "DELIVERY", "CLIENT"],
      index: true,
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    ineImage: String,
    approved: { type: Boolean, default: false },
    addresses: [
      {
        street: String,
        number: String,
        colonyId: String,
        reference: String,
      },
    ],
    // Store Specific
    storeName: String,
    storeAddress: {
      street: String,
      number: String,
      colonyId: String,
    },
    subscription: {
      type: String,
      enum: ["ULTRA", "PREMIUM", "STANDARD"],
      default: "STANDARD",
    },
    subscriptionPriority: { type: Number, default: 0 },
    isOpen: { type: Boolean, default: false, index: true },
    logo: String,
    coverImage: String,
    description: String,
    prepTime: String,
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// === FILTRO DE SEGURIDAD (EVITA FUGA DE DATOS AL FRONTEND) ===
UserSchema.set("toJSON", {
  transform: function (doc, ret, options) {
    delete ret.password; // Nunca envía la contraseña
    // CORRECCIÓN: No eliminamos ineImage aquí porque el Master necesita verla para aprobar.
    // Al usar Cloudinary, esto será una URL segura, no un string base64 gigante.
    return ret;
  },
});

const ProductSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    image: String,
    isAvailable: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    customizations: [
      {
        name: String,
        options: [
          {
            name: String,
            additionalPrice: Number,
          },
        ],
        required: Boolean,
        multiple: Boolean,
      },
    ],
  },
  { timestamps: true },
);

const OrderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    items: [
      {
        // Snapshot del producto al momento de la compra para integridad histórica
        product: {
          name: { type: String, required: true },
          price: { type: Number, required: true },
          image: String,
          // Puedes agregar otros campos que consideres importantes para el historial
        },
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        notes: String,
        customizations: [
          {
            name: String,
            option: String,
            additionalPrice: Number,
          },
        ],
      },
    ],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    driverFee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "PENDIENTE",
        "PREPARANDO",
        "LISTO PARA RECOGER",
        "EN CAMINO",
        "LLEGÓ AL DOMICILIO",
        "ENTREGADO",
        "RECHAZADO",
        "CANCELADO",
      ],
      default: "PENDIENTE",
      index: true,
    },
    deliveryAddress: {
      street: String,
      number: String,
      colonyId: String,
      reference: String,
    },
    paymentMethod: { type: String, enum: ["CASH", "CARD"], required: true },
    isReviewed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const MessageSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const ColonySchema = new mongoose.Schema({
  name: { type: String, required: true },
  lat: { type: Number, default: 0 },
  lng: { type: Number, default: 0 },
});

const SettingsSchema = new mongoose.Schema({
  commissionRate: { type: Number, default: 5 }, // Banderazo como %
  kmRate: { type: Number, default: 5 }, // Tarifa por Km para el repartidor
});

const ReviewSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: true },
);

export const User = mongoose.model("User", UserSchema);
export const Product = mongoose.model("Product", ProductSchema);
export const Order = mongoose.model("Order", OrderSchema);
export const Colony = mongoose.model("Colony", ColonySchema);
export const Message = mongoose.model("Message", MessageSchema);
export const Settings = mongoose.model("Settings", SettingsSchema);
export const Review = mongoose.model("Review", ReviewSchema);
