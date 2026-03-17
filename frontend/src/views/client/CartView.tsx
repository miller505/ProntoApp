import React, { useState, useMemo } from "react";
import { useApp } from "../../AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { Button, Input } from "../../components/UI";
import { Icons } from "../../constants";
import { StoreProfile, OrderStatus } from "../../types";
import { calculateDistance } from "../../utils";

// --- SUB-COMPONENTE PARA CORREGIR ERROR DE HOOKS Y MEJORAR UI ---
const CartItemCard = ({ item }: { item: any }) => {
  const { users } = useApp();
  const { removeFromCart, addToCart, deleteFromCart, updateItemNotes } =
    useCart();
  const store = users.find(
    (u) => u.id === item.product.storeId,
  ) as StoreProfile;
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center flex-1">
          <img
            src={item.product.image}
            alt={item.product.name}
            className="w-16 h-16 rounded-lg object-cover bg-gray-100"
          />
          <div className="flex-1">
            <p className="font-bold text-sm">{item.product.name}</p>
            <p className="text-xs text-gray-400">{store?.storeName}</p>
            <p className="text-sm font-bold text-primary mt-1">
              ${(Number(item.product.price || 0) * item.quantity).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => removeFromCart(item.product.id)}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
          >
            -
          </button>
          <span className="font-bold text-sm w-5 text-center">
            {item.quantity}
          </span>
          <button
            onClick={() => addToCart(item.product)}
            className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center active:bg-red-700"
          >
            +
          </button>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs text-blue-500 hover:text-blue-700 font-semibold flex items-center gap-1.5 p-1 -m-1"
        >
          <Icons.Edit2 size={14} />
          {item.notes ? "Editar nota" : "Agregar nota"}
        </button>
        <button
          onClick={() => deleteFromCart(item.product.id)}
          className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1.5 p-1 -m-1"
        >
          <Icons.Trash2 size={14} />
          Eliminar
        </button>
      </div>
      {showNotes && (
        <div className="mt-2">
          <Input
            as="textarea"
            rows={2}
            placeholder="Ej. Sin cebolla, bien cocido, etc."
            value={item.notes || ""}
            onChange={(e: any) =>
              updateItemNotes(item.product.id, e.target.value)
            }
            className="text-xs"
            maxLength={100}
          />
          <p className="text-right text-xs text-gray-400 mt-1">
            {(item.notes || "").length} / 100
          </p>
        </div>
      )}
    </div>
  );
};

export const CartView = ({
  setView,
}: {
  setView: (view: "home" | "cart" | "orders" | "profile") => void;
}) => {
  const { colonies, placeOrder, users, settings, refreshData } = useApp();
  const {
    cart,
    removeFromCart,
    addToCart,
    deleteFromCart,
    cartTotal,
    clearCart,
    updateItemNotes,
  } = useCart();
  const { currentUser, updateUser } = useAuth();

  const [addressStep, setAddressStep] = useState(false);
  const [newAddress, setNewAddress] = useState({
    street: "",
    number: "",
    colonyId: "",
    reference: "",
  });
  const [saveAddress, setSaveAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [payMethod, setPayMethod] = useState<"CARD" | "CASH">("CARD");
  const [colonySearch, setColonySearch] = useState("");
  const [isColonyListOpen, setIsColonyListOpen] = useState(false);

  const filteredColonies = useMemo(() => {
    return colonies.filter((c) =>
      c.name.toLowerCase().includes(colonySearch.toLowerCase()),
    );
  }, [colonies, colonySearch]);

  // Agrupar ítems por tienda para manejar pedidos múltiples
  const itemsByStore = useMemo(() => {
    const groups: Record<string, typeof cart> = {};
    cart.forEach((item) => {
      const sId = item.product.storeId;
      if (!groups[sId]) groups[sId] = [];
      groups[sId].push(item);
    });
    return groups;
  }, [cart]);

  // Calcular tarifas de envío por tienda
  const { totalDeliveryFee, storeFees } = useMemo(() => {
    const fees: Record<string, number> = {};
    let total = 0;

    // Determinar colonia del cliente
    const clientColonyId =
      addressStep && newAddress.colonyId
        ? newAddress.colonyId
        : selectedAddressId
          ? currentUser?.addresses?.find(
              (a: any) => (a.id || a._id) === selectedAddressId,
            )?.colonyId
          : null;

    const clientColony = colonies.find((c) => c.id === clientColonyId);

    if (clientColony) {
      Object.keys(itemsByStore).forEach((storeId) => {
        const store = users.find((u) => u.id === storeId) as StoreProfile;
        if (store && store.storeAddress?.colonyId) {
          const storeColony = colonies.find(
            (c) => c.id === store.storeAddress.colonyId,
          );
          if (storeColony) {
            const dist = calculateDistance(
              clientColony.lat,
              clientColony.lng,
              storeColony.lat,
              storeColony.lng,
            );
            const driverPart = Math.ceil(dist * settings.kmRate);
            const fee =
              (driverPart < settings.kmRate ? settings.kmRate : driverPart) +
              settings.baseFee;
            fees[storeId] = fee;
            total += fee;
          }
        } else {
          // Fallback si no se encuentra la tienda (usa tarifa base)
          fees[storeId] = settings.baseFee;
          total += settings.baseFee;
        }
      });
    }
    return { totalDeliveryFee: total, storeFees: fees };
  }, [
    itemsByStore,
    addressStep,
    newAddress.colonyId,
    selectedAddressId,
    currentUser,
    colonies,
    users,
    settings,
  ]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Determinar la dirección a usar
    let finalAddress: any = null;

    // 1. Flujo de Nueva Dirección
    if (addressStep) {
      if (!newAddress.colonyId) return alert("Selecciona una colonia");

      const newAddressObject = { id: Date.now().toString(), ...newAddress };

      if (saveAddress) {
        const currentAddresses = currentUser?.addresses || [];
        if (currentAddresses.length < 3) {
          await updateUser({
            ...currentUser,
            addresses: [...currentAddresses, newAddressObject],
          } as any);
        } else {
          alert(
            "Solo puedes guardar un máximo de 3 direcciones. Esta dirección se usará para el pedido actual pero no se guardará.",
          );
        }
      }
      finalAddress = newAddressObject;
    }

    // 2. Flujo de Dirección Guardada
    else if (selectedAddressId) {
      finalAddress = currentUser?.addresses?.find(
        (a: any) => (a.id || a._id) === selectedAddressId,
      );
    }

    if (!finalAddress) {
      // 3. Si no hay nada seleccionado, forzar nueva dirección
      setAddressStep(true);
      return alert("Por favor, agrega o selecciona una dirección de entrega.");
    }

    try {
      // Generar una orden por cada tienda
      const orderPromises = Object.entries(itemsByStore).map(
        async ([storeId, items]) => {
          const fee = storeFees[storeId] || settings.baseFee;
          const subtotal = items.reduce(
            (acc, item) =>
              acc + Number(item.product.price || 0) * item.quantity,
            0,
          );

          const formattedItems = items.map((item) => ({
            product: item.product,
            productId: item.product.id,
            quantity: item.quantity,
            price: Number(item.product.price || 0),
            notes: item.notes,
          }));

          return placeOrder({
            storeId,
            customerId: currentUser!.id,
            items: formattedItems,
            subtotal: subtotal,
            deliveryFee: fee,
            driverFee: 0, // El backend recalcula esto por seguridad
            total: subtotal + fee,
            paymentMethod: payMethod,
            deliveryAddress: {
              street: finalAddress.street,
              number: finalAddress.number,
              colonyId: finalAddress.colonyId,
              reference: finalAddress.reference || "",
            },
            status: OrderStatus.PENDING,
          } as any);
        },
      );

      await Promise.all(orderPromises);

      alert("¡Pedidos realizados con éxito!");
      clearCart();
      refreshData();
      setView("orders");
    } catch (e: any) {
      console.error(e);
      alert(
        e.response?.data?.error ||
          "Error al realizar uno o más pedidos. Por favor verifica.",
      );
    }
  };

  if (cart.length === 0)
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-400">
        <Icons.ShoppingCart size={48} className="mb-4 opacity-20" />
        <p className="mb-6">Tu carrito está vacío</p>
        <Button onClick={() => setView("home")}>
          <Icons.ShoppingCart size={16} /> Comprar ahora
        </Button>
      </div>
    );

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Tu Pedido</h2>

      <div className="space-y-4 mb-6">
        {cart.map((item, i) => (
          <CartItemCard key={item.product.id || i} item={item} />
        ))}
      </div>

      {!addressStep ? (
        <div className="space-y-4">
          <h3 className="font-bold">Dirección de Entrega</h3>
          {(currentUser?.addresses || []).length > 0 ? (
            <div className="space-y-2">
              {currentUser?.addresses?.map((addr: any) => {
                const addrId = addr.id || addr._id;
                return (
                  <div
                    key={addrId}
                    onClick={() => setSelectedAddressId(addrId)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer flex justify-between items-center ${
                      selectedAddressId === addrId
                        ? "border-primary bg-red-50"
                        : "border-transparent bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-bold">
                        {addr.street} #{addr.number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {colonies.find((c) => c.id === addr.colonyId)?.name}
                      </p>
                    </div>
                    {selectedAddressId === addrId && (
                      <Icons.Check className="text-primary" size={20} />
                    )}
                  </div>
                );
              })}
              <Button
                variant="secondary"
                onClick={() => {
                  setAddressStep(true);
                  setSelectedAddressId(""); // Limpiar selección al crear nueva
                }}
                className="w-full py-2 text-sm"
              >
                + Nueva Dirección
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setAddressStep(true)}
              className="w-full py-4 border-dashed border-2 border-gray-300"
            >
              Agregar Dirección
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white p-4 rounded-3xl space-y-3 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">Nueva Dirección</h3>
            <button
              onClick={() => setAddressStep(false)}
              className="text-xs text-red-500"
            >
              Cancelar
            </button>
          </div>
          <Input
            label="Calle"
            value={newAddress.street}
            onChange={(e: any) =>
              setNewAddress({ ...newAddress, street: e.target.value })
            }
          />
          <div className="flex gap-2">
            <Input
              label="Número"
              value={newAddress.number}
              onChange={(e: any) => {
                const val = e.target.value;
                if (/^\d*$/.test(val) && val.length <= 5) {
                  setNewAddress({ ...newAddress, number: val });
                }
              }}
              type="tel"
              maxLength={5}
            />
            <div className="w-full relative">
              <label className="text-xs text-gray-500 ml-1">Colonia</label>
              <input
                type="text"
                placeholder="Selecciona o busca..."
                className="w-full p-3 bg-gray-100 rounded-2xl mt-1 focus:outline-none focus:ring-2 ring-primary/20 text-iosText"
                value={colonySearch}
                onChange={(e) => {
                  setColonySearch(e.target.value);
                  setIsColonyListOpen(true);
                  if (newAddress.colonyId)
                    setNewAddress({ ...newAddress, colonyId: "" });
                }}
                onFocus={() => setIsColonyListOpen(true)}
                onBlur={() => setTimeout(() => setIsColonyListOpen(false), 200)}
              />
              {isColonyListOpen && (
                <div className="absolute top-full left-0 w-full bg-white border border-gray-100 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 mt-1">
                  {filteredColonies.length > 0 ? (
                    filteredColonies.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-50 last:border-none"
                        onClick={() => {
                          setNewAddress({ ...newAddress, colonyId: c.id });
                          setColonySearch(c.name);
                        }}
                      >
                        {c.name}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-gray-400 text-xs text-center">
                      No se encontraron resultados
                    </div>
                  )}
                </div>
              )}
              <Icons.ChevronDown
                className="absolute right-3 top-[2.8rem] text-gray-400 pointer-events-none"
                size={16}
              />
            </div>
          </div>
          <Input
            label="Referencias"
            value={newAddress.reference}
            onChange={(e: any) =>
              setNewAddress({ ...newAddress, reference: e.target.value })
            }
          />
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="saveAddress"
              checked={saveAddress}
              onChange={(e) => setSaveAddress(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="saveAddress" className="text-sm text-gray-600">
              Guardar dirección para futuros pedidos
            </label>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white p-4 rounded-3xl space-y-3">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${cartTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Envío</span>
          <span>
            $
            {totalDeliveryFee > 0
              ? totalDeliveryFee.toFixed(2)
              : "Calculando..."}
          </span>
        </div>
        <div className="flex justify-between font-bold text-xl pt-2 border-t">
          <span>Total</span>
          <span>${(cartTotal + totalDeliveryFee).toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setPayMethod("CARD")}
          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 ${
            payMethod === "CARD" ? "bg-gray-800 text-white" : "bg-white"
          }`}
        >
          <Icons.CreditCard size={18} /> Tarjeta
        </button>
        <button
          onClick={() => setPayMethod("CASH")}
          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 ${
            payMethod === "CASH" ? "bg-green-600 text-white" : "bg-white"
          }`}
        >
          <Icons.DollarSign size={18} /> Efectivo
        </button>
      </div>

      <Button
        className="w-full mt-6 shadow-xl shadow-red-500/30"
        onClick={handleCheckout}
      >
        Realizar Pedido
      </Button>
    </div>
  );
};
