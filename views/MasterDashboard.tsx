import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Button, Card, Input, Badge, Modal } from '../components/UI';
import { Icons, MOCK_COLONIES } from '../constants';
import { UserRole, SubscriptionType, StoreProfile, User } from '../types';

export const MasterDashboard = () => {
  const { users, currentUser, logout, updateUser, deleteUser, colonies, addColony, updateColony, deleteColony } = useApp();
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'colonies'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  
  // Requests Logic
  const pendingUsers = users.filter(u => !u.approved);
  
  // Users Logic
  const activeUsers = users.filter(u => u.approved && u.role !== UserRole.MASTER);
  const filteredUsers = activeUsers.filter(u => {
    const matchesSearch = (u.firstName + ' ' + u.lastName).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleApprove = (u: User | StoreProfile) => {
    updateUser({ ...u, approved: true });
  };

  const handleChangeSubscription = (store: StoreProfile, sub: SubscriptionType) => {
    updateUser({ ...store, subscription: sub });
  };

  const handlePriority = (store: StoreProfile, direction: 'up' | 'down') => {
    updateUser({ ...store, subscriptionPriority: store.subscriptionPriority + (direction === 'up' ? 1 : -1) });
  };

  return (
    <div className="min-h-screen bg-secondary pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Master Panel</h1>
          <p className="text-sm text-gray-500">Bienvenido, {currentUser?.firstName}</p>
        </div>
        <Button variant="ghost" onClick={logout}><Icons.LogOut size={20} /></Button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-white rounded-2xl shadow-sm overflow-x-auto no-scrollbar">
          {[
            { id: 'requests', label: 'Solicitudes', count: pendingUsers.length },
            { id: 'users', label: 'Usuarios y Tiendas', count: 0 },
            { id: 'colonies', label: 'Colonias', count: 0 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[120px] py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab.id ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {tab.label}
              {tab.count > 0 && <span className="bg-white text-primary text-xs px-2 py-0.5 rounded-full">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* --- REQUESTS PANEL --- */}
        {activeTab === 'requests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingUsers.length === 0 ? <p className="text-gray-400 text-center col-span-full py-10">No hay solicitudes pendientes.</p> :
            pendingUsers.map(u => (
              <Card key={u.id} className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg">{u.firstName} {u.lastName}</h3>
                    <Badge color={u.role === UserRole.STORE ? 'blue' : u.role === UserRole.DELIVERY ? 'yellow' : 'gray'}>{u.role}</Badge>
                  </div>
                  {u.ineImage && <img src={u.ineImage} alt="INE" className="w-16 h-10 object-cover rounded bg-gray-200" />}
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Email: {u.email}</p>
                  <p>Tel: +52 {u.phone}</p>
                  {(u.role === UserRole.STORE) && (
                    <div className="mt-2 bg-gray-50 p-2 rounded">
                      <p className="font-semibold">{(u as StoreProfile).storeName}</p>
                      <p>Calle: {(u as StoreProfile).storeAddress.street} #{(u as StoreProfile).storeAddress.number}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="danger" className="flex-1 py-2 text-sm" onClick={() => deleteUser(u.id)}>Rechazar</Button>
                  <Button variant="primary" className="flex-1 py-2 text-sm" onClick={() => handleApprove(u)}>Aceptar</Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* --- USERS PANEL --- */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex gap-4 flex-col md:flex-row">
              <div className="flex-1 relative">
                <Icons.Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar usuario..." 
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 ring-primary/20"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {['ALL', UserRole.STORE, UserRole.CLIENT, UserRole.DELIVERY].map(r => (
                   <button 
                    key={r}
                    onClick={() => setFilterRole(r)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${filterRole === r ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}
                   >
                     {r === 'ALL' ? 'Todos' : r}
                   </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filteredUsers.map(u => (
                <Card key={u.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold">
                       {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-iosText">{u.firstName} {u.lastName}</h4>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-gray-400">{u.email}</span>
                        <Badge color={u.role === UserRole.STORE ? 'blue' : 'gray'}>{u.role}</Badge>
                      </div>
                      {u.role === UserRole.STORE && (
                        <div className="mt-1 flex gap-2 items-center">
                            <span className="text-xs font-semibold text-primary">{(u as StoreProfile).storeName}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{(u as StoreProfile).subscription}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    {u.role === UserRole.STORE && (
                      <>
                        <div className="flex items-center bg-gray-50 rounded-lg p-1 mr-2">
                           <button onClick={() => handlePriority(u as StoreProfile, 'up')} className="p-1 hover:text-primary"><Icons.ChevronUp size={16}/></button>
                           <span className="text-xs font-mono w-6 text-center">{(u as StoreProfile).subscriptionPriority}</span>
                           <button onClick={() => handlePriority(u as StoreProfile, 'down')} className="p-1 hover:text-primary"><Icons.ChevronDown size={16}/></button>
                        </div>
                        <select 
                          className="text-xs p-2 rounded-xl bg-gray-100 border-none"
                          value={(u as StoreProfile).subscription}
                          onChange={(e) => handleChangeSubscription(u as StoreProfile, e.target.value as SubscriptionType)}
                        >
                          <option value={SubscriptionType.STANDARD}>STANDARD</option>
                          <option value={SubscriptionType.PREMIUM}>PREMIUM</option>
                          <option value={SubscriptionType.ULTRA}>ULTRA</option>
                        </select>
                      </>
                    )}
                    <Button variant="secondary" className="px-3 py-2 text-xs">Editar</Button>
                    <button onClick={() => deleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Icons.Trash2 size={18} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* --- COLONIES PANEL --- */}
        {activeTab === 'colonies' && (
           <ColoniesPanel colonies={colonies} onAdd={addColony} onUpdate={updateColony} onDelete={deleteColony} />
        )}

      </div>
    </div>
  );
};

// Sub-component for Colonies
const ColoniesPanel = ({ colonies, onAdd, onUpdate, onDelete }: any) => {
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', fee: 0 });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ name: '', fee: 0 });
    setModalOpen(true);
  };

  const handleEdit = (colony: any) => {
    setEditingId(colony.id);
    setFormData({ name: colony.name, fee: colony.deliveryFee });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      onUpdate({ id: editingId, name: formData.name, deliveryFee: Number(formData.fee) });
    } else {
      onAdd({ id: Date.now().toString(), name: formData.name, deliveryFee: Number(formData.fee) });
    }
    setModalOpen(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">Administrar Colonias</h3>
        <Button onClick={handleOpenAdd} className="py-2 text-sm"><Icons.Plus size={16} /> Agregar</Button>
      </div>
      <div className="space-y-3">
        {colonies.map((c: any) => (
          <div key={c.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="font-bold">{c.name}</p>
              <p className="text-sm text-gray-500">Tarifa: ${c.deliveryFee}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleEdit(c)} className="p-2 text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                <Icons.Edit2 size={18} />
              </button>
              <button onClick={() => onDelete(c.id)} className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                <Icons.Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Editar Colonia" : "Nueva Colonia"}>
        <div className="space-y-4">
          <Input label="Nombre" value={formData.name} onChange={(e:any) => setFormData({...formData, name: e.target.value})} />
          <Input label="Tarifa de Envío ($)" type="number" value={formData.fee} onChange={(e:any) => setFormData({...formData, fee: Number(e.target.value)})} />
          <Button onClick={handleSave} className="w-full">Guardar</Button>
        </div>
      </Modal>
    </div>
  );
};
