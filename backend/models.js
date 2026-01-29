import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['MASTER', 'STORE', 'DELIVERY', 'CLIENT'] },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // En producción, usar bcrypt para hashear
  ineImage: String,
  approved: { type: Boolean, default: false },
  addresses: [{
    street: String,
    number: String,
    colonyId: String,
    reference: String
  }],
  // Store Specific
  storeName: String,
  storeAddress: {
    street: String,
    number: String,
    colonyId: String
  },
  subscription: { type: String, enum: ['ULTRA', 'PREMIUM', 'STANDARD'], default: 'STANDARD' },
  subscriptionPriority: { type: Number, default: 0 },
  isOpen: { type: Boolean, default: false },
  logo: String,
  coverImage: String,
  description: String,
  prepTime: String
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  category: String,
  image: String
});

const OrderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: Object, required: true }, // Guardamos snapshot del producto
    quantity: Number
  }],
  status: { type: String, default: 'PENDING' },
  total: Number,
  deliveryFee: Number,
  paymentMethod: String,
  deliveryAddress: Object
}, { timestamps: true });

const ColonySchema = new mongoose.Schema({
  name: { type: String, required: true },
  deliveryFee: { type: Number, required: true }
});

export const User = mongoose.model('User', UserSchema);
export const Product = mongoose.model('Product', ProductSchema);
export const Order = mongoose.model('Order', OrderSchema);
export const Colony = mongoose.model('Colony', ColonySchema);
