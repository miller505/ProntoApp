/// <reference types="vite/client" />
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Product, Order, Colony, Message, SystemSettings } from "./types";
import { api } from "./api";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./contexts/AuthContext";
import { useCart } from "./contexts/CartContext";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AppContextType {
  users: any[];
  products: Product[];
  orders: Order[];
  colonies: Colony[];
  settings: SystemSettings;
  messages: Message[];
  loading: boolean;
  unreadCounts: Record<string, number>;
  placeOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: string,
    driverId?: string,
  ) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addProduct: (product: any) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addColony: (colony: Colony) => Promise<void>;
  updateColony: (colony: Colony) => Promise<void>;
  deleteColony: (id: string) => Promise<void>;
  fetchColonies: () => Promise<void>;
  updateSettings: (settings: SystemSettings) => Promise<void>;
  fetchMessages: (orderId: string) => Promise<void>;
  sendMessage: (msg: Partial<Message>) => Promise<void>;
  joinChatRoom: (orderId: string) => void;
  markOrderMessagesAsRead: (orderId: string) => void;
  addReview: (review: any) => Promise<void>;
  getStoreReviews: (storeId: string) => Promise<any[]>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const { clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    baseFee: 15,
    kmRate: 5,
  });
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // CONEXIÓN SEGURA: Enviamos el token para autenticar el socket
    const token = localStorage.getItem("token");
    const newSocket = io(SOCKET_URL, {
      auth: { token },
    });
    setSocket(newSocket);

    newSocket.on("order_update", (updatedOrder: Order) => {
      const normalizedOrder = {
        ...updatedOrder,
        id: (updatedOrder as any)._id || updatedOrder.id,
      };
      setOrders((prevOrders) => {
        const exists = prevOrders.some((o) => o.id === normalizedOrder.id);
        if (exists)
          return prevOrders.map((o) =>
            o.id === normalizedOrder.id ? normalizedOrder : o,
          );
        return [normalizedOrder, ...prevOrders];
      });
    });

    newSocket.on("product_update", (updatedProduct: Product) => {
      const normalizedProduct = {
        ...updatedProduct,
        id: (updatedProduct as any)._id || updatedProduct.id,
      };
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === normalizedProduct.id);
        if (exists)
          return prev.map((p) =>
            p.id === normalizedProduct.id ? normalizedProduct : p,
          );
        return [...prev, normalizedProduct];
      });
    });

    newSocket.on("store_update", (updatedStore: any) => {
      setUsers((prev) => {
        const exists = prev.some(
          (u) => u.id === updatedStore.id || u._id === updatedStore._id,
        );
        if (exists) {
          return prev.map((u) =>
            u.id === updatedStore.id || u._id === updatedStore._id
              ? {
                  ...u,
                  ...updatedStore,
                  id: updatedStore._id || updatedStore.id,
                }
              : u,
          );
        }
        // CORRECCIÓN: Si la tienda abre y no estaba en la lista (porque estaba cerrada al inicio), la agregamos.
        return [
          ...prev,
          { ...updatedStore, id: updatedStore._id || updatedStore.id },
        ];
      });
    });

    newSocket.on("receive_message", (newMessage: Message) => {
      setMessages((prev) => {
        if (
          prev.some(
            (m) => (m.id || m._id) === (newMessage.id || newMessage._id),
          )
        )
          return prev;
        return [...prev, newMessage];
      });
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const fetchInitialData = useCallback(async (user: any) => {
    if (!user || !user.id) return;
    try {
      const normalize = (data: any[]) =>
        Array.isArray(data)
          ? data.map((item) => ({ ...item, id: item._id || item.id }))
          : [];

      // OPTIMIZACIÓN: Usar /api/init para cargar catálogos estáticos en una sola petición
      const initRes = await api.get("/api/init");
      const {
        colonies: initCols,
        settings: initSettings,
        products: initProds,
        users: initOpenStores,
      } = initRes.data;

      setColonies(normalize(initCols));
      setSettings(initSettings);
      setProducts(normalize(initProds));

      // Cargar datos dinámicos o privados por separado
      let endpointUsers =
        user.role === "MASTER" || user.role === "DELIVERY"
          ? "/api/admin/users"
          : null; // Si es cliente o tienda, ya tenemos las tiendas abiertas de /init

      const promises = [api.get("/api/orders")];
      if (endpointUsers) {
        promises.push(api.get(endpointUsers));
      }

      const [ordersRes, usersRes] = await Promise.all(promises);

      setOrders(normalize(ordersRes.data));
      // Si es Master/Delivery usamos la lista completa, si no, usamos la lista de tiendas abiertas de init
      setUsers(normalize(usersRes ? usersRes.data : initOpenStores));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchInitialData(currentUser).then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchInitialData]);

  const placeOrder = async (order: Order) => {
    try {
      await api.post("/api/orders", order);
      clearCart();
      if (currentUser) fetchInitialData(currentUser);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al realizar pedido");
    }
  };

  const updateOrderStatus = async (
    id: string,
    status: string,
    driverId?: string,
  ) => {
    try {
      await api.put(`/api/orders/${id}/status`, { status, driverId });
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al actualizar estado");
      if (currentUser) fetchInitialData(currentUser);
    }
  };

  const updateProduct = async (p: Product) => {
    // ANTI-RACE CONDITION: Guardamos estado previo para rollback
    const previousProducts = [...products];

    // Optimismo: Actualizamos UI de inmediato
    setProducts((prev) =>
      prev.map((prod) => (prod.id === p.id ? { ...prod, ...p } : prod)),
    );

    const { _id, id, ...rest } = p as any;
    try {
      await api.put(`/api/products/${p.id}`, rest);
      if (currentUser) fetchInitialData(currentUser);
    } catch (error: any) {
      console.error("Error updating product:", error);
      setProducts(previousProducts); // <--- REVERSIÓN SI EL SERVIDOR FALLA
      alert(error.response?.data?.error || "Error al actualizar producto");
    }
  };

  const addProduct = async (p: any) => {
    try {
      await api.post("/api/products", p);
      if (currentUser) fetchInitialData(currentUser);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al agregar producto");
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.delete(`/api/products/${id}`);
      if (currentUser) fetchInitialData(currentUser);
    } catch (e) {
      alert("Error al eliminar");
    }
  };

  // Resto de funciones (Colonies, Settings, Messages, Reviews)
  const fetchColonies = useCallback(async () => {
    try {
      const res = await api.get("/api/colonies");
      setColonies(
        res.data.map((item: any) => ({ ...item, id: item._id || item.id })),
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchMessages = useCallback(async (orderId: string) => {
    if (!orderId) return;
    try {
      const res = await api.get(`/api/messages/${orderId}`);
      setMessages(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const sendMessage = async (msg: Partial<Message>) => {
    socket?.emit("send_message", msg);
  };
  const joinChatRoom = (id: string) => socket?.emit("join_room", id);
  const markOrderMessagesAsRead = (id: string) => {
    const newCounts = { ...unreadCounts };
    delete newCounts[id];
    setUnreadCounts(newCounts);
  };

  const addReview = async (r: any) => {
    try {
      await api.post("/api/reviews", r);
      if (currentUser) fetchInitialData(currentUser);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error");
    }
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

  return (
    <AppContext.Provider
      value={{
        users,
        products,
        orders,
        colonies,
        settings,
        messages,
        loading,
        placeOrder,
        updateOrderStatus,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchColonies,
        fetchMessages,
        sendMessage,
        joinChatRoom,
        markOrderMessagesAsRead,
        unreadCounts,
        addReview,
        getStoreReviews,
        updateSettings: async (s: any) => {
          await api.put("/api/settings", s);
          if (currentUser) fetchInitialData(currentUser);
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
