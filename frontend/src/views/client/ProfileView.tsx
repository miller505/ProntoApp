import React, { useState } from "react";
import { useApp } from "../../AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card, Modal } from "../../components/UI";
import { Icons } from "../../constants";
import { OrderStatus } from "../../types";

export const ProfileView = () => {
  const { colonies, orders } = useApp();
  const { currentUser, logout, updateUser } = useAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleDeleteAddress = (addressId: string) => {
    if (!currentUser?.addresses) return;

    if (window.confirm("¿Seguro que deseas eliminar esta dirección?")) {
      const updatedAddresses = currentUser.addresses.filter(
        (addr: any) => (addr.id || addr._id) !== addressId,
      );
      updateUser({ ...currentUser, addresses: updatedAddresses } as any);
    }
  };

  const handleLogoutClick = () => {
    const activeOrders = orders.filter((o) => {
      const cId =
        typeof o.customerId === "object"
          ? (o.customerId as any).id || (o.customerId as any)._id
          : o.customerId;
      return (
        cId === currentUser?.id &&
        ![
          OrderStatus.DELIVERED,
          OrderStatus.REJECTED,
          OrderStatus.CANCELLED,
        ].includes(o.status)
      );
    });

    if (activeOrders.length > 0) {
      setIsLogoutModalOpen(true);
    } else {
      logout();
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${
      lastName?.charAt(0) || ""
    }`.toUpperCase();
  };

  const getColor = (name: string) => {
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="p-6 pb-24">
      <h2 className="text-lg mb-4 font-mega">MI CUENTA</h2>
      <Card className="flex flex-col py-6 space-y-4">
        <div className="flex items-center gap-4 px-2">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md ${getColor(
              (currentUser?.firstName || "") + (currentUser?.lastName || ""),
            )}`}
          >
            {getInitials(currentUser?.firstName, currentUser?.lastName)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-iosText">
              {currentUser?.firstName} {currentUser?.lastName}
            </h2>
            <p className="text-gray-500 font-medium text-sm">
              {currentUser?.role === "CLIENT" ? "Cliente" : "Usuario"}
            </p>
          </div>
        </div>

        <div className="w-full space-y-3 mt-4 text-left">
          <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
              <Icons.Mail size={16} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold">Correo</p>
              <p className="font-medium text-gray-800">{currentUser?.email}</p>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
              <Icons.Phone size={16} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold">Teléfono</p>
              <p className="font-medium text-gray-800">
                {currentUser?.phone || "Sin registrar"}
              </p>
            </div>
          </div>
        </div>

        {currentUser?.addresses && currentUser.addresses.length > 0 && (
          <div className="w-full mt-6 text-left">
            <h3 className="font-mega text-lg mb-3 flex items-center gap-2">
              <Icons.MapPin size={18} className="text-primary" /> MIS
              DIRECCIONES
            </h3>
            <div className="space-y-2">
              {currentUser.addresses.map((addr: any, idx: number) => {
                const col = colonies.find((c) => c.id === addr.colonyId);
                const addrId = addr.id || addr._id;
                return (
                  <div
                    key={addrId || idx}
                    className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-sm">
                        {addr.street} #{addr.number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {col ? col.name : "Colonia desconocida"}
                      </p>
                      {addr.reference && (
                        <p className="text-xs text-gray-400 mt-1 italic">
                          "{addr.reference}"
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAddress(addrId)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Icons.Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          variant="danger"
          className="mt-8 w-full py-3 rounded-xl font-bold"
          onClick={handleLogoutClick}
        >
          <Icons.LogOut size={18} className="mr-2" />
          Cerrar Sesión
        </Button>
      </Card>

      {/* Modal de Advertencia Logout */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="¿Cerrar sesión?"
      >
        <div className="space-y-4 pt-2">
          <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 flex items-start gap-3">
            <div className="bg-yellow-100 p-2 rounded-full text-yellow-600">
              <Icons.AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="font-bold text-yellow-800 text-sm">
                Tienes un pedido activo
              </h4>
              <p className="text-xs text-yellow-700 mt-1 leading-relaxed">
                Si cierras sesión ahora, no recibirás notificaciones sobre el
                estado de tu pedido en curso. Te recomendamos esperar a recibir
                tu entrega.
              </p>
            </div>
          </div>

          <p className="text-gray-500 text-sm text-center">
            ¿Deseas continuar de todos modos?
          </p>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => setIsLogoutModalOpen(false)}
              variant="secondary"
              className="w-full"
            >
              Volver
            </Button>
            <Button
              onClick={() => {
                setIsLogoutModalOpen(false);
                logout();
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20"
            >
              Continuar y cerrar sesión
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
