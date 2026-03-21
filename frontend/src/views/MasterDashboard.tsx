import React, { useState, useEffect, useMemo } from "react";
import { useApp } from "../AppContext";
import { useAuth } from "../contexts/AuthContext";
import { Button, Card, Input, Badge, Modal } from "../components/UI";
import { Icons } from "../constants";
import {
  UserRole,
  SubscriptionType,
  StoreProfile,
  User,
  Order,
  OrderStatus,
} from "../types";
import { formatDate, getOrderStatusColor } from "../utils";

export const MasterDashboard = () => {
  const {
    users,
    deleteUser,
    colonies,
    addColony,
    updateColony,
    deleteColony,
    settings,
    updateSettings,
    orders, // Needed for Finances
  } = useApp();

  const { currentUser, logout, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "users" | "requests" | "colonies" | "finances" | "monitoring"
  >("requests");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | StoreProfile | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<any>({});
  const [viewImage, setViewImage] = useState<string | null>(null);

  // ESTADO NUEVO: Controla las acciones en proceso para mostrar retroalimentación
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Requests Logic
  const pendingUsers = users.filter((u) => !u.approved);

  // Users Logic
  const activeUsers = users.filter(
    (u) => u.approved && u.role !== UserRole.MASTER,
  );
  const filteredUsers = activeUsers.filter((u) => {
    const matchesSearch = (u.firstName + " " + u.lastName)
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStoreName =
      u.role === UserRole.STORE &&
      (u as StoreProfile).storeName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === "ALL" || u.role === filterRole;
    return (matchesSearch || matchesStoreName) && matchesRole;
  });

  const handleApprove = async (u: User | StoreProfile) => {
    setLoadingAction(`approve-${u.id}`);
    try {
      await updateUser({ ...u, approved: true, isMasterUpdate: true } as any);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleChangeSubscription = async (
    store: StoreProfile,
    sub: SubscriptionType,
  ) => {
    setLoadingAction(`sub-${store.id}`);
    try {
      await updateUser({
        ...store,
        subscription: sub,
        isMasterUpdate: true,
      } as any);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setLoadingAction(`delete-${id}`);
    try {
      await deleteUser(id);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEditClick = (user: User | StoreProfile) => {
    setEditingUser(user);
    setEditFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      password: "",
      ...(user.role === UserRole.STORE && {
        storeName: (user as StoreProfile).storeName,
        storeAddress: (user as StoreProfile).storeAddress,
      }),
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setLoadingAction(`edit-${editingUser.id}`);

    const updatedUser: any = {
      ...editingUser,
      ...editFormData,
      isMasterUpdate: true,
    };

    if (!editFormData.password) {
      delete updatedUser.password;
    }

    try {
      await updateUser(updatedUser);
      setIsEditModalOpen(false);
      setEditingUser(null);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-secondary pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg?v=2"
            alt="Logo"
            className="h-10 w-auto object-contain"
          />
          <h1 className="text-xs font-mega text-primary">
            ADMINISTRACIÓN GENERAL
          </h1>
        </div>
        <Button variant="ghost" onClick={logout}>
          <Icons.LogOut size={20} />
        </Button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
          {[
            {
              id: "requests",
              label: "Solicitudes",
              icon: <Icons.Check size={18} />,
              count: pendingUsers.length,
            },
            {
              id: "users",
              label: "Usuarios",
              icon: <Icons.User size={18} />,
              count: 0,
            },
            {
              id: "colonies",
              label: "Colonias",
              icon: <Icons.MapPin size={18} />,
              count: 0,
            },
            {
              id: "finances",
              label: "Finanzas",
              icon: <Icons.DollarSign size={18} />,
              count: 0,
            },
            {
              id: "monitoring",
              label: "Monitoreo",
              icon: <Icons.Zap size={18} />,
              count: 0,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all relative ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "text-gray-400"
              }`}
            >
              {tab.count > 0 && (
                <span className="absolute top-1 right-3 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white">
                  {tab.count > 9 ? "9+" : tab.count}
                </span>
              )}
              {tab.icon}
              <span className="text-[10px] font-medium mt-1">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* --- REQUESTS PANEL --- */}
        {activeTab === "requests" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingUsers.length === 0 ? (
              <p className="text-gray-400 text-center col-span-full py-10">
                No hay solicitudes pendientes.
              </p>
            ) : (
              pendingUsers.map((u) => (
                <Card key={u.id} className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">
                        {u.firstName} {u.lastName}
                      </h3>
                      <Badge
                        color={
                          u.role === UserRole.STORE
                            ? "blue"
                            : u.role === UserRole.DELIVERY
                              ? "yellow"
                              : "gray"
                        }
                      >
                        {u.role}
                      </Badge>
                    </div>
                    {u.ineImage && (
                      <img
                        src={u.ineImage}
                        alt="INE"
                        className="w-16 h-10 object-cover rounded bg-gray-200 cursor-pointer hover:opacity-80"
                        onClick={() => setViewImage(u.ineImage || "")}
                      />
                    )}
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>Email: {u.email}</p>
                    <p>Tel: +52 {u.phone}</p>
                    {u.role === UserRole.STORE && (
                      <div className="mt-2 bg-gray-50 p-2 rounded">
                        <p className="font-semibold">
                          {(u as StoreProfile).storeName}
                        </p>
                        <p>
                          Calle: {(u as StoreProfile).storeAddress.street} #
                          {(u as StoreProfile).storeAddress.number}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="danger"
                      className="flex-1 py-2 text-sm disabled:opacity-50"
                      onClick={() => handleDeleteUser(u.id)}
                      disabled={loadingAction !== null}
                    >
                      {loadingAction === `delete-${u.id}`
                        ? "Procesando..."
                        : "Rechazar"}
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 py-2 text-sm disabled:opacity-50"
                      onClick={() => handleApprove(u)}
                      disabled={loadingAction !== null}
                    >
                      {loadingAction === `approve-${u.id}`
                        ? "Aceptando..."
                        : "Aceptar"}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}

        {/* --- USERS PANEL --- */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex-1 relative">
                <Icons.Search
                  className="absolute left-4 top-3.5 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Buscar usuario..."
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {[
                  "ALL",
                  UserRole.STORE,
                  UserRole.CLIENT,
                  UserRole.DELIVERY,
                ].map((r) => {
                  const getRoleLabel = (role: string) => {
                    const roleLabels: any = {
                      ALL: "Todos",
                      [UserRole.STORE]: "Tienda",
                      [UserRole.CLIENT]: "Cliente",
                      [UserRole.DELIVERY]: "Repartidor",
                    };
                    return roleLabels[role] || role;
                  };
                  return (
                    <button
                      key={r}
                      onClick={() => setFilterRole(r)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
                        filterRole === r
                          ? "bg-gray-800 text-white"
                          : "bg-white text-gray-600"
                      }`}
                    >
                      {getRoleLabel(r)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {filteredUsers.map((u) => (
                <Card
                  key={u.id}
                  className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between py-3 px-4"
                >
                  <div className="flex items-center gap-3 w-full md:w-auto overflow-hidden">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-sm">
                      {u.firstName[0]}
                      {u.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-iosText truncate">
                        {u.firstName} {u.lastName}
                      </h4>
                      {u.role === UserRole.STORE && (
                        <>
                          {/* Store Name Row */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                              <Icons.Store
                                size={14}
                                className="text-gray-500"
                              />
                              <span className="text-sm font-bold text-gray-800">
                                {(u as StoreProfile).storeName}
                              </span>
                            </div>
                          </div>
                          {/* Rating and Subscription Row */}
                          <div className="flex items-center gap-2 mt-1 w-full">
                            <div className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100 shrink-0">
                              <Icons.Star size={12} fill="currentColor" />
                              {(u as StoreProfile).averageRating
                                ? (u as StoreProfile).averageRating?.toFixed(1)
                                : "N/A"}
                            </div>
                            <div className="ml-auto flex items-center gap-1 px-2 py-1 bg-gray-800 text-white rounded-lg text-[10px] font-bold shadow-sm shrink-0">
                              <Icons.Award size={12} className="text-white" />
                              {(u as StoreProfile).subscription}
                            </div>
                          </div>
                        </>
                      )}
                      {/* End of store-specific info */}
                      <div className="flex items-center gap-2 w-full mt-1">
                        {" "}
                        {/* Added mt-1 for spacing from store info */}
                        <span className="text-xs text-gray-400 truncate flex-grow">
                          {" "}
                          {/* Allow email to grow but truncate */}
                          {u.email}
                        </span>
                        <Badge
                          color={
                            u.role === UserRole.STORE
                              ? "blue"
                              : u.role === UserRole.DELIVERY
                                ? "yellow"
                                : "green"
                          }
                          className="text-[10px] px-1.5 py-0 shrink-0 ml-auto" // This ml-auto should now work correctly
                        >
                          {u.role === UserRole.STORE
                            ? "Tienda"
                            : u.role === UserRole.DELIVERY
                              ? "Repartidor"
                              : "Cliente"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="h-0.5 w-full bg-gray-200 rounded-full my-2 md:hidden" />
                  <div className="flex gap-2 items-center w-full md:w-auto justify-end mt-1 md:mt-0">
                    {u.role === UserRole.STORE &&
                      (loadingAction === `sub-${u.id}` ? (
                        <span className="text-xs font-semibold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg animate-pulse shrink-0">
                          Cambiando...
                        </span>
                      ) : (
                        <select
                          className="text-xs p-1.5 rounded-lg bg-gray-100 border-none disabled:opacity-50 shrink-0"
                          value={(u as StoreProfile).subscription}
                          onChange={(e) =>
                            handleChangeSubscription(
                              u as StoreProfile,
                              e.target.value as SubscriptionType,
                            )
                          }
                          disabled={loadingAction !== null}
                        >
                          <option value={SubscriptionType.STANDARD}>
                            STANDARD
                          </option>
                          <option value={SubscriptionType.PREMIUM}>
                            PREMIUM
                          </option>
                          <option value={SubscriptionType.ULTRA}>ULTRA</option>
                        </select>
                      ))}
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs h-8 disabled:opacity-50"
                      onClick={() => handleEditClick(u)}
                      disabled={loadingAction !== null}
                    >
                      Editar
                    </Button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      disabled={loadingAction !== null}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center min-w-[32px]"
                    >
                      {loadingAction === `delete-${u.id}` ? (
                        <span className="text-xs font-bold animate-pulse">
                          ...
                        </span>
                      ) : (
                        <Icons.Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* --- COLONIES PANEL --- */}
        {activeTab === "colonies" && (
          <ColoniesPanel
            colonies={colonies}
            onAdd={addColony}
            onUpdate={updateColony}
            onDelete={deleteColony}
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        )}

        {/* --- FINANCES PANEL --- */}
        {activeTab === "finances" && <FinancePanel orders={orders} />}

        {/* --- MONITORING PANEL --- */}
        {activeTab === "monitoring" && (
          <MonitoringPanel orders={orders} users={users} />
        )}

        {/* Edit User Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Editar ${
            editingUser?.role === UserRole.STORE
              ? "Tienda"
              : editingUser?.role === UserRole.DELIVERY
                ? "Repartidor"
                : "Cliente"
          }`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={editFormData.firstName}
                onChange={(e: any) =>
                  setEditFormData({
                    ...editFormData,
                    firstName: e.target.value,
                  })
                }
              />
              <Input
                label="Apellido"
                value={editFormData.lastName}
                onChange={(e: any) =>
                  setEditFormData({ ...editFormData, lastName: e.target.value })
                }
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={editFormData.email}
              onChange={(e: any) =>
                setEditFormData({ ...editFormData, email: e.target.value })
              }
            />
            <Input
              label="Teléfono"
              value={editFormData.phone}
              onChange={(e: any) =>
                setEditFormData({ ...editFormData, phone: e.target.value })
              }
            />
            <div className="relative">
              <Input
                label="Contraseña"
                type="text"
                placeholder="Dejar vacío para no cambiar"
                value={editFormData.password || ""}
                onChange={(e: any) =>
                  setEditFormData({ ...editFormData, password: e.target.value })
                }
              />
              <p className="text-xs text-gray-400 mt-1">
                Escribe una nueva contraseña solo si deseas cambiarla.
              </p>
            </div>
            {editingUser?.role === UserRole.STORE && (
              <>
                <Input
                  label="Nombre de Tienda"
                  value={editFormData.storeName}
                  onChange={(e: any) =>
                    setEditFormData({
                      ...editFormData,
                      storeName: e.target.value,
                    })
                  }
                />
                <Input
                  label="Calle"
                  value={editFormData.storeAddress?.street}
                  onChange={(e: any) =>
                    setEditFormData({
                      ...editFormData,
                      storeAddress: {
                        ...editFormData.storeAddress,
                        street: e.target.value,
                      },
                    })
                  }
                />
                <Input
                  label="Número"
                  value={editFormData.storeAddress?.number}
                  onChange={(e: any) =>
                    setEditFormData({
                      ...editFormData,
                      storeAddress: {
                        ...editFormData.storeAddress,
                        number: e.target.value,
                      },
                    })
                  }
                />
                <div className="mb-4 w-full">
                  <label className="block text-sm font-medium text-gray-500 mb-1 ml-1">
                    Colonia
                  </label>
                  <select
                    className="w-full px-4 py-3 rounded-2xl bg-gray-100 border-2 border-transparent focus:bg-white focus:border-primary focus:outline-none transition-colors text-iosText"
                    value={editFormData.storeAddress?.colonyId || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        storeAddress: {
                          ...editFormData.storeAddress,
                          colonyId: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Selecciona una colonia</option>
                    {colonies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {editingUser?.ineImage && (
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Identificación (INE)
                </p>
                <img
                  src={editingUser.ineImage}
                  alt="INE"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>
            )}
            <Button
              onClick={handleSaveEdit}
              className="w-full disabled:opacity-50"
              disabled={loadingAction !== null}
            >
              {loadingAction ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </Modal>

        {/* Image Viewer Modal */}
        <Modal
          isOpen={!!viewImage}
          onClose={() => setViewImage(null)}
          title="Documento Adjunto"
        >
          <img
            src={viewImage || ""}
            alt="Documento"
            className="w-full h-auto rounded-lg"
          />
        </Modal>
      </div>
    </div>
  );
};

// Sub-component for Monitoring
const MonitoringPanel = ({
  orders,
  users,
}: {
  orders: Order[];
  users: User[];
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const ordersPerPage = 15;

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const matchesId = order.id
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesStatus =
          statusFilter === "ALL" || (order.status || "").toUpperCase() === statusFilter;
        return matchesId && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOrder === "newest") {
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
      });
  }, [orders, searchTerm, statusFilter, sortOrder]);

  // Paginación
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(
    indexOfFirstOrder,
    indexOfLastOrder,
  );
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // --- CHART LOGIC ---
  const chartData = useMemo(() => {
    const daysMap: Record<string, number> = {};
    // Generar últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("es-MX", {
        weekday: "short",
        day: "numeric",
      });
      daysMap[key] = 0;
    }

    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      // Solo contar si es de la última semana (aprox)
      const diffTime = Math.abs(Date.now() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        const key = d.toLocaleDateString("es-MX", {
          weekday: "short",
          day: "numeric",
        });
        if (daysMap[key] !== undefined) {
          daysMap[key]++;
        }
      }
    });

    return Object.entries(daysMap);
  }, [orders]);

  const maxOrders = Math.max(...chartData.map(([_, count]) => count), 1);

  const OrderInfoCard = ({ order }: { order: Order }) => {
    const customer =
      typeof order.customerId === "object"
        ? order.customerId
        : users.find((u) => u.id === order.customerId);
    const store =
      typeof order.storeId === "object"
        ? order.storeId
        : users.find((u) => u.id === order.storeId);
    const driver = order.driverId
      ? users.find((u) => u.id === order.driverId)
      : null;

    return (
      <div
        onClick={() => setSelectedOrder(order)}
        className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
      >
        {/* Top Row: ID, Date, Repartidor, Monto */}
        <div className="flex justify-between items-center text-xs mb-2 pb-2 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">
              #{order.id.slice(-6)}
            </span>
            <span className="text-gray-500">{formatDate(order.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-gray-600">
              <Icons.Bike size={12} />
              <span className="truncate max-w-[100px]">
                {driver?.firstName || "Sin asignar"}
              </span>
            </div>
            <span className="font-bold text-primary bg-red-50 px-2 py-0.5 rounded">
              ${order.total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Bottom Row: Status, Client, Store */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge
              color={getOrderStatusColor(order.status)}
              className="shrink-0 text-[10px] px-1.5 font-mega uppercase"
            >
              {(order.status || "").toUpperCase()}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-700 truncate">
              <Icons.User size={12} className="text-gray-400" />
              <span className="truncate">{customer?.firstName}</span>
            </div>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1 text-xs text-gray-700 truncate">
              <Icons.Store size={12} className="text-gray-400" />
              <span className="truncate">
                {(store as StoreProfile)?.storeName}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Chart Section */}
      <Card className="p-4">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Icons.BarChart2 size={18} /> Pedidos por Día (Última Semana)
        </h3>
        <br />
        <div className="flex justify-between h-32 gap-2">
          {chartData.map(([label, count]) => (
            <div
              key={label}
              className="flex flex-col items-center flex-1 group h-full"
            >
              <div className="relative w-full flex justify-center items-end flex-1">
                <div
                  className="w-full max-w-[30px] bg-primary/80 rounded-t-lg transition-all duration-500 group-hover:bg-primary relative"
                  style={{
                    height: `${(count / maxOrders) * 100}%`,
                    minHeight: count > 0 ? "4px" : "0",
                  }}
                >
                  {count > 0 && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-600">
                      {count}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-gray-400 mt-2 font-medium">
                {label}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full">
          <Icons.Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            placeholder="Buscar por ID de pedido..."
            value={searchTerm}
            onChange={(e: any) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white shadow-sm border-2 border-transparent focus:bg-white focus:border-primary focus:outline-none transition-colors text-iosText placeholder-gray-400"
          />
        </div>

        <div className="flex gap-4 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-white shadow-sm border-2 border-transparent focus:bg-white focus:border-primary focus:outline-none text-sm"
          >
            <option value="ALL">Todos los estados</option>
            {Object.values(OrderStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-white shadow-sm border-2 border-transparent focus:bg-white focus:border-primary focus:outline-none text-sm"
          >
            <option value="newest">Más recientes primero</option>
            <option value="oldest">Más antiguos primero</option>
          </select>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-4">
        {currentOrders.length > 0 ? (
          currentOrders.map((order) => (
            <OrderInfoCard key={order.id} order={order} />
          ))
        ) : (
          <p className="text-center text-gray-400 py-10">
            No se encontraron pedidos con esos filtros.
          </p>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            variant="secondary"
            className="!px-3 !py-2"
          >
            <Icons.ChevronLeft size={18} />
          </Button>
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            variant="secondary"
            className="!px-3 !py-2"
          >
            <Icons.ChevronRight size={18} />
          </Button>
        </div>
      )}

      {/* Modal de Detalles del Pedido */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Detalles del Pedido"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
              <span className="font-bold text-lg">
                #{selectedOrder.id.slice(-6)}
              </span>
              <Badge
                color={getOrderStatusColor(selectedOrder.status)}
                className="font-mega"
              >
                {selectedOrder.status}
              </Badge>
            </div>

            <div className="border rounded-xl p-3 max-h-60 overflow-y-auto">
              <h4 className="font-bold text-sm mb-2 text-gray-500">
                Productos
              </h4>
              {selectedOrder.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0"
                >
                  <span>
                    {item.quantity}x {item.product.name}
                  </span>
                  <span>
                    $
                    {(
                      (item.price || item.product.price) * item.quantity
                    ).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-xl space-y-2 text-sm">
              <h4 className="font-bold text-blue-800 mb-2">
                Desglose Financiero
              </h4>
              <div className="flex justify-between">
                <span>Subtotal Productos:</span>
                <span className="font-medium">
                  ${selectedOrder.subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tarifa de Envío Total (Cliente paga):</span>
                <span className="font-medium">
                  ${selectedOrder.deliveryFee.toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-blue-200 my-1"></div>
              <div className="flex justify-between text-xs text-blue-700">
                <span>- Tarifa Repartidor (Por Km):</span>
                <span>${(selectedOrder.driverFee || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-blue-700">
                <span>- Banderazo (Comisión App):</span>
                <span>
                  $
                  {(
                    (selectedOrder.deliveryFee || 0) -
                    (selectedOrder.driverFee || 0)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="h-px bg-blue-200 my-1"></div>
              <div className="flex justify-between font-bold text-lg text-blue-900">
                <span>Total Cobrado:</span>
                <span>${selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// Sub-component for Colonies
const ColoniesPanel = ({
  colonies,
  onAdd,
  onUpdate,
  onDelete,
  settings,
  onUpdateSettings,
}: any) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", lat: "", lng: "" });
  const [globalForm, setGlobalForm] = useState({
    commissionRate: settings.commissionRate,
    kmRate: settings.kmRate,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search and Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setGlobalForm({
      commissionRate: settings.commissionRate,
      kmRate: settings.kmRate,
    });
  }, [settings]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ name: "", lat: "", lng: "" });
    setModalOpen(true);
  };

  const handleEdit = (colony: any) => {
    setEditingId(colony.id);
    setFormData({
      name: colony.name,
      lat: String(colony.lat || 0),
      lng: String(colony.lng || 0),
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    const lat = Number(formData.lat);
    const lng = Number(formData.lng);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      return alert("Latitud inválida. Debe estar entre -90 y 90.");
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return alert(
        "Longitud inválida. Debe estar entre -180 y 180. (¿Falta un punto decimal?)",
      );
    }

    if (editingId) {
      onUpdate({
        id: editingId,
        name: formData.name,
        lat: lat,
        lng: lng,
      });
    } else {
      onAdd({
        id: Date.now().toString(),
        name: formData.name,
        lat: lat,
        lng: lng,
      });
    }
    setModalOpen(false);
  };

  const handleSaveGlobal = () => {
    onUpdateSettings({
      ...settings,
      commissionRate: Number(globalForm.commissionRate),
      kmRate: Number(globalForm.kmRate),
    });
    alert("Tarifas globales actualizadas");
  };

  // Filter and Sort Logic
  const filteredAndSortedColonies = colonies
    .filter((c: any) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a: any, b: any) => {
      if (sortOrder === "asc") return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });

  return (
    <div>
      {/* Global Settings Card */}
      <Card className="mb-6 bg-blue-50 border border-blue-100">
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="flex justify-between items-center w-full"
        >
          <h3 className="font-mega text-lg text-blue-900">
            TARIFAS GLOBALES DE ENVÍO
          </h3>
          <Icons.ChevronDown
            className={`text-blue-900 transition-transform ${
              isSettingsOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isSettingsOpen && (
          <div className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Comisión de la App (%)"
                type="number"
                value={globalForm.commissionRate}
                onChange={(e: any) =>
                  setGlobalForm({
                    ...globalForm,
                    commissionRate: e.target.value,
                  })
                }
              />
              <Input
                label="Tarifa por Kilómetro (Para Repartidor)"
                type="number"
                value={globalForm.kmRate}
                onChange={(e: any) =>
                  setGlobalForm({ ...globalForm, kmRate: e.target.value })
                }
              />
            </div>
            <Button
              onClick={handleSaveGlobal}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700"
            >
              Actualizar Tarifas
            </Button>
          </div>
        )}
      </Card>

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-mega text-lg">ADMINISTRAR COLONIAS</h3>
        <Button onClick={handleOpenAdd} className="py-2 text-sm">
          <Icons.Plus size={16} /> Agregar
        </Button>
      </div>

      {/* Search and Sort Controls */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 relative">
          <Icons.Search
            className="absolute left-3 top-3.5 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar colonia..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 ring-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          className="px-4 py-2 bg-white shadow-sm rounded-xl font-medium text-gray-700 flex items-center gap-2 hover:bg-gray-50 transition-colors"
        >
          {sortOrder === "asc" ? (
            <>
              <Icons.ArrowUp size={18} /> A-Z
            </>
          ) : (
            <>
              <Icons.ArrowDown size={18} /> Z-A
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        {filteredAndSortedColonies.map((c: any) => (
          <div
            key={c.id}
            className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm"
          >
            <div>
              <p className="font-bold">{c.name}</p>
              <p className="text-xs text-gray-500 font-mono">
                Lat: {c.lat}, Lng: {c.lng}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(c)}
                className="p-2 text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <Icons.Edit2 size={18} />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                <Icons.Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
        {filteredAndSortedColonies.length === 0 && (
          <p className="text-center text-gray-400 py-6">
            No se encontraron colonias.
          </p>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Editar Colonia" : "Nueva Colonia"}
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={formData.name}
            onChange={(e: any) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
          <Input
            label="Latitud"
            type="number"
            step="any"
            value={formData.lat}
            onChange={(e: any) =>
              setFormData({ ...formData, lat: e.target.value })
            }
          />
          <Input
            label="Longitud"
            type="number"
            step="any"
            value={formData.lng}
            onChange={(e: any) =>
              setFormData({ ...formData, lng: e.target.value })
            }
          />
          <Button onClick={handleSave} className="w-full">
            Guardar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

// Sub-component for Finances
const FinancePanel = ({ orders }: { orders: Order[] }) => {
  // Only completed orders contribute to earnings
  const completedOrders = orders.filter(
    (o) => (o.status || "").toUpperCase() === OrderStatus.DELIVERED,
  );

  // Calculate Total Earnings (Commision = DeliveryFee - DriverFee)
  // Note: Ensure driverFee exists, otherwise commission might be BaseFee.
  // Assuming strict logic: user pays DeliveryFee, Driver gets DriverFee, App gets the rest.
  const calculateCommission = (order: Order) => {
    const delivery = order.deliveryFee || 0;
    const driver = order.driverFee || 0;
    return Math.max(0, delivery - driver);
  };

  const totalEarnings = completedOrders.reduce(
    (acc, o) => acc + calculateCommission(o),
    0,
  );

  // Calculate current week stats
  const now = new Date();
  const currentDay = now.getDay();
  const diff = now.getDate() - currentDay;
  const currentWeekStart = new Date(now.setDate(diff)).setHours(0, 0, 0, 0);

  let currentWeekEarnings = 0;
  let currentWeekOrders = 0;

  completedOrders.forEach((o) => {
    const d = new Date(o.createdAt);
    const day = d.getDay();
    const diffDate = d.getDate() - day;
    const weekStart = new Date(d.setDate(diffDate)).setHours(0, 0, 0, 0);

    if (weekStart === currentWeekStart) {
      currentWeekEarnings += calculateCommission(o);
      currentWeekOrders += 1;
    }
  });

  // Group by Week
  const getWeekKey = (dateMs: number) => {
    const d = new Date(dateMs);
    // Simple week grouping: Start of the week (Sunday)
    const day = d.getDay();
    const diff = d.getDate() - day; // adjust when day is sunday
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart.getTime();
  };

  const weeklyData: Record<number, { total: number; count: number }> = {};

  completedOrders.forEach((o) => {
    const weekStart = getWeekKey(o.createdAt);
    if (!weeklyData[weekStart]) weeklyData[weekStart] = { total: 0, count: 0 };
    weeklyData[weekStart].total += calculateCommission(o);
    weeklyData[weekStart].count += 1;
  });

  const sortedWeeks = Object.keys(weeklyData)
    .map(Number)
    .sort((a, b) => b - a); // Descending date

  return (
    <div className="pb-24">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-white border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-indigo-600">
            <Icons.DollarSign size={18} />
            <h3 className="font-semibold text-xs text-gray-600">
              Ganancias Totales
            </h3>
          </div>
          <p className="text-xl font-bold text-gray-800">
            ${totalEarnings.toFixed(2)}
          </p>
        </Card>

        <div className="bg-green-600 text-white p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Icons.TrendingUp size={18} />
            <h3 className="font-semibold text-xs">Ganancias (Semana)</h3>
          </div>
          <p className="text-xl font-bold">${currentWeekEarnings.toFixed(2)}</p>
        </div>

        <Card className="bg-white border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1 text-blue-600">
            <Icons.ShoppingBag size={18} />
            <h3 className="font-semibold text-xs text-gray-600">
              Pedidos Completados
            </h3>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {completedOrders.length}
          </p>
        </Card>

        <div className="bg-green-600 text-white p-4 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-1 opacity-80">
            <Icons.ShoppingBag size={18} />
            <h3 className="font-semibold text-xs">Pedidos (Semana)</h3>
          </div>
          <p className="text-xl font-bold">{currentWeekOrders}</p>
        </div>
      </div>

      {/* Weekly Breakdown */}
      <div>
        <h3 className="font-mega text-lg mb-4 text-gray-800">
          RESUMEN SEMANAL
        </h3>
        <div className="space-y-3">
          {sortedWeeks.length === 0 ? (
            <p className="text-gray-400 text-center">
              No hay datos financieros registrados aún.
            </p>
          ) : (
            sortedWeeks.map((weekStart) => {
              const date = new Date(weekStart);
              const labelStart = date.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              // Calculate range end (Saturday)
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 6);
              const labelEnd = weekEnd.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              return (
                <Card
                  key={weekStart}
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
                        {weeklyData[weekStart].count} pedidos
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-lg text-green-600">
                    ${weeklyData[weekStart].total.toFixed(2)}
                  </p>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
