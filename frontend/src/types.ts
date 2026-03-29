export enum UserRole {
  MASTER = "MASTER",
  STORE = "STORE",
  DELIVERY = "DELIVERY",
  CLIENT = "CLIENT",
}

export enum SubscriptionType {
  BLACK = "BLACK",
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
  AWAITING_PAYMENT = "PAGO_PENDIENTE",
  PENDING = "PENDIENTE",
  PREPARING = "PREPARANDO",
  READY = "LISTO PARA RECOGER",
  ON_WAY = "EN CAMINO",
  ARRIVED = "LLEGÓ AL DOMICILIO",
  DELIVERED = "ENTREGADO",
  REJECTED = "RECHAZADO",
  CANCELLED = "CANCELADO",
}

export interface SystemSettings {
  id?: string;
  commissionRate: number; // Banderazo como porcentaje
  kmRate: number; // Tarifa por Km para el repartidor
  companyKmRate: number; // Tarifa por Km para el Master
}

export interface Colony {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password?: string;
  authProvider?: "LOCAL" | "GOOGLE" | "APPLE";
  ineImage?: string; // base64 or url
  defaultNotes?: string;
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
  averageRating?: number;
  ratingCount?: number;
  subscriptionExpiresAt?: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  salesCount?: number;
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
  price?: number;
  notes?: string;
}

export interface Order {
  id: string;
  customerId: string | User; // Puede venir poblado del backend
  storeId: string | StoreProfile; // Puede venir poblado del backend
  driverId?: string;
  items: CartItem[];
  status: OrderStatus;
  subtotal: number;
  total: number;
  deliveryFee: number;
  driverFee?: number; // What the driver earns
  companyDistanceFee?: number; // Lo que gana el Master por distancia
  paymentMethod: "CARD" | "CASH";
  deliveryAddress: Address;
  createdAt: number;
  isReviewed?: boolean;
}

export interface CommunityMessage {
  id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  expiresAt: string; // ISO Date string
  storeId?: string | StoreProfile; // Opcional: Enlace a tienda
  createdAt: string;
}
