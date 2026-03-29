import React, { useState, useMemo } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useOrders } from "../contexts/OrderContext";
import { useChat } from "../contexts/ChatContext";
import { Button, Card, Badge } from "../components/UI";
import { Icons } from "../constants";
import { OrderStatus, StoreProfile, User, Order } from "../types";
import { ChatModal } from "../components/ChatModal";
import { formatDate, getOrderStatusColor } from "../utils";
export const DeliveryDashboard = () => {
  const { users, colonies } = useApp();
  const { orders, updateOrderStatus } = useOrders();
  const { unreadCounts, markOrderMessagesAsRead } = useChat();

  const { currentUser, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "available" | "mine" | "profile" | "finances"
  >("available");
  const [chatOrder, setChatOrder] = useState<any | null>(null);
  const [visibleMapId, setVisibleMapId] = useState<string | null>(null); // 'store-id' o 'client-id'
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);

  const availableOrders = orders.filter(
    (o: Order) =>
      (o.status || "").toUpperCase() === OrderStatus.READY && !o.driverId,
  );
  const myDeliveries = orders.filter(
    (o: Order) =>
      o.driverId === currentUser?.id &&
      ((o.status || "").toUpperCase() === OrderStatus.ON_WAY ||
        (o.status || "").toUpperCase() === OrderStatus.ARRIVED),
  );
  const myCompletedDeliveries = orders
    .filter(
      (o: Order) =>
        o.driverId === currentUser?.id &&
        (o.status || "").toUpperCase() === OrderStatus.DELIVERED,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  // Calculate financial stats
  const { totalEarnings, currentWeekEarnings, currentWeekOrders } =
    useMemo(() => {
      const total = myCompletedDeliveries.reduce(
        (acc, o) => acc + (o.driverFee || 0),
        0,
      );

      const now = new Date();
      const currentDay = now.getDay();
      const diff = now.getDate() - currentDay;
      const currentWeekStart = new Date(now.setDate(diff)).setHours(0, 0, 0, 0);

      let weekEarnings = 0;
      let weekOrders = 0;

      myCompletedDeliveries.forEach((o) => {
        const d = new Date(o.createdAt);
        const day = d.getDay();
        const diffDate = d.getDate() - day;
        const weekStart = new Date(d.setDate(diffDate)).setHours(0, 0, 0, 0);

        if (weekStart === currentWeekStart) {
          weekEarnings += o.driverFee || 0;
          weekOrders += 1;
        }
      });

      return {
        totalEarnings: total,
        currentWeekEarnings: weekEarnings,
        currentWeekOrders: weekOrders,
      };
    }, [myCompletedDeliveries]);

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

  const handleArrived = async (orderId: string) => {
    const success = await updateOrderStatus(orderId, OrderStatus.ARRIVED);
    if (success) {
      alert("¡Cliente notificado que estás afuera!");
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
            src="/logo.svg?v=2"
            alt="Logo"
            className="h-10 w-auto object-contain"
          />
          <h1 className="text-xs font-mega text-iosGray">
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
            label="Disponibles"
            count={availableOrders.length}
            icon={<Icons.Bike size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="mine"
            label="Mis Entregas"
            count={myDeliveries.length}
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
              // Usamos los datos poblados directamente de la orden
              const store = (
                typeof order.storeId === "object"
                  ? order.storeId
                  : users.find((u) => u.id === order.storeId)
              ) as StoreProfile;

              if (!store) return null;

              const storeColony = colonies.find(
                (c) => c.id === (store.storeAddress?.colonyId || ""),
              );
              const deliveryColony = colonies.find(
                (c) => c.id === order.deliveryAddress.colonyId,
              );

              return (
                <Card key={order.id} className="border-l-4 border-yellow-400">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-gray-500 text-xs">
                      #{order.id.slice(-4)}
                    </span>
                    <Badge
                      color={getOrderStatusColor(order.status)}
                      className="font-mega uppercase"
                    >
                      {(order.status || "").toUpperCase()}
                    </Badge>
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
              const store = (
                typeof order.storeId === "object"
                  ? order.storeId
                  : users.find((u) => u.id === order.storeId)
              ) as StoreProfile;
              const client = (
                typeof order.customerId === "object"
                  ? order.customerId
                  : users.find((u) => u.id === order.customerId)
              ) as User;

              if (!store) return null;

              const storeColony = colonies.find(
                (c) => c.id === (store.storeAddress?.colonyId || ""),
              );
              const clientColony = colonies.find(
                (c) => c.id === order.deliveryAddress.colonyId,
              );

              return (
                <Card key={order.id} className="border-l-4 border-blue-500">
                  <div className="flex justify-between mb-4">
                    <div>
                      <span className="font-mega text-xl block">EN CURSO </span>
                      <span className="text-xs font-mono text-gray-500">
                        ID: #{order.id.slice(-6)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        ${order.total.toFixed(2)}
                      </p>
                      {order.paymentMethod === "CASH" ? (
                        <div className="flex items-center justify-end mt-1">
                          <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-[10px] font-bold border border-green-200">
                            <Icons.DollarSign size={12} />
                            Cobrar Efectivo
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end mt-1">
                          <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-[10px] font-bold border border-blue-200">
                            <Icons.CreditCard size={12} />
                            Pagado Tarjeta
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 relative">
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
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() =>
                              setVisibleMapId(
                                visibleMapId === `store-${order.id}`
                                  ? null
                                  : `store-${order.id}`,
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-bold"
                          >
                            <Icons.MapPin size={14} />
                            {visibleMapId === `store-${order.id}`
                              ? "Ocultar Mapa"
                              : "Ver Ubicación"}
                          </button>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.storeAddress.street} ${store.storeAddress.number}, ${storeColony?.name || ""}, Canatlán, Durango`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold"
                          >
                            <Icons.ExternalLink size={14} />
                            Google Maps
                          </a>
                        </div>

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
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() =>
                              setVisibleMapId(
                                visibleMapId === `client-${order.id}`
                                  ? null
                                  : `client-${order.id}`,
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-xs font-bold"
                          >
                            <Icons.MapPin size={14} />
                            {visibleMapId === `client-${order.id}`
                              ? "Ocultar Mapa"
                              : "Ver Ubicación"}
                          </button>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.deliveryAddress.street} ${order.deliveryAddress.number}, ${clientColony?.name || ""}, Canatlán, Durango`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold"
                          >
                            <Icons.ExternalLink size={14} />
                            Google Maps
                          </a>
                        </div>

                        <a
                          href={`tel:${client?.phone}`}
                          className="text-primary text-sm font-bold mt-2 block"
                        >
                          Llamar: {client?.phone}
                        </a>
                      </div>
                    </div>
                  </div>

                  {order.status === OrderStatus.ON_WAY && (
                    <Button
                      className="w-full mt-6 bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleArrived(order.id)}
                    >
                      <Icons.MapPin size={18} className="mr-2" />
                      Ya llegué al domicilio
                    </Button>
                  )}

                  {order.status === OrderStatus.ARRIVED && (
                    <Button
                      className="w-full mt-6 bg-green-600 hover:bg-green-700 animate-pulse"
                      onClick={() => handleDeliver(order.id)}
                    >
                      <Icons.Check size={18} className="mr-2" />
                      Confirmar Entrega
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    className="w-full mt-4 !border-gray-800 !text-gray-800 relative"
                    onClick={() => {
                      setChatOrder(order);
                      markOrderMessagesAsRead(order.id);
                    }}
                  >
                    <Icons.MessageSquare size={16} className="mr-2" />
                    Chatear con Cliente
                    {unreadCounts[order.id] > 0 && (
                      <span className=" absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                        {unreadCounts[order.id] > 9
                          ? "9+"
                          : unreadCounts[order.id]}
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
                <h3 className="font-bold text-lg"> Datos del repartidor </h3>
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

            <h3 className="font-mega text-lg mb-2">HISTORIAL DE ENTREGAS</h3>
            {myCompletedDeliveries.length === 0 && (
              <p className="text-center text-gray-400 mt-10">
                No has completado ninguna entrega.
              </p>
            )}
            {myCompletedDeliveries
              .slice(0, visibleHistoryCount)
              .map((order) => {
                const store = (
                  typeof order.storeId === "object"
                    ? order.storeId
                    : users.find((u) => u.id === order.storeId)
                ) as StoreProfile;
                if (!store) return null;
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
                      <Badge
                        color={getOrderStatusColor(order.status)}
                        className="font-mega uppercase"
                      >
                        {(order.status || "").toUpperCase()}
                      </Badge>
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
            {myCompletedDeliveries.length > visibleHistoryCount && (
              <Button
                variant="secondary"
                className="w-full mt-4"
                onClick={() => setVisibleHistoryCount((prev) => prev + 10)}
              >
                Cargar más
              </Button>
            )}
          </div>
        )}

        {activeTab === "finances" && (
          <div className="pb-24">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="bg-white border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1 text-indigo-600">
                  <Icons.DollarSign size={18} />
                  <h3 className="font-semibold text-xs text-gray-600">
                    Ganancias Totales
                  </h3>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  ${totalEarnings.toFixed(2)}
                </p>
              </Card>

              <div className="bg-green-600 text-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-1 opacity-80">
                  <Icons.TrendingUp size={18} />
                  <h3 className="font-semibold text-xs">Ganancias (Semana)</h3>
                </div>
                <p className="text-xl font-bold">
                  ${currentWeekEarnings.toFixed(2)}
                </p>
              </div>

              <Card className="bg-white border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1 text-blue-600">
                  <Icons.ShoppingBag size={18} />
                  <h3 className="font-semibold text-xs text-gray-600">
                    Entregas Totales
                  </h3>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {myCompletedDeliveries.length}
                </p>
              </Card>

              <div className="bg-green-600 text-white p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-1 opacity-80">
                  <Icons.ShoppingBag size={18} />
                  <h3 className="font-semibold text-xs">Entregas (Semana)</h3>
                </div>
                <p className="text-xl font-bold">{currentWeekOrders}</p>
              </div>
            </div>

            <div>
              <h3 className="font-mega text-lg mb-4 text-gray-800">
                RESUMEN SEMANAL
              </h3>
              <div className="space-y-3">
                {Object.entries(
                  myCompletedDeliveries.reduce((acc: any, order) => {
                    const d = new Date(order.createdAt);
                    const day = d.getDay();
                    const diff = d.getDate() - day;
                    const weekStart = new Date(d.setDate(diff)).setHours(
                      0,
                      0,
                      0,
                      0,
                    );

                    if (!acc[weekStart])
                      acc[weekStart] = { total: 0, orders: 0, date: weekStart };

                    acc[weekStart].total += order.driverFee || 0;
                    acc[weekStart].orders += 1;
                    return acc;
                  }, {}),
                )
                  .sort((a: any, b: any) => Number(b[0]) - Number(a[0]))
                  .map(([key, data]: any) => {
                    const startDate = new Date(Number(key));
                    const labelStart = startDate.toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                    const endDate = new Date(startDate);
                    endDate.setDate(endDate.getDate() + 6);
                    const labelEnd = endDate.toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });

                    return (
                      <Card
                        key={key}
                        className="flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Icons.Calendar size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">
                              {labelStart} - {labelEnd}
                            </p>
                            <p className="text-xs text-gray-400">
                              {data.orders} entregas
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-lg text-green-600">
                          ${data.total.toFixed(2)}
                        </span>
                      </Card>
                    );
                  })}
              </div>
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
          otherParty={
            (typeof chatOrder.customerId === "object"
              ? chatOrder.customerId
              : users.find((u) => u.id === chatOrder.customerId)) ||
            ({
              firstName: "Cliente",
              lastName: "",
              role: "CLIENT",
              email: "",
              phone: "",
              id: chatOrder.customerId as string,
              approved: true,
            } as User)
          }
        />
      )}
    </div>
  );
};

const TabButton = ({ id, label, icon, active, set, count }: any) => (
  <button
    onClick={() => set(id)}
    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all relative ${active === id ? "bg-primary text-white shadow-md" : "text-gray-400"}`}
  >
    {count > 0 && (
      <span className="absolute top-1 right-3 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
        {count > 9 ? "9+" : count}
      </span>
    )}
    {icon}
    <span className="text-[10px] font-bold mt-1">{label}</span>
  </button>
);
