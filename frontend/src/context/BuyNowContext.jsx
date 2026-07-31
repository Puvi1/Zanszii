import { createContext, useContext, useMemo, useState } from "react";

const BuyNowContext = createContext(null);

export function BuyNowProvider({ children }) {
  const [buyNowItem, setBuyNowItem] = useState(() => {
    try {
      const saved = sessionStorage.getItem("zanszii_buy_now_item");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const startBuyNow = (product, quantity = 1) => {
    const item = {
      ...product,
      quantity: Math.max(1, Number(quantity) || 1),
    };

    setBuyNowItem(item);
    sessionStorage.setItem("zanszii_buy_now_item", JSON.stringify(item));
  };

  const clearBuyNow = () => {
    setBuyNowItem(null);
    sessionStorage.removeItem("zanszii_buy_now_item");
  };

  const value = useMemo(
    () => ({
      buyNowItem,
      startBuyNow,
      clearBuyNow,
    }),
    [buyNowItem]
  );

  return (
    <BuyNowContext.Provider value={value}>
      {children}
    </BuyNowContext.Provider>
  );
}

export function useBuyNow() {
  const context = useContext(BuyNowContext);

  if (!context) {
    throw new Error("useBuyNow must be used inside BuyNowProvider");
  }

  return context;
}
