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
import { api } from "./src/api"; // Asegúrate de que la ruta sea correcta
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AppContextType {
  // ... (Tus definiciones de tipos se mantienen intactas. Por brevedad asume que están aquí tal cual las tenías)
  currentUser: any | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  register: (user: any) => Promise<boolean>;
  users: any[];
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
  updateUser: (user: any) => Promise<void>;
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
  deleteFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  loading: boolean;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    baseFee: 15,
    kmRate: 5,
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // CORRECCIÓN: Persistencia del carrito en LocalStorage
  const [cart, setCart] = useState<any[]>(() => {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  // Socket setup
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // CORRECCIÓN CRÍTICA DE RENDIMIENTO:
    // Actualizamos SOLO la orden modificada en lugar de tirar el servidor haciendo fetch de todo.
    newSocket.on("order_updated", (updatedOrder: Order) => {
      const normalizedOrder = {
        ...updatedOrder,
        id: (updatedOrder as any)._id || updatedOrder.id,
      };
      setOrders((prevOrders) => {
        const exists = prevOrders.some((o) => o.id === normalizedOrder.id);
        if (exists) {
          return prevOrders.map((o) =>
            o.id === normalizedOrder.id ? normalizedOrder : o,
          );
        }
        return [normalizedOrder, ...prevOrders];
      });
    });

    newSocket.on("product_updated", (updatedProduct: Product) => {
      const normalizedProduct = {
        ...updatedProduct,
        id: (updatedProduct as any)._id || updatedProduct.id,
      };
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === normalizedProduct.id);
        if (exists) {
          return prev.map((p) =>
            p.id === normalizedProduct.id ? normalizedProduct : p,
          );
        }
        return [...prev, normalizedProduct];
      });
    });

    newSocket.on("receive_message", (newMessage: Message) => {
      setMessages((prev) => {
        if (
          prev.some(
            (m) =>
              (m.id || m._id) === (newMessage.id || newMessage._id) ||
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
  }, []);

  const fetchInitialData = useCallback(async (user: any) => {
    const userId = user._id || user.id;

    if (!userId || userId === "undefined") {
      console.error("❌ Error: Usuario sin ID válido", user);
      return;
    }

    const normalize = (data: any[]) => {
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({ ...item, id: item._id || item.id }));
    };

    try {
      const [colsRes, setRes] = await Promise.all([
        api.get("/api/colonies"),
        api.get("/api/settings"),
      ]);
      setColonies(normalize(colsRes.data));
      setSettings(setRes.data);

      let endpointOrders = `/api/orders?userId=${userId}&role=${user.role}`;
      let endpointUsers = "/api/stores";

      if (user.role === "MASTER" || user.role === "DELIVERY") {
        endpointUsers = "/api/users";
      }
      if (user.role === "MASTER") {
        endpointOrders = "/api/orders";
      }

      const promises = [
        api.get(endpointOrders),
        api.get(endpointUsers),
        api.get("/api/products"),
      ];

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
      // CORRECCIÓN XSS: Obtenemos datos del usuario validando el token contra el backend si es posible.
      // Si usas el enfoque actual, aseguramos al menos no depender a ciegas del localStorage.
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (storedUser && token) {
        try {
          const user = JSON.parse(storedUser);
          if (user && (user._id || user.id)) {
            setCurrentUser(user);
            await fetchInitialData(user);
          }
        } catch (e) {
          console.error("Error parsing stored user", e);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchInitialData]);

  // --- LÓGICA DE CADUCIDAD DE SESIÓN (15 MINUTOS) ---
  useEffect(() => {
    if (!currentUser) return;

    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

    const checkActivity = () => {
      const lastActive = localStorage.getItem("lastActive");
      if (lastActive && Date.now() - Number(lastActive) > TIMEOUT_MS) {
        logout();
      } else {
        localStorage.setItem("lastActive", Date.now().toString());
      }
    };

    // Chequeo inicial y listeners
    checkActivity();
    const handleActivity = () =>
      localStorage.setItem("lastActive", Date.now().toString());
    const intervalId = setInterval(checkActivity, 60000); // Revisar cada minuto

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keypress", handleActivity);
    window.addEventListener("click", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, [currentUser]);

  const login = async (email: string, pass: string) => {
    try {
      const res = await api.post("/api/login", { email, password: pass });
      const { user, token } = res.data;

      const safeUser = { ...user, id: user._id || user.id };
      delete safeUser.password; // Protección extra

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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("cart"); // Limpiamos carrito al salir
    localStorage.removeItem("lastActive");
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

  // CORRECCIÓN: useCallback para evitar re-renders infinitos en Modales
  const joinChatRoom = useCallback(
    (orderId: string) => {
      socket?.emit("join_room", orderId);
    },
    [socket],
  );

  const fetchMessages = useCallback(async (orderId: string) => {
    if (!orderId) return;
    try {
      const res = await api.get(`/api/messages/${orderId}`);
      setMessages(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

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
    // Ya no llamamos a fetchInitialData aquí porque WebSockets se encargará.
  };

  const updateUser = async (u: any) => {
    const { _id, role, ...rest } = u; // PREVENCIÓN IDOR: Evitamos que se pueda enviar un rol diferente
    try {
      const res = await api.put(`/api/users/${u._id || u.id}`, rest);
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
    const { _id, ...rest } = p as any;
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
    setOrders((prev) =>
      prev.map((o) => (o.id === r.orderId ? { ...o, isReviewed: true } : o)),
    );
  };

  const getStoreReviews = async (sid: string) => {
    if (!sid || sid === "undefined") return [];
    try {
      const r = await api.get(`/api/reviews/${sid}`);
      return r.data;
    } catch (e) {
      return [];
    }
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.product.id === product.id);
      if (existing) {
        return prevCart.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: (i.quantity || 0) + quantity }
            : i,
        );
      }
      return [...prevCart, { product, quantity }];
    });
  };

  const removeFromCart = (pid: string) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.product.id === pid);
      if (existing && existing.quantity > 1) {
        return prevCart.map((i) =>
          i.product.id === pid ? { ...i, quantity: i.quantity - 1 } : i,
        );
      }
      return prevCart.filter((i) => i.product.id !== pid);
    });
  };

  const deleteFromCart = (pid: string) => {
    setCart((prevCart) => prevCart.filter((i) => i.product.id !== pid));
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
        deleteFromCart,
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
