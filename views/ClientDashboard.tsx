import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Button, Card, Input, Badge, Modal } from '../components/UI';
import { Icons, MOCK_COLONIES } from '../constants';
import { StoreProfile, SubscriptionType, Product, OrderStatus } from '../types';

export const ClientDashboard = () => {
  const { users, products, cart, addToCart, removeFromCart, cartTotal, currentUser, updateUser, placeOrder, orders, logout } = useApp();
  const [view, setView] = useState<'home' | 'cart' | 'orders' | 'profile'>('home');
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState<StoreProfile | null>(null);
  
  // Logic to separate stores
  const stores = users.filter(u => u.role === 'STORE' && (u as StoreProfile).isOpen && u.approved) as StoreProfile[];
  
  // Ultra Stores (Sorted by priority set by master)
  const ultraStores = stores
    .filter(s => s.subscription === SubscriptionType.ULTRA)
    .sort((a, b) => b.subscriptionPriority - a.subscriptionPriority);

  // Other Stores (Premium then Standard)
  const otherStores = stores
    .filter(s => s.subscription !== SubscriptionType.ULTRA)
    .sort((a, b) => {
        if (a.subscription === SubscriptionType.PREMIUM && b.subscription === SubscriptionType.STANDARD) return -1;
        if (a.subscription === SubscriptionType.STANDARD && b.subscription === SubscriptionType.PREMIUM) return 1;
        return b.subscriptionPriority - a.subscriptionPriority;
    });

  // Search Logic
  const filteredStores = useMemo(() => {
    if (!search) return [];
    return stores.filter(s => {
       const hasProduct = products.some(p => p.storeId === s.id && p.name.toLowerCase().includes(search.toLowerCase()));
       const matchesName = s.storeName.toLowerCase().includes(search.toLowerCase());
       return hasProduct || matchesName;
    });
  }, [search, stores, products]);

  // --- Sub-View Components ---

  const HomeView = () => (
    <div className="space-y-6 pb-24">
       {/* Search Bar */}
       <div className="sticky top-0 z-20 bg-secondary pt-4 pb-2 px-4">
         <div className="relative">
           <Icons.Search className="absolute left-4 top-3.5 text-gray-400" size={20} />
           <input 
             type="text" 
             placeholder="Busca pizza, sushi, tacos..." 
             className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white shadow-ios-card focus:outline-none focus:ring-2 ring-primary/20 text-iosText"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
         </div>
       </div>

       {search ? (
          <div className="px-4 space-y-4">
             <h2 className="font-bold text-lg">Resultados</h2>
             {filteredStores.map(s => <StoreCard key={s.id} store={s} onClick={() => setSelectedStore(s)} />)}
             {filteredStores.length === 0 && <p className="text-gray-400 text-center">No se encontraron resultados</p>}
          </div>
       ) : (
         <>
            {/* Ultra Section */}
            {ultraStores.length > 0 && (
              <div className="pl-4">
                <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <Icons.Store className="text-primary" size={20}/> La mejor opción
                </h2>
                <div className="flex overflow-x-auto gap-4 pb-4 pr-4 no-scrollbar snap-x">
                  {ultraStores.map(s => (
                    <div key={s.id} onClick={() => setSelectedStore(s)} className="snap-center shrink-0 w-72 bg-white rounded-3xl overflow-hidden shadow-ios-card relative cursor-pointer active:scale-95 transition-transform">
                       <img src={s.coverImage} className="w-full h-32 object-cover" />
                       <div className="p-4">
                          <h3 className="font-bold text-lg">{s.storeName}</h3>
                          <p className="text-xs text-gray-500 line-clamp-1">{s.description}</p>
                          <div className="mt-2 flex gap-2">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg flex items-center gap-1"><Icons.Clock size={12}/> {s.prepTime || '30m'}</span>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vertical Feed */}
            <div className="px-4 space-y-4">
               <h2 className="font-bold text-lg">Restaurantes</h2>
               {otherStores.map(s => <StoreCard key={s.id} store={s} onClick={() => setSelectedStore(s)} />)}
            </div>
         </>
       )}
    </div>
  );

  const CartView = () => {
    const [addressStep, setAddressStep] = useState(false);
    const [newAddress, setNewAddress] = useState({ street: '', number: '', colonyId: '', reference: '' });
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [payMethod, setPayMethod] = useState<'CARD'|'CASH'>('CARD');

    const handleCheckout = () => {
      if (!selectedAddressId && !addressStep) {
        setAddressStep(true);
        return;
      }
      
      let finalAddress = currentUser?.addresses?.find(a => a.id === selectedAddressId);
      
      if (addressStep) {
        // Validate new address
        if (!newAddress.colonyId) return alert("Selecciona una colonia");
        const colony = MOCK_COLONIES.find(c => c.id === newAddress.colonyId);
        finalAddress = { id: Date.now().toString(), ...newAddress } as any;
        // Optionally save to profile here
      }

      if (!finalAddress) return alert("Dirección requerida");
      const colony = MOCK_COLONIES.find(c => c.id === finalAddress?.colonyId);
      const fee = colony ? colony.deliveryFee : 0;

      placeOrder({
        id: Date.now().toString(),
        customerId: currentUser!.id,
        storeId: cart[0].product.storeId,
        items: cart,
        status: OrderStatus.PENDING,
        total: cartTotal + fee,
        deliveryFee: fee,
        paymentMethod: payMethod,
        deliveryAddress: finalAddress!,
        createdAt: Date.now()
      });
      alert("¡Pedido realizado con éxito!");
      setView('orders');
    };

    if (cart.length === 0) return <div className="h-full flex flex-col items-center justify-center text-gray-400"><Icons.ShoppingBag size={48} className="mb-4 opacity-20"/><p>Tu carrito está vacío</p></div>;

    const colony = addressStep && newAddress.colonyId ? MOCK_COLONIES.find(c => c.id === newAddress.colonyId) : null;
    const deliveryFee = colony ? colony.deliveryFee : 0; // Simplified logic, real logic would pull from saved address too

    return (
      <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
         <h2 className="text-2xl font-bold mb-6">Tu Pedido</h2>
         
         <div className="space-y-4 mb-6">
           {cart.map((item, i) => (
             <div key={i} className="flex justify-between items-center bg-white p-3 rounded-2xl">
                <div className="flex gap-3 items-center">
                   <div className="bg-gray-100 rounded-lg w-8 h-8 flex items-center justify-center font-bold text-sm">{item.quantity}x</div>
                   <div>
                     <p className="font-bold text-sm">{item.product.name}</p>
                     <p className="text-xs text-gray-500">${item.product.price * item.quantity}</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => removeFromCart(item.product.id)} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">-</button>
                   <button onClick={() => addToCart(item.product)} className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center">+</button>
                </div>
             </div>
           ))}
         </div>

         {!addressStep ? (
           <div className="space-y-4">
              <h3 className="font-bold">Dirección de Entrega</h3>
              {(currentUser?.addresses || []).length > 0 ? (
                <div className="space-y-2">
                  {currentUser?.addresses?.map(addr => (
                    <div key={addr.id} onClick={() => setSelectedAddressId(addr.id)} className={`p-4 rounded-2xl border-2 cursor-pointer ${selectedAddressId === addr.id ? 'border-primary bg-red-50' : 'border-transparent bg-white'}`}>
                       <p className="font-bold">{addr.street} #{addr.number}</p>
                       <p className="text-xs text-gray-500">{MOCK_COLONIES.find(c => c.id === addr.colonyId)?.name}</p>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={() => setAddressStep(true)} className="w-full py-2 text-sm">+ Nueva Dirección</Button>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setAddressStep(true)} className="w-full py-4 border-dashed border-2 border-gray-300">Agregar Dirección</Button>
              )}
           </div>
         ) : (
           <div className="bg-white p-4 rounded-3xl space-y-3 shadow-sm">
             <div className="flex justify-between items-center mb-2">
               <h3 className="font-bold">Nueva Dirección</h3>
               <button onClick={() => setAddressStep(false)} className="text-xs text-red-500">Cancelar</button>
             </div>
             <Input label="Calle" value={newAddress.street} onChange={(e:any) => setNewAddress({...newAddress, street: e.target.value})}/>
             <div className="flex gap-2">
                <Input label="Número" value={newAddress.number} onChange={(e:any) => setNewAddress({...newAddress, number: e.target.value})}/>
                <div className="w-full">
                  <label className="text-xs text-gray-500 ml-1">Colonia</label>
                  <select className="w-full p-3 bg-gray-100 rounded-2xl mt-1" value={newAddress.colonyId} onChange={(e) => setNewAddress({...newAddress, colonyId: e.target.value})}>
                     <option value="">Selecciona</option>
                     {MOCK_COLONIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
             </div>
             <Input label="Referencias" value={newAddress.reference} onChange={(e:any) => setNewAddress({...newAddress, reference: e.target.value})}/>
           </div>
         )}

         <div className="mt-6 bg-white p-4 rounded-3xl space-y-3">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${cartTotal}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Envío</span>
              <span>${addressStep && colony ? colony.deliveryFee : 'Calculando...'}</span>
            </div>
            <div className="flex justify-between font-bold text-xl pt-2 border-t">
              <span>Total</span>
              <span>${cartTotal + (addressStep && colony ? colony.deliveryFee : 0)}</span>
            </div>
         </div>

         <div className="mt-4 flex gap-2">
            <button onClick={() => setPayMethod('CARD')} className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 ${payMethod === 'CARD' ? 'bg-gray-800 text-white' : 'bg-white'}`}>
              <Icons.CreditCard size={18} /> Tarjeta
            </button>
            <button onClick={() => setPayMethod('CASH')} className={`flex-1 py-3 rounded-2xl flex items-center justify-center gap-2 ${payMethod === 'CASH' ? 'bg-green-600 text-white' : 'bg-white'}`}>
              <Icons.DollarSign size={18} /> Efectivo
            </button>
         </div>

         <Button className="w-full mt-6 shadow-xl shadow-red-500/30" onClick={handleCheckout}>Realizar Pedido</Button>
      </div>
    );
  };

  const OrdersView = () => (
    <div className="px-4 py-6 pb-24 space-y-4">
      <h2 className="text-2xl font-bold mb-6">Mis Pedidos</h2>
      {orders.filter(o => o.customerId === currentUser!.id).reverse().map(o => (
        <Card key={o.id}>
           <div className="flex justify-between mb-2">
             <span className="font-bold text-primary">{users.find(u => u.id === o.storeId)?.firstName || 'Tienda'}</span>
             <Badge color={o.status === 'DELIVERED' ? 'green' : o.status === 'REJECTED' ? 'red' : 'blue'}>{o.status}</Badge>
           </div>
           <p className="text-sm text-gray-500 mb-2">{new Date(o.createdAt).toLocaleDateString()} • {o.items.length} productos</p>
           <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
              <div className={`h-full bg-primary transition-all duration-1000`} style={{ width: o.status === 'PENDING' ? '10%' : o.status === 'PREPARING' ? '40%' : o.status === 'ON_WAY' ? '80%' : '100%' }}></div>
           </div>
           <p className="text-xs text-right mt-1 text-gray-400">
             {o.status === 'PENDING' ? 'Enviado' : o.status === 'PREPARING' ? 'Cocinando' : o.status === 'READY' ? 'Esperando Repartidor' : o.status === 'ON_WAY' ? 'En camino' : 'Entregado'}
           </p>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary">
      {/* Content Area */}
      {view === 'home' && <HomeView />}
      {view === 'cart' && <CartView />}
      {view === 'orders' && <OrdersView />}
      {view === 'profile' && (
        <div className="p-6 pb-24">
          <Card className="flex flex-col items-center py-10">
            <div className="w-24 h-24 bg-gray-200 rounded-full mb-4 flex items-center justify-center text-3xl text-gray-400">
               <Icons.User />
            </div>
            <h2 className="text-xl font-bold">{currentUser?.firstName}</h2>
            <p className="text-gray-500">{currentUser?.email}</p>
            <Button variant="danger" className="mt-8 w-full" onClick={logout}>Cerrar Sesión</Button>
          </Card>
        </div>
      )}

      {/* Store Modal */}
      <Modal isOpen={!!selectedStore} onClose={() => setSelectedStore(null)} title={selectedStore?.storeName || ''}>
         {selectedStore && (
           <div className="pb-10">
              <img src={selectedStore.coverImage} className="w-full h-40 object-cover rounded-2xl mb-4" />
              <p className="text-gray-500 mb-4">{selectedStore.description}</p>
              <h3 className="font-bold text-lg mb-3">Menú</h3>
              <div className="space-y-4">
                 {products.filter(p => p.storeId === selectedStore.id).map(p => (
                   <div key={p.id} className="flex justify-between items-center border-b border-gray-100 pb-3">
                      <div>
                        <p className="font-bold">{p.name}</p>
                        <p className="text-xs text-gray-500 mb-1">{p.description}</p>
                        <p className="font-semibold text-primary">${p.price}</p>
                      </div>
                      <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => { addToCart(p); setSelectedStore(null); alert('Agregado al carrito'); }}>
                        <Icons.Plus size={16} />
                      </Button>
                   </div>
                 ))}
              </div>
           </div>
         )}
      </Modal>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-lg border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between z-40">
        <NavBtn icon={<Icons.Home />} label="Inicio" active={view === 'home'} onClick={() => setView('home')} />
        <NavBtn icon={<Icons.ShoppingBag />} label="Pedidos" active={view === 'orders'} onClick={() => setView('orders')} />
        <div className="relative">
          <NavBtn icon={<Icons.Bike />} label="Carrito" active={view === 'cart'} onClick={() => setView('cart')} />
          {cart.length > 0 && <span className="absolute -top-1 right-2 w-5 h-5 bg-primary text-white text-[10px] flex items-center justify-center rounded-full font-bold">{cart.reduce((a,b) => a+b.quantity, 0)}</span>}
        </div>
        <NavBtn icon={<Icons.User />} label="Perfil" active={view === 'profile'} onClick={() => setView('profile')} />
      </nav>
    </div>
  );
};

const StoreCard: React.FC<{ store: StoreProfile, onClick: () => void }> = ({ store, onClick }) => (
  <div onClick={onClick} className="bg-white p-3 rounded-3xl flex gap-3 shadow-ios-card cursor-pointer active:scale-95 transition-transform">
     <img src={store.logo} className="w-20 h-20 rounded-2xl object-cover bg-gray-100" />
     <div className="flex-1">
        <div className="flex justify-between items-start">
           <h3 className="font-bold text-iosText">{store.storeName}</h3>
           {store.subscription === SubscriptionType.PREMIUM && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">RECOMENDADO</span>}
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{store.description}</p>
        <div className="mt-2 flex gap-3 text-xs text-gray-400">
           <span className="flex items-center gap-1"><Icons.Clock size={12}/> {store.prepTime || '30m'}</span>
        </div>
     </div>
  </div>
);

const NavBtn = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center p-2 transition-colors ${active ? 'text-primary' : 'text-gray-400'}`}>
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium mt-1">{label}</span>
  </button>
);