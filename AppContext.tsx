import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import {
  User,
  StoreProfile,
  Product,
  Order,
  Colony,
  Message,
  OrderStatus,
  SubscriptionType,
  SystemSettings,
} from "./types";
import { api } from "./src/api"; // Importamos la conexión real
import { io } from "socket.io-client";

interface AppContextType {
  currentUser: User | StoreProfile | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  register: (user: User | StoreProfile) => Promise<boolean>;

  users: (User | StoreProfile)[];
  updateUser: (user: User | StoreProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  colonies: Colony[];
  addColony: (colony: Colony) => Promise<void>;
  updateColony: (colony: Colony) => Promise<void>;
  deleteColony: (id: string) => Promise<void>;

  settings: SystemSettings;
  updateSettings: (settings: SystemSettings) => Promise<void>;

  products: Product[];
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  orders: Order[];
  placeOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    driverId?: string,
  ) => Promise<void>;

  messages: Message[];
  fetchMessages: (orderId: string) => Promise<void>;
  sendMessage: (message: Omit<Message, "id" | "createdAt">) => Promise<void>;
  joinChatRoom: (orderId: string) => void;

  addReview: (data: {
    orderId: string;
    storeId: string;
    customerId: string;
    rating: number;
    comment: string;
  }) => Promise<void>;

  getStoreReviews: (storeId: string) => Promise<any[]>;

  // Cart Logic for Client
  cart: { product: Product; quantity: number }[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | StoreProfile | null>(
    null,
  );
  const [users, setUsers] = useState<(User | StoreProfile)[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    baseFee: 0,
    kmRate: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>(
    [],
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [socket, setSocket] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Initial Load from Backend
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/init");
      // Mapear _id de mongo a id string para el frontend
      const mapId = (list: any[]) =>
        list.map((item) => ({ ...item, id: item._id }));

      setUsers(mapId(data.users));
      setProducts(mapId(data.products));
      setOrders(mapId(data.orders));
      setColonies(mapId(data.colonies));
      if (data.settings)
        setSettings({ ...data.settings, id: data.settings._id });
    } catch (error) {
      console.error("Error cargando datos", error);
    } finally {
      setLoading(false);
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        console.error("Error restoring session", e);
        localStorage.removeItem("currentUser");
      }
    }
  }, []);

  // --- REAL-TIME UPDATES (Socket.io) ---
  useEffect(() => {
    // Conectar al backend (ajusta la URL si es diferente en producción)
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    // Helper para actualizar listas (insertar o reemplazar)
    const handleUpdate = (setter: any) => (data: any) => {
      // Mapear _id a id para consistencia con el frontend
      const item = { ...data, id: String(data._id || data.id) };
      setter((prev: any[]) => {
        const index = prev.findIndex((i) => String(i.id) === item.id);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = item;
          return newArr;
        }
        return [...prev, item];
      });
    };

    // Helper para eliminar de listas
    const handleDelete = (setter: any) => (id: string) => {
      setter((prev: any[]) => prev.filter((i) => i.id !== id));
    };

    // Escuchar eventos
    newSocket.on("order_update", handleUpdate(setOrders));

    newSocket.on("product_update", handleUpdate(setProducts));
    newSocket.on("product_delete", handleDelete(setProducts));

    newSocket.on("user_update", handleUpdate(setUsers));
    newSocket.on("user_delete", handleDelete(setUsers));

    newSocket.on("colony_update", handleUpdate(setColonies));
    newSocket.on("colony_delete", handleDelete(setColonies));

    newSocket.on("settings_update", (data: any) => {
      const mapped = { ...data, id: data._id || data.id };
      setSettings(mapped);
    });

    // Nuevo listener para mensajes de chat
    newSocket.on("new_message", (message: any) => {
      const mappedMessage = { ...message, id: message._id };
      setMessages((prev) => [...prev, mappedMessage]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // --- AUTH ---
  const login = async (email: string, pass: string) => {
    try {
      const { data } = await api.post("/auth/login", { email, password: pass });
      const { user, token } = data;
      const mappedUser = { ...user, id: user._id };

      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(mappedUser));
      setCurrentUser(mappedUser);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setCart([]);
    // Limpiar sesión completa
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
  };

  const register = async (newUser: User | StoreProfile): Promise<boolean> => {
    try {
      // El registro ahora también devuelve un token para auto-login
      const { data } = await api.post("/auth/register", newUser);
      const { user, token } = data;
      const mappedUser = { ...user, id: user._id };

      // No guardamos la sesión aquí, el usuario debe ser aprobado por el Master primero.
      // La alerta de éxito se maneja en el componente Register.
      return true;
    } catch (e: any) {
      console.error(e);
      const errorMessage =
        e.response?.data?.error || "Error en el registro. Intenta de nuevo.";
      alert(errorMessage);
      return false;
    }
  };

  // --- USER MGMT ---
  const updateUser = async (updatedUser: User | StoreProfile) => {
    try {
      const { data } = await api.put(`/users/${updatedUser.id}`, updatedUser);
      const mapped = { ...data, id: data._id };
      setUsers(users.map((u) => (u.id === mapped.id ? mapped : u)));
      if (currentUser?.id === mapped.id) {
        setCurrentUser(mapped);
        // Update session in localStorage
        localStorage.setItem("currentUser", JSON.stringify(mapped));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUser = async (id: string) => {
    await api.delete(`/users/${id}`);
    setUsers(users.filter((u) => u.id !== id));
  };

  // --- COLONY MGMT ---
  const addColony = async (c: Colony) => {
    const { data } = await api.post("/colonies", c);
    setColonies([...colonies, { ...data, id: data._id }]);
  };
  const updateColony = async (c: Colony) => {
    await api.put(`/colonies/${c.id}`, c);
    setColonies(colonies.map((col) => (col.id === c.id ? c : col)));
  };
  const deleteColony = async (id: string) => {
    await api.delete(`/colonies/${id}`);
    setColonies(colonies.filter((c) => c.id !== id));
  };

  // --- SETTINGS MGMT ---
  const updateSettings = async (s: SystemSettings) => {
    const { data } = await api.put("/settings", s);
    setSettings({ ...data, id: data._id });
  };

  // --- PRODUCT MGMT ---
  const addProduct = async (p: Product) => {
    const { data } = await api.post("/products", p);
    setProducts([...products, { ...data, id: data._id }]);
  };
  const updateProduct = async (p: Product) => {
    await api.put(`/products/${p.id}`, p);
    setProducts(products.map((prod) => (prod.id === p.id ? p : prod)));
  };
  const deleteProduct = async (id: string) => {
    await api.delete(`/products/${id}`);
    setProducts(products.filter((p) => p.id !== id));
  };

  // --- ORDER MGMT ---
  const placeOrder = async (orderData: {
    storeId: string;
    items: { product: Product; quantity: number }[];
    paymentMethod: "CASH" | "CARD";
    deliveryAddress: any;
  }) => {
    try {
      // El frontend solo envía los datos esenciales.
      // El backend calcula precios, tarifas y totales.
      const { data } = await api.post("/orders", {
        ...orderData,
        customerId: currentUser!.id, // El backend lo verificará con el token de todos modos
      });
      // El socket se encargará de actualizar el estado de `orders`
      clearCart();
    } catch (e) {
      console.error(e);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    driverId?: string,
  ) => {
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, {
        status,
        driverId,
      });
      const mapped = { ...data, id: data._id };
      setOrders(orders.map((o) => (o.id === orderId ? mapped : o)));
      return mapped; // Devolver el pedido actualizado para manejar el flujo
    } catch (e) {
      console.error(e);
    }
  };

  // --- CHAT MGMT ---
  const fetchMessages = async (orderId: string) => {
    try {
      const { data } = await api.get(`/messages/${orderId}`);
      const mapped = data.map((m: any) => ({ ...m, id: m._id }));
      setMessages(mapped);
    } catch (e) {
      console.error("Error fetching messages", e);
      setMessages([]);
    }
  };

  const sendMessage = async (message: Omit<Message, "id" | "createdAt">) => {
    try {
      // El backend guarda y emite, el listener 'new_message' actualiza el estado
      await api.post("/messages", message);
    } catch (e) {
      console.error("Error sending message", e);
    }
  };

  const joinChatRoom = (orderId: string) => {
    if (socket) socket.emit("join_order_room", orderId);
  };

  // --- REVIEWS ---
  const addReview = async (data: any) => {
    try {
      await api.post("/reviews", data);
    } catch (e) {
      console.error("Error adding review", e);
    }
  };

  const getStoreReviews = async (storeId: string) => {
    try {
      const { data } = await api.get(`/reviews/${storeId}`);
      return data;
    } catch (e) {
      console.error("Error fetching reviews", e);
      return [];
    }
  };

  // --- CART (Client side logic remains) ---
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      if (cart.length > 0 && cart[0].product.storeId !== product.storeId) {
        if (
          window.confirm(
            "Solo puedes pedir de una tienda a la vez. ¿Vaciar carrito?",
          )
        ) {
          setCart([{ product, quantity: 1 }]);
        }
      } else {
        setCart([...cart, { product, quantity: 1 }]);
      }
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find((item) => item.product.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        ),
      );
    } else {
      setCart(cart.filter((item) => item.product.id !== productId));
    }
  };

  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0,
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        register,
        users,
        updateUser,
        deleteUser,
        colonies,
        addColony,
        updateColony,
        deleteColony,
        settings,
        updateSettings,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        orders,
        placeOrder,
        updateOrderStatus,
        messages,
        fetchMessages,
        sendMessage,
        joinChatRoom,
        addReview,
        getStoreReviews,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
