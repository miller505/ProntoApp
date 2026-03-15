import React, { useState, useMemo, useEffect } from "react";
import { useCart } from "../../contexts/CartContext";
import { Icons } from "../../constants";
import { StoreProfile, SubscriptionType, Product } from "../../types";
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
        {store.subscription === SubscriptionType.ULTRA && (
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

export const HomeView = ({
  stores,
  ultraStores,
  otherStores,
  onStoreSelect,
  loading,
}: {
  stores: StoreProfile[];
  ultraStores: StoreProfile[];
  otherStores: StoreProfile[];
  onStoreSelect: (store: StoreProfile) => void;
  loading: boolean;
}) => {
  const [search, setSearch] = useState("");
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const { addToCart } = useCart();
  const [notification, setNotification] = useState("");

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
                {foundProducts.map((p) => (
                  <div key={p.id} className="relative">
                    {/* Mostrar nombre de la tienda en pequeño */}
                    <span className="absolute top-2 right-2 bg-gray-100 text-[10px] px-2 py-1 rounded-full text-gray-500 z-10">
                      {stores.find((s: StoreProfile) => s.id === p.storeId)
                        ?.storeName || "Tienda"}
                    </span>
                    <ProductItem product={p} onAdd={handleAddToCart} />
                  </div>
                ))}
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
          {(loading || ultraStores.length > 0) && (
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
                  : ultraStores.map((s: StoreProfile) => (
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
          <div className="px-4 pb-20 mt-4">
            <h2 className="font-bold text-lg mb-2">Para ti</h2>
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
                ultraStores.length === 0 && (
                  <p className="text-gray-400 text-center col-span-2 py-10">
                    No hay tiendas abiertas en este momento.
                  </p>
                )}
            </div>
          </div>
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
