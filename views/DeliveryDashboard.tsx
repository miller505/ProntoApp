import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Button, Card, Badge } from '../components/UI';
import { Icons } from '../constants';
import { OrderStatus, StoreProfile } from '../types';

export const DeliveryDashboard = () => {
  const { orders, currentUser, updateOrderStatus, users, logout } = useApp();
  const [activeTab, setActiveTab] = useState<'available' | 'mine' | 'profile'>('available');

  const availableOrders = orders.filter(o => o.status === OrderStatus.READY && !o.driverId);
  const myDeliveries = orders.filter(o => o.driverId === currentUser?.id && o.status !== OrderStatus.DELIVERED);
  const myCompletedDeliveries = orders.filter(o => o.driverId === currentUser?.id && o.status === OrderStatus.DELIVERED);

  const handleClaim = (orderId: string) => {
    // Check if still available (simulation)
    const order = orders.find(o => o.id === orderId);
    if (order && !order.driverId) {
      updateOrderStatus(orderId, OrderStatus.ON_WAY, currentUser?.id);
      setActiveTab('mine');
    } else {
      alert("Este pedido ya fue tomado.");
    }
  };

  const handleDeliver = (orderId: string) => {
    updateOrderStatus(orderId, OrderStatus.DELIVERED);
    alert("¡Entrega completada!");
  };

  return (
    <div className="min-h-screen bg-secondary pb-20">
      <header className="bg-primary text-white p-6 rounded-b-3xl shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Repartidor</h1>
          <button onClick={logout} className="p-2 bg-white/20 rounded-full"><Icons.LogOut size={20}/></button>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setActiveTab('available')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'available' ? 'bg-white text-primary' : 'bg-primary-dark text-white/70 border border-white/20'}`}>
             Disponibles ({availableOrders.length})
           </button>
           <button onClick={() => setActiveTab('mine')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'mine' ? 'bg-white text-primary' : 'bg-primary-dark text-white/70 border border-white/20'}`}>
             Mis Entregas ({myDeliveries.length})
           </button>
           <button onClick={() => setActiveTab('profile')} className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-white text-primary' : 'bg-primary-dark text-white/70 border border-white/20'}`}>
             Perfil
           </button>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {activeTab === 'available' && (
          <>
            {availableOrders.length === 0 && <p className="text-center text-gray-400 mt-10">No hay pedidos listos en tu zona.</p>}
            {availableOrders.map(order => {
              const store = users.find(u => u.id === order.storeId) as StoreProfile;
              return (
                <Card key={order.id} className="border-l-4 border-yellow-400">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-gray-500 text-xs">#{order.id.slice(-4)}</span>
                    <Badge color="yellow">LISTO</Badge>
                  </div>
                  <div className="mb-4">
                    <h3 className="font-bold text-lg">{store.storeName}</h3>
                    <p className="text-sm text-gray-500">{store.storeAddress.street}, {store.storeAddress.number}</p>
                  </div>
                  <div className="flex justify-between items-center border-t pt-3">
                     <div className="text-sm">
                        <p className="font-bold text-primary">${order.deliveryFee} ganancia</p>
                        <p className="text-gray-400">Total: ${order.total}</p>
                     </div>
                     <Button onClick={() => handleClaim(order.id)}>Aceptar Pedido</Button>
                  </div>
                </Card>
              )
            })}
          </>
        )}

        {activeTab === 'mine' && (
           <>
             {myDeliveries.length === 0 && <p className="text-center text-gray-400 mt-10">No tienes entregas en curso.</p>}
             {myDeliveries.map(order => {
               const store = users.find(u => u.id === order.storeId) as StoreProfile;
               const client = users.find(u => u.id === order.customerId);
               
               return (
                <Card key={order.id} className="border-l-4 border-blue-500">
                   <div className="flex justify-between mb-4">
                     <span className="font-bold text-xl">En Curso</span>
                     <div className="text-right">
                       <p className="font-bold text-lg">${order.total}</p>
                       <p className="text-xs text-gray-400">{order.paymentMethod === 'CASH' ? 'Cobrar en Efectivo' : 'Pagado con Tarjeta'}</p>
                     </div>
                   </div>
                   
                   <div className="space-y-4 relative">
                      {/* Line connector */}
                      <div className="absolute left-2 top-2 bottom-8 w-0.5 bg-gray-200"></div>

                      <div className="flex gap-3 relative z-10">
                         <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                         <div>
                            <p className="text-xs text-gray-400 uppercase font-bold">Recoger en</p>
                            <p className="font-bold">{store.storeName}</p>
                            <p className="text-sm text-gray-500">{store.storeAddress.street} #{store.storeAddress.number}</p>
                         </div>
                      </div>

                      <div className="flex gap-3 relative z-10">
                         <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow"></div>
                         <div>
                            <p className="text-xs text-gray-400 uppercase font-bold">Entregar a</p>
                            <p className="font-bold">{client?.firstName} {client?.lastName}</p>
                            <p className="text-sm text-gray-500">{order.deliveryAddress.street} #{order.deliveryAddress.number}</p>
                            <a href={`tel:${client?.phone}`} className="text-primary text-sm font-bold mt-1 block">Llamar: {client?.phone}</a>
                         </div>
                      </div>
                   </div>

                   <Button className="w-full mt-6 bg-green-600 hover:bg-green-700" onClick={() => handleDeliver(order.id)}>
                     Marcar Entregado
                   </Button>
                </Card>
               )
             })}
           </>
        )}
        
        {activeTab === 'profile' && (
          <div>
            <Card className="mb-6">
              <h3 className="font-bold text-lg mb-2">Mi Perfil</h3>
              <p>Nombre: {currentUser?.firstName} {currentUser?.lastName}</p>
              <p>Teléfono: {currentUser?.phone}</p>
            </Card>
            
            <h3 className="font-bold text-lg mb-2">Historial de Entregas</h3>
            {myCompletedDeliveries.length === 0 && <p className="text-center text-gray-400 mt-10">No has completado ninguna entrega.</p>}
            {myCompletedDeliveries.map(order => {
              const store = users.find(u => u.id === order.storeId) as StoreProfile;
              return (
                <Card key={order.id} className="opacity-80 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-gray-500 text-xs">#{order.id.slice(-4)}</span>
                    <Badge color="green">ENTREGADO</Badge>
                  </div>
                  <div className="mb-2">
                    <h3 className="font-bold text-md">{store.storeName}</h3>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2 mt-2">
                     <div className="text-sm">
                        <p className="font-bold text-primary">${order.deliveryFee} ganancia</p>
                     </div>
                     <p className="text-sm text-gray-500">${order.total}</p>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  );
};
