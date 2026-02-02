import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import {
  User,
  StoreProfile,
  Product,
  Order,
  Colony,
  OrderStatus,
  SubscriptionType,
} from "./types";
import { api } from "./src/api"; // Importamos la conexión real

interface AppContextType {
  currentUser: User | StoreProfile | null;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  register: (user: User | StoreProfile) => Promise<void>;

  users: (User | StoreProfile)[];
  updateUser: (user: User | StoreProfile) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  colonies: Colony[];
  addColony: (colony: Colony) => Promise<void>;
  updateColony: (colony: Colony) => Promise<void>;
  deleteColony: (id: string) => Promise<void>;

  products: Product[];
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  orders: Order[];
  placeOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    driverId?: string,
  ) => Promise<void>;

  // Cart Logic for Client
  cart: { product: Product; quantity: number }[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | StoreProfile | null>(
    null,
  );
  const [users, setUsers] = useState<(User | StoreProfile)[]>([]);
  const [colonies, setColonies] = useState<Colony[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  // Initial Load from Backend
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/init");
      // Mapear _id de mongo a id string para el frontend
      const mapId = (list: any[]) =>
        list.map((item) => ({ ...item, id: item._id }));

      setUsers(mapId(data.users));
      setProducts(mapId(data.products));
      setOrders(mapId(data.orders));
      setColonies(mapId(data.colonies));
    } catch (error) {
      console.error("Error cargando datos", error);
    } finally {
      setLoading(false);
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("currentUser");
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch (e) {
        console.error("Error restoring session", e);
        localStorage.removeItem("currentUser");
      }
    }
  }, []);

  // --- AUTH ---
  const login = async (email: string, pass: string) => {
    try {
      const { data } = await api.post("/auth/login", { email, password: pass });
      // Mapear ID
      const user = { ...data, id: data._id };
      setCurrentUser(user);
      // Persist session in localStorage
      localStorage.setItem("currentUser", JSON.stringify(user));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setCart([]);
    // Clear session from localStorage
    localStorage.removeItem("currentUser");
  };

  const register = async (newUser: User | StoreProfile) => {
    try {
      await api.post("/auth/register", newUser);
      await fetchInitialData(); // Recargar usuarios
    } catch (e) {
      console.error(e);
      alert("Error en el registro");
    }
  };

  // --- USER MGMT ---
  const updateUser = async (updatedUser: User | StoreProfile) => {
    try {
      const { data } = await api.put(`/users/${updatedUser.id}`, updatedUser);
      const mapped = { ...data, id: data._id };
      setUsers(users.map((u) => (u.id === mapped.id ? mapped : u)));
      if (currentUser?.id === mapped.id) {
        setCurrentUser(mapped);
        // Update session in localStorage
        localStorage.setItem("currentUser", JSON.stringify(mapped));
      }
      // CRITICAL: Reload all data from backend to ensure consistency
      console.log("🔄 Reloading data from backend after user update...");
      await fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUser = async (id: string) => {
    await api.delete(`/users/${id}`);
    setUsers(users.filter((u) => u.id !== id));
  };

  // --- COLONY MGMT ---
  const addColony = async (c: Colony) => {
    const { data } = await api.post("/colonies", c);
    setColonies([...colonies, { ...data, id: data._id }]);
  };
  const updateColony = async (c: Colony) => {
    await api.put(`/colonies/${c.id}`, c);
    setColonies(colonies.map((col) => (col.id === c.id ? c : col)));
  };
  const deleteColony = async (id: string) => {
    await api.delete(`/colonies/${id}`);
    setColonies(colonies.filter((c) => c.id !== id));
  };

  // --- PRODUCT MGMT ---
  const addProduct = async (p: Product) => {
    const { data } = await api.post("/products", p);
    setProducts([...products, { ...data, id: data._id }]);
  };
  const updateProduct = async (p: Product) => {
    await api.put(`/products/${p.id}`, p);
    setProducts(products.map((prod) => (prod.id === p.id ? p : prod)));
  };
  const deleteProduct = async (id: string) => {
    await api.delete(`/products/${id}`);
    setProducts(products.filter((p) => p.id !== id));
  };

  // --- ORDER MGMT ---
  const placeOrder = async (order: Order) => {
    try {
      const { data } = await api.post("/orders", order);
      setOrders([...orders, { ...data, id: data._id }]);
      clearCart();
    } catch (e) {
      console.error(e);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    driverId?: string,
  ) => {
    try {
      const { data } = await api.put(`/orders/${orderId}/status`, {
        status,
        driverId,
      });
      const mapped = { ...data, id: data._id };
      setOrders(orders.map((o) => (o.id === orderId ? mapped : o)));
    } catch (e) {
      console.error(e);
    }
  };

  // --- CART (Client side logic remains) ---
  const addToCart = (product: Product) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      if (cart.length > 0 && cart[0].product.storeId !== product.storeId) {
        if (
          window.confirm(
            "Solo puedes pedir de una tienda a la vez. ¿Vaciar carrito?",
          )
        ) {
          setCart([{ product, quantity: 1 }]);
        }
      } else {
        setCart([...cart, { product, quantity: 1 }]);
      }
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find((item) => item.product.id === productId);
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        ),
      );
    } else {
      setCart(cart.filter((item) => item.product.id !== productId));
    }
  };

  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0,
  );

  return (
    <AppContext.Provider
      value={{
        currentUser,
        login,
        logout,
        register,
        users,
        updateUser,
        deleteUser,
        colonies,
        addColony,
        updateColony,
        deleteColony,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        orders,
        placeOrder,
        updateOrderStatus,
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        cartTotal,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
