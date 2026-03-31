import React, { useState, useMemo, useEffect, useRef } from "react";
import { useCart } from "../../contexts/CartContext";
import { Icons } from "../../constants";
import {
  StoreProfile,
  SubscriptionType,
  Product,
  CommunityMessage,
  Order,
  OrderStatus,
} from "../../types";
import { api } from "../../api";
import { ProductItem } from "../../components/ProductItem";

const StoreCard: React.FC<{ store: StoreProfile; onClick: () => void }> = ({
  store,
  onClick,
}) => (
  <div
    onClick={onClick}
    className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer group active:scale-[0.98]"
  >
    <div className="relative h-32 w-full overflow-hidden">
      <img
        src={store.coverImage || store.logo}
        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
        alt={store.storeName}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

      {/* Badges */}
      <div className="absolute top-2 left-2 flex gap-1">
        {store.subscription === SubscriptionType.PREMIUM && (
          <span className="bg-yellow-400/90 backdrop-blur-sm text-yellow-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ★ Recomendado
          </span>
        )}
        {store.subscription === "BLACK" && (
          <span className="bg-purple-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            La mejor opción
          </span>
        )}
      </div>

      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white">
        <div className="bg-white/20 backdrop-blur-md p-1 rounded-full">
          <img
            src={store.logo}
            className="w-6 h-6 rounded-full object-cover"
            alt="logo"
          />
        </div>
      </div>
    </div>

    <div className="p-3">
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-gray-800 text-sm line-clamp-2 flex-1">
          {store.storeName}
        </h3>
      </div>

      <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 min-h-[2.5em]">
        {store.description}
      </p>

      <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
          <Icons.Clock size={12} /> {store.prepTime || "30m"}
        </span>
        {store.averageRating !== undefined && (
          <span className="flex items-center gap-1 text-xs font-bold text-yellow-500 bg-yellow-50 px-1.5 py-0.5 rounded-lg">
            <Icons.Star size={10} fill="currentColor" />
            {store.averageRating > 0 ? store.averageRating.toFixed(1) : "N"}
            {store.ratingCount !== undefined && (
              <span className="text-gray-400 font-normal ml-0.5">
                ({store.ratingCount})
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  </div>
);

const NewsletterCarousel = ({
  messages,
  onStoreSelect,
  stores,
}: {
  messages: CommunityMessage[];
  onStoreSelect: (s: StoreProfile) => void;
  stores: StoreProfile[];
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) clearInterval(timeoutRef.current);
    if (messages.length > 1) {
      timeoutRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
      }, 5000);
    }
  };

  useEffect(() => {
    resetTimer();

    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [messages.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    if (timeoutRef.current) clearInterval(timeoutRef.current); // Pausar al tocar
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) {
      resetTimer(); // Reanudar si fue solo un toque
      return;
    }

    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }

    if (isRightSwipe) {
      setCurrentIndex((prev) => (prev - 1 + messages.length) % messages.length);
    }

    touchStartX.current = null;
    touchEndX.current = null;
    resetTimer(); // Reanudar auto-play
  };

  if (messages.length === 0) return null;

  return (
    <div className="px-4 mt-6 mb-8">
      <h2 className="font-mega text-lg mb-2 flex items-center gap-2 leading-none">
        <Icons.Star className="text-primary" size={20} /> NO TE LO PIERDAS
      </h2>
      <div
        className="w-full aspect-[16/9] rounded-3xl overflow-hidden shadow-lg border border-gray-100 bg-gray-100 relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: "pan-y" }} // Permite scroll vertical pero captura horizontal
      >
        <div
          className="flex w-full h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {messages.map((msg, idx) => {
            const handleClick = () => {
              if (msg.storeId) {
                const storeId =
                  typeof msg.storeId === "object"
                    ? (msg.storeId as any).id
                    : msg.storeId;
                const store = stores.find((s) => s.id === storeId);
                if (store) onStoreSelect(store);
              }
            };

            return (
              <div
                key={msg.id || idx}
                className="w-full h-full flex-shrink-0 relative cursor-pointer"
                onClick={handleClick}
              >
                <img
                  src={msg.imageUrl}
                  className="w-full h-full object-cover"
                  alt={msg.title || "Newsletter"}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-4">
                  {msg.title && (
                    <h3 className="text-white font-mega text-lg leading-tight">
                      {msg.title}
                    </h3>
                  )}
                  {msg.description && (
                    <p className="text-white/90 text-xs mt-1 line-clamp-2">
                      {msg.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Indicators */}
        {messages.length > 1 && (
          <div className="absolute top-3 right-3 flex gap-1.5 z-10">
            {messages.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const HomeView = ({
  stores,
  blackStores,
  otherStores,
  onStoreSelect,
  loading,
  communityMessages,
  orders,
}: {
  stores: StoreProfile[];
  blackStores: StoreProfile[];
  otherStores: StoreProfile[];
  onStoreSelect: (store: StoreProfile) => void;
  loading: boolean;
  communityMessages: CommunityMessage[];
  orders: Order[];
}) => {
  const [search, setSearch] = useState("");
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const { addToCart, removeFromCart, cart } = useCart();
  const [notification, setNotification] = useState("");
  const ultraScrollRef = useRef<HTMLDivElement>(null);
  const interactionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const scrollDirection = useRef<"forward" | "backward">("forward");

  // Lógica de auto-scroll para tiendas "Black" (Ultra)
  useEffect(() => {
    if (loading || blackStores.length === 0) return;
    const container = ultraScrollRef.current;
    if (!container) return;

    const autoScroll = () => {
      if (!isPaused && container) {
        const speed = 0.6;
        if (scrollDirection.current === "forward") {
          container.scrollLeft += speed;
          // Si llegamos al final, cambiamos dirección
          if (
            container.scrollLeft >=
            container.scrollWidth - container.clientWidth - 1
          ) {
            scrollDirection.current = "backward";
          }
        } else {
          container.scrollLeft -= speed;
          // Si llegamos al inicio, cambiamos dirección
          if (container.scrollLeft <= 0) {
            scrollDirection.current = "forward";
          }
        }
      }
    };
    const interval = setInterval(autoScroll, 30); // ~33 cuadros por segundo
    return () => clearInterval(interval);
  }, [blackStores.length, isPaused, loading]);

  const startCooldown = () => {
    setIsPaused(true);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 5000); // Cooldown de 5 segundos
  };

  const handleMouseEnter = () => {
    setIsPaused(true);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
  };

  // Efecto para búsqueda en servidor (Debounce)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (search.trim().length > 2) {
        setIsSearchingProducts(true);
        try {
          const res = await api.get(`/api/products?search=${search}`);
          setFoundProducts(
            res.data.map((p: any) => ({ ...p, id: p._id || p.id })),
          );
        } catch (error) {
          console.error("Error searching products", error);
        } finally {
          setIsSearchingProducts(false);
        }
      } else {
        setFoundProducts([]);
      }
    }, 500); // Esperar 500ms después de que deje de escribir

    return () => clearTimeout(timer);
  }, [search]);

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart(product, quantity);
    setNotification("Agregado al carrito");
    setTimeout(() => setNotification(""), 2000);
  };

  const filteredStores = useMemo(() => {
    if (!search) return [];

    // 1. Identificar tiendas que tienen los productos encontrados
    const storesWithProducts = new Set(foundProducts.map((p) => p.storeId));

    return stores.filter((s: StoreProfile) => {
      // 2. Coincidencia por nombre de tienda
      const matchesName = s.storeName
        ?.toLowerCase()
        .includes(search.toLowerCase());
      // 3. Coincidencia por producto encontrado
      const hasMatchingProduct = storesWithProducts.has(s.id);
      return matchesName || hasMatchingProduct;
    });
  }, [search, stores, foundProducts]);

  const recentStoreIds = useMemo(() => {
    // Buscar tiendas de las últimas 5 órdenes entregadas
    const pastDelivered = orders
      .filter((o) => o.status === OrderStatus.DELIVERED)
      .sort((a, b) => b.createdAt - a.createdAt);

    // Extraer IDs únicos e iterar usando reduce para evitar duplicates, MAX 5
    const ids: string[] = [];
    for (const o of pastDelivered) {
      const sId = typeof o.storeId === "object" ? o.storeId.id : o.storeId;
      if (!ids.includes(sId)) {
        ids.push(sId);
      }
      if (ids.length >= 5) break;
    }
    return ids;
  }, [orders]);

  const recentStores = stores.filter((s) => recentStoreIds.includes(s.id));

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
          {/* Resultados de Productos */}
          <div>
            <h2 className="font-bold text-lg mb-2 text-gray-800">
              Productos encontrados
            </h2>
            {isSearchingProducts ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-gray-100 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            ) : foundProducts.length > 0 ? (
              <div className="space-y-3">
                {foundProducts.map((p) => {
                  const itemInCart = cart.find(
                    (item) => item.product.id === p.id,
                  );
                  return (
                    <div key={p.id} className="relative">
                      <span className="absolute top-2 right-2 bg-gray-100 text-[10px] px-2 py-1 rounded-full text-gray-500 z-10">
                        {stores.find((s: StoreProfile) => s.id === p.storeId)
                          ?.storeName || "Tienda"}
                      </span>
                      <ProductItem
                        product={p}
                        onAdd={handleAddToCart}
                        onRemove={removeFromCart}
                        cartQuantity={itemInCart?.quantity || 0}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              search.length > 2 && (
                <p className="text-gray-400 text-sm text-center py-4">
                  No se encontraron productos con ese nombre.
                </p>
              )
            )}
          </div>

          <h2 className="font-bold text-lg mb-2 text-gray-800 mt-6">
            Tiendas coincidentes
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {filteredStores.map((s: StoreProfile) => (
              <StoreCard
                key={s.id}
                store={s}
                onClick={() => onStoreSelect(s)}
              />
            ))}
          </div>
          {filteredStores.length === 0 && (
            <p className="text-gray-400 text-center text-sm py-2">
              No se encontraron resultados
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Ultra Section */}
          {(loading || blackStores.length > 0) && (
            <div>
              <h2 className="font-mega text-lg mb-2 flex items-center gap-2 px-4">
                <Icons.Store className="text-primary" size={20} />
                LA MEJOR OPCIÓN
              </h2>
              <div
                ref={ultraScrollRef}
                onTouchStart={startCooldown}
                onMouseDown={startCooldown}
                onWheel={startCooldown}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={startCooldown}
                className="flex overflow-x-auto gap-3 px-4 pt-4 pb-4 -mt-4 no-scrollbar"
                style={{
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                }}
              >
                {loading
                  ? // SKELETONS PARA ULTRA (Animación de carga)
                    Array(3)
                      .fill(0)
                      .map((_, i) => (
                        <div
                          key={i}
                          className="snap-center shrink-0 w-60 bg-white rounded-3xl overflow-hidden shadow-ios-card h-48 animate-pulse border border-gray-100"
                        >
                          <div className="w-full h-32 bg-gray-200" />
                          <div className="p-4 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-3/4" />
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                          </div>
                        </div>
                      ))
                  : blackStores.map((s: StoreProfile) => (
                      <div
                        key={s.id}
                        onClick={() => onStoreSelect(s)}
                        className="snap-center shrink-0 w-60 bg-white rounded-3xl overflow-hidden shadow-ios-card hover:shadow-lg relative cursor-pointer group active:scale-[0.98] transition-all duration-300"
                      >
                        <div className="relative h-32 overflow-hidden">
                          <img
                            src={s.coverImage}
                            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            alt={s.storeName}
                          />
                        </div>
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
                                {s.ratingCount !== undefined && (
                                  <span className="text-gray-400 font-normal ml-0.5">
                                    ({s.ratingCount})
                                  </span>
                                )}
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
          <div className="px-4 pb-4 mt-4">
            <h2 className="font-mega text-lg mb-2">PARA TI</h2>
            <div className="grid grid-cols-2 gap-3">
              {loading
                ? // SKELETONS PARA FEED NORMAL
                  Array(4)
                    .fill(0)
                    .map((_, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-3xl overflow-hidden shadow-sm h-48 animate-pulse border border-gray-100"
                      >
                        <div className="h-32 bg-gray-200 w-full" />
                        <div className="p-3 space-y-2">
                          <div className="h-3 bg-gray-200 rounded w-full" />
                          <div className="h-2 bg-gray-200 rounded w-2/3" />
                        </div>
                      </div>
                    ))
                : otherStores.map((s: StoreProfile) => (
                    <StoreCard
                      key={s.id}
                      store={s}
                      onClick={() => onStoreSelect(s)}
                    />
                  ))}
              {!loading &&
                otherStores.length === 0 &&
                blackStores.length === 0 && (
                  <p className="text-gray-400 text-center col-span-2 py-10">
                    No hay tiendas abiertas en este momento.
                  </p>
                )}
            </div>
          </div>

          {/* --- NEWSLETTER (COMUNIDAD) --- */}
          {/* Movido antes de Pedir de nuevo por requerimiento de UX */}
          <NewsletterCarousel
            messages={communityMessages || []}
            onStoreSelect={onStoreSelect}
            stores={stores}
          />

          {/* --- PEDIR DE NUEVO --- */}
          {!loading && recentStores.length > 0 && (
            <div className="pl-4 mt-2 mb-6 animate-fade-in-up">
              <br />
              <h2 className="font-mega text-lg mb-2 flex items-center gap-2">
                <Icons.RotateCcw className="text-primary" size={20} />
                PEDIR DE NUEVO
              </h2>
              <div
                className="flex overflow-x-auto gap-3 pb-2 pr-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-primary/30 scrollbar-track-transparent"
                style={{
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                }}
              >
                {recentStores.map((s: StoreProfile) => (
                  <div
                    key={`recent-${s.id}`}
                    onClick={() => onStoreSelect(s)}
                    className="snap-center shrink-0 w-[110px] bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md relative cursor-pointer active:scale-95 transition-all duration-300 border border-gray-100 flex flex-col items-center p-3"
                  >
                    <div className="w-14 h-14 mb-2 rounded-full overflow-hidden border-2 border-gray-50 shadow-sm">
                      <img
                        src={s.logo}
                        className="w-full h-full object-cover"
                        alt={s.storeName}
                      />
                    </div>
                    <h3 className="font-bold text-[11px] text-gray-800 text-center line-clamp-2 w-full leading-tight">
                      {s.storeName}
                    </h3>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
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
