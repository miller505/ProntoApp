import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["MASTER", "STORE", "DELIVERY", "CLIENT"],
      index: true, // Optimiza búsquedas por rol
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true }, // Optimiza login
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
    isOpen: { type: Boolean, default: false, index: true }, // Optimiza mostrar tiendas abiertas
    logo: String,
    coverImage: String,
    description: String,
    prepTime: String,
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const ProductSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: { type: String, required: true },
  image: String,
  isVisible: { type: Boolean, default: true },
});

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
    }, // Puede ser null al inicio
    items: [
      {
        product: { type: Object, required: true }, // Guardamos snapshot del producto
        quantity: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: [
        "PENDING",
        "PREPARING",
        "READY",
        "ON_WAY",
        "DELIVERED",
        "REJECTED",
      ],
      default: "PENDING",
      index: true,
    },
    total: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    deliveryAddress: { type: Object, required: true },
    storeName: String, // Snapshot para evitar lookups masivos
    customerName: String,
    driverName: String,
  },
  { timestamps: true },
);

const MessageSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
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
  baseFee: { type: Number, default: 15 },
  kmRate: { type: Number, default: 5 },
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
