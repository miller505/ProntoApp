import React, { createContext, useContext, useState, ReactNode } from "react";
import { Order } from "../types";
import { api } from "../api";
import { toast } from "sonner";
import { useCart } from "./CartContext";

interface OrderContextType {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  placeOrder: (order: any) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: string,
    driverId?: string,
  ) => Promise<boolean>;
  getFinanceStats: () => Promise<any>;
  getStoreReviews: (storeId: string) => Promise<any[]>;
  addReview: (review: any) => Promise<void>;
}

const OrderContext = createContext<OrderContextType>({} as OrderContextType);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { clearCart } = useCart();

  const placeOrder = async (order: any) => {
    try {
      await api.post("/api/orders", order);
      clearCart();
      toast.success("¡Pedido realizado con éxito!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error al realizar pedido");
      throw e;
    }
  };

  const updateOrderStatus = async (
    id: string,
    status: string,
    driverId?: string,
  ) => {
    try {
      await api.put(`/api/orders/${id}/status`, { status, driverId });
      return true;
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error al actualizar estado");
      return false;
    }
  };

  const getFinanceStats = async () => {
    try {
      const res = await api.get(`/api/finances/stats?t=${Date.now()}`);
      return res.data;
    } catch (error) {
      console.error("Error fetching finance stats:", error);
      return null;
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

  const addReview = async (r: any) => {
    try {
      await api.post("/api/reviews", r);
      toast.success("¡Gracias por tu calificación!");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error al calificar");
    }
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        setOrders,
        placeOrder,
        updateOrderStatus,
        getFinanceStats,
        getStoreReviews,
        addReview,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => useContext(OrderContext);
