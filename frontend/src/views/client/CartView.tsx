import React, { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../../AppContext";
import { useCart } from "../../contexts/CartContext";
import { useProducts } from "../../contexts/ProductContext";
import { Button, Input } from "../../components/UI";
import { Icons } from "../../constants";
import { StoreProfile, Product } from "../../types";

// --- SUB-COMPONENTE PARA CORREGIR ERROR DE HOOKS Y MEJORAR UI ---
const CartItemCard = ({ item }: { item: any }) => {
  const { users } = useApp();
  const { removeFromCart, addToCart, deleteFromCart, updateItemNotes } =
    useCart();
  const store = users.find(
    (u) => u.id === item.product.storeId,
  ) as StoreProfile;
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center flex-1 min-w-0">
          <img
            src={item.product.image}
            alt={item.product.name}
            className="w-16 h-16 rounded-lg object-cover bg-gray-100"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{item.product.name}</p>
            <p className="text-xs text-gray-400 truncate">{store?.storeName}</p>
            <p className="text-sm font-bold text-primary mt-1 truncate">
              ${(Number(item.product.price || 0) * item.quantity).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={() => removeFromCart(item.product.id)}
            className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
          >
            -
          </button>
          <span className="font-bold text-sm w-5 text-center">
            {item.quantity}
          </span>
          <button
            onClick={() => addToCart(item.product)}
            className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center active:bg-red-700"
          >
            +
          </button>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="text-xs text-blue-500 hover:text-blue-700 font-semibold flex items-center gap-1.5 p-1 -m-1"
        >
          <Icons.Edit2 size={14} />
          {item.notes ? "Editar nota" : "Agregar nota"}
        </button>
        <button
          onClick={() => deleteFromCart(item.product.id)}
          className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1.5 p-1 -m-1"
        >
          <Icons.Trash2 size={14} />
          Eliminar
        </button>
      </div>
      {showNotes && (
        <div className="mt-2">
          <Input
            as="textarea"
            rows={2}
            placeholder="Ej. Sin cebolla, bien cocido, etc."
            value={item.notes || ""}
            onChange={(e: any) =>
              updateItemNotes(item.product.id, e.target.value)
            }
            className="text-xs"
            maxLength={100}
          />
          <p className="text-right text-xs text-gray-400 mt-1">
            {(item.notes || "").length} / 100
          </p>
        </div>
      )}
    </div>
  );
};

// --- COMPONENTE PARA LOS "ANTOJOS" CON SELECTOR DE CANTIDAD ANIMADO ---
const AntojoItemCard = ({ product }: { product: Product }) => {
  const { cart, addToCart, removeFromCart } = useCart();
  const [showCounter, setShowCounter] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const cartItem = cart.find((item) => item.product.id === product.id);
  const cartQuantity = cartItem?.quantity || 0;

  const handleInteraction = (type: "add" | "remove") => {
    if (type === "add") {
      addToCart(product, 1);
    } else {
      removeFromCart(product.id);
    }

    setShowCounter(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowCounter(false), 2000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const shouldShowCounter = showCounter && cartQuantity > 0;

  return (
    <div className="snap-center shrink-0 w-32 bg-white rounded-3xl p-3 shadow-sm border border-gray-100 flex flex-col items-center">
      <img
        src={product.image}
        className="w-20 h-20 rounded-2xl object-cover mb-2 bg-gray-50"
        alt={product.name}
      />
      <p className="text-[10px] font-bold text-gray-800 text-center line-clamp-1 w-full px-1">
        {product.name}
      </p>
      <p className="text-[11px] text-primary font-bold mb-2">
        ${Number(product.price).toFixed(2)}
      </p>
      <div className="relative h-8 w-full">
        <div
          className={`absolute inset-0 flex items-center justify-between bg-gray-100 rounded-xl transition-all duration-300 ${shouldShowCounter ? "opacity-100 scale-100 z-10" : "opacity-0 scale-50 pointer-events-none"}`}
        >
          <button
            onClick={() => handleInteraction("remove")}
            className="flex-1 h-full text-gray-600 font-bold text-xs"
          >
            -
          </button>
          <span className="text-[10px] font-bold">{cartQuantity}</span>
          <button
            onClick={() => handleInteraction("add")}
            className="flex-1 h-full text-gray-600 font-bold text-xs"
          >
            +
          </button>
        </div>
        <button
          onClick={() => handleInteraction("add")}
          className={`absolute inset-0 w-full h-full bg-primary/10 text-primary rounded-xl flex items-center justify-center active:scale-95 transition-all duration-300 ${shouldShowCounter ? "opacity-0 scale-50 pointer-events-none" : "opacity-100 scale-100"}`}
        >
          <Icons.Plus size={14} />
        </button>
      </div>
    </div>
  );
};

export const CartView = ({
  setView,
  onCheckout,
}: {
  setView: (view: "home" | "cart" | "orders" | "profile") => void;
  onCheckout: () => void;
}) => {
  const { cart, cartTotal } = useCart();
  const { products } = useProducts();

  // Identificar el ID de la tienda actual basándonos en el primer producto del carrito
  const storeId = useMemo(() => {
    if (cart.length === 0) return null;
    const sid = cart[0].product.storeId;
    return typeof sid === "object" ? (sid as any).id || (sid as any)._id : sid;
  }, [cart]);

  // Obtener los 5 más vendidos de la tienda
  const topProducts = useMemo(() => {
    if (!storeId) return [];
    return products
      .filter((p) => {
        const psid =
          typeof p.storeId === "object"
            ? (p.storeId as any).id || (p.storeId as any)._id
            : p.storeId;
        const isInCart = cart.some(
          (item) => String(item.product.id) === String(p.id),
        );
        return (
          String(psid) === String(storeId) &&
          p.isAvailable !== false &&
          !isInCart
        );
      })
      .sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 5);
  }, [products, storeId, cart]);

  if (cart.length === 0)
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-gray-400">
        <Icons.ShoppingCart size={48} className="mb-4 opacity-20" />
        <p className="mb-6">Tu carrito está vacío</p>
        <Button onClick={() => setView("home")}>
          <Icons.ShoppingCart size={16} /> Comprar ahora
        </Button>
      </div>
    );

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <h2 className="text-lg font-mega mb-6">TU PEDIDO</h2>

      <div className="space-y-4 mb-6">
        {cart.map((item, i) => (
          <CartItemCard key={item.product.id || i} item={item} />
        ))}
      </div>

      <div className="mt-6 bg-white p-4 rounded-3xl space-y-3">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>${cartTotal.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400 text-center">
          El costo de envío se calculará en el siguiente paso.
        </p>
      </div>

      <Button
        className="w-full mt-6 shadow-xl shadow-red-500/30"
        onClick={onCheckout}
      >
        Ir a Pagar
      </Button>

      {topProducts.length > 0 && (
        <div className="mt-10 animate-fade-in-up">
          <h3 className="font-mega text-lg mb-4 text-gray-800 ml-1">
            COMPLEMENTA TU ORDEN
          </h3>
          <div className="flex overflow-x-auto gap-3 pb-4 no-scrollbar -mx-4 px-4 snap-x">
            {topProducts.map((p) => (
              <AntojoItemCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
