/// <reference types="vite/client" />
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  Product,
  Order,
  Colony,
  Message,
  SystemSettings,
  CommunityMessage,
  OrderStatus,
} from "./types";
import { toast } from "sonner";
import { api } from "./api";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./contexts/AuthContext";
import { useProducts } from "./contexts/ProductContext";
import { useOrders } from "./contexts/OrderContext";
import { useChat } from "./contexts/ChatContext";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface AppContextType {
  users: any[];
  colonies: Colony[];
  settings: SystemSettings;
  communityMessages: CommunityMessage[];
  loading: boolean;
  socket: Socket | null;
  deleteUser: (id: string) => Promise<void>;
  addColony: (colony: Colony) => Promise<void>;
  updateColony: (colony: Colony) => Promise<void>;
  deleteColony: (id: string) => Promise<void>;
  fetchColonies: () => Promise<void>;
  updateSettings: (settings: SystemSettings) => Promise<void>;
  sendMessage: (msg: Partial<Message>) => void;
  joinChatRoom: (orderId: string) => void;
  addReview: (review: any) => Promise<void>;
  refreshData: () => Promise<void>;
  addCommunityMessage: (msg: any) => Promise<void>;
  updateCommunityMessage: (msg: any) => Promise<boolean>;
  deleteCommunityMessage: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { currentUser } = useAuth();
  const { setProducts } = useProducts();
  const { setOrders } = useOrders();
  const { setMessages, setUnreadCounts } = useChat();

  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [communityMessages, setCommunityMessages] = useState<
    CommunityMessage[]
  >([]);
  const [settings, setSettings] = useState<SystemSettings>({
    commissionRate: 5, // Default 5%
    kmRate: 5, // Default $5/km
    companyKmRate: 0,
  });

  // --- NOTIFICATION HELPER ---
  const sendNotification = (title: string, body: string) => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      // Vibración patrón: vibrar 200ms, pausa 100ms, vibrar 200ms
      try {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } catch (e) {
        // Silenciamos el error de intervención del navegador
      }
      toast(title, { description: body }); // Notificación en pantalla
      new Notification(title, {
        body,
        icon: "/logo.svg", // Asegúrate de tener este logo en public
        badge: "/logo.svg",
      });
    }
  };

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

    // Solicitar permiso de notificaciones al conectar
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    newSocket.on("connect_error", (err) => {
      console.error("Error de conexión Socket.IO:", err);
    });

    newSocket.on("order_update", (updatedOrder: Order) => {
      const normalizedOrder = {
        ...updatedOrder,
        id: (updatedOrder as any)._id || updatedOrder.id,
      };

      // Extraer IDs limpios para comparaciones lógicas
      const customerId =
        typeof normalizedOrder.customerId === "object"
          ? (normalizedOrder.customerId as any).id
          : normalizedOrder.customerId;
      const storeId =
        typeof normalizedOrder.storeId === "object"
          ? (normalizedOrder.storeId as any).id
          : normalizedOrder.storeId;

      setOrders((prevOrders: Order[]) => {
        const exists = prevOrders.some((o) => o.id === normalizedOrder.id);
        if (exists)
          return prevOrders.map((o) =>
            o.id === normalizedOrder.id ? normalizedOrder : o,
          );
        return [normalizedOrder, ...prevOrders].sort(
          (a, b) => b.createdAt - a.createdAt,
        );
      });

      // --- LÓGICA DE NOTIFICACIONES PUSH ---
      // 1. Cliente: Cambio de estado de SU pedido
      if (currentUser.role === "CLIENT" && customerId === currentUser.id) {
        if (normalizedOrder.status === OrderStatus.ARRIVED) {
          sendNotification(
            "¡Tu repartidor ha llegado!",
            "Sal a recibir tu pedido al domicilio. ¡Buen provecho!",
          );
        } else {
          sendNotification(
            "Actualización de Pedido",
            `Tu pedido está: ${normalizedOrder.status}`,
          );
        }
      }

      // 2. Tienda: Nueva orden recibida (Pendiente)
      if (
        currentUser.role === "STORE" &&
        storeId === currentUser.id &&
        normalizedOrder.status === OrderStatus.PENDING
      ) {
        sendNotification(
          "¡Nueva Comanda!",
          `Tienes un nuevo pedido por $${normalizedOrder.total}`,
        );
      }

      // 3. Repartidor: Nueva orden lista para recoger (Solo si está en la sala DRIVERS_ROOM, manejado por socket logic)
      // Nota: El backend emite a "DRIVERS_ROOM" solo si el estado es READY y sin driver.
      if (
        currentUser.role === "DELIVERY" &&
        normalizedOrder.status === OrderStatus.READY &&
        !normalizedOrder.driverId
      ) {
        sendNotification(
          "Pedido Disponible",
          "Hay un nuevo pedido listo para recoger cerca de ti.",
        );
      }
    });

    newSocket.on("product_update", (updatedProduct: Product) => {
      const normalizedProduct = {
        ...updatedProduct,
        id: (updatedProduct as any)._id || updatedProduct.id,
      };
      setProducts((prev: Product[]) => {
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

    // --- NUEVO Y CRÍTICO: Escuchar actualizaciones de CUALQUIER usuario (para el Master) ---
    newSocket.on("user_update", (updatedUser: any) => {
      setUsers((prev) => {
        const uId = updatedUser._id || updatedUser.id;
        const exists = prev.some((u) => (u.id || u._id) === uId);

        // Si existe, lo actualizamos
        if (exists) {
          return prev.map((u) =>
            (u.id || u._id) === uId ? { ...u, ...updatedUser, id: uId } : u,
          );
        }
        // Si no existe (ej. nuevo registro), lo agregamos
        return [...prev, { ...updatedUser, id: uId }];
      });
    });

    newSocket.on("new_message", (newMessage: Message) => {
      // Solo incrementar si no somos el remitente
      if (newMessage.senderId !== currentUser?.id) {
        setUnreadCounts((prev: any) => ({
          ...prev,
          [newMessage.orderId]: (prev[newMessage.orderId] || 0) + 1,
        }));
      }

      // Notificación de mensaje
      sendNotification(
        "Nuevo Mensaje",
        `Tienes un mensaje nuevo sobre el pedido #${newMessage.orderId.slice(-4)}`,
      );
    });

    newSocket.on("receive_message", (newMessage: Message) => {
      setMessages((prev: Message[]) => {
        if (
          prev.some(
            (m) => (m.id || m._id) === (newMessage.id || newMessage._id),
          )
        )
          return prev;
        return [...prev, newMessage];
      });
    });

    // --- LISTENERS DE COMUNIDAD (NEWSLETTER) ---
    newSocket.on("community_message_update", (msg: CommunityMessage) => {
      const normalizedMsg = { ...msg, id: (msg as any)._id || msg.id };
      setCommunityMessages((prev) => {
        // Usamos String() para asegurar una comparación de IDs robusta
        const exists = prev.some(
          (m) => String(m.id) === String(normalizedMsg.id),
        );
        if (exists) {
          return prev.map((m) =>
            String(m.id) === String(normalizedMsg.id) ? normalizedMsg : m,
          );
        }
        return [normalizedMsg, ...prev];
      });
    });

    newSocket.on("community_message_delete", (id: string) => {
      setCommunityMessages((prev) =>
        prev.filter((m) => m.id !== id && (m as any)._id !== id),
      );
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
        communityMessages: initMsgs,
      } = initRes.data;

      setColonies(normalize(initCols));
      setSettings(initSettings);
      setProducts(normalize(initProds));
      setCommunityMessages(normalize(initMsgs));

      setOrders(normalize(ordersRes.data) as Order[]);
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
      fetchInitialData(currentUser)
        .catch((err) => {
          console.error("Fallo la carga inicial de datos:", err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchInitialData]);

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

  const sendMessage = async (msg: Partial<Message>) => {
    socket?.emit("send_message", msg);
  };
  const joinChatRoom = (id: string) => socket?.emit("join_order_room", id);

  const addReview = async (r: any) => {
    try {
      await api.post("/api/reviews", r);
      if (currentUser) fetchInitialData(currentUser);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error al calificar");
    }
  };

  const addCommunityMessage = async (msg: any) => {
    try {
      await api.post("/api/community-messages", msg);
      // La actualización del estado vendrá vía Socket.io (community_message_update)
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al crear mensaje");
    }
  };

  const updateCommunityMessage = async (msg: any) => {
    try {
      await api.put(`/api/community-messages/${msg.id}`, msg);
      // La actualización vendrá vía Socket.io
      return true;
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al actualizar mensaje");
      return false;
    }
  };

  const deleteCommunityMessage = async (id: string) => {
    try {
      await api.delete(`/api/community-messages/${id}`);
      // La eliminación vendrá vía Socket.io (community_message_delete)
    } catch (e) {
      alert("Error al eliminar mensaje");
    }
  };

  return (
    <AppContext.Provider
      value={{
        users,
        colonies,
        settings,
        communityMessages,
        loading,
        socket,
        deleteUser,
        addColony,
        updateColony,
        deleteColony,
        fetchColonies,
        sendMessage,
        joinChatRoom,
        addReview,
        refreshData,
        addCommunityMessage,
        updateCommunityMessage,
        deleteCommunityMessage,
        updateSettings: async (s: any) => {
          try {
            const res = await api.put("/api/settings", s);
            setSettings(res.data); // Actualización inmediata del estado local
            toast.success("Tarifas actualizadas correctamente");
          } catch (e) {
            toast.error("Error al guardar las tarifas");
          }
        },
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
