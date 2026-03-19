import React, { useState, useMemo } from "react";
import { useApp } from "../../AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card, Input, Badge, Modal } from "../../components/UI";
import { Icons, SUBSCRIPTION_LIMITS } from "../../constants";
import { StoreProfile, OrderStatus } from "../../types";
import { ChatModal } from "../../components/ChatModal";
import { formatDate, getOrderStatusColor } from "../../utils";

const RatingModal = ({ isOpen, onClose, order, onSubmit }: any) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    onSubmit({
      orderId: order.id,
      storeId:
        typeof order.storeId === "object" ? order.storeId.id : order.storeId,
      customerId:
        typeof order.customerId === "object"
          ? order.customerId.id
          : order.customerId,
      rating,
      comment,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Calificar Servicio">
      <div className="flex flex-col items-center space-y-4 py-4">
        <p className="text-gray-500 text-center">¿Qué te pareció tu pedido?</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`transition-transform hover:scale-110 ${
                rating >= star ? "text-yellow-400" : "text-gray-300"
              }`}
            >
              <Icons.Star size={32} fill="currentColor" />
            </button>
          ))}
        </div>
        <Input
          placeholder="Escribe un comentario (opcional)"
          value={comment}
          onChange={(e: any) => setComment(e.target.value)}
        />
        <Button onClick={handleSubmit} className="w-full">
          Enviar Calificación
        </Button>
      </div>
    </Modal>
  );
};

const OrderDetailsModal = ({ order, isOpen, onClose, onRateClick }: any) => {
  const { users } = useApp();
  if (!order) return null;

  const store =
    typeof order.storeId === "object"
      ? (order.storeId as StoreProfile)
      : (users.find((u) => u.id === order.storeId) as StoreProfile);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detalles del Pedido #${order.id.slice(-4)}`}
    >
      <div className="py-4">
        <div className="flex justify-between mb-2">
          <span className="font-bold text-primary">
            {store?.storeName || "Tienda"}
          </span>
          <Badge color={getOrderStatusColor(order.status)}>
            {order.status}
          </Badge>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {formatDate(order.createdAt)}
        </p>
        <div className="space-y-1 mb-3 bg-gray-50 p-3 rounded-xl">
          {order.items.map((item: any, idx: number) => (
            <div
              key={idx}
              className="flex justify-between text-xs text-gray-600"
            >
              <span>
                {item.quantity}x {item.product.name}
              </span>
              <span>
                ${(Number(item.product.price || 0) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Productos</span>
              <span>
                $
                {order.items
                  .reduce(
                    (sum: number, i: any) =>
                      sum + Number(i.product.price || 0) * i.quantity,
                    0,
                  )
                  .toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span> Tarifa de envío </span>
              <span>${Number(order.deliveryFee || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-100">
              <span>Total</span>
              <span>${Number(order.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
        {/* Rating section inside modal */}
        {order.status === OrderStatus.DELIVERED && !order.isReviewed && (
          <Button
            onClick={() => {
              onRateClick();
              onClose(); // Cierra este modal para abrir el de calificación
            }}
            className="w-full mt-4 !py-2 !text-sm bg-yellow-400 hover:bg-yellow-500 !text-yellow-900"
          >
            <Icons.Star size={16} />
            Calificar Tienda
          </Button>
        )}
        {order.status === OrderStatus.DELIVERED && order.isReviewed && (
          <div className="w-full mt-4 py-2 text-sm bg-gray-100 text-gray-500 text-center rounded-xl font-medium flex items-center justify-center gap-2">
            <Icons.Check size={16} />
            Tienda Calificada
          </div>
        )}
      </div>
    </Modal>
  );
};

const OrderHistoryCard = ({ order, onCardClick, onRateClick }: any) => {
  const { users } = useApp();
  const store =
    typeof order.storeId === "object"
      ? (order.storeId as StoreProfile)
      : (users.find((u) => u.id === order.storeId) as StoreProfile);

  return (
    <div
      onClick={onCardClick}
      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-sm">{store?.storeName || "Tienda"}</p>
          <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
        </div>
        <Badge color={getOrderStatusColor(order.status)}>{order.status}</Badge>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {order.status === OrderStatus.DELIVERED && !order.isReviewed && (
            <Button
              onClick={(e) => {
                e.stopPropagation(); // Evita que se abra el modal de detalles
                onRateClick();
              }}
              className="!py-1.5 !px-3 !text-xs bg-yellow-400 hover:bg-yellow-500 !text-yellow-900"
            >
              <Icons.Star size={14} />
              Calificar
            </Button>
          )}
          {order.status === OrderStatus.DELIVERED && order.isReviewed && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
              <Icons.Check size={14} className="text-green-500" />
              Calificada
            </div>
          )}
        </div>
        <div>
          <span className="text-xs text-gray-500">Total: </span>
          <span className="font-bold text-primary">
            ${Number(order.total || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const OrdersView = ({
  setView,
}: {
  setView: (view: "home" | "cart" | "orders" | "profile") => void;
}) => {
  const {
    orders,
    users,
    updateOrderStatus,
    addReview,
    unreadCounts,
    markOrderMessagesAsRead,
  } = useApp();

  const { currentUser } = useAuth();
  const [chatOrder, setChatOrder] = useState<any | null>(null);
  const [ratingOrder, setRatingOrder] = useState<any | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<any | null>(null);
  const [isRating, setIsRating] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(7);

  const { activeOrders, pastOrders } = useMemo(() => {
    const myOrders = orders.filter((o) => {
      const cId =
        typeof o.customerId === "object"
          ? (o.customerId as any).id || (o.customerId as any)._id
          : o.customerId;
      return cId === currentUser!.id;
    });

    const active = myOrders.filter(
      (o) =>
        ![
          OrderStatus.DELIVERED,
          OrderStatus.REJECTED,
          OrderStatus.CANCELLED,
        ].includes(o.status),
    );
    const past = myOrders.filter((o) =>
      [
        OrderStatus.DELIVERED,
        OrderStatus.REJECTED,
        OrderStatus.CANCELLED,
      ].includes(o.status),
    );

    return { activeOrders: active, pastOrders: past };
  }, [orders, currentUser]);

  const handleRateSubmit = async (reviewData: any) => {
    setIsRating(true);
    try {
      await addReview(reviewData);
      setRatingOrder(null); // Cierra el modal de calificación
    } catch (error) {
      console.error("Error al calificar:", error);
      alert("Hubo un error al enviar tu calificación.");
    } finally {
      setIsRating(false);
    }
  };

  return (
    <div className="px-4 py-6 pb-24 space-y-4">
      {/* Orders ACTIVES */}
      <h2 className="text-2xl font-bold">Pedidos Activos</h2>
      {activeOrders.length > 0 ? (
        activeOrders.map((o) => {
          const store =
            typeof o.storeId === "object"
              ? (o.storeId as StoreProfile)
              : (users.find((u) => u.id === o.storeId) as StoreProfile);

          const driver = o.driverId
            ? users.find((u) => u.id === o.driverId) ||
              ({
                id: o.driverId,
                firstName: "Repartidor",
                lastName: "",
                role: "DELIVERY",
              } as any)
            : null;
          return (
            <Card 
              key={o.id} 
              className={`transition-all duration-500 ${
                o.status === OrderStatus.ARRIVED 
                  ? "border-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" 
                  : ""
              }`}
            >
              <div className="flex justify-between mb-2">
                <span className="font-bold text-primary">
                  {store?.storeName || "Tienda"}
                </span>
                <Badge color={getOrderStatusColor(o.status)}>{o.status}</Badge>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                ID: #{o.id.slice(-4)} • {formatDate(o.createdAt)}
              </p>
              <div className="mb-3 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg flex items-start gap-2">
                <Icons.MapPin size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  Entregar en: {o.deliveryAddress.street} #
                  {o.deliveryAddress.number}
                </span>
              </div>
              <div className="space-y-1 mb-3 bg-gray-50 p-3 rounded-xl">
                {o.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs text-gray-600"
                  >
                    <span>
                      {item.quantity}x {item.product.name}
                    </span>
                    <span>
                      $
                      {(
                        Number(item.product.price || 0) * item.quantity
                      ).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Productos</span>
                    <span>
                      $
                      {o.items
                        .reduce(
                          (sum, i) =>
                            sum + Number(i.product.price || 0) * i.quantity,
                          0,
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span> Tarifa de envío </span>
                    <span>${Number(o.deliveryFee || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-100">
                    <span>Total</span>
                    <span>${Number(o.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-primary transition-all duration-1000`}
                  style={{
                    width: {
                      [OrderStatus.PENDING]: "10%",
                      [OrderStatus.PREPARING]: "40%",
                      [OrderStatus.READY]: "60%",
                      [OrderStatus.ON_WAY]: "80%",
                      [OrderStatus.ARRIVED]: "90%",
                      [OrderStatus.DELIVERED]: "100%",
                      [OrderStatus.REJECTED]: "100%",
                      [OrderStatus.CANCELLED]: "100%",
                    }[o.status],
                  }}
                ></div>
              </div>
              <p className="text-xs text-right mt-1 text-gray-400">
                {o.status}
              </p>

              {/* NOTIFICACIÓN VISUAL DE LLEGADA */}
              {o.status === OrderStatus.ARRIVED && (
                <div className="mt-4 p-3 bg-green-100 rounded-xl flex items-center gap-3 animate-pulse">
                  <div className="bg-green-500 p-2 rounded-full text-white"><Icons.Bike size={20} /></div>
                  <p className="text-green-800 font-bold text-sm">¡Tu repartidor ha llegado! Sal a recibir tu pedido.</p>
                </div>
              )}

              {(o.status === OrderStatus.ON_WAY || o.status === OrderStatus.ARRIVED) && driver && (
                <Button
                  variant="secondary"
                  className="w-full mt-3 py-2 text-sm relative"
                  onClick={() => {
                    setChatOrder(o);
                    markOrderMessagesAsRead(o.id);
                  }}
                >
                  <Icons.Mail size={16} className="mr-2" />
                  Chatear con Repartidor
                  {unreadCounts[o.id] > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                      {unreadCounts[o.id]}
                    </span>
                  )}
                </Button>
              )}
              {o.status === OrderStatus.DELIVERED && !o.isReviewed && (
                <Button
                  className="w-full mt-3 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 text-white"
                  onClick={() => setRatingOrder(o)}
                >
                  <Icons.Star size={16} className="mr-2" />
                  Calificar Tienda
                </Button>
              )}
              {o.status === OrderStatus.DELIVERED && o.isReviewed && (
                <div className="w-full mt-3 py-2 text-sm bg-gray-100 text-gray-500 text-center rounded-xl font-medium flex items-center justify-center gap-2">
                  <Icons.Check size={16} />
                  Tienda Calificada
                </div>
              )}
              {o.status === OrderStatus.PENDING && (
                <Button
                  variant="danger"
                  className="w-full mt-3 py-2 text-sm"
                  onClick={() => {
                    if (
                      window.confirm("¿Seguro que deseas cancelar el pedido?")
                    ) {
                      updateOrderStatus(o.id, OrderStatus.CANCELLED);
                    }
                  }}
                >
                  Cancelar Pedido
                </Button>
              )}
            </Card>
          );
        })
      ) : (
        <div className="text-center py-10 text-gray-400 flex flex-col items-center">
          <p>No tienes ningún pedido activo en este momento.</p>
          <Button onClick={() => setView("home")} className="mt-4">
            <Icons.ShoppingCart size={16} />
            Comprar ahora
          </Button>
        </div>
      )}

      {pastOrders.length > 0 && (
        <div className="pt-4">
          <h2 className="text-2xl font-bold mb-4">Historial de Pedidos</h2>
          <div className="space-y-3">
            {pastOrders.slice(0, visibleHistoryCount).map((o) => (
              <OrderHistoryCard
                key={o.id}
                order={o}
                onCardClick={() => setDetailsOrder(o)}
                onRateClick={() => setRatingOrder(o)}
              />
            ))}
          </div>
          {pastOrders.length > visibleHistoryCount && (
            <Button
              onClick={() => setVisibleHistoryCount((prev) => prev + 7)}
              variant="secondary"
              className="w-full mt-4"
            >
              Cargar más
            </Button>
          )}
        </div>
      )}
      {chatOrder && (
        <ChatModal
          isOpen={!!chatOrder}
          onClose={() => setChatOrder(null)}
          orderId={chatOrder.id}
          otherParty={
            users.find((u) => u.id === chatOrder.driverId) ||
            ({
              id: chatOrder.driverId,
              firstName: "Repartidor",
              lastName: "",
              role: "DELIVERY",
              email: "",
              phone: "",
            } as any)
          }
        />
      )}
      {ratingOrder && (
        <RatingModal
          isOpen={!!ratingOrder}
          onClose={() => setRatingOrder(null)}
          order={ratingOrder}
          onSubmit={handleRateSubmit}
        />
      )}
      <OrderDetailsModal
        order={detailsOrder}
        isOpen={!!detailsOrder}
        onClose={() => setDetailsOrder(null)}
        onRateClick={() => setRatingOrder(detailsOrder)}
      />
    </div>
  );
};
