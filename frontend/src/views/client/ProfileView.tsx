import React from "react";
import { useApp } from "../../AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card } from "../../components/UI";
import { Icons } from "../../constants";

export const ProfileView = () => {
  const { colonies } = useApp();
  const { currentUser, logout, updateUser } = useAuth();

  const handleDeleteAddress = (addressId: string) => {
    if (!currentUser?.addresses) return;

    if (window.confirm("¿Seguro que deseas eliminar esta dirección?")) {
      const updatedAddresses = currentUser.addresses.filter(
        (addr: any) => (addr.id || addr._id) !== addressId,
      );
      updateUser({ ...currentUser, addresses: updatedAddresses } as any);
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
            <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
              <Icons.MapPin size={18} className="text-primary" /> Mis
              Direcciones
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
          onClick={logout}
        >
          Cerrar Sesión
        </Button>
      </Card>
    </div>
  );
};