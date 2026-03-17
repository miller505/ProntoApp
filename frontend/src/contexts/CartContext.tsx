import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Product, CartItem } from "../types";

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  deleteFromCart: (productId: string) => void;
  clearCart: () => void;
  updateItemNotes: (productId: string, notes: string) => void;
  cartTotal: number;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.product.id === product.id);
      if (existing) {
        return prevCart.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: (i.quantity || 0) + quantity }
            : i,
        );
      }
      return [...prevCart, { product, quantity }];
    });
  };

  const removeFromCart = (pid: string) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.product.id === pid);
      if (existing && existing.quantity > 1) {
        return prevCart.map((i) =>
          i.product.id === pid ? { ...i, quantity: i.quantity - 1 } : i,
        );
      }
      return prevCart.filter((i) => i.product.id !== pid);
    });
  };

  const deleteFromCart = (pid: string) => {
    setCart((prevCart) => prevCart.filter((i) => i.product.id !== pid));
  };

  const updateItemNotes = (productId: string, notes: string) => {
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId ? { ...item, notes } : item,
      ),
    );
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce(
    (acc, item) =>
      acc + (Number(item.product.price) || 0) * (item.quantity || 1),
    0,
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        deleteFromCart,
        clearCart,
        updateItemNotes,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
