import React, { useState } from "react";
import { useApp } from "../../AppContext";
import { useCart } from "../../contexts/CartContext";
import { Button, Input } from "../../components/UI";
import { Icons } from "../../constants";
import { StoreProfile } from "../../types";

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
        <div className="flex gap-4 items-center flex-1">
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
        <div className="flex items-center gap-2">
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

export const CartView = ({
  setView,
  onCheckout,
}: {
  setView: (view: "home" | "cart" | "orders" | "profile") => void;
  onCheckout: () => void;
}) => {
  const { cart, cartTotal } = useCart();

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
    </div>
  );
};
