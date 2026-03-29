import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { Product } from "../types";
import { api } from "../api";
import { toast } from "sonner";

interface ProductContextType {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  addProduct: (product: any) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  fetchStoreProducts: (storeId: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType>(
  {} as ProductContextType,
);

export const ProductProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);

  const fetchStoreProducts = useCallback(async (storeId: string) => {
    try {
      const res = await api.get(`/api/products?storeId=${storeId}`);
      const newProducts = res.data.map((item: any) => ({
        ...item,
        id: item._id || item.id,
      }));
      setProducts((prev) => {
        const others = prev.filter((p) => p.storeId !== storeId);
        return [...others, ...newProducts];
      });
    } catch (error) {
      console.error("Error fetching store products:", error);
    }
  }, []);

  const addProduct = async (p: any) => {
    try {
      const res = await api.post("/api/products", p);
      const newProd = { ...res.data, id: res.data._id || res.data.id };
      setProducts((prev) => [...prev, newProd]);
      toast.success("Producto agregado correctamente");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error al agregar producto");
    }
  };

  const updateProduct = async (p: Product) => {
    const previousProducts = [...products];
    setProducts((prev) =>
      prev.map((prod) => (prod.id === p.id ? { ...prod, ...p } : prod)),
    );

    const { _id, id, ...rest } = p as any;
    try {
      await api.put(`/api/products/${p.id}`, rest);
    } catch (error: any) {
      setProducts(previousProducts);
      toast.error(
        error.response?.data?.error || "Error al actualizar producto",
      );
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.delete(`/api/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success("Producto eliminado");
    } catch (e) {
      toast.error("Error al eliminar producto");
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        setProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        fetchStoreProducts,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
};

export const useProducts = () => useContext(ProductContext);
