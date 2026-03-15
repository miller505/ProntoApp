import React, { useState, useMemo, useEffect } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { Button } from "../components/UI";
import { Icons } from "../constants";
import { StoreProfile, SubscriptionType, Product } from "../types";

// Componentes refactorizados
import { HomeView } from "./client/HomeView";
import { CartView } from "./client/CartView";
import { OrdersView } from "./client/OrdersView";
import { ProfileView } from "./client/ProfileView";
import { ProductItem } from "../components/ProductItem";
import { NavBtn } from "../components/NavBtn";

const ClientDashboard = () => {
  const {
    users,
    products,
    unreadCounts,
    loading, // Importamos el estado de carga global
    fetchStoreProducts,
  } = useApp();

  const { currentUser } = useAuth();
  const { cart } = useCart();

  const [view, setView] = useState<"home" | "cart" | "orders" | "profile">(
    "home",
  );
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);

  // --- SOLUCIÓN: Manejo del historial del navegador para el gesto "Atrás" ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Si el estado es el que creamos para la tienda, ciérrala.
      if (event.state?.view === "store") {
        setSelectedStore(null);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
  // --- FIN DE LA SOLUCIÓN ---

  // Lógica más resistente: Si la tienda llega del endpoint /api/stores, sabemos que
  // ya está abierta y aprobada desde el backend, pero validamos por seguridad.
  const stores = useMemo(
    () =>
      users.filter(
        (u) => u.role === "STORE" && (u as StoreProfile).isOpen !== false,
      ) as StoreProfile[],
    [users],
  );

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
    // Filtramos las Ultra
    const newUltraStores = shuffleArray(
      stores.filter((s) => s.subscription === SubscriptionType.ULTRA),
    );
    // TODAS las demás caen aquí (incluso si no tienen suscripción definida)
    const newOtherStores = shuffleArray(
      stores.filter((s) => s.subscription !== SubscriptionType.ULTRA),
    );

    return {
      ultraStores: newUltraStores,
      otherStores: newOtherStores,
    };
  }, [stores]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts || {}).reduce(
      (a: number, b: number) => a + (b || 0),
      0,
    );
  }, [unreadCounts]);

  if (selectedStore) {
    return (
      <StoreView
        store={selectedStore}
        onBack={() => {
          // Simula el botón "atrás" del navegador
          window.history.back();
        }}
        fetchStoreProducts={fetchStoreProducts}
        onGoToCart={() => {
          // Al ir al carrito, no queremos que el historial de la tienda se quede
          window.history.replaceState(null, "", window.location.pathname);
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
          onStoreSelect={(store) => {
            // Empujamos un nuevo estado al historial del navegador
            window.history.pushState({ view: "store" }, "", "");
            setSelectedStore(store);
          }}
          loading={loading} // Pasamos el estado a la vista
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
          {totalUnread > 0 && (
            <span className="absolute top-0 right-4 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
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

// --- Sub-View Components ---
const StoreView = ({
  store,
  onBack,
  onGoToCart,
  fetchStoreProducts,
}: {
  store: StoreProfile;
  onBack: () => void;
  onGoToCart: () => void;
  fetchStoreProducts: (storeId: string) => Promise<void>;
}) => {
  const { addToCart, cart } = useCart();
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [notification, setNotification] = useState("");
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    setLoadingMenu(true);
    // Cargar menú al entrar a la tienda (la función está en AppContext)
    fetchStoreProducts(store.id).finally(() => setLoadingMenu(false));
  }, [store.id]);

  // Los productos se obtienen del AppContext, que se actualiza con fetchStoreProducts
  const { products } = useApp();

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart(product, quantity);
    setNotification("Agregado al carrito");
    setTimeout(() => setNotification(""), 2000);
  };

  const storeProducts = products.filter(
    (p) => p.storeId === store.id && p.isAvailable !== false,
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
        <Button
          onClick={onBack}
          variant="secondary"
          className="absolute top-4 left-4 !py-2 !px-3 !rounded-full !bg-white/80 !text-gray-800 !backdrop-blur-md"
        >
          <Icons.ChevronLeft size={18} />
          Atrás
        </Button>
        <Button
          onClick={onGoToCart}
          variant="secondary"
          className="absolute top-4 right-4 !py-2 !px-3 !rounded-full !bg-white/80 !text-gray-800 !backdrop-blur-md"
        >
          <Icons.ShoppingCart size={18} />
          Carrito
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          )}
        </Button>
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
              <Icons.MapPin size={16} /> {store.storeAddress?.street}
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
        {loadingMenu
          ? // SKELETONS DEL MENÚ (Animación de carga de productos)
            Array(5)
              .fill(0)
              .map((_, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse"
                >
                  <div className="w-24 h-24 rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-3 py-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))
          : filteredProducts.map((p) => (
              <ProductItem key={p.id} product={p} onAdd={handleAddToCart} />
            ))}
        {!loadingMenu && filteredProducts.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            No hay productos en esta categoría.
          </p>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-green-600 text-white py-2 px-4 rounded-full flex items-center gap-2 shadow-lg z-50 animate-fade-in-up">
          <Icons.Check size={16} />
          <span className="font-medium text-sm">{notification}</span>
        </div>
      )}
    </div>
  );
};

export { ClientDashboard };
