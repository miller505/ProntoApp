import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Input, Badge, Modal } from "../components/UI";
import { Icons } from "../constants";
import { uploadToCloudinary } from "../api";
import { SUBSCRIPTION_LIMITS } from "../constants";
import { StoreProfile, Product, Order, OrderStatus } from "../types";
import { formatDate, getOrderStatusColor } from "../utils";

export const StoreDashboard = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    orders,
    updateOrderStatus,
    colonies,
    getStoreReviews,
    getFinanceStats,
  } = useApp();

  const { currentUser, updateUser, logout } = useAuth();

  const store = currentUser as StoreProfile;

  const [activeTab, setActiveTab] = useState<
    "orders" | "products" | "reviews" | "profile" | "finances"
  >("orders");
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [financeStats, setFinanceStats] = useState<any>(null);

  // ESTADO NUEVO: Controla la animación de carga al abrir/cerrar tienda
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // Estado de carga de imagen

  // Product Form State
  const [prodForm, setProdForm] = useState<any>({
    name: "",
    description: "",
    price: "",
    category: "",
    image: "",
  });
  const [prodErrors, setProdErrors] = useState<any>({});

  // Products filtering and sorting
  const [prodSearchTerm, setProdSearchTerm] = useState("");
  const [prodFilterCategory, setProdFilterCategory] = useState<string>("ALL");
  const [prodFilterVisibility, setProdFilterVisibility] =
    useState<string>("ALL");
  const [prodSortBy, setProdSortBy] = useState<string>("name-asc");

  // Helper function to extract number from "X min" format
  const extractPrepTime = (prepTime: string | undefined): string => {
    if (!prepTime) return "";
    // Extract number from "20 min" format
    const match = prepTime.match(/(\d+)/);
    return match ? match[1] : "";
  };

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    prepTime: extractPrepTime(store?.prepTime),
    description: store?.description || "",
    logo: store?.logo || "",
    coverImage: store?.coverImage || "",
  });

  // Sync profileForm with store data when it changes
  useEffect(() => {
    setProfileForm({
      prepTime: extractPrepTime(store?.prepTime),
      description: store?.description || "",
      logo: store?.logo || "",
      coverImage: store?.coverImage || "",
    });
  }, [store?.prepTime, store?.description, store?.logo, store?.coverImage]);

  useEffect(() => {
    if (activeTab === "reviews" && store) {
      getStoreReviews(store.id).then((data) => {
        setReviews(
          [...data].sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "finances") {
      getFinanceStats().then(setFinanceStats);
    }
  }, [activeTab]);

  const [saveFeedback, setSaveFeedback] = useState("");

  const myOrders = useMemo(
    () =>
      orders.filter((o) => {
        const sId =
          typeof o.storeId === "object"
            ? (o.storeId as any).id || (o.storeId as any)._id
            : o.storeId;
        return sId === store?.id;
      }),
    [orders, store?.id],
  );

  const activeOrdersCount = useMemo(
    () =>
      myOrders.filter(
        (o) =>
          ![
            OrderStatus.DELIVERED,
            OrderStatus.REJECTED,
            OrderStatus.CANCELLED,
          ].includes(o.status),
      ).length,
    [myOrders],
  );

  const myProducts = products.filter((p) => p.storeId === store?.id);

  // Filter and sort products, memoized for performance
  const filteredAndSortedProducts = useMemo(() => {
    return myProducts
      .filter((p) => {
        const matchesSearch = p.name
          .toLowerCase()
          .includes(prodSearchTerm.toLowerCase());
        const matchesCategory =
          prodFilterCategory === "ALL" || p.category === prodFilterCategory;

        const isHidden = p.isAvailable === false;
        const matchesVisibility =
          prodFilterVisibility === "ALL" ||
          (prodFilterVisibility === "VISIBLE" && !isHidden) ||
          (prodFilterVisibility === "HIDDEN" && isHidden);

        return matchesSearch && matchesCategory && matchesVisibility;
      })
      .sort((a, b) => {
        switch (prodSortBy) {
          case "name-asc":
            return a.name.localeCompare(b.name);
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "price-asc":
            return a.price - b.price;
          case "price-desc":
            return b.price - a.price;
          default:
            return 0;
        }
      });
  }, [
    myProducts,
    prodSearchTerm,
    prodFilterCategory,
    prodFilterVisibility,
    prodSortBy,
  ]);

  // Get unique categories for filter
  const uniqueCategories = Array.from(
    new Set(myProducts.map((p) => p.category)),
  );

  // Calculate stats from reviews state for the Reviews tab (Real-time calculation)
  const reviewStats = useMemo(() => {
    if (reviews.length === 0) return { average: 0, count: 0 };
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    return {
      average: total / reviews.length,
      count: reviews.length,
    };
  }, [reviews]);

  const handleToggleOpen = async () => {
    if (!store) return;
    setIsTogglingStatus(true);
    try {
      await updateUser({ ...store, isOpen: !store.isOpen });
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDeleteProduct = (id: string) => {
    const ok = window.confirm(
      "¿Estás seguro que deseas eliminar este producto?",
    );
    if (!ok) return;
    deleteProduct(id);
    setSaveFeedback("Producto eliminado");
    setTimeout(() => setSaveFeedback(""), 2500);
  };

  const handleToggleProductVisibility = (p: Product) => {
    const currentVisibility = p.isAvailable !== false;
    const productLimit = SUBSCRIPTION_LIMITS[store.subscription] || 10;
    const visibleProducts = myProducts.filter(
      (p) => p.isAvailable !== false,
    ).length;

    if (!currentVisibility && visibleProducts >= productLimit) {
      return alert(
        `Has alcanzado el límite de ${productLimit} productos visibles para tu suscripción ${store.subscription}. Oculta otro producto para poder hacer este visible.`,
      );
    }

    updateProduct({ ...p, isAvailable: !currentVisibility });
    setSaveFeedback(
      !currentVisibility ? "Producto visible" : "Producto oculto",
    );
    setTimeout(() => setSaveFeedback(""), 2500);
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;

    const errors: any = {};
    const name = (prodForm.name || "").toString();
    const description = (prodForm.description || "").toString();
    const category = (prodForm.category || "").toString();
    const priceNum = Number(prodForm.price);

    if (!name.trim()) errors.name = "Nombre requerido";
    else if (name.length > 50) errors.name = "Máx 50 caracteres";

    if (description.length > 90) errors.description = "Máx 90 caracteres";

    if (category.length > 30) errors.category = "Máx 30 caracteres";

    if (isNaN(priceNum) || priceNum <= 0) errors.price = "Precio inválido";
    else if (priceNum > 3000)
      errors.price = "El precio no puede ser mayor a $3000";

    if (Object.keys(errors).length > 0) {
      setProdErrors(errors);
      return;
    }

    setProdErrors({});

    const payload: any = {
      storeId: currentUser?.id, // Asegurar que usamos el ID de la sesión real
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      category: category.trim(),
      image: prodForm.image || "https://picsum.photos/200",
      isAvailable: editingProduct ? editingProduct.isAvailable : true,
    };

    if (editingProduct) {
      updateProduct({ ...payload, id: editingProduct.id });
    } else {
      addProduct(payload);
    }

    setProductModalOpen(false);
    setEditingProduct(null);
    setProdForm({
      name: "",
      description: "",
      price: "",
      category: "",
      image: "",
    });

    // show feedback when editing a product
    if (editingProduct) {
      setSaveFeedback("Cambios realizados");
      setTimeout(() => setSaveFeedback(""), 2500);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await uploadToCloudinary(file);
        setProdForm({ ...prodForm, image: url });
        setProdErrors({ ...prodErrors, image: undefined });
      } catch (error) {
        alert("Error al subir imagen. Intenta de nuevo.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleProfileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "coverImage",
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await uploadToCloudinary(file);
        setProfileForm({
          ...profileForm,
          [type]: url,
        });
      } catch (error) {
        alert("Error al subir imagen.");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    if (!store) return;
    let prep = Number(profileForm.prepTime);
    if (isNaN(prep)) prep = 0;
    if (prep < 0) prep = 0;
    if (prep > 120) prep = 120;
    const desc = (profileForm.description || "").toString().slice(0, 70);
    const prepTimeStr = prep > 0 ? `${prep} min` : "";

    // CRITICAL: Only update fields that the store owner is allowed to modify
    // Do NOT include Master-controlled fields like subscription, subscriptionPriority, approved
    // This prevents overwriting with stale values from localStorage
    const updatedFields = {
      prepTime: prepTimeStr,
      description: desc,
      logo: profileForm.logo,
      coverImage: profileForm.coverImage,
    };

    // Merge with current store data, preserving Master-controlled fields
    const newProfile: StoreProfile = {
      ...store,
      ...updatedFields,
    };

    // Sync the local form with any clamped/trimmed values
    setProfileForm({
      ...profileForm,
      prepTime: String(prep),
      description: desc,
    });

    await updateUser(newProfile);

    // show temporary feedback toast
    setSaveFeedback("Cambios realizados");
    setTimeout(() => setSaveFeedback(""), 2500);
  };

  const openProductModal = (p?: Product) => {
    if (p) {
      setEditingProduct(p);
      setProdForm({
        name: p.name,
        description: p.description,
        price: String(p.price),
        category: p.category,
        image: p.image,
      });
    } else {
      setEditingProduct(null);
      setProdForm({
        name: "",
        description: "",
        price: "",
        category: "",
        image: "",
      });
    }
    setProdErrors({});
    setProductModalOpen(true);
  };

  if (!store) return null; // Prevención de errores si aún está cargando la sesión

  return (
    <div className="min-h-screen bg-secondary pb-24">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
            {store.logo && (
              <img src={store.logo} className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <h1 className="font-bold text-iosText leading-tight">
              {store.storeName}
            </h1>
            <Badge color={store.isOpen ? "green" : "red"}>
              {store.isOpen ? (
                <span className="font-bold">ABIERTO</span>
              ) : (
                <span className="font-bold">CERRADO</span>
              )}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleOpen}
            disabled={isTogglingStatus}
            className={`px-4 py-2 rounded-xl transition-colors flex items-center gap-2 font-medium text-sm disabled:opacity-50 ${
              store.isOpen
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {isTogglingStatus ? (
              <span className="animate-pulse font-semibold">Cambiando...</span>
            ) : (
              <>
                <Icons.Store size={18} />
                {store.isOpen ? "Cerrar Tienda" : "Abrir Tienda"}
              </>
            )}
          </button>
          <button
            onClick={logout}
            className="p-2 bg-gray-100 text-gray-600 rounded-xl"
          >
            <Icons.LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-sm">
          <TabButton
            id="orders"
            label={`Pedidos (${activeOrdersCount})`}
            icon={<Icons.ShoppingBag size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="products"
            label="Menú"
            icon={<Icons.Menu size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="reviews"
            label="Reseñas"
            icon={<Icons.Star size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="finances"
            label="Finanzas"
            icon={<Icons.DollarSign size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
          <TabButton
            id="profile"
            label="Perfil"
            icon={<Icons.Settings size={18} />}
            active={activeTab}
            set={setActiveTab}
          />
        </div>

        {/* --- ORDERS --- */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 ml-1">
              Comandas Activas
            </h2>
            {activeOrdersCount === 0 && (
              <div className="text-center py-10 text-gray-400">
                No hay pedidos activos
              </div>
            )}
            {myOrders
              .filter(
                (o) =>
                  ![
                    OrderStatus.DELIVERED,
                    OrderStatus.REJECTED,
                    OrderStatus.CANCELLED,
                  ].includes(o.status),
              )
              .map((order) => (
                <Card key={order.id} className="border-l-4 border-primary">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-gray-400">
                        #{order.id.slice(-4)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <Badge color={getOrderStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div className="flex flex-col">
                          <span>
                            {item.quantity}x {item.product.name}
                          </span>
                          {item.notes && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-800 bg-blue-50 p-2 rounded-lg">
                              <Icons.Edit2 size={12} />
                              <p className="italic">"{item.notes}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="h-0.5 w-full bg-gray-200 rounded-full mb-3" />
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg">
                      $
                      {order.items.reduce(
                        (acc, item) => acc + item.product.price * item.quantity,
                        0,
                      )}
                    </span>
                    <div className="flex gap-2">
                      {order.status === OrderStatus.PENDING && (
                        <>
                          <Button
                            variant="danger"
                            className="py-2 px-3 text-xs"
                            onClick={() =>
                              updateOrderStatus(order.id, OrderStatus.REJECTED)
                            }
                          >
                            Rechazar
                          </Button>
                          <Button
                            className="py-2 px-3 text-xs"
                            onClick={() =>
                              updateOrderStatus(order.id, OrderStatus.PREPARING)
                            }
                          >
                            Aceptar
                          </Button>
                        </>
                      )}
                      {order.status === OrderStatus.PREPARING && (
                        <Button
                          className="py-2 px-3 text-xs w-full bg-green-600 hover:bg-green-700"
                          onClick={() =>
                            updateOrderStatus(order.id, OrderStatus.READY)
                          }
                        >
                          <Icons.Check size={16} className="mr-1" /> Listo para
                          Repartidor
                        </Button>
                      )}
                      {order.status === OrderStatus.READY && (
                        <span className="text-sm text-gray-500 animate-pulse">
                          Esperando repartidor...
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

            <h2 className="text-lg font-bold text-gray-800 ml-1 mt-8">
              Historial de Pedidos
            </h2>
            {myOrders.filter((o) =>
              [
                OrderStatus.DELIVERED,
                OrderStatus.REJECTED,
                OrderStatus.CANCELLED,
              ].includes(o.status),
            ).length === 0 && (
              <div className="text-center py-10 text-gray-400">
                No hay pedidos en el historial
              </div>
            )}
            {myOrders
              .filter((o) =>
                [
                  OrderStatus.DELIVERED,
                  OrderStatus.REJECTED,
                  OrderStatus.CANCELLED,
                ].includes(o.status),
              )
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime(),
              )
              .map((order) => {
                return (
                  <Card key={order.id} className="opacity-70">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-gray-400">
                          #{order.id.slice(-4)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(order.createdAt)}
                        </span>
                      </div>
                      <Badge color={getOrderStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </div>
                    <div className="space-y-2 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>
                            {item.quantity}x {item.product.name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="h-0.5 w-full bg-gray-200 rounded-full mb-3" />
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-lg">
                        $
                        {order.items.reduce(
                          (acc, item) =>
                            acc + item.product.price * item.quantity,
                          0,
                        )}
                      </span>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}

        {/* --- PRODUCTS --- */}
        {activeTab === "products" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800 ml-1">
                Mi Catálogo
              </h2>
              <Button
                onClick={() => openProductModal()}
                className="py-2 text-sm"
                disabled={
                  myProducts.length >=
                  (SUBSCRIPTION_LIMITS[store.subscription] || 10)
                }
              >
                <Icons.Plus size={18} /> Nuevo
              </Button>
            </div>

            {/* Search and Filters */}
            <div className="space-y-4 mb-6">
              <div className="relative">
                <Icons.Search
                  className="absolute left-4 top-3.5 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 ring-primary/20"
                  value={prodSearchTerm}
                  onChange={(e) => setProdSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <select
                  className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium"
                  value={prodFilterCategory}
                  onChange={(e) => setProdFilterCategory(e.target.value)}
                >
                  <option value="ALL">Todas las categorías</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <select
                  className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium"
                  value={prodFilterVisibility}
                  onChange={(e) => setProdFilterVisibility(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="VISIBLE">Visibles</option>
                  <option value="HIDDEN">Ocultos</option>
                </select>
                <select
                  className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium"
                  value={prodSortBy}
                  onChange={(e) => setProdSortBy(e.target.value)}
                >
                  <option value="name-asc">Nombre A-Z</option>
                  <option value="name-desc">Nombre Z-A</option>
                  <option value="price-asc">Precio: Menor a Mayor</option>
                  <option value="price-desc">Precio: Mayor a Menor</option>
                </select>
              </div>
            </div>

            {/* Products List */}
            <div className="space-y-3">
              {filteredAndSortedProducts.length === 0 ? (
                <p className="text-center text-gray-400 py-6">
                  No hay productos que coincidan
                </p>
              ) : (
                filteredAndSortedProducts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white p-3 rounded-2xl flex gap-3 items-start shadow-ios-card"
                  >
                    <img
                      src={p.image}
                      className="w-20 h-20 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="flex-1">
                          <h4 className="font-bold text-sm">{p.name}</h4>
                          <Badge color="blue" className="mt-1">
                            {p.category}
                          </Badge>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleProductVisibility(p)}
                            className={`p-1.5 rounded-lg transition-colors ${p.isAvailable === false ? "bg-gray-200 text-gray-500" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
                            title={
                              p.isAvailable === false
                                ? "Mostrar producto"
                                : "Ocultar producto"
                            }
                          >
                            {p.isAvailable === false ? (
                              <Icons.EyeOff size={14} />
                            ) : (
                              <Icons.Eye size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => openProductModal(p)}
                            className="p-1.5 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200"
                          >
                            <Icons.Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id)}
                            className="p-1.5 bg-red-50 rounded-lg text-red-500 hover:bg-red-100"
                          >
                            <Icons.Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-baseline gap-2">
                        <p className="text-xs text-gray-500 line-clamp-2 flex-1">
                          {p.description}
                        </p>
                        <span className="font-semibold text-primary flex-shrink-0">
                          ${p.price}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* --- REVIEWS --- */}
        {activeTab === "reviews" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-gray-800 ml-1">
                Reseñas de Clientes
              </h2>
              <div className="flex items-center gap-2 bg-yellow-50 px-3 py-1.5 rounded-xl border border-yellow-100">
                <Icons.Star
                  size={20}
                  className="text-yellow-500"
                  fill="currentColor"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-800 leading-none">
                    {reviewStats.average > 0
                      ? reviewStats.average.toFixed(1)
                      : "N/A"}
                  </span>
                  <span className="text-[10px] text-gray-500 leading-none">
                    {reviewStats.count} reseñas
                  </span>
                </div>
              </div>
            </div>
            {reviews.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                Aún no tienes reseñas.
              </div>
            )}
            {reviews.map((r) => (
              <Card key={r._id || r.id}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-sm">
                      Pedido #{r.orderId.slice(-4)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                    <Icons.Star size={14} fill="currentColor" />
                    {r.rating}
                  </div>
                </div>
                {r.comment && (
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl mt-2">
                    "{r.comment}"
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* --- FINANCES --- */}
        {activeTab === "finances" && (
          <div className="pb-24">
            {!financeStats ? (
              <div className="mb-6 p-6 bg-gray-50 rounded-2xl text-center text-gray-400 animate-pulse">
                Cargando estadísticas generales...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card className="bg-white border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1 text-indigo-600">
                      <Icons.DollarSign size={18} />
                      <h3 className="font-semibold text-xs text-gray-600">
                        Ventas Totales
                      </h3>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      ${(financeStats.totalVolume || 0).toFixed(2)}
                    </p>
                  </Card>

                  {/* CORRECCIÓN: Usar div en lugar de Card para evitar conflictos de estilos (fondo blanco forzado) */}
                  <div className="bg-green-600 text-white p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                      <Icons.TrendingUp size={18} />
                      <h3 className="font-semibold text-xs">Ventas (Semana)</h3>
                    </div>
                    <p className="text-xl font-bold">
                      ${(financeStats.weeklyEarnings || 0).toFixed(2)}
                    </p>
                  </div>

                  <Card className="bg-white border border-gray-100 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-1 text-blue-600">
                      <Icons.ShoppingBag size={18} />
                      <h3 className="font-semibold text-xs text-gray-600">
                        Pedidos Totales
                      </h3>
                    </div>
                    <p className="text-xl font-bold text-gray-800">
                      {financeStats.count || 0}
                    </p>
                  </Card>

                  {/* CORRECCIÓN: Usar div en lugar de Card */}
                  <div className="bg-green-600 text-white p-4 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-1 opacity-80">
                      <Icons.ShoppingBag size={18} />
                      <h3 className="font-semibold text-xs">
                        Pedidos (Semana)
                      </h3>
                    </div>
                    <p className="text-xl font-bold">
                      {financeStats.weeklyCount || 0}
                    </p>
                  </div>
                </div>

                <h3 className="font-bold text-lg mb-4 text-gray-800">
                  Resumen Semanal
                </h3>
                <div className="space-y-3">
                  {(!financeStats.weeklyBreakdown ||
                    financeStats.weeklyBreakdown.length === 0) && (
                    <p className="text-gray-400 text-center">
                      No hay ventas registradas.
                    </p>
                  )}
                  {(financeStats.weeklyBreakdown || []).map((stat: any) => {
                    const labelStart = new Date(
                      stat.startDate,
                    ).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                    const endDate = new Date(stat.startDate);
                    endDate.setDate(endDate.getDate() + 6);
                    const labelEnd = endDate.toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });

                    return (
                      <Card
                        key={stat.startDate}
                        className="flex justify-between items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                            <Icons.Calendar size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">
                              {labelStart} - {labelEnd}
                            </p>
                            <p className="text-xs text-gray-400">
                              {stat.count} pedidos
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-lg text-green-600">
                          ${stat.total.toFixed(2)}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* --- PROFILE (Simplified) --- */}
        {activeTab === "profile" && (
          <div className="space-y-4">
            <Card>
              <h3 className="font-bold text-lg mb-4">Suscripción y Límites</h3>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Icons.Award
                    size={20}
                    className={
                      store.subscription === "ULTRA"
                        ? "text-purple-500"
                        : store.subscription === "PREMIUM"
                          ? "text-yellow-500"
                          : "text-gray-500"
                    }
                  />
                  <span className="font-bold text-lg">
                    {store.subscription}
                  </span>
                </div>
                <span
                  className={`text-sm font-medium text-right transition-colors ${
                    myProducts.length >
                    (SUBSCRIPTION_LIMITS[store.subscription] || 10)
                      ? "text-red-500"
                      : "text-gray-500"
                  }`}
                >
                  {myProducts.length} /{" "}
                  {SUBSCRIPTION_LIMITS[store.subscription] || 10} productos
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    myProducts.length >
                    (SUBSCRIPTION_LIMITS[store.subscription] || 10)
                      ? "bg-red-500"
                      : store.subscription === "ULTRA"
                        ? "bg-purple-500"
                        : store.subscription === "PREMIUM"
                          ? "bg-yellow-500"
                          : "bg-gray-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      (myProducts.length /
                        (SUBSCRIPTION_LIMITS[store.subscription] || 10)) *
                        100,
                      100,
                    )}%`,
                  }}
                ></div>
              </div>
            </Card>

            <Card>
              <button
                onClick={() => setIsCustomizationOpen(!isCustomizationOpen)}
                className="flex justify-between items-center w-full"
              >
                <h3 className="font-bold text-lg">
                  Personalización de la tienda
                </h3>
                <Icons.ChevronDown
                  className={`transition-transform duration-300 ${isCustomizationOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isCustomizationOpen && (
                <div className="space-y-6 mt-4 pt-4 border-t border-gray-100">
                  {/* Cover Image Upload */}
                  <div className="flex flex-col items-center">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Portada de Tienda
                    </label>
                    <div className="flex items-center gap-4">
                      {profileForm.coverImage && (
                        <img
                          src={profileForm.coverImage}
                          alt="Cover"
                          className="w-32 h-20 rounded-xl object-cover border border-gray-200"
                        />
                      )}
                      <label className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Icons.Camera size={18} />
                          <span>
                            {isUploading
                              ? "Subiendo..."
                              : profileForm.coverImage
                                ? "Cambiar"
                                : "Subir"}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleProfileImageUpload(e, "coverImage")
                          }
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Logo Upload */}
                  <div className="flex flex-col items-center">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Avatar de Tienda
                    </label>
                    <div className="flex items-center gap-4">
                      {profileForm.logo && (
                        <img
                          src={profileForm.logo}
                          alt="Logo"
                          className="w-20 h-20 rounded-full object-cover border border-gray-200"
                        />
                      )}
                      <label className="flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Icons.Camera size={18} />
                          <span>
                            {isUploading
                              ? "..."
                              : profileForm.logo
                                ? "Cambiar"
                                : "Subir"}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleProfileImageUpload(e, "logo")}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Tiempo estimado de preparación
                      </label>
                      <span className="text-xs text-gray-400">Máx 120 min</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="Ej. 20"
                      value={profileForm.prepTime}
                      onChange={(e: any) =>
                        setProfileForm({
                          ...profileForm,
                          prepTime: e.target.value,
                        })
                      }
                      min={0}
                      max={120}
                      step={1}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Descripción de la tienda
                      </label>
                      <span className="text-xs text-gray-400">
                        {(profileForm.description || "").length}/70
                      </span>
                    </div>
                    <Input
                      value={profileForm.description}
                      onChange={(e: any) =>
                        setProfileForm({
                          ...profileForm,
                          description: e.target.value,
                        })
                      }
                      maxLength={70}
                    />
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={handleSaveProfile}
                    disabled={isUploading}
                  >
                    Guardar Cambios
                  </Button>
                </div>
              )}
            </Card>

            <Card>
              <h3 className="font-bold text-lg mb-4">
                Información del Propietario
              </h3>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 text-xs block">Nombre</span>
                    <p className="font-medium text-gray-800">
                      {store.firstName}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">
                      Apellido
                    </span>
                    <p className="font-medium text-gray-800">
                      {store.lastName}
                    </p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">
                    Número asociado
                  </span>
                  <p className="font-medium text-gray-800">{store.phone}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">
                    Correo electrónico
                  </span>
                  <p className="font-medium text-gray-800">{store.email}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">
                    Suscripción
                  </span>
                  <p className="font-medium text-gray-800">
                    {store.subscription}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">
                    Límite de productos
                  </span>
                  <p className="font-medium text-gray-800">
                    {myProducts.length} de{" "}
                    {SUBSCRIPTION_LIMITS[store.subscription] || 10}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">
                    Productos Visibles
                  </span>
                  <p className="font-medium text-gray-800">
                    {myProducts.filter((p) => p.isAvailable !== false).length}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block">
                    Dirección de la tienda
                  </span>
                  <p className="font-medium text-gray-800">
                    {store.storeAddress.street} #{store.storeAddress.number}
                    {store.storeAddress.colonyId && colonies
                      ? `, ${colonies.find((c) => c.id === store.storeAddress.colonyId)?.name}`
                      : ""}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs block mb-2">
                    Identificación (INE)
                  </span>
                  {store.ineImage ? (
                    <img
                      src={store.ineImage}
                      alt="INE"
                      className="w-full h-48 object-cover rounded-xl border border-gray-200"
                    />
                  ) : (
                    <p className="text-gray-400 italic">No disponible</p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* --- PRODUCT MODAL --- */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setProductModalOpen(false)}
        title={editingProduct ? "Editar Producto" : "Nuevo Producto"}
      >
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <Input
            label="Nombre del Producto"
            value={prodForm.name}
            onChange={(e: any) => {
              setProdForm({ ...prodForm, name: e.target.value });
              setProdErrors({ ...prodErrors, name: undefined });
            }}
            required
            maxLength={50}
            error={prodErrors.name}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 ml-1">
              Descripción
            </label>
            <textarea
              className={`w-full px-4 py-3 rounded-2xl bg-gray-100 border-2 ${prodErrors.description ? "border-red-500" : "border-transparent focus:border-primary"} focus:bg-white focus:outline-none transition-colors text-iosText resize-none`}
              rows={2}
              value={prodForm.description}
              onChange={(e) => {
                setProdForm({ ...prodForm, description: e.target.value });
                setProdErrors({ ...prodErrors, description: undefined });
              }}
              required
              maxLength={90}
            />
            {prodErrors.description ? (
              <p className="text-xs text-red-500 ml-1">
                {prodErrors.description}
              </p>
            ) : (
              <p className="text-xs text-right text-gray-400">
                {prodForm.description.length}/90
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">
              Imagen
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {isUploading && (
              <p className="text-xs text-blue-500 mt-1">
                Subiendo imagen a la nube...
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio"
              type="number"
              step="0.01"
              value={prodForm.price}
              onChange={(e: any) => {
                setProdForm({ ...prodForm, price: e.target.value });
                setProdErrors({ ...prodErrors, price: undefined });
              }}
              required
              error={prodErrors.price}
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 ml-1">
                Categoría
              </label>
              <div className="relative">
                <span className="absolute right-3 top-3.5 text-gray-400 pointer-events-none">
                  <Icons.ChevronDown size={16} />
                </span>
              </div>
              <Input
                value={prodForm.category}
                onChange={(e: any) => {
                  setProdForm({ ...prodForm, category: e.target.value });
                  setProdErrors({ ...prodErrors, category: undefined });
                }}
                required
                list="categories"
                maxLength={30}
                error={prodErrors.category}
              />
            </div>
          </div>
          <datalist id="categories">
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
          <Button type="submit" className="w-full" disabled={isUploading}>
            Guardar Producto
          </Button>
        </form>
      </Modal>

      {saveFeedback && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white py-2 px-4 rounded-full flex items-center gap-2 shadow-lg z-50">
          <Icons.Check size={16} />
          <span className="font-medium text-sm">{saveFeedback}</span>
        </div>
      )}
    </div>
  );
};

const TabButton = ({ id, label, icon, active, set }: any) => (
  <button
    onClick={() => set(id)}
    className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all ${active === id ? "bg-primary text-white shadow-md" : "text-gray-400"}`}
  >
    {icon}
    <span className="text-[10px] font-medium mt-1">{label}</span>
  </button>
);
