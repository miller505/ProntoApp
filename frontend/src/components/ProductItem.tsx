import React, { useState } from "react";
import { Product } from "../types";
import { Icons } from "../constants";

export const ProductItem = ({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product, q: number) => void;
}) => {
  const [quantity, setQuantity] = useState(1);

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
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 rounded-lg h-8">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-2 h-full text-gray-600 hover:bg-gray-200 rounded-l-lg"
              >
                -
              </button>
              <span className="text-xs font-bold w-6 text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-2 h-full text-gray-600 hover:bg-gray-200 rounded-r-lg"
              >
                +
              </button>
            </div>
            <button
              onClick={() => onAdd(product, quantity)}
              className="w-8 h-8 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-transform flex items-center justify-center"
            >
              <Icons.Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
