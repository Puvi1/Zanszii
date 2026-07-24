import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0, total_items: 0 });
  const [loading, setLoading] = useState(false);

  const loadCart = useCallback(async () => {
    if (!user) {
      setCart({ items: [], subtotal: 0, total_items: 0 });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/cart");
      setCart(data);
    } catch {
      setCart({ items: [], subtotal: 0, total_items: 0 });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadCart(); }, [loadCart]);

  const addItem = async (product, quantity = 1) => {
    try {
      const { data } = await api.post("/cart/items", {
        product_id: product.product_id,
        quantity,
      });
      setCart(data);
      return data;
    } catch (error) {
      throw new Error(formatApiError(error?.response?.data?.detail));
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) return removeItem(productId);
    try {
      const { data } = await api.put(`/cart/items/${productId}`, {
        product_id: productId,
        quantity,
      });
      setCart(data);
      return data;
    } catch (error) {
      throw new Error(formatApiError(error?.response?.data?.detail));
    }
  };

  const removeItem = async (productId) => {
    const { data } = await api.delete(`/cart/items/${productId}`);
    setCart(data);
    return data;
  };

  const clearCart = async () => {
    await api.delete("/cart");
    setCart({ items: [], subtotal: 0, total_items: 0 });
  };

  const value = useMemo(() => ({
    items: cart.items || [],
    subtotal: Number(cart.subtotal || 0),
    itemCount: Number(cart.total_items || 0),
    loading,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    reloadCart: loadCart,
  }), [cart, loading, loadCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
