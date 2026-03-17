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
  PENDING = "Pendiente",
  PREPARING = "Preparando",
  READY = "Listo para Recoger",
  ON_WAY = "En Camino",
  DELIVERED = "Entregado",
  REJECTED = "Rechazado",
  CANCELLED = "Cancelado",
}

export interface SystemSettings {
  id?: string;
  baseFee: number; // Banderazo
  kmRate: number; // Tarifa por Km
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
  averageRating?: number;
  ratingCount?: number;
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
  notes?: string;
}

export interface Order {
  id: string;
  customerId: string | User; // Puede venir poblado del backend
  storeId: string | StoreProfile; // Puede venir poblado del backend
  driverId?: string;
  items: CartItem[];
  status: OrderStatus;
  total: number;
  deliveryFee: number;
  driverFee?: number; // What the driver earns
  paymentMethod: "CARD" | "CASH";
  deliveryAddress: Address;
  createdAt: number;
  isReviewed?: boolean;
}
