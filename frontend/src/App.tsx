import React from 'react';
import { AppProvider, useApp } from './AppContext';
import { Login } from './views/Login';
import { MasterDashboard } from './views/MasterDashboard';
import { StoreDashboard } from './views/StoreDashboard';
import { ClientDashboard } from './views/ClientDashboard';
import { DeliveryDashboard } from './views/DeliveryDashboard';
import { UserRole } from './types';

const Main = () => {
  const { currentUser } = useApp();

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
    <AppProvider>
      <Main />
    </AppProvider>
  );
};

export default App;
