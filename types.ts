export enum UserRole {
  MASTER = "MASTER",
  STORE = "STORE",
  DELIVERY = "DELIVERY",
  CLIENT = "CLIENT",
}

export enum SubscriptionType {
  ULTRA = "ULTRA",
  PREMIUM = "PREMIUM",
  STANDARD = "STANDARD",
}
export interface Message {
  _id?: string;
  id: string;
  orderId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
}

export enum OrderStatus {
  PENDING = "PENDING", // Waiting for store acceptance
  PREPARING = "PREPARING", // Store accepted, cooking
  READY = "READY", // Ready for pickup (Pool for drivers)
  ON_WAY = "ON_WAY", // Driver picked up
  DELIVERED = "DELIVERED", // Completed
  REJECTED = "REJECTED", // Store rejected
}

export interface Colony {
  id: string;
  name: string;
  deliveryFee: number;
}

export interface User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password?: string;
  ineImage?: string; // base64 or url
  addresses?: Address[];
  approved: boolean; // For registration approval
}

export interface StoreProfile extends User {
  storeName: string;
  storeAddress: {
    street: string;
    number: string;
    colonyId: string;
  };
  subscription: SubscriptionType;
  subscriptionPriority: number; // For manual ordering by Master
  isOpen: boolean;
  logo?: string;
  coverImage?: string;
  description?: string;
  prepTime?: string; // e.g. "20-30 min"
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
}

export interface Address {
  id: string;
  street: string;
  number: string;
  colonyId: string;
  reference: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  customerId: string;
  storeId: string;
  driverId?: string;
  items: CartItem[];
  status: OrderStatus;
  total: number;
  deliveryFee: number;
  paymentMethod: "CARD" | "CASH";
  deliveryAddress: Address;
  createdAt: number;
}
