import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { Button, Card, Input, Badge, Modal } from '../components/UI';
import { Icons } from '../constants';
import { StoreProfile, Product, Order, OrderStatus } from '../types';

export const StoreDashboard = () => {
  const { currentUser, updateUser, products, addProduct, updateProduct, deleteProduct, orders, updateOrderStatus, logout } = useApp();
  const store = currentUser as StoreProfile;
  
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'profile'>('orders');
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Product Form State
  const [prodForm, setProdForm] = useState<any>({ name: '', description: '', price: '', category: '' });

  const myOrders = orders.filter(o => o.storeId === store.id);
  const myProducts = products.filter(p => p.storeId === store.id);

  const handleToggleOpen = () => {
    updateUser({ ...store, isOpen: !store.isOpen });
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      storeId: store.id,
      name: prodForm.name,
      description: prodForm.description,
      price: Number(prodForm.price),
      category: prodForm.category,
      image: 'https://picsum.photos/200' // Placeholder
    };
    
    if (editingProduct) updateProduct(payload);
    else addProduct(payload);
    
    setProductModalOpen(false);
    setEditingProduct(null);
    setProdForm({ name: '', description: '', price: '', category: '' });
  };

  const openProductModal = (p?: Product) => {
    if (p) {
      setEditingProduct(p);
      setProdForm({ name: p.name, description: p.description, price: p.price, category: p.category });
    } else {
      setEditingProduct(null);
      setProdForm({ name: '', description: '', price: '', category: '' });
    }
    setProductModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-secondary pb-24">
      <header className="bg-white sticky top-0 z-30 px-6 py-4 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
             {store.logo && <img src={store.logo} className="w-full h-full object-cover" />}
          </div>
          <div>
            <h1 className="font-bold text-iosText leading-tight">{store.storeName}</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${store.isOpen ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-xs text-gray-500">{store.isOpen ? 'Abierto' : 'Cerrado'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={handleToggleOpen} className={`p-2 rounded-xl transition-colors ${store.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
             <Icons.Store size={20} />
           </button>
           <button onClick={logout} className="p-2 bg-gray-100 text-gray-600 rounded-xl">
             <Icons.LogOut size={20} />
           </button>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        
        <div className="flex gap-2 p-1 bg-white rounded-2xl shadow-sm">
           <TabButton id="orders" label="Pedidos" icon={<Icons.ShoppingBag size={18}/>} active={activeTab} set={setActiveTab} />
           <TabButton id="products" label="Menú" icon={<Icons.Menu size={18}/>} active={activeTab} set={setActiveTab} />
           <TabButton id="profile" label="Perfil" icon={<Icons.Settings size={18}/>} active={activeTab} set={setActiveTab} />
        </div>

        {/* --- ORDERS --- */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800 ml-1">Comandas Activas</h2>
            {myOrders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.REJECTED).length === 0 && (
               <div className="text-center py-10 text-gray-400">No hay pedidos activos</div>
            )}
            {myOrders.filter(o => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.REJECTED).map(order => (
              <Card key={order.id} className="border-l-4 border-primary">
                <div className="flex justify-between mb-3">
                   <span className="font-mono text-sm text-gray-400">#{order.id.slice(-4)}</span>
                   <Badge color={order.status === OrderStatus.PENDING ? 'yellow' : 'blue'}>{order.status}</Badge>
                </div>
                <div className="space-y-2 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.product.name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t pt-3">
                  <span className="font-bold text-lg">${order.total}</span>
                  <div className="flex gap-2">
                    {order.status === OrderStatus.PENDING && (
                      <>
                        <Button variant="danger" className="py-2 px-3 text-xs" onClick={() => updateOrderStatus(order.id, OrderStatus.REJECTED)}>Rechazar</Button>
                        <Button className="py-2 px-3 text-xs" onClick={() => updateOrderStatus(order.id, OrderStatus.PREPARING)}>Aceptar</Button>
                      </>
                    )}
                    {order.status === OrderStatus.PREPARING && (
                      <Button className="py-2 px-3 text-xs w-full bg-green-600 hover:bg-green-700" onClick={() => updateOrderStatus(order.id, OrderStatus.READY)}>
                        <Icons.Check size={16} className="mr-1"/> Listo para Repartidor
                      </Button>
                    )}
                    {order.status === OrderStatus.READY && (
                       <span className="text-sm text-gray-500 animate-pulse">Esperando repartidor...</span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* --- PRODUCTS --- */}
        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold text-gray-800 ml-1">Mi Catálogo</h2>
               <Button onClick={() => openProductModal()} className="py-2 text-sm"><Icons.Plus size={18}/> Nuevo</Button>
            </div>
            <div className="space-y-3">
              {myProducts.map(p => (
                <div key={p.id} className="bg-white p-3 rounded-2xl flex gap-3 shadow-ios-card">
                   <img src={p.image} className="w-20 h-20 rounded-xl object-cover bg-gray-100" />
                   <div className="flex-1">
                      <div className="flex justify-between">
                        <h4 className="font-bold text-sm">{p.name}</h4>
                        <span className="font-semibold text-primary">${p.price}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{p.description}</p>
                      <div className="flex justify-end gap-2 mt-2">
                         <button onClick={() => openProductModal(p)} className="p-1.5 bg-gray-100 rounded-lg text-gray-600"><Icons.Edit2 size={14}/></button>
                         <button onClick={() => deleteProduct(p.id)} className="p-1.5 bg-red-50 rounded-lg text-red-500"><Icons.Trash2 size={14}/></button>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- PROFILE (Simplified) --- */}
        {activeTab === 'profile' && (
           <Card>
              <h3 className="font-bold text-lg mb-4">Configuración</h3>
              <div className="space-y-3">
                <Input label="Tiempo Prep." placeholder="Ej. 20-30 min" value={store.prepTime || ''} onChange={(e:any) => updateUser({...store, prepTime: e.target.value})} />
                <Input label="Descripción" value={store.description || ''} onChange={(e:any) => updateUser({...store, description: e.target.value})} />
                <Button className="w-full mt-4">Guardar Cambios</Button>
              </div>
           </Card>
        )}
      </div>

      <Modal isOpen={isProductModalOpen} onClose={() => setProductModalOpen(false)} title={editingProduct ? "Editar" : "Nuevo Producto"}>
         <form onSubmit={handleProductSubmit} className="space-y-4">
            <Input label="Nombre" value={prodForm.name} onChange={(e:any) => setProdForm({...prodForm, name: e.target.value})} required />
            <Input label="Descripción" value={prodForm.description} onChange={(e:any) => setProdForm({...prodForm, description: e.target.value})} required />
            <Input label="Precio ($)" type="number" value={prodForm.price} onChange={(e:any) => setProdForm({...prodForm, price: e.target.value})} required />
            <Input label="Categoría" value={prodForm.category} onChange={(e:any) => setProdForm({...prodForm, category: e.target.value})} required list="categories" />
            <datalist id="categories">
               <option value="Entradas" />
               <option value="Plato Fuerte" />
               <option value="Bebidas" />
            </datalist>
            <Button type="submit" className="w-full">Guardar Producto</Button>
         </form>
      </Modal>
    </div>
  );
};

const TabButton = ({ id, label, icon, active, set }: any) => (
  <button onClick={() => set(id)} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all ${active === id ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}>
    {icon}
    <span className="text-[10px] font-bold mt-1">{label}</span>
  </button>
);
