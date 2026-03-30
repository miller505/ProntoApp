import React, { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useProducts } from "../contexts/ProductContext";
import { useOrders } from "../contexts/OrderContext";
import { useChat } from "../contexts/ChatContext";
import { Button } from "../components/UI";
import { Icons } from "../constants";
import {
  StoreProfile,
  SubscriptionType,
  Product,
  User,
  UserRole,
  OrderStatus,
} from "../types";

// Componentes refactorizados
import { HomeView } from "./client/HomeView";
import { CartView } from "./client/CartView";
import { OrdersView } from "./client/OrdersView";
import { CheckoutView } from "./client/CheckoutView";
import { ProfileView } from "./client/ProfileView";
import { ProductItem } from "../components/ProductItem";
import { NavBtn } from "../components/NavBtn";
import { shuffleArray } from "../utils";
import { Modal, Input } from "../components/UI";

const ScrollToTopButton = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handleScroll = () => setShow(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-24 right-4 bg-primary text-white p-3.5 rounded-full shadow-[0_4px_14px_rgba(0,0,0,0.3)] z-50 hover:bg-opacity-90 transition-all active:scale-90 animate-fade-in-up"
      aria-label="Volver arriba"
    >
      <Icons.ArrowUp size={24} />
    </button>
  );
};

const ClientDashboard = () => {
  const { users, colonies, loading, communityMessages } = useApp();
  const { products, fetchStoreProducts } = useProducts();
  const { orders } = useOrders();
  const { unreadCounts } = useChat();

  const { currentUser, updateUser } = useAuth();
  const { cart } = useCart();

  const [view, setView] = useState<
    "home" | "cart" | "orders" | "profile" | "checkout"
  >("home");
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);

  // --- SOLUCIÓN: Manejo del historial del navegador para el gesto "Atrás" ---
  useEffect(() => {
    const handlePopState = () => {
      // Si el usuario hace el gesto "atrás" y hay una tienda abierta, la cerramos.
      setSelectedStore((current) => {
        return current ? null : current;
      });
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
        (u) =>
          u.role === UserRole.STORE && (u as StoreProfile).isOpen !== false,
      ) as StoreProfile[],
    [users],
  );

  // Memoize the shuffled stores to prevent re-shuffling on every render
  const { blackStores, otherStores } = useMemo(() => {
    // Filtramos las Black
    const newBlackStores = shuffleArray(
      stores.filter((s) => s.subscription === "BLACK"),
    );
    // Filtramos y aleatorizamos las Premium
    const premiumStores = shuffleArray(
      stores.filter((s) => s.subscription === SubscriptionType.PREMIUM),
    );
    // Filtramos y aleatorizamos las Standard (y las que no tengan suscripción)
    const standardStores = shuffleArray(
      stores.filter(
        (s) => s.subscription === SubscriptionType.STANDARD || !s.subscription,
      ),
    );

    return {
      blackStores: newBlackStores,
      otherStores: [...premiumStores, ...standardStores],
    };
  }, [stores]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadCounts || {}).reduce(
      (a: number, b: number) => a + (b || 0),
      0,
    );
  }, [unreadCounts]);

  // Detectar si hay un pedido que ya llegó ("ARRIVED") para mostrar burbuja especial
  const hasArrivedOrder = useMemo(() => {
    if (!currentUser) return false;
    return orders.some((o) => {
      const cId =
        typeof o.customerId === "object"
          ? (o.customerId as any).id || (o.customerId as any)._id
          : o.customerId;
      return cId === currentUser.id && o.status === OrderStatus.ARRIVED;
    });
  }, [orders, currentUser]);

  // --- LÓGICA DE VERIFICACIÓN DE TELÉFONO ---
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneForm, setPhoneForm] = useState("");

  const checkPhoneRequirement = () => {
    // Si el teléfono es el placeholder o está vacío, exigir actualización
    if (
      !currentUser?.phone ||
      currentUser.phone === "0000000000" ||
      currentUser.phone.length < 10
    ) {
      setIsPhoneModalOpen(true);
      return false;
    }
    return true;
  };

  const handleSavePhone = async () => {
    if (phoneForm.length !== 10 || isNaN(Number(phoneForm))) {
      return alert("Ingresa un número válido de 10 dígitos.");
    }
    await updateUser({ ...currentUser, phone: phoneForm } as User);
    setIsPhoneModalOpen(false);
    alert("¡Teléfono guardado! Ahora puedes continuar con tu compra.");
  };
  // ---------------------------------------------

  if (selectedStore) {
    return (
      <>
        <StoreView
          store={selectedStore}
          onBack={() => {
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
        <Modal
          isOpen={isPhoneModalOpen}
          onClose={() => setIsPhoneModalOpen(false)}
          title="Falta un paso"
        >
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Para que el repartidor pueda comunicarse contigo, necesitamos tu
              número de celular.
            </p>
            <div className="flex gap-2 items-center">
              <div className="px-3 py-3 bg-gray-100 rounded-2xl text-gray-500 font-bold border-2 border-transparent">
                +52
              </div>
              <Input
                placeholder="10 dígitos"
                value={phoneForm}
                onChange={(e: any) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  if (val.length <= 10) setPhoneForm(val);
                }}
                type="tel"
                className="flex-1"
              />
            </div>
            <Button onClick={handleSavePhone} className="w-full">
              Guardar y Continuar
            </Button>
          </div>
        </Modal>
        <ScrollToTopButton />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex justify-center">
      <div className="w-full max-w-md bg-secondary shadow-lg relative">
        {/* Content Area */}
        {view === "home" && (
          <>
            <div className="w-full flex justify-center pt-2 pb-1 bg-secondary">
              <img
                src="/logo.svg?v=2"
                alt="Pronto"
                className="h-5 w-auto object-contain"
              />
            </div>
            <HomeView
              stores={stores}
              blackStores={blackStores}
              otherStores={otherStores}
              onStoreSelect={(store) => {
                // Empujamos un nuevo estado al historial del navegador
                window.history.pushState({ view: "store" }, "", "");
                setSelectedStore(store);
              }}
              loading={loading} // Pasamos el estado a la vista
              communityMessages={communityMessages}
              orders={orders}
            />
          </>
        )}
        {view === "cart" && (
          <CartView
            setView={setView}
            onCheckout={() => {
              if (checkPhoneRequirement()) setView("checkout");
            }}
          />
        )}
        {view === "checkout" && <CheckoutView setView={setView} />}
        {view === "orders" && <OrdersView setView={setView} />}
        {view === "profile" && <ProfileView />}

        {/* Modal de Teléfono (Disponible en vistas principales como el Carrito) */}
        <Modal
          isOpen={isPhoneModalOpen}
          onClose={() => setIsPhoneModalOpen(false)}
          title="Falta un paso"
        >
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Para que el repartidor pueda comunicarse contigo, necesitamos tu
              número de celular.
            </p>
            <div className="flex gap-2 items-center">
              <div className="px-3 py-3 bg-gray-100 rounded-2xl text-gray-500 font-bold border-2 border-transparent">
                +52
              </div>
              <Input
                placeholder="10 dígitos"
                value={phoneForm}
                onChange={(e: any) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  if (val.length <= 10) setPhoneForm(val);
                }}
                type="tel"
                className="flex-1"
              />
            </div>
            <Button onClick={handleSavePhone} className="w-full">
              Guardar y Continuar
            </Button>
          </div>
        </Modal>

        {/* Bottom Nav */}
        {view !== "checkout" && (
          <nav className="fixed bottom-0 w-full max-w-md bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between z-40">
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
              {hasArrivedOrder ? (
                <span className="absolute -top-3 -right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-full border-2 border-white shadow-sm animate-bounce flex items-center gap-1 z-50 pointer-events-none">
                  <Icons.Bike size={12} /> ¡Llegó!
                </span>
              ) : (
                totalUnread > 0 && (
                  <span className="absolute top-0 right-3 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white pointer-events-none">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )
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
        )}
      </div>

      <ScrollToTopButton />
    </div>
  );
};

const FeaturedProductCard = ({
  product,
  onAdd,
  onRemove,
  cartQuantity,
}: any) => {
  const [showCounter, setShowCounter] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleInteraction = (type: "add" | "remove") => {
    if (type === "add") {
      onAdd(product, 1);
    } else {
      onRemove(product.id);
    }

    setShowCounter(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setShowCounter(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const shouldShowCounter = showCounter && cartQuantity > 0;

  return (
    <div className="snap-center shrink-0 w-36 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
      <div className="h-24 w-full relative bg-gray-100">
        <img
          src={product.image}
          className="w-full h-full object-cover"
          alt={product.name}
        />
      </div>
      <div className="p-2 flex-1 flex flex-col">
        <h4 className="font-bold text-sm line-clamp-2 mb-1 leading-tight text-gray-800">
          {product.name}
        </h4>
        <p className="font-bold text-primary text-sm mt-auto">
          ${product.price}
        </p>

        <div className="relative h-7 mt-2 w-full">
          <div
            className={`absolute inset-0 flex items-center justify-between bg-gray-100 rounded-lg transition-all duration-300 ${shouldShowCounter ? "opacity-100 scale-100 z-10" : "opacity-0 scale-50 pointer-events-none"}`}
          >
            <button
              onClick={() => handleInteraction("remove")}
              className="w-8 h-full text-gray-600 hover:bg-gray-200 rounded-l-lg flex items-center justify-center font-bold text-xs"
            >
              -
            </button>
            <span className="text-[10px] font-bold">{cartQuantity}</span>
            <button
              onClick={() => handleInteraction("add")}
              className="w-8 h-full text-gray-600 hover:bg-gray-200 rounded-r-lg flex items-center justify-center font-bold text-xs"
            >
              +
            </button>
          </div>

          <Button
            onClick={() => handleInteraction("add")}
            className={`absolute inset-0 w-full h-full !py-0 !text-[10px] !rounded-lg transition-all duration-300 ${shouldShowCounter ? "opacity-0 scale-50 pointer-events-none" : "opacity-100 scale-100"}`}
          >
            <Icons.ShoppingCart size={12} />
            Agregar
          </Button>
        </div>
      </div>
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
  const { currentUser } = useAuth();
  const { addToCart, removeFromCart, cart } = useCart();
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [notification, setNotification] = useState("");
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setLoadingMenu(true);
    // Cargar menú al entrar a la tienda (la función está en AppContext)
    fetchStoreProducts(store.id).finally(() => setLoadingMenu(false));
  }, [store.id]);

  // Los productos se obtienen del AppContext, que se actualiza con fetchStoreProducts
  const { products } = useProducts();

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart(product, quantity, currentUser?.defaultNotes);
    setNotification("Agregado al carrito");
    setTimeout(() => setNotification(""), 2000);
  };

  const storeProducts = useMemo(() => {
    return products.filter((p) => {
      // Robustez: Aseguramos que los IDs coincidan convirtiéndolos a String,
      // esto arregla el problema con productos antiguos creados con formatos de ID diferentes.
      const pStoreId =
        typeof p.storeId === "object"
          ? (p.storeId as any).id || (p.storeId as any)._id
          : p.storeId;
      const targetStoreId = store.id || (store as any)._id;
      return (
        String(pStoreId) === String(targetStoreId) && p.isAvailable !== false
      );
    });
  }, [products, store.id]);
  const categories = useMemo(
    () => ["ALL", ...new Set(storeProducts.map((p) => p.category))],
    [storeProducts],
  );

  // FEATURED PRODUCTS LOGIC
  const featuredProducts = useMemo(() => {
    const featured = storeProducts.filter((p) => p.isFeatured);
    return shuffleArray(featured); // Aleatorizar orden
  }, [storeProducts]);

  const filteredProducts = useMemo(() => {
    let products = storeProducts;

    if (activeCategory !== "ALL") {
      products = products.filter((p) => p.category === activeCategory);
    }

    if (searchTerm.trim() !== "") {
      products = products.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return activeCategory === "ALL"
      ? shuffleArray(products)
      : products.sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCategory, storeProducts, searchTerm]);
  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header Image */}
      <div className="relative h-36">
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
      <div className="px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-2xl p-3 shadow-lg border border-gray-50 flex items-center gap-3">
          <img
            src={store.logo}
            className="w-14 h-14 rounded-xl object-cover border border-gray-100 bg-gray-50 flex-shrink-0"
            alt="Logo"
          />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
              <h1 className="text-lg font-bold text-gray-800 truncate leading-tight">
                {store.storeName}
              </h1>
              {store.averageRating !== undefined && (
                <div className="flex items-center gap-1 text-xs font-bold text-yellow-500 bg-yellow-50 px-1.5 py-0.5 rounded-md flex-shrink-0 ml-2">
                  <Icons.Star size={10} fill="currentColor" />
                  {store.averageRating > 0
                    ? store.averageRating.toFixed(1)
                    : "N"}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">
              {store.description}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
              <span className="flex items-center gap-1">
                <Icons.Clock size={12} /> {store.prepTime || "30m"}
              </span>
              <span className="flex items-center gap-1 truncate">
                <Icons.MapPin size={12} /> {store.storeAddress?.street}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar (Moved above Featured) */}
      <div className="px-6 mt-4 mb-2">
        <div className="relative">
          <Icons.Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder={`Buscar en ${store.storeName}...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-100 focus:outline-none focus:ring-2 ring-primary/20 text-sm text-iosText"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- FEATURED CAROUSEL --- */}
      {featuredProducts.length > 0 &&
        !searchTerm &&
        activeCategory === "ALL" && (
          <div className="mt-6 mb-2">
            <div className="flex items-center gap-2 px-6 mb-3">
              <Icons.Star
                size={18}
                className="text-yellow-500"
                fill="currentColor"
              />
              <h2 className="font-mega text-lg text-gray-800">DESTACADOS</h2>
            </div>

            <div className="flex overflow-x-auto gap-4 px-6 pb-4 snap-x snap-mandatory no-scrollbar">
              {featuredProducts.map((p) => (
                <FeaturedProductCard
                  key={p.id}
                  product={p}
                  onAdd={handleAddToCart}
                  onRemove={removeFromCart}
                  cartQuantity={
                    cart.find((item) => item.product.id === p.id)?.quantity || 0
                  }
                />
              ))}
            </div>
            <div className="h-1 bg-gray-50 mx-6 rounded-full" />
          </div>
        )}

      {/* Categories Nav */}
      <div className="sticky top-0 bg-white z-20 py-3 px-6 border-b border-gray-50">
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex gap-3">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-mega uppercase whitespace-nowrap transition-colors ${activeCategory === cat ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}
              >
                {cat === "ALL" ? "Todo" : cat}
              </button>
            ))}
          </div>
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
          : filteredProducts.map((p) => {
              const itemInCart = cart.find((item) => item.product.id === p.id);
              return (
                <ProductItem
                  key={p.id}
                  product={p}
                  onAdd={handleAddToCart}
                  onRemove={removeFromCart}
                  cartQuantity={itemInCart?.quantity || 0}
                />
              );
            })}
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
