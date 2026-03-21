import React, { useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { AppProvider, useApp } from "./AppContext";
import { Login } from "./views/Login";
import { MasterDashboard } from "./views/MasterDashboard";
import { StoreDashboard } from "./views/StoreDashboard";
import { ClientDashboard } from "./views/ClientDashboard";
import { DeliveryDashboard } from "./views/DeliveryDashboard";
import { UserRole, OrderStatus } from "./types";

const Main = () => {
  const { currentUser, loadingAuth, logout } = useAuth();
  const { orders } = useApp(); // Accedemos a las órdenes para validar inactividad

  // Lógica de Logout por Inactividad (Controlada por pedidos activos)
  useEffect(() => {
    if (!currentUser) return;
    const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

    const checkTimeout = () => {
      const lastActive = localStorage.getItem("lastActive");

      // Chequeo especial para Clientes: Si tiene pedidos activos, NO cerrar sesión
      if (currentUser.role === UserRole.CLIENT) {
        const hasActiveOrder = orders.some((o) => {
          const cId =
            typeof o.customerId === "object"
              ? (o.customerId as any).id || (o.customerId as any)._id
              : o.customerId;
          return (
            cId === currentUser.id &&
            ![
              OrderStatus.DELIVERED,
              OrderStatus.REJECTED,
              OrderStatus.CANCELLED,
            ].includes(o.status)
          );
        });

        if (hasActiveOrder) return; // Salir de la función, no checar tiempo
      }

      // Para otros roles o clientes sin pedidos, checar tiempo
      if (lastActive && Date.now() - Number(lastActive) > TIMEOUT_MS) {
        console.log("Sesión cerrada por inactividad");
        logout();
      }
    };

    const interval = setInterval(checkTimeout, 30000); // Checar cada 30s
    return () => clearInterval(interval);
  }, [currentUser, orders, logout]);

  // Pantalla de carga mientras se verifica si hay sesión activa
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  switch (currentUser.role) {
    case UserRole.MASTER:
      return <MasterDashboard />;
    case UserRole.STORE:
      return <StoreDashboard />;
    case UserRole.CLIENT:
      return <ClientDashboard />;
    case UserRole.DELIVERY:
      return <DeliveryDashboard />;
    default:
      return <Login />;
  }
};

const App = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <AppProvider>
          <Main />
        </AppProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
