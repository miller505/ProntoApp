import React, { useState, useMemo } from "react";
import { useApp } from "../AppContext";
import { Button, Card, Badge } from "../components/UI";
import { Icons } from "../constants";
import { OrderStatus, StoreProfile, User } from "../types";
import { ChatModal } from "../components/ChatModal";
import { formatDate } from "../utils";

export const DeliveryDashboard = () => {
  const { orders, currentUser, updateOrderStatus, users, logout, colonies, unreadCounts, markOrderMessagesAsRead } = useApp();
  const [activeTab, setActiveTab] = useState<"available" | "mine" | "profile" | "finances">(
    "available",
  );
  const [chatOrder, setChatOrder] = useState<any | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(true);

  const availableOrders = orders.filter(
    (o) => o.status === OrderStatus.READY && !o.driverId,
  );
  const myDeliveries = orders.filter(
    (o) => o.driverId === currentUser?.id && o.status !== OrderStatus.DELIVERED,
  );
  const myCompletedDeliveries = orders
    .filter(
      (o) =>
        o.driverId === currentUser?.id && o.status === OrderStatus.DELIVERED,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  // Memoize a map of users by ID for efficient lookups
  const usersById = useMemo(() => {
    const map = new Map<string, User | StoreProfile>();
    for (const user of users) {
      map.set(user.id, user);
    }
    return map;
  }, [users]);

  const handleClaim = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order && !order.driverId) {
      try {
        await updateOrderStatus(orderId, OrderStatus.ON_WAY, currentUser?.id);
        setActiveTab("mine");
      } catch (error) {
        alert(
          "¡Lo sentimos! Otro repartidor tomó este pedido justo antes que tú.",
        );
      }
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
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Logo"
            className="h-10 w-auto object-contain"
          />
          <h1 className="text-xs font-bold text-primary">
            PANEL DE REPARTIDOR
          </h1>
        </div>
        <Button variant="ghost" onClick={logout}>
          <Icons.LogOut size={20} />
        </Button>
      </header>

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-sm">
          <TabButton
            id="available"
            label={`Disponibles (${availableOrders.length})`}
            icon={<Icons.Bike size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="mine"
            label={`Mis Entregas (${myDeliveries.length})`}
            icon={<Icons.ShoppingBag size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="profile"
            label="Perfil"
            icon={<Icons.User size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="finances"
            label="Finanzas"
            icon={<Icons.DollarSign size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
        </div>

        {activeTab === "available" && (
          <>
            {availableOrders.length === 0 && (
              <p className="text-center text-gray-400 mt-10">
                No hay pedidos listos en tu zona.
              </p>
            )}
            {availableOrders.map((order) => {
              const store = usersById.get(order.storeId) as StoreProfile;
              const storeColony = colonies.find(
                (c) => c.id === store.storeAddress.colonyId
              );
              const deliveryColony = colonies.find(
                (c) => c.id === order.deliveryAddress.colonyId
              );

              return (
                <Card key={order.id} className="border-l-4 border-yellow-400">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-gray-500 text-xs">
                      #{order.id.slice(-4)}
                    </span>
                    <Badge color="yellow">LISTO</Badge>
                  </div>
                  <div className="mb-4">
                    <h3 className="font-bold text-lg">{store.storeName}</h3>
                    <p className="text-sm text-gray-600 font-semibold mb-1">
                      <Icons.MapPin size={14} className="inline mr-1" />
                      De: {storeColony?.name || "Colonia desconocida"}
                    </p>
                    <p className="text-sm text-gray-600 font-semibold">
                      <Icons.MapPin size={14} className="inline mr-1" />
                      Para: {deliveryColony?.name || "Colonia desconocida"}
                    </p>
                  </div>
                  <div className="h-0.5 w-full bg-gray-200 rounded-full mb-3" />
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <p className="font-bold text-primary">
                        ${order.driverFee || 0} ganancia
                      </p>
                      <p className="text-gray-400">Total: ${order.total}</p>
                    </div>
                    <Button onClick={() => handleClaim(order.id)}>
                      Aceptar Pedido
                    </Button>
                  </div>
                </Card>
              );
            })}
          </>
        )}

        {activeTab === "mine" && (
          <>
            {myDeliveries.length === 0 && (
              <p className="text-center text-gray-400 mt-10">
                No tienes entregas en curso.
              </p>
            )}
            {myDeliveries.map((order) => {
              const store = usersById.get(order.storeId) as StoreProfile;
              const client = usersById.get(order.customerId);
              const storeColony = colonies.find(
                (c) => c.id === store.storeAddress.colonyId
              );
              const clientColony = colonies.find(
                (c) => c.id === order.deliveryAddress.colonyId
              );

              return (
                <Card key={order.id} className="border-l-4 border-blue-500">
                  <div className="flex justify-between mb-4">
                    <span className="font-bold text-xl">En Curso</span>
                    <div className="text-right">
                      <p className="font-bold text-lg">${order.total}</p>
                      <p className="text-xs text-gray-400">
                        {order.paymentMethod === "CASH"
                          ? "Cobrar en Efectivo"
                          : "Pagado con Tarjeta"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 relative">
                    {/* Line connector */}
                    <div className="absolute left-2 top-2 bottom-8 w-0.5 bg-gray-200"></div>

                    <div className="flex gap-3 relative z-10">
                      <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow"></div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">
                          Recoger en
                        </p>
                        <p className="font-bold">{store.storeName}</p>
                        <p className="text-sm text-gray-600 font-semibold">
                          Col. {storeColony?.name || "Desconocida"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {store.storeAddress.street} #
                          {store.storeAddress.number}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 relative z-10">
                      <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow"></div>
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-bold">
                          Entregar a
                        </p>
                        <p className="font-bold">
                          {client?.firstName} {client?.lastName}
                        </p>
                        <p className="text-sm text-gray-600 font-semibold">
                          Col. {clientColony?.name || "Desconocida"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {order.deliveryAddress.street} #
                          {order.deliveryAddress.number}
                        </p>
                        <a
                          href={`tel:${client?.phone}`}
                          className="text-primary text-sm font-bold mt-2 block"
                        >
                          Llamar: {client?.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full mt-6 bg-green-600 hover:bg-green-700"
                    onClick={() => handleDeliver(order.id)}
                  >
                    Marcar Entregado
                  </Button>
                  <Button
                    className="w-full mt-4 bg-gray-800 text-white relative"
                    onClick={() => {
                      setChatOrder(order);
                      markOrderMessagesAsRead(order.id);
                    }}
                  >
                    <Icons.MessageSquare size={16} className="mr-2" />
                    Chatear con Cliente
                    {unreadCounts[order.id] > 0 && (
                      <span className="absolute top-3 right-4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {unreadCounts[order.id]}
                      </span>
                    )}
                  </Button>
                </Card>
              );
            })}
          </>
        )}

        {activeTab === "profile" && (
          <div>
            <Card className="mb-6">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex justify-between items-center w-full"
              >
                <h3 className="font-bold text-lg">Mi Perfil</h3>
                <Icons.ChevronDown
                  className={`transition-transform duration-300 ${isProfileOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isProfileOpen && (
                <div className="space-y-4 text-sm mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400 text-xs block">
                        Nombre
                      </span>
                      <p className="font-medium text-gray-800">
                        {currentUser?.firstName}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">
                        Apellido
                      </span>
                      <p className="font-medium text-gray-800">
                        {currentUser?.lastName}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">
                      Correo electrónico
                    </span>
                    <p className="font-medium text-gray-800">
                      {currentUser?.email}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">
                      Teléfono
                    </span>
                    <p className="font-medium text-gray-800">
                      {currentUser?.phone}
                    </p>
                  </div>
                </div>
              )}
            </Card>

            <h3 className="font-bold text-lg mb-2">Historial de Entregas</h3>
            {myCompletedDeliveries.length === 0 && (
              <p className="text-center text-gray-400 mt-10">
                No has completado ninguna entrega.
              </p>
            )}
            {myCompletedDeliveries.map((order) => {
              const store = usersById.get(order.storeId) as StoreProfile;
              return (
                <Card key={order.id} className="opacity-80 mb-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <span className="font-mono text-gray-500 text-xs">
                        #{order.id.slice(-4)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <Badge color="green">ENTREGADO</Badge>
                  </div>
                  <div className="mb-2">
                    <h3 className="font-bold text-md">{store.storeName}</h3>
                  </div>
                  <div className="h-0.5 w-full bg-gray-200 rounded-full mb-2 mt-2" />
                  <div className="flex justify-between items-center">
                    <div className="text-sm">
                      <p className="font-bold text-primary">
                        ${order.driverFee || 0} ganancia
                      </p>
                    </div>
                    <p className="text-sm text-gray-500">${order.total}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === "finances" && (
          <div className="pb-24">
            <h2 className="text-2xl font-bold mb-6">Mis Finanzas</h2>
            <Card className="bg-gradient-to-br from-green-600 to-green-800 text-white p-6 mb-6">
              <div className="flex items-center gap-3 mb-2 opacity-80">
                <Icons.DollarSign size={20} />
                <h3 className="font-semibold text-sm">Ganancias Totales</h3>
              </div>
              <p className="text-4xl font-bold">
                ${myCompletedDeliveries.reduce((acc, o) => acc + (o.driverFee || 0), 0).toFixed(2)}
              </p>
            </Card>

            <div>
              <h3 className="font-bold text-lg mb-4">Desglose Semanal</h3>
              {Object.entries(
                myCompletedDeliveries.reduce((acc: any, order) => {
                  const d = new Date(order.createdAt);
                  const day = d.getDay();
                  const diff = d.getDate() - day;
                  const weekStart = new Date(d.setDate(diff)).setHours(0, 0, 0, 0);

                  if (!acc[weekStart]) acc[weekStart] = { total: 0, orders: 0, date: weekStart };

                  acc[weekStart].total += order.driverFee || 0;
                  acc[weekStart].orders += 1;
                  return acc;
                }, {})
              )
                .sort((a: any, b: any) => Number(b[0]) - Number(a[0]))
                .map(([key, data]: any) => {
                  const startDate = new Date(Number(key));
                  const labelStart = startDate.toLocaleDateString("es-MX", { day: 'numeric', month: 'long', year: 'numeric' });
                  const endDate = new Date(startDate);
                  endDate.setDate(endDate.getDate() + 6);
                  const labelEnd = endDate.toLocaleDateString("es-MX", { day: 'numeric', month: 'numeric' });

                  return (
                    <Card key={key} className="mb-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-800">Semana del {labelStart}</p>
                        <p className="text-xs text-gray-500">Hasta {labelEnd} • {data.orders} entregas</p>
                      </div>
                      <span className="font-bold text-green-600 text-lg">
                        ${data.total.toFixed(2)}
                      </span>
                    </Card>
                  );
                })}
              {myCompletedDeliveries.length === 0 && (
                <p className="text-gray-400 text-center py-10">
                  Aún no tienes ganancias registradas.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      {chatOrder && (
        <ChatModal
          isOpen={!!chatOrder}
          onClose={() => setChatOrder(null)}
          orderId={chatOrder.id}
          otherParty={users.find((u) => u.id === chatOrder.customerId) as User}
        />
      )}
    </div>
  );
};



const TabButton = ({ id, label, icon, active, set }: any) => (
  <button
    onClick={() => set(id)}
    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all ${active === id ? "bg-primary text-white shadow-md" : "text-gray-400"}`}
  >
    {icon}
    <span className="text-[10px] font-bold mt-1">{label}</span>
  </button>
);
