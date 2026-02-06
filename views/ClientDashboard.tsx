import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../AppContext";
import { Button, Card, Input, Badge, Modal } from "../components/UI";
import { Icons } from "../constants";
import { StoreProfile, SubscriptionType, Product, OrderStatus } from "../types";
import {
  getOrderStatusLabel,
  getOrderStatusColor,
} from "../src/orderStatusTranslations";
import { ChatModal } from "../components/ChatModal";
import { formatDate } from "../utils";

const ClientDashboard = () => {
  const {
    users,
    products,
    cart,
    addToCart,
    removeFromCart,
    cartTotal,
    currentUser,
    updateUser,
    placeOrder,
    orders,
    logout,
    colonies,
    addReview,
    unreadCounts,
    markOrderMessagesAsRead,
  } = useApp();
  const [view, setView] = useState<"home" | "cart" | "orders" | "profile">(
    "home",
  );
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);

  // Logic to separate stores
  const stores = users.filter(
    (u) => u.role === "STORE" && (u as StoreProfile).isOpen && u.approved,
  ) as StoreProfile[];

  // Fisher-Yates shuffle algorithm for random ordering
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Memoize the shuffled stores to prevent re-shuffling on every render
  const { ultraStores, otherStores } = useMemo(() => {
    console.log("Shuffling stores...");
    const newUltraStores = shuffleArray(
      stores.filter((s) => s.subscription === SubscriptionType.ULTRA),
    );
    const newPremiumStores = shuffleArray(
      stores.filter((s) => s.subscription === SubscriptionType.PREMIUM),
    );
    const newStandardStores = shuffleArray(
      stores.filter((s) => s.subscription === SubscriptionType.STANDARD),
    );
    const newOtherStores = [...newPremiumStores, ...newStandardStores];

    return {
      ultraStores: newUltraStores,
      otherStores: newOtherStores,
    };
  }, [stores]);

  if (selectedStore) {
    return (
      <StoreView
        store={selectedStore}
        onBack={() => setSelectedStore(null)}
        onGoToCart={() => {
          setSelectedStore(null);
          setView("cart");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Content Area */}
      {view === "home" && (
        <HomeView
          stores={stores}
          ultraStores={ultraStores}
          otherStores={otherStores}
          products={products}
          onStoreSelect={setSelectedStore}
        />
      )}
      {view === "cart" && <CartView setView={setView} />}
      {view === "orders" && <OrdersView />}
      {view === "profile" && <ProfileView />}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between z-40">
        <NavBtn
          icon={<Icons.Home />}
          label="Inicio"
          active={view === "home"}
          onClick={() => setView("home")}
        />
        <div className="relative">
          <NavBtn
            icon={<Icons.ShoppingBag />}
            label="Pedidos"
            active={view === "orders"}
            onClick={() => setView("orders")}
          />
          {Object.values(unreadCounts).reduce((a: number, b: number) => a + b, 0) > 0 && (
            <span className="absolute top-0 right-4 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </div>
        <div className="relative">
          <NavBtn
            icon={<Icons.ShoppingCart />}
            label="Carrito"
            active={view === "cart"}
            onClick={() => setView("cart")}
          />
          {cart.length > 0 && (
            <span className="absolute -top-1 right-2 w-5 h-5 bg-primary text-white text-[10px] flex items-center justify-center rounded-full font-bold">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </div>
        <NavBtn
          icon={<Icons.User />}
          label="Perfil"
          active={view === "profile"}
          onClick={() => setView("profile")}
        />
      </nav>
    </div>
  );
};

// --- Sub-View Components (Defined outside to prevent re-renders/focus loss) ---

const StoreView = ({
  store,
  onBack,
  onGoToCart,
}: {
  store: StoreProfile;
  onBack: () => void;
  onGoToCart: () => void;
}) => {
  const { products, addToCart, cart } = useApp();
  const [activeCategory, setActiveCategory] = useState("ALL");

  const storeProducts = products.filter(
    (p) => p.storeId === store.id && (p as any).isVisible !== false,
  );
  const categories = ["ALL", ...new Set(storeProducts.map((p) => p.category))];
  const filteredProducts =
    activeCategory === "ALL"
      ? storeProducts
      : storeProducts.filter((p) => p.category === activeCategory);

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header Image */}
      <div className="relative h-48">
        <img
          src={store.coverImage}
          className="w-full h-full object-cover"
          alt="Cover"
        />
        <div className="absolute inset-0 bg-black/20"></div>
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors"
        >
          <Icons.ChevronDown className="rotate-90" size={24} />
        </button>
        <button
          onClick={onGoToCart}
          className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors"
        >
          <Icons.ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      {/* Store Info */}
      <div className="px-6 -mt-10 relative z-10">
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-50">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {store.storeName}
              </h1>
              <p className="text-sm text-gray-500 mt-1">{store.description}</p>
            </div>
            <img
              src={store.logo}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-gray-100 bg-gray-50"
              alt="Logo"
            />
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Icons.Clock size={16} /> {store.prepTime || "30m"}
            </span>
            <span className="flex items-center gap-1">
              <Icons.MapPin size={16} /> {store.storeAddress.street}
            </span>
            {store.averageRating !== undefined && (
              <span className="flex items-center gap-1 text-yellow-500 font-bold">
                <Icons.Star size={16} fill="currentColor" />{" "}
                {store.averageRating > 0
                  ? store.averageRating.toFixed(1)
                  : "Nuevo"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Categories Nav */}
      <div className="sticky top-0 bg-white z-20 py-4 px-6 shadow-sm mt-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-3">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-primary text-white shadow-md shadow-primary/30" : "bg-gray-100 text-gray-500"}`}
            >
              {cat === "ALL" ? "Todo" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="px-6 py-4 space-y-4">
        {filteredProducts.map((p) => (
          <div
            key={p.id}
            className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"
          >
            <img
              src={p.image}
              className="w-24 h-24 rounded-xl object-cover bg-gray-100"
              alt={p.name}
            />
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{p.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">
                  {p.description}
                </p>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-bold text-primary">${p.price}</span>
                <button
                  onClick={() => {
                    addToCart(p);
                    alert("Agregado al carrito");
                  }}
                  className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-transform"
                >
                  <Icons.Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            No hay productos en esta categoría.
          </p>
        )}
      </div>
    </div>
  );
};

const HomeView = ({
  stores,
  ultraStores,
  otherStores,
  products,
  onStoreSelect,
}: any) => {
  const [search, setSearch] = useState("");

  const filteredStores = useMemo(() => {
    if (!search) return [];
    return stores.filter((s: StoreProfile) => {
      const hasProduct = products.some(
        (p: Product) =>
          p.storeId === s.id &&
          p.name.toLowerCase().includes(search.toLowerCase()) &&
          (p as any).isVisible !== false,
      );
      const matchesName = s.storeName
        .toLowerCase()
        .includes(search.toLowerCase());
      return hasProduct || matchesName;
    });
  }, [search, stores, products]);

  return (
    <div className="space-y-2 pb-24">
      {/* Search Bar */}
      <div className="sticky top-0 z-20 bg-secondary pt-2 pb-2 px-4">
        <div className="relative">
          <Icons.Search
            className="absolute left-4 top-3.5 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Busca pizza, sushi, tacos..."
            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white shadow-ios-card focus:outline-none focus:ring-2 ring-primary/20 text-iosText"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {search ? (
        <div className="px-4 space-y-4">
          <h2 className="font-bold text-lg">Resultados</h2>
          {filteredStores.map((s) => (
            <StoreCard key={s.id} store={s} onClick={() => onStoreSelect(s)} />
          ))}
          {filteredStores.length === 0 && (
            <p className="text-gray-400 text-center">
              No se encontraron resultados
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Ultra Section */}
          {ultraStores.length > 0 && (
            <div className="pl-4">
              <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Icons.Store className="text-primary" size={20} /> La mejor
                opción
              </h2>
              <div
                className="flex overflow-x-auto gap-3 pb-2 pr-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent"
                style={{
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "thin",
                  scrollbarColor:
                    "rgba(var(--primary-rgb, 59, 130, 246), 0.3) transparent",
                }}
              >
                {ultraStores.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onStoreSelect(s)}
                    className="snap-center shrink-0 w-60 bg-white rounded-3xl overflow-hidden shadow-ios-card relative cursor-pointer active:scale-95 transition-transform"
                  >
                    <img
                      src={s.coverImage}
                      className="w-full h-32 object-cover"
                    />
                    {/* Logo Overlay for Ultra Stores */}
                    <div className="absolute top-2 right-2 bg-white p-1 rounded-xl shadow-sm">
                      <img
                        src={s.logo}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg line-clamp-1">
                        {s.storeName}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {s.description}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1">
                          <Icons.Clock size={12} /> {s.prepTime || "30m"}
                        </span>
                        {s.averageRating !== undefined && (
                          <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-1 rounded-lg flex items-center gap-1 font-bold">
                            <Icons.Star size={12} fill="currentColor" />
                            {s.averageRating > 0
                              ? s.averageRating.toFixed(1)
                              : "Nuevo"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vertical Feed */}
          <div className="px-4 pb-20">
            <h2 className="font-bold text-lg mb-2 mt-1">Para ti</h2>
            <div className="grid grid-cols-2 gap-3">
              {otherStores.map((s) => (
                <StoreCard
                  key={s.id}
                  store={s}
                  onClick={() => onStoreSelect(s)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const CartView = ({ setView }: { setView: (view: any) => void }) => {
  const {
    cart,
    removeFromCart,
    addToCart,
    currentUser,
    colonies,
    cartTotal,
    placeOrder,
    updateUser,
    users,
    settings,
  } = useApp();
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

  // Haversine formula to calculate distance in km
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

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
        (a) => (a.id || (a as any)._id) === selectedAddressId,
      );
    }

    if (!finalAddress) {
      // 3. Si no hay nada seleccionado, forzar nueva dirección
      setAddressStep(true);
      return alert("Por favor, agrega o selecciona una dirección de entrega.");
    }

    // 4. Llamar a placeOrder con los datos mínimos. El backend hace el resto.
    await placeOrder({
      storeId: cart[0].product.storeId,
      items: cart,
      paymentMethod: payMethod,
      deliveryAddress: finalAddress,
    });

    alert("¡Pedido realizado con éxito!");
    setView("orders");
  };

  if (cart.length === 0)
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-400">
        <Icons.ShoppingCart size={48} className="mb-4 opacity-20" />
        <p>Tu carrito está vacío</p>
      </div>
    );

  const selectedSavedAddress = currentUser?.addresses?.find(
    (a) => (a.id || (a as any)._id) === selectedAddressId,
  );

  const clientColony =
    addressStep && newAddress.colonyId
      ? colonies.find((c) => c.id === newAddress.colonyId)
      : selectedSavedAddress
        ? colonies.find((c) => c.id === selectedSavedAddress.colonyId)
        : null;

  // Calculate estimated fee for display
  let estimatedFee = 0;
  if (clientColony && cart.length > 0) {
    const store = users.find(
      (u) => u.id === cart[0].product.storeId,
    ) as StoreProfile;
    const storeColony = store?.storeAddress?.colonyId
      ? colonies.find((c) => c.id === store.storeAddress.colonyId)
      : null;
    if (storeColony) {
      const dist = calculateDistance(
        clientColony.lat,
        clientColony.lng,
        storeColony.lat,
        storeColony.lng,
      );
      const driverPart = Math.ceil(dist * settings.kmRate);
      // Ensure at least 1km charge
      estimatedFee =
        (driverPart < settings.kmRate ? settings.kmRate : driverPart) +
        settings.baseFee;
    }
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6">Tu Pedido</h2>

      <div className="space-y-4 mb-6">
        {cart.map((item, i) => (
          <div
            key={i}
            className="flex justify-between items-center bg-white p-3 rounded-2xl"
          >
            <div className="flex gap-3 items-center">
              <div className="bg-gray-100 rounded-lg w-8 h-8 flex items-center justify-center font-bold text-sm">
                {item.quantity}x
              </div>
              <div>
                <p className="font-bold text-sm">{item.product.name}</p>
                <p className="text-xs text-gray-500">
                  ${item.product.price * item.quantity}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => removeFromCart(item.product.id)}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
              >
                -
              </button>
              <button
                onClick={() => addToCart(item.product)}
                className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {!addressStep ? (
        <div className="space-y-4">
          <h3 className="font-bold">Dirección de Entrega</h3>
          {(currentUser?.addresses || []).length > 0 ? (
            <div className="space-y-2">
              {currentUser?.addresses?.map((addr) => {
                const addrId = addr.id || (addr as any)._id;
                return (
                  <div
                    key={addrId}
                    onClick={() => setSelectedAddressId(addrId)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer flex justify-between items-center ${selectedAddressId === addrId ? "border-primary bg-red-50" : "border-transparent bg-white"}`}
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
              onChange={(e: any) =>
                setNewAddress({ ...newAddress, number: e.target.value })
              }
            />
            <div className="w-full">
              <label className="text-xs text-gray-500 ml-1">Colonia</label>
              <select
                className="w-full p-3 bg-gray-100 rounded-2xl mt-1"
                value={newAddress.colonyId}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, colonyId: e.target.value })
                }
              >
                <option value="">Selecciona</option>
                {colonies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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
          <span>${cartTotal}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Envío</span>
          <span>
            $
            {estimatedFee > 0
              ? estimatedFee
              : clientColony
                ? "Calculando..."
                : "Selecciona dirección"}
          </span>
        </div>
        <div className="flex justify-between font-bold text-xl pt-2 border-t">
          <span>Total</span>
          <span>${cartTotal + estimatedFee}</span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setPayMethod("CARD")}
          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 ${payMethod === "CARD" ? "bg-gray-800 text-white" : "bg-white"}`}
        >
          <Icons.CreditCard size={18} /> Tarjeta
        </button>
        <button
          onClick={() => setPayMethod("CASH")}
          className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 ${payMethod === "CASH" ? "bg-green-600 text-white" : "bg-white"}`}
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

const OrdersView = () => {
  const { orders, currentUser, users, updateOrderStatus, products, addReview, unreadCounts, markOrderMessagesAsRead } =
    useApp();
  const [chatOrder, setChatOrder] = useState<any | null>(null);
  const [ratingOrder, setRatingOrder] = useState<any | null>(null);

  return (
    <div className="px-4 py-6 pb-24 space-y-4">
      <h2 className="text-2xl font-bold mb-6">Mis Pedidos</h2>
      {orders
        .filter((o) => o.customerId === currentUser!.id)
        .reverse()
        .map((o) => {
          const driver = o.driverId
            ? users.find((u) => u.id === o.driverId)
            : null;
          return (
            <Card key={o.id}>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-primary">
                  {(users.find((u) => u.id === o.storeId) as StoreProfile)
                    ?.storeName || "Tienda"}
                </span>
                <Badge color={getOrderStatusColor(o.status)}>
                  {getOrderStatusLabel(o.status)}
                </Badge>
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
                    <span>${item.product.price * item.quantity}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Productos</span>
                    <span>
                      ${o.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Envío (Banderazo + Repartidor)</span>
                    <span>${o.deliveryFee}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-100">
                    <span>Total</span>
                    <span>${o.total}</span>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-primary transition-all duration-1000`}
                  style={{
                    width:
                      o.status === "PENDING"
                        ? "10%"
                        : o.status === "PREPARING"
                          ? "40%"
                          : o.status === "READY"
                            ? "60%"
                            : o.status === "ON_WAY"
                              ? "80%"
                              : "100%",
                  }}
                ></div>
              </div>
              <p className="text-xs text-right mt-1 text-gray-400">
                {o.status === OrderStatus.PENDING
                  ? "Enviado"
                  : o.status === OrderStatus.PREPARING
                    ? "Preparando"
                    : o.status === OrderStatus.READY
                      ? "Esperando Repartidor"
                      : o.status === OrderStatus.ON_WAY
                        ? "En camino"
                        : o.status === OrderStatus.DELIVERED
                          ? "Entregado"
                          : "Cancelado"}
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
                  Calificar Restaurante
                </Button>
              )}
              {o.status === OrderStatus.DELIVERED && o.isReviewed && (
                <div className="w-full mt-3 py-2 text-sm bg-gray-100 text-gray-500 text-center rounded-xl font-medium flex items-center justify-center gap-2">
                  <Icons.Check size={16} />
                  Restaurante calificado
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
                      updateOrderStatus(o.id, OrderStatus.REJECTED);
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
          otherParty={users.find((u) => u.id === chatOrder.driverId)!}
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

const ProfileView = () => {
  const { currentUser, colonies, logout, updateUser } = useApp();

  const handleDeleteAddress = (addressId: string) => {
    if (!currentUser?.addresses) return;

    if (window.confirm("¿Seguro que deseas eliminar esta dirección?")) {
      const updatedAddresses = currentUser.addresses.filter(
        (addr) => (addr.id || (addr as any)._id) !== addressId,
      );
      updateUser({ ...currentUser, addresses: updatedAddresses } as any);
    }
  };

  return (
    <div className="p-6 pb-24">
      <Card className="flex flex-col items-center py-10 space-y-4">
        <div className="w-24 h-24 bg-gray-200 rounded-full mb-2 flex items-center justify-center text-3xl text-gray-400">
          <Icons.User />
        </div>

        <div className="text-center w-full">
          <h2 className="text-2xl font-bold text-iosText">
            {currentUser?.firstName} {currentUser?.lastName}
          </h2>
          <p className="text-gray-500 font-medium">
            {currentUser?.role === "CLIENT" ? "Cliente" : "Usuario"}
          </p>
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
              {currentUser.addresses.map((addr, idx) => {
                const col = colonies.find((c) => c.id === addr.colonyId);
                const addrId = addr.id || (addr as any)._id;
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

const StoreCard: React.FC<{ store: StoreProfile; onClick: () => void }> = ({
  store,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="bg-white p-3 rounded-3xl flex flex-col gap-3 shadow-ios-card cursor-pointer active:scale-95 transition-transform h-full"
  >
    <div className="relative w-full h-24">
      <img
        src={store.logo}
        className="w-full h-full rounded-2xl object-cover bg-gray-100"
      />
      {store.subscription === SubscriptionType.PREMIUM && (
        <span className="absolute top-2 right-2 text-[8px] bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-bold shadow-sm">
          RECOMENDADO
        </span>
      )}
    </div>

    <div className="flex-1 flex flex-col">
      <h3 className="font-bold text-iosText text-sm line-clamp-1">
        {store.storeName}
      </h3>
      <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 flex-1">
        {store.description}
      </p>
      <div className="mt-2 flex gap-3 text-xs text-gray-400 items-center">
        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
          <Icons.Clock size={10} /> {store.prepTime || "30m"}
        </span>
        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg text-yellow-600">
          <Icons.Star size={10} fill="currentColor" />
          {store.averageRating && store.averageRating > 0
            ? store.averageRating.toFixed(1)
            : "Nuevo"}
        </span>
      </div>
    </div>
  </div>
);

const NavBtn = ({ icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center p-2 transition-colors ${active ? "text-primary" : "text-gray-400"}`}
  >
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium mt-1">{label}</span>
  </button>
);

const RatingModal = ({ isOpen, onClose, order, onSubmit }: any) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    onSubmit({
      orderId: order.id,
      storeId: order.storeId,
      customerId: order.customerId,
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
              className={`transition-transform hover:scale-110 ${rating >= star ? "text-yellow-400" : "text-gray-300"}`}
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

export { ClientDashboard };
