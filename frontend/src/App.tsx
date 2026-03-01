import React from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { AppProvider } from "./AppContext";
import { Login } from "./views/Login";
import { MasterDashboard } from "./views/MasterDashboard";
import { StoreDashboard } from "./views/StoreDashboard";
import { ClientDashboard } from "./views/ClientDashboard";
import { DeliveryDashboard } from "./views/DeliveryDashboard";
import { UserRole } from "./types";

const Main = () => {
  const { currentUser, loadingAuth } = useAuth();

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
