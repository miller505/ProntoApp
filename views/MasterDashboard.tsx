import React, { useState, useEffect } from "react";
import { useApp } from "../AppContext";
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

export const MasterDashboard = () => {
  const {
    users,
    currentUser,
    logout,
    updateUser,
    deleteUser,
    colonies,
    addColony,
    updateColony,
    deleteColony,
    settings,
    updateSettings,
    orders, // Needed for Finances
  } = useApp();
  const [activeTab, setActiveTab] = useState<
    "users" | "requests" | "colonies" | "finances"
  >("requests");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | StoreProfile | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<any>({});

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

  const handleApprove = (u: User | StoreProfile) => {
    updateUser({ ...u, approved: true, isMasterUpdate: true } as any);
  };

  const handleChangeSubscription = (
    store: StoreProfile,
    sub: SubscriptionType,
  ) => {
    updateUser({ ...store, subscription: sub, isMasterUpdate: true } as any);
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

  const handleSaveEdit = () => {
    if (!editingUser) return;

    const updatedUser: any = {
      ...editingUser,
      ...editFormData,
      isMasterUpdate: true,
    };

    if (!editFormData.password) {
      delete updatedUser.password;
    }

    updateUser(updatedUser);
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  return (
    <div className="min-h-screen bg-secondary pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Logo"
            className="h-10 w-auto object-contain"
          />
          <h1 className="text-xs font-bold text-primary">
            ADMINISTRACIÓN GENERAL
          </h1>
        </div>
        <Button variant="ghost" onClick={logout}>
          <Icons.LogOut size={20} />
        </Button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-white rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
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
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? "bg-primary text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count > 0 && (
                <span className="bg-white text-primary text-xs px-2 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
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
                        className="w-16 h-10 object-cover rounded bg-gray-200"
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
                      className="flex-1 py-2 text-sm"
                      onClick={() => deleteUser(u.id)}
                    >
                      Rechazar
                    </Button>
                    <Button
                      variant="primary"
                      className="flex-1 py-2 text-sm"
                      onClick={() => handleApprove(u)}
                    >
                      Aceptar
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400 truncate">
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
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {u.role === UserRole.STORE
                            ? "Tienda"
                            : u.role === UserRole.DELIVERY
                              ? "Repartidor"
                              : "Cliente"}
                        </Badge>
                      </div>
                      {u.role === UserRole.STORE && (
                        <div className="flex gap-2 items-center mt-0.5">
                          <span className="text-xs font-semibold text-primary truncate">
                            {(u as StoreProfile).storeName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600 shrink-0">
                            {(u as StoreProfile).subscription}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-0.5 w-full bg-gray-200 rounded-full my-2 md:hidden" />
                  <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-between md:justify-end mt-1 md:mt-0">
                    {u.role === UserRole.STORE && (
                      <div className="flex flex-row md:flex-col items-center md:items-end gap-2">
                        <div className="flex items-center gap-1 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">
                          <Icons.Star size={12} fill="currentColor" />
                          {(u as StoreProfile).averageRating
                            ? (u as StoreProfile).averageRating?.toFixed(1)
                            : "N/A"}
                        </div>
                        <select
                          className="text-xs p-1.5 rounded-lg bg-gray-100 border-none"
                          value={(u as StoreProfile).subscription}
                          onChange={(e) =>
                            handleChangeSubscription(
                              u as StoreProfile,
                              e.target.value as SubscriptionType,
                            )
                          }
                        >
                          <option value={SubscriptionType.STANDARD}>
                            STANDARD
                          </option>
                          <option value={SubscriptionType.PREMIUM}>
                            PREMIUM
                          </option>
                          <option value={SubscriptionType.ULTRA}>ULTRA</option>
                        </select>
                      </div>
                    )}
                    <div className="flex gap-2 ml-auto">
                      <Button
                        variant="secondary"
                        className="px-3 py-1.5 text-xs h-8"
                        onClick={() => handleEditClick(u)}
                      >
                        Editar
                      </Button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Icons.Trash2 size={16} />
                      </button>
                    </div>
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
            <Button onClick={handleSaveEdit} className="w-full">
              Guardar Cambios
            </Button>
          </div>
        </Modal>
      </div>
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
    baseFee: settings.baseFee,
    kmRate: settings.kmRate,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Search and Sort states
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setGlobalForm({
      baseFee: settings.baseFee,
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
      baseFee: Number(globalForm.baseFee),
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
          <h3 className="font-bold text-lg text-blue-900">
            Tarifas Globales de Envío
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
                label="Banderazo (Comisión Empresa)"
                type="number"
                value={globalForm.baseFee}
                onChange={(e: any) =>
                  setGlobalForm({ ...globalForm, baseFee: e.target.value })
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
        <h3 className="font-bold text-lg">Administrar Colonias</h3>
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
    (o) => o.status === OrderStatus.DELIVERED,
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

  const weeklyData: Record<number, number> = {};

  completedOrders.forEach((o) => {
    const weekStart = getWeekKey(o.createdAt);
    if (!weeklyData[weekStart]) weeklyData[weekStart] = 0;
    weeklyData[weekStart] += calculateCommission(o);
  });

  const sortedWeeks = Object.keys(weeklyData)
    .map(Number)
    .sort((a, b) => b - a); // Descending date

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-white border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-indigo-600">
            <Icons.DollarSign size={20} />
            <h3 className="font-semibold text-sm text-gray-600">
              Ganancias Totales (Banderazos)
            </h3>
          </div>
          <p className="text-4xl font-bold text-gray-800">
            ${totalEarnings.toFixed(2)}
          </p>
          <p className="text-xs mt-2 text-gray-400">
            Acumulado histórico de comisiones
          </p>
        </Card>

        <Card className="bg-gradient-to-br from-green-600 to-green-800 text-white p-6">
          <div className="flex items-center gap-3 mb-2 opacity-80">
            <Icons.Calendar size={20} />
            <h3 className="font-semibold text-sm">Ganancias Semanales</h3>
          </div>
          <p className="text-4xl font-bold">
            ${currentWeekEarnings.toFixed(2)}
          </p>
          <p className="text-xs mt-2 opacity-70">Semana en curso</p>
        </Card>

        <Card className="bg-white border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-blue-600">
            <Icons.ShoppingBag size={20} />
            <h3 className="font-semibold text-sm text-gray-600">
              Pedidos Completados
            </h3>
          </div>
          <p className="text-4xl font-bold text-gray-800">
            {completedOrders.length}
          </p>
          <p className="text-xs mt-2 text-gray-400">Acumulado histórico</p>
        </Card>

        <Card className="bg-white border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2 text-green-600">
            <Icons.ShoppingBag size={20} />
            <h3 className="font-semibold text-sm text-gray-600">
              Pedidos Semanales
            </h3>
          </div>
          <p className="text-4xl font-bold text-gray-800">
            {currentWeekOrders}
          </p>
          <p className="text-xs mt-2 text-gray-400">Semana en curso</p>
        </Card>
      </div>

      {/* Weekly Breakdown */}
      <div>
        <h3 className="font-bold text-lg mb-4 text-gray-800">
          Resumen semanal
        </h3>
        <div className="space-y-3">
          {sortedWeeks.length === 0 ? (
            <p className="text-gray-400">
              No hay datos financieros registrados aún.
            </p>
          ) : (
            sortedWeeks.map((weekStart) => {
              const date = new Date(weekStart);
              const label = date.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              // Calculate range end (Saturday)
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekEnd.getDate() + 6);
              const labelEnd = weekEnd.toLocaleDateString("es-MX", {
                day: "numeric",
                month: "numeric",
              });

              return (
                <div
                  key={weekStart}
                  className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center group hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Icons.Calendar size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">
                        Semana del {label}
                      </p>
                      <p className="text-xs text-gray-400">Hasta {labelEnd}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-indigo-600">
                      +${weeklyData[weekStart].toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
