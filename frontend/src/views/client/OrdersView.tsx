import React, { useState } from "react";
import { useApp } from "../../AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card, Input, Badge, Modal } from "../../components/UI";
import { Icons } from "../../constants";
import { StoreProfile, OrderStatus } from "../../types";
import { ChatModal } from "../../components/ChatModal";
import { formatDate, getOrderStatusColor } from "../../utils";

const RatingModal = ({ isOpen, onClose, order, onSubmit }: any) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    onSubmit({
      orderId: order.id,
      storeId: typeof order.storeId === "object" ? order.storeId.id : order.storeId,
      customerId: typeof order.customerId === "object" ? order.customerId.id : order.customerId,
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

export const OrdersView = () => {
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

  return (
    <div className="px-4 py-6 pb-24 space-y-4">
      <h2 className="text-2xl font-bold mb-6">Mis Pedidos</h2>
      {orders
        .filter((o) => {
          const cId =
            typeof o.customerId === "object"
              ? (o.customerId as any).id || (o.customerId as any)._id
              : o.customerId;
          return cId === currentUser!.id;
        })
        .map((o) => {
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
            <Card key={o.id}>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-primary">
                  {store?.storeName || "Tienda"}
                </span>
                <Badge color={getOrderStatusColor(o.status)}>{o.status}</Badge>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                ID: #{o.id.slice(-4)} • {formatDate(o.createdAt)}
              </p>
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
              {o.status === OrderStatus.ON_WAY && driver && (
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
                    <span className="absolute top-3 right-4 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
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
        })}
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
          onSubmit={addReview}
        />
      )}
    </div>
  );
};