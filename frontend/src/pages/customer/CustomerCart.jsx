import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Minus,
  Plus,
  Trash,
  ShoppingCart,
  ArrowRight,
} from "@phosphor-icons/react";

import { useCart } from "../../context/CartContext";
import { useBuyNow } from "../../context/BuyNowContext";

export default function CustomerCart() {
  const navigate = useNavigate();

  const {
    items,
    subtotal,
    itemCount,
    updateQuantity,
    removeItem,
    clearCart,
    loading,
  } = useCart();

  const { clearBuyNow } = useBuyNow();

  // Clear Buy Now session whenever Cart page opens
  useEffect(() => {
    clearBuyNow();
  }, []);

  if (loading) {
    return <div className="py-20 text-center">Loading cart...</div>;
  }

  if (!items.length) {
    return (
      <div className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <ShoppingCart
          size={52}
          className="mx-auto text-[#0F4C9C]"
        />

        <h1 className="mt-4 text-3xl font-black">
          Your cart is empty
        </h1>

        <Link
          to="/products"
          className="mt-6 inline-flex rounded-2xl bg-[#0F4C9C] px-6 py-3 font-bold text-white"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.45fr_.75fr]">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[#0F4C9C]">
              Shopping cart
            </p>

            <h1 className="text-3xl font-black">
              Review your items
            </h1>
          </div>

          <button
            onClick={clearCart}
            className="text-sm font-bold text-red-600"
          >
            Clear cart
          </button>
        </div>

        {items.map((item) => (
          <article
            key={item.product_id}
            className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[90px_1fr_auto] sm:items-center"
          >
            <img
              src={
                item.image_url ||
                "https://placehold.co/300x300/F5F9FF/0F4C9C?text=Z"
              }
              alt={item.name}
              className="h-24 w-full rounded-2xl object-cover sm:w-24"
            />

            <div>
              <h2 className="font-black">{item.name}</h2>

              <p className="text-sm text-slate-500">
                ₹{Number(item.price).toLocaleString("en-IN")} /{" "}
                {item.unit}
              </p>

              <p className="mt-1 text-sm font-bold text-[#062B5F]">
                ₹{Number(item.line_total).toLocaleString("en-IN")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  updateQuantity(
                    item.product_id,
                    item.quantity - 1
                  )
                }
                className="grid h-9 w-9 place-items-center rounded-xl border"
              >
                <Minus />
              </button>

              <b>{item.quantity}</b>

              <button
                disabled={item.quantity >= item.stock}
                onClick={() =>
                  updateQuantity(
                    item.product_id,
                    item.quantity + 1
                  )
                }
                className="grid h-9 w-9 place-items-center rounded-xl bg-[#0F4C9C] text-white disabled:opacity-40"
              >
                <Plus />
              </button>

              <button
                onClick={() =>
                  removeItem(item.product_id)
                }
                className="grid h-9 w-9 place-items-center rounded-xl text-red-600"
              >
                <Trash />
              </button>
            </div>
          </article>
        ))}
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-lg lg:sticky lg:top-6">
        <h2 className="text-xl font-black">
          Order summary
        </h2>

        <div className="mt-5 flex justify-between border-y py-5">
          <span>{itemCount} items</span>

          <b>
            ₹{subtotal.toLocaleString("en-IN")}
          </b>
        </div>

        <div className="mt-5 flex justify-between text-2xl font-black">
          <span>Total</span>

          <span>
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        </div>

        <button
          onClick={() => navigate("/checkout")}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-4 font-black text-[#062B5F]"
        >
          Proceed to checkout
          <ArrowRight />
        </button>

        <Link
          to="/products"
          className="mt-3 block text-center text-sm font-bold text-[#0F4C9C]"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
