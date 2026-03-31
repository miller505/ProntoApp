import React, { useState, useMemo } from "react";
import { useApp } from "../../AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useOrders } from "../../contexts/OrderContext";
import {
  Button,
  Input,
  Card,
  Badge,
  SearchableSelect,
} from "../../components/UI";
import { Icons } from "../../constants";
import { StoreProfile, OrderStatus } from "../../types";
import { calculateDistance } from "../../utils";

export const CheckoutView = ({ setView }: { setView: (view: any) => void }) => {
  const { colonies, users, settings, refreshData } = useApp();
  const { placeOrder } = useOrders();
  const { cart, cartTotal, clearCart } = useCart();
  const { currentUser, updateUser } = useAuth();

  const [addressStep, setAddressStep] = useState(false);
  const [newAddress, setNewAddress] = useState({
    street: "",
    number: "",
    colonyId: "",
    reference: "",
    lat: 0,
    lng: 0,
  });
  const [saveAddress, setSaveAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    currentUser?.addresses?.[0]?.id || currentUser?.addresses?.[0]?._id || "",
  );
  const [payMethod, setPayMethod] = useState<"CARD" | "CASH">("CARD");
  const [colonySearch, setColonySearch] = useState("");
  const [isColonyListOpen, setIsColonyListOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const filteredColonies = useMemo(() => {
    return colonies.filter((c) =>
      c.name.toLowerCase().includes(colonySearch.toLowerCase()),
    );
  }, [colonies, colonySearch]);

  // Agrupar ítems por tienda
  const itemsByStore = useMemo(() => {
    const groups: Record<string, typeof cart> = {};
    cart.forEach((item) => {
      const sId = item.product.storeId;
      if (!groups[sId]) groups[sId] = [];
      groups[sId].push(item);
    });
    return groups;
  }, [cart]);

  // Calcular tarifas y tiempos
  const { storeCalculations, grandTotal } = useMemo(() => {
    const calcs: Record<string, any> = {};
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

    Object.entries(itemsByStore).forEach(([storeId, items]) => {
      const store = users.find((u) => u.id === storeId) as StoreProfile;
      let deliveryFee = 0;
      let eta = 0; // Estimated Time of Arrival (mins)

      // Calcular Subtotal Tienda
      const storeSubtotal = items.reduce(
        (acc, item) => acc + Number(item.product.price || 0) * item.quantity,
        0,
      );

      if (clientColony && store && store.storeAddress?.colonyId) {
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

          // Tarifa Repartidor
          const driverPart = Math.ceil(dist * settings.kmRate);
          const driverFee =
            driverPart < settings.kmRate ? settings.kmRate : driverPart;

          // Comisión App (Banderazo)
          const appCommission = storeSubtotal * (settings.commissionRate / 100);

          // Comisión por distancia para la empresa (Nuevo) con mínimo de 1KM
          const companyDistanceFee = Math.max(
            settings.companyKmRate || 0,
            Math.ceil(dist * (settings.companyKmRate || 0)),
          );

          deliveryFee = driverFee + appCommission + companyDistanceFee;

          // Tiempo Estimado: Prep + (3 mins x Km)
          const prepTimeVal = parseInt(store.prepTime || "0") || 30;
          const travelTime = Math.ceil(dist * 3);
          eta = prepTimeVal + travelTime;
        }
      }

      const storeTotal = storeSubtotal + deliveryFee;
      total += storeTotal;

      calcs[storeId] = {
        store,
        subtotal: storeSubtotal,
        deliveryFee,
        total: storeTotal,
        eta,
      };
    });

    return { storeCalculations: calcs, grandTotal: total };
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

  const handlePlaceOrder = async () => {
    let finalAddress: any = null;

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
        }
      }
      finalAddress = newAddressObject;
    } else if (selectedAddressId) {
      finalAddress = currentUser?.addresses?.find(
        (a: any) => (a.id || a._id) === selectedAddressId,
      );
    }

    if (!finalAddress) return alert("Selecciona una dirección de entrega.");

    setIsPlacingOrder(true);

    try {
      // RECOMENDACIÓN: Llamar primero a /api/orders/estimate para confirmar precio final
      // antes de ejecutar los placeOrder.

      const orderPromises = Object.entries(itemsByStore).map(
        async ([storeId, items]) => {
          // Usamos la lógica de estimación del servidor
          const formattedItems = items.map((item) => ({
            product: item.product,
            productId: item.product.id,
            quantity: item.quantity,
            price: Number(item.product.price || 0),
            notes: item.notes,
          }));

          const calc = storeCalculations[storeId];

          // El backend ahora validará y recalculará deliveryFee por seguridad
          return placeOrder({
            storeId,
            customerId: currentUser!.id,
            items: formattedItems,
            subtotal: calc.subtotal,
            deliveryFee: calc.deliveryFee,
            driverFee: 0,
            total: calc.total,
            paymentMethod: payMethod,
            deliveryAddress: {
              street: finalAddress.street,
              number: finalAddress.number,
              colonyId: finalAddress.colonyId,
              reference: finalAddress.reference || "",
              lat: finalAddress.lat, // Coordenadas de Leaflet
              lng: finalAddress.lng,
            },
            status: OrderStatus.PENDING,
          } as any);
        },
      );

      await Promise.all(orderPromises);
      clearCart();
      refreshData();
      setView("orders");
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al realizar pedido.");
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-40 overflow-y-auto">
      {/* Header */}
      <div className="bg-white px-4 py-4 sticky top-0 z-20 shadow-sm flex items-center gap-3">
        <button
          onClick={() => setView("cart")}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100"
        >
          <Icons.ChevronLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="font-mega text-lg text-gray-800">CHECKOUT</h1>
      </div>

      <div className="p-4 space-y-6">
        {/* 1. Dirección */}
        <section>
          <h3 className="font-bold text-gray-500 text-xs mb-2 uppercase tracking-wide">
            Dirección de Entrega
          </h3>
          {!addressStep ? (
            <div className="space-y-2">
              {(currentUser?.addresses || []).map((addr: any) => (
                <div
                  key={addr.id || addr._id}
                  onClick={() => setSelectedAddressId(addr.id || addr._id)}
                  className={`p-4 rounded-2xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                    selectedAddressId === (addr.id || addr._id)
                      ? "border-primary bg-white shadow-md"
                      : "border-transparent bg-white shadow-sm opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${selectedAddressId === (addr.id || addr._id) ? "bg-red-50 text-primary" : "bg-gray-100 text-gray-400"}`}
                    >
                      <Icons.MapPin size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">
                        {addr.street} #{addr.number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {colonies.find((c) => c.id === addr.colonyId)?.name}
                      </p>
                    </div>
                  </div>
                  {selectedAddressId === (addr.id || addr._id) && (
                    <Icons.CheckCircle
                      className="text-primary"
                      size={20}
                      fill="white"
                    />
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => {
                  setAddressStep(true);
                  setSelectedAddressId("");
                }}
                className="w-full text-sm border-dashed"
              >
                + Nueva Dirección
              </Button>
            </div>
          ) : (
            <Card className="space-y-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm">Nueva Dirección</span>
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
                maxLength={50}
                onChange={(e: any) =>
                  setNewAddress({ ...newAddress, street: e.target.value })
                }
              />
              <div className="flex gap-2">
                <Input
                  label="Número"
                  value={newAddress.number}
                  onChange={(e: any) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setNewAddress({ ...newAddress, number: val });
                  }}
                  maxLength={5}
                />
                <div className="w-full">
                  <SearchableSelect
                    label="Colonia"
                    placeholder="Seleccionar..."
                    value={newAddress.colonyId}
                    onChange={(val: string) => {
                      const col = colonies.find((c) => c.id === val);
                      if (col) {
                        setNewAddress({
                          ...newAddress,
                          colonyId: col.id,
                          lat: col.lat,
                          lng: col.lng,
                        });
                      }
                    }}
                    options={colonies}
                  />
                </div>
              </div>
              <Input
                label="Referencias"
                value={newAddress.reference}
                maxLength={100}
                onChange={(e: any) =>
                  setNewAddress({ ...newAddress, reference: e.target.value })
                }
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="save"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                />
                <label htmlFor="save" className="text-sm">
                  Guardar dirección
                </label>
              </div>
            </Card>
          )}
        </section>

        {/* 2. Método de Pago */}
        <section>
          <h3 className="font-bold text-gray-500 text-xs mb-2 uppercase tracking-wide">
            Método de Pago
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPayMethod("CARD")}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                payMethod === "CARD"
                  ? "border-secondary bg-blue shadow-md text-secondary"
                  : "border-transparent bg-white shadow-sm text-gray-400"
              }`}
            >
              <Icons.CreditCard size={24} />
              <span className="text-xs font-bold">Tarjeta</span>
            </button>
            <button
              onClick={() => setPayMethod("CASH")}
              className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                payMethod === "CASH"
                  ? "border-green-600 bg-white shadow-md text-green-600"
                  : "border-transparent bg-white shadow-sm text-gray-400"
              }`}
            >
              <Icons.DollarSign size={24} />
              <span className="text-xs font-bold">Efectivo</span>
            </button>
          </div>
        </section>

        {/* 3. Resumen de Orden(es) */}
        <section>
          <h3 className="font-bold text-gray-500 text-xs mb-2 uppercase tracking-wide">
            Resumen del Pedido
          </h3>
          {Object.entries(storeCalculations).map(([storeId, calc]: any) => (
            <div
              key={storeId}
              className="bg-white rounded-3xl p-4 shadow-sm mb-4 border border-gray-100"
            >
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-50">
                <img
                  src={calc.store?.logo}
                  className="w-10 h-10 rounded-full bg-gray-100 object-cover"
                />
                <div>
                  <h4 className="font-bold text-gray-800">
                    {calc.store?.storeName}
                  </h4>
                  {calc.eta > 0 ? (
                    <Badge
                      color="blue"
                      className="mt-1 flex items-center gap-1 font-mega !py-0.5"
                    >
                      <Icons.Clock size={10} /> ~{calc.eta} min
                    </Badge>
                  ) : (
                    <span className="text-xs text-red-400">
                      Calculando tiempo...
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {itemsByStore[storeId].map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-600">
                        {item.quantity}x
                      </span>
                      <span className="text-gray-800 line-clamp-1">
                        {item.product.name}
                      </span>
                    </div>
                    <span className="font-medium text-gray-600">
                      ${(Number(item.product.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>${calc.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tarifa de envío</span>
                  <span>${calc.deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-gray-800 pt-2 border-t border-gray-200 mt-2">
                  <span>Total</span>
                  <span>${calc.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Bottom Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30">
        <div className="flex justify-between items-end mb-4 px-2">
          <span className="text-gray-500 text-sm">Total a pagar</span>
          <div className="text-right">
            <span className="block font-mega text-2xl text-gray-900 leading-none">
              ${grandTotal.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-400">
              {cart.reduce((a, b) => a + b.quantity, 0)} productos
            </span>
          </div>
        </div>
        <Button
          onClick={handlePlaceOrder}
          disabled={isPlacingOrder}
          className="w-full shadow-xl shadow-primary/30 py-4 text-lg"
        >
          {isPlacingOrder ? "Procesando..." : "Confirmar Pedido"}
        </Button>
      </div>
    </div>
  );
};
