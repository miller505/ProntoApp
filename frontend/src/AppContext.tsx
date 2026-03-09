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
  getFinanceStats: () => Promise<any>;
  refreshData: () => Promise<void>;
  fetchStoreProducts: (storeId: string) => Promise<void>;
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
    if (!currentUser) return; // No conectar si no hay usuario

    // CONEXIÓN SEGURA: Enviamos el token para autenticar el socket
    const token = localStorage.getItem("token");
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"], // Forzar WebSocket mejora la estabilidad en móviles
      reconnectionAttempts: 5,
    });
    setSocket(newSocket);

    newSocket.on("connect_error", (err) => {
      console.error("Error de conexión Socket.IO:", err);
    });

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
  }, [currentUser]); // CORRECCIÓN: Reconectar cuando cambia el usuario (Login/Logout)

  const fetchInitialData = useCallback(async (user: any) => {
    if (!user || !user.id) return;
    try {
      const normalize = (data: any[]) =>
        Array.isArray(data)
          ? data.map((item) => ({ ...item, id: item._id || item.id }))
          : [];

      // OPTIMIZACIÓN: Usar /api/init para cargar catálogos estáticos en una sola petición
      // Enviamos rol y ID para que el backend filtre y no mande basura innecesaria
      const initPromise = api.get(
        `/api/init?role=${user.role}&userId=${user.id}`,
      );

      // Cargar datos dinámicos o privados por separado
      let endpointUsers = user.role === "MASTER" ? "/api/admin/users" : null;
      const ordersPromise = api.get(`/api/orders?t=${Date.now()}`);
      const usersPromise = endpointUsers
        ? api.get(endpointUsers)
        : Promise.resolve(null);

      // EJECUCIÓN EN PARALELO: Esperamos todo junto en lugar de uno por uno
      const [initRes, ordersRes, usersRes] = await Promise.all([
        initPromise,
        ordersPromise,
        usersPromise,
      ]);

      const {
        colonies: initCols,
        settings: initSettings,
        products: initProds,
        users: initOpenStores,
      } = initRes.data;

      setColonies(normalize(initCols));
      setSettings(initSettings);
      setProducts(normalize(initProds));

      setOrders(normalize(ordersRes.data));
      // Si es Master/Delivery usamos la lista completa, si no, usamos la lista de tiendas abiertas de init
      setUsers(normalize(usersRes ? usersRes.data : initOpenStores));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  const refreshData = async () => {
    if (currentUser) await fetchInitialData(currentUser);
  };

  useEffect(() => {
    if (currentUser) {
      setLoading(true); // CORRECCIÓN: Activar loading al detectar usuario para mostrar Skeletons
      fetchInitialData(currentUser).then(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchInitialData]);

  const placeOrder = async (order: Order) => {
    // Eliminamos el try/catch y clearCart aquí para manejar múltiples pedidos en el frontend
    // Si falla uno, el frontend decidirá qué hacer.
    await api.post("/api/orders", order);
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

  const deleteUser = async (id: string) => {
    try {
      await api.delete(`/api/users/${id}`);
      // Optimización Profesional: Actualizar estado local en vez de recargar todo
      setUsers((prev) => prev.filter((u) => (u.id || u._id) !== id));
    } catch (e) {
      console.error(e);
      alert("Error al eliminar usuario");
    }
  };

  const addColony = async (colony: Colony) => {
    try {
      const res = await api.post("/api/colonies", colony);
      // Optimización: Agregar al estado inmediatamente
      const newColony = { ...res.data, id: res.data._id || res.data.id };
      setColonies((prev) => [...prev, newColony]);
    } catch (e) {
      console.error(e);
      alert("Error al agregar colonia");
    }
  };

  const updateColony = async (colony: Colony) => {
    try {
      const res = await api.put(`/api/colonies/${colony.id}`, colony);
      // Optimización: Actualizar solo el elemento modificado
      const updated = { ...res.data, id: res.data._id || res.data.id };
      setColonies((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
    } catch (e) {
      console.error(e);
      alert("Error al actualizar colonia");
    }
  };

  const deleteColony = async (id: string) => {
    try {
      await api.delete(`/api/colonies/${id}`);
      // Optimización: Eliminar del estado localmente
      setColonies((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      alert("Error al eliminar colonia");
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

  const getFinanceStats = async () => {
    try {
      // Agregamos timestamp para evitar que el navegador guarde en caché una respuesta vacía antigua
      const res = await api.get(`/api/finances/stats?t=${Date.now()}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching finance stats:", error);
      return null;
    }
  };

  const fetchStoreProducts = async (storeId: string) => {
    try {
      const res = await api.get(`/api/products?storeId=${storeId}`);
      const newProducts = res.data.map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }));

      setProducts((prev) => {
        // Reemplazamos los productos de esta tienda con los frescos, manteniendo los de otras tiendas si ya se cargaron
        const others = prev.filter((p) => p.storeId !== storeId);
        return [...others, ...newProducts];
      });
    } catch (error) {
      console.error("Error fetching store products:", error);
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
        deleteUser,
        addColony,
        updateColony,
        deleteColony,
        fetchColonies,
        fetchMessages,
        sendMessage,
        joinChatRoom,
        markOrderMessagesAsRead,
        unreadCounts,
        addReview,
        getStoreReviews,
        getFinanceStats,
        fetchStoreProducts,
        refreshData,
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
