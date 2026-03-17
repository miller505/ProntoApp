import React, { useState, useEffect, useRef } from "react";
import { Product } from "../../types";
import { Icons } from "../../constants";

export const ProductItem = ({
  product,
  onAdd,
  onRemove,
  cartQuantity,
}: {
  product: Product;
  onAdd: (p: Product, q: number) => void;
  onRemove: (productId: string) => void;
  cartQuantity: number;
}) => {
  const [showCounter, setShowCounter] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleInteraction = (type: "add" | "remove") => {
    if (type === "add") {
      onAdd(product, 1);
    } else {
      onRemove(product.id);
    }

    setShowCounter(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setShowCounter(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const shouldShowCounter = showCounter && cartQuantity > 0;

  return (
    <div className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
      <img
        src={product.image}
        className="w-24 h-24 rounded-xl object-cover bg-gray-100"
        alt={product.name}
      />
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-gray-800">{product.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2">
            {product.description}
          </p>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="font-bold text-primary">
            ${Number(product.price || 0).toFixed(2)}
          </span>
          <div className="relative flex items-center justify-end h-8 w-24">
            <div
              className={`absolute right-0 flex items-center bg-gray-100 rounded-lg h-8 transition-all duration-300 ${
                shouldShowCounter
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-50 pointer-events-none"
              }`}
            >
              <button
                onClick={() => handleInteraction("remove")}
                className="px-2 h-full text-gray-600 hover:bg-gray-200 rounded-l-lg"
              >
                -
              </button>
              <span className="text-xs font-bold w-6 text-center">
                {cartQuantity}
              </span>
              <button
                onClick={() => handleInteraction("add")}
                className="px-2 h-full text-gray-600 hover:bg-gray-200 rounded-r-lg"
              >
                +
              </button>
            </div>
            <button
              onClick={() => handleInteraction("add")}
              className={`absolute right-0 w-8 h-8 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-all duration-300 flex items-center justify-center ${
                shouldShowCounter
                  ? "opacity-0 scale-50 pointer-events-none"
                  : "opacity-100 scale-100"
              }`}
            >
              <Icons.Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
