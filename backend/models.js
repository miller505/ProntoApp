import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["MASTER", "STORE", "DELIVERY", "CLIENT"],
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // En producción, usar bcrypt para hashear
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
    isOpen: { type: Boolean, default: false },
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
  },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  image: String,
  isVisible: { type: Boolean, default: true },
});

const OrderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        product: { type: Object, required: true }, // Guardamos snapshot del producto
        quantity: Number,
      },
    ],
    status: { type: String, default: "PENDING" },
    total: Number,
    deliveryFee: Number,
    driverFee: Number, // Portion of deliveryFee that goes to driver
    isReviewed: { type: Boolean, default: false },
    paymentMethod: String,
    deliveryAddress: Object,
  },
  { timestamps: true },
);

const MessageSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // receiverId is useful for notifications, but not strictly required for the room logic
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
  // deliveryFee is deprecated in favor of dynamic calculation
});

const SettingsSchema = new mongoose.Schema({
  baseFee: { type: Number, default: 15 }, // Banderazo (Commission)
  kmRate: { type: Number, default: 5 }, // Tarifa por Km
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
