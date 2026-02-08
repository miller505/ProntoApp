/// <reference types="vite/client" />
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import {
  User,
  StoreProfile,
  Product,
  Order,
  Colony,
  Message,
  SystemSettings,
} from "./types";
import { api } from "./src/api";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AppContextType {
  currentUser: User | StoreProfile | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  register: (user: User | StoreProfile) => Promise<boolean>;
  users: (User | StoreProfile)[];
  products: Product[];
  orders: Order[];
  colonies: Colony[];
  settings: SystemSettings;
  placeOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: string,
    driverId?: string,
  ) => Promise<void>;
  updateUser: (user: User | StoreProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addProduct: (product: any) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addColony: (colony: Colony) => Promise<void>;
  updateColony: (colony: Colony) => Promise<void>;
  deleteColony: (id: string) => Promise<void>;
  updateSettings: (settings: SystemSettings) => Promise<void>;
  messages: Message[];
  fetchMessages: (orderId: string) => Promise<void>;
  sendMessage: (msg: Partial<Message>) => Promise<void>;
  joinChatRoom: (orderId: string) => void;
  markOrderMessagesAsRead: (orderId: string) => void;
  unreadCounts: Record<string, number>;
  addReview: (review: any) => Promise<void>;
  getStoreReviews: (storeId: string) => Promise<any[]>;
  cart: any[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  loading: boolean;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [users, setUsers] = useState<(User | StoreProfile)[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    baseFee: 15,
    kmRate: 5,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // Socket setup
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on("orders_updated", () => {
      // Usamos una referencia funcional para obtener el usuario actual sin dependencias rancias
      setCurrentUser((prevUser: any) => {
        if (prevUser) fetchInitialData(prevUser);
        return prevUser;
      });
    });

    newSocket.on("receive_message", (newMessage: Message) => {
      setMessages((prev) => {
        if (
          prev.some(
            (m) =>
              m._id === newMessage._id ||
              (m.text === newMessage.text &&
                m.createdAt === newMessage.createdAt),
          )
        ) {
          return prev;
        }
        return [...prev, newMessage];
      });
    });

    return () => {
      newSocket.close();
    };
  }, []); // Removemos currentUser?.id de dependencias para evitar reconexiones infinitas

  // --- CORRECCIÓN PRINCIPAL: MANEJO DE IDs ---
  const fetchInitialData = useCallback(async (user: any) => {
    // MongoDB usa _id, el frontend a veces usa id. Normalizamos:
    const userId = user._id || user.id;

    if (!userId || userId === "undefined") {
      console.error(
        "❌ Error: Usuario sin ID válido intentando cargar datos",
        user,
      );
      return;
    }

    // Helper para normalizar _id a id en arrays
    const normalize = (data: any[]) => {
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({ ...item, id: item._id || item.id }));
    };

    try {
      // Cargar datos globales básicos
      const [colsRes, setRes] = await Promise.all([
        api.get("/api/colonies"),
        api.get("/api/settings"),
      ]);
      setColonies(normalize(colsRes.data));
      setSettings(setRes.data);

      let endpointOrders = `/api/orders?userId=${userId}&role=${user.role}`;
      let endpointUsers = "/api/stores";

      if (user.role === "MASTER") {
        endpointUsers = "/api/users";
        endpointOrders = "/api/orders";
      } else if (user.role === "DELIVERY") {
        // Los repartidores necesitan info de tiendas Y clientes.
        // Si /api/stores solo devuelve tiendas, intentamos traer todos los usuarios si el backend lo permite.
        endpointUsers = "/api/users";
      }

      const promises = [
        api.get(endpointOrders),
        api.get(endpointUsers),
        api.get("/api/products"),
      ];

      // Si es tienda, traer sus reviews también
      if (user.role === "STORE") {
        // No hacemos nada extra aquí, se piden bajo demanda o podrías agregarlo
      }

      const [ordersRes, usersRes, prodsRes] = await Promise.all(promises);

      setOrders(normalize(ordersRes.data));
      setUsers(normalize(usersRes.data));
      setProducts(normalize(prodsRes.data));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (storedUser && token) {
        try {
          const user = JSON.parse(storedUser);
          // Aseguramos que el usuario tenga un formato correcto
          if (user && (user._id || user.id)) {
            setCurrentUser(user);
            await fetchInitialData(user);
          }
        } catch (e) {
          console.error("Error parsing stored user", e);
          localStorage.clear();
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchInitialData]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await api.post("/api/login", { email, password: pass });
      const { user, token } = res.data;

      // Normalización importante antes de guardar
      const safeUser = { ...user, id: user._id || user.id };

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(safeUser));

      setCurrentUser(safeUser);
      await fetchInitialData(safeUser);
      return true;
    } catch (e) {
      return false;
    }
  };

  const logout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setOrders([]);
    window.location.href = "/";
  };

  const register = async (data: any) => {
    try {
      await api.post("/api/register", data);
      return true;
    } catch (e) {
      return false;
    }
  };

  const joinChatRoom = (orderId: string) => {
    socket?.emit("join_room", orderId);
  };

  const fetchMessages = async (orderId: string) => {
    if (!orderId) return;
    try {
      const res = await api.get(`/api/messages/${orderId}`);
      setMessages(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const sendMessage = async (msg: Partial<Message>) => {
    socket?.emit("send_message", msg);
  };
  const markOrderMessagesAsRead = (orderId: string) => {
    const newCounts = { ...unreadCounts };
    delete newCounts[orderId];
    setUnreadCounts(newCounts);
  };

  const placeOrder = async (order: Order) => {
    await api.post("/api/orders", order);
    clearCart();
    if (currentUser) fetchInitialData(currentUser);
  };

  const updateOrderStatus = async (
    id: string,
    status: string,
    driverId?: string,
  ) => {
    await api.put(`/api/orders/${id}/status`, { status, driverId });
    if (currentUser) fetchInitialData(currentUser);
  };

  const updateUser = async (u: any) => {
    const { _id, ...rest } = u; // Extraemos _id para no enviarlo en el cuerpo
    try {
      const res = await api.put(`/api/users/${u._id || u.id}`, rest);
      // Si el usuario actualizado es el actual, actualizamos el estado local y localStorage
      if (
        currentUser &&
        (u.id === currentUser.id || u._id === currentUser.id)
      ) {
        const updatedUser = { ...res.data, id: res.data._id || res.data.id };
        setCurrentUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      if (currentUser) fetchInitialData(currentUser);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };
  const deleteUser = async (id: string) => {
    /* Implementar */
  };

  const addProduct = async (p: any) => {
    await api.post("/api/products", p);
    if (currentUser) fetchInitialData(currentUser);
  };
  const updateProduct = async (p: Product) => {
    const { _id, ...rest } = p as any; // Extraemos _id para no enviarlo en el cuerpo
    await api.put(`/api/products/${p.id}`, rest);
    if (currentUser) fetchInitialData(currentUser);
  };
  const deleteProduct = async (id: string) => {
    await api.delete(`/api/products/${id}`);
    if (currentUser) fetchInitialData(currentUser);
  };

  const addColony = async (c: Colony) => {
    await api.post("/api/colonies", c);
    if (currentUser) fetchInitialData(currentUser);
  };
  const updateColony = async (c: Colony) => {
    /* PUT */
  };
  const deleteColony = async (id: string) => {
    await api.delete(`/api/colonies/${id}`);
    if (currentUser) fetchInitialData(currentUser);
  };
  const updateSettings = async (s: SystemSettings) => {
    await api.put("/api/settings", s);
    if (currentUser) fetchInitialData(currentUser);
  };

  const addReview = async (r: any) => {
    await api.post("/api/reviews", r);
  };

  const getStoreReviews = async (sid: string) => {
    // PROTECCIÓN: Si el ID es undefined, retornamos array vacío y no llamamos a la API
    if (!sid || sid === "undefined") return [];
    try {
      const r = await api.get(`/api/reviews/${sid}`);
      return r.data;
    } catch (e) {
      console.error("Error getting reviews", e);
      return [];
    }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    const existing = cart.find((i) => i.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: (i.quantity || 0) + quantity }
            : i,
        ),
      );
    } else {
      setCart([...cart, { product, quantity }]);
    }
  };

  const removeFromCart = (pid: string) => {
    const existing = cart.find((i) => i.product.id === pid);
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((i) =>
          i.product.id === pid ? { ...i, quantity: i.quantity - 1 } : i,
        ),
      );
    } else {
      setCart(cart.filter((i) => i.product.id !== pid));
    }
  };

  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce(
    (acc, item) =>
      acc + (Number(item.product.price) || 0) * (item.quantity || 1),
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
        products,
        orders,
        colonies,
        settings,
        placeOrder,
        updateOrderStatus,
        updateUser,
        deleteUser,
        addProduct,
        updateProduct,
        deleteProduct,
        addColony,
        updateColony,
        deleteColony,
        updateSettings,
        messages,
        fetchMessages,
        sendMessage,
        joinChatRoom,
        markOrderMessagesAsRead,
        unreadCounts,
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

export const useApp = () => useContext(AppContext);
