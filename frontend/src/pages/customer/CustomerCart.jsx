import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Heart,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Trash,
  Truck,
} from "@phosphor-icons/react";

import { useCart } from "../../context/CartContext";
import { useBuyNow } from "../../context/BuyNowContext";

const FALLBACK =
  "https://placehold.co/500x500/F4F8FC/0F4C9C?text=ZANSZI";

const WISHLIST_STORAGE_KEY = "zanszii_wishlist";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function readWishlist() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

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

  const [updatingId, setUpdatingId] = useState("");
  const [removingId, setRemovingId] = useState("");
  const [message, setMessage] = useState("");
  const [wishlistIds, setWishlistIds] = useState(readWishlist);

  useEffect(() => {
    clearBuyNow();
  }, [clearBuyNow]);

  const safeItems = Array.isArray(items) ? items : [];
  const safeSubtotal = Number(subtotal || 0);
  const safeItemCount = Number(itemCount || 0);

  const savings = useMemo(
    () =>
      safeItems.reduce((total, item) => {
        const unitPrice = Number(item.price || 0);
        const originalPrice = Number(
          item.mrp ||
            item.original_price ||
            item.price ||
            0
        );
        const quantity = Number(item.quantity || 0);

        return total + Math.max(0, originalPrice - unitPrice) * quantity;
      }, 0),
    [safeItems]
  );

  const deliveryFee = 0;
  const total = safeSubtotal + deliveryFee;

  const changeQuantity = async (item, nextQuantity) => {
    if (!item?.product_id || nextQuantity < 1) return;

    setUpdatingId(item.product_id);
    setMessage("");

    try {
      await updateQuantity(item.product_id, nextQuantity);
    } catch (error) {
      setMessage(
        error?.message || "Unable to update this quantity."
      );
    } finally {
      setUpdatingId("");
    }
  };

  const remove = async (item) => {
    if (!item?.product_id) return;

    setRemovingId(item.product_id);
    setMessage("");

    try {
      await removeItem(item.product_id);
      setMessage(`${item.name} removed from your cart.`);
    } catch (error) {
      setMessage(
        error?.message || "Unable to remove this product."
      );
    } finally {
      setRemovingId("");
    }
  };

  const saveForLater = async (item) => {
    if (!item?.product_id) return;

    const nextWishlist = wishlistIds.includes(item.product_id)
      ? wishlistIds
      : [...wishlistIds, item.product_id];

    setWishlistIds(nextWishlist);
    localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify(nextWishlist)
    );

    try {
      await removeItem(item.product_id);
      setMessage(`${item.name} saved to your wishlist.`);
    } catch (error) {
      setMessage(
        error?.message || "Unable to save this product for later."
      );
    }
  };

  const clearAll = async () => {
    setMessage("");

    try {
      await clearCart();
      setMessage("Your cart has been cleared.");
    } catch (error) {
      setMessage(error?.message || "Unable to clear your cart.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-28">
        <div className="h-28 animate-pulse rounded-[26px] bg-slate-200" />

        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[24px] border border-slate-200 bg-white p-4"
          >
            <div className="grid grid-cols-[110px_1fr] gap-4">
              <div className="aspect-square animate-pulse rounded-2xl bg-slate-200" />

              <div className="space-y-3">
                <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!safeItems.length) {
    return (
      <section className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#0F4C9C]">
          <ShoppingCart size={38} weight="duotone" />
        </span>

        <h1 className="mt-5 text-2xl font-black text-slate-900 sm:text-3xl">
          Your cart is empty
        </h1>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          Add your favourite ZANSZI cleaning products and they will
          appear here.
        </p>

        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0F4C9C] px-6 py-3 text-sm font-black text-white transition hover:bg-[#0B3D80]"
        >
          Browse products
          <ArrowRight size={17} weight="bold" />
        </Link>
      </section>
    );
  }

  return (
    <div className="pb-32 lg:pb-8">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_.7fr]">
        <section className="min-w-0 space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                Your basket
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                Shopping Cart
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {safeItemCount}{" "}
                {safeItemCount === 1 ? "item" : "items"} ready for checkout
              </p>
            </div>

            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 text-xs font-black text-rose-600 transition hover:text-rose-700 sm:text-sm"
            >
              Clear cart
            </button>
          </div>

          {message && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0F4C9C]">
              {message}
            </div>
          )}

          <div className="rounded-[24px] border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                <Truck size={21} weight="duotone" />
              </span>

              <div>
                <p className="text-sm font-black text-emerald-800">
                  Free doorstep delivery
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  Estimated delivery within 2–3 working days
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {safeItems.map((item) => {
              const productId = item.product_id;
              const image =
                item.image_url ||
                item.images?.[0] ||
                FALLBACK;

              const quantity = Number(item.quantity || 1);
              const stock = Number(item.stock || 0);
              const price = Number(item.price || 0);
              const lineTotal = Number(
                item.line_total || price * quantity
              );

              const originalPrice = Number(
                item.mrp ||
                  item.original_price ||
                  item.price ||
                  0
              );

              const hasDiscount = originalPrice > price;
              const isUpdating = updatingId === productId;
              const isRemoving = removingId === productId;
              const atStockLimit = stock > 0 && quantity >= stock;

              return (
                <article
                  key={productId}
                  className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="grid grid-cols-[108px_1fr] gap-3 sm:grid-cols-[130px_1fr] sm:gap-5">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/products/${productId}`)
                      }
                      className="relative aspect-square overflow-hidden rounded-2xl bg-[#F4F8FC] p-2"
                    >
                      <img
                        src={image}
                        alt={item.name}
                        className="h-full w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.src = FALLBACK;
                        }}
                      />

                      {hasDiscount && (
                        <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2 py-1 text-[9px] font-black text-white">
                          SAVE
                        </span>
                      )}
                    </button>

                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/products/${productId}`)
                        }
                        className="block w-full text-left"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#0F4C9C]">
                          {item.category?.name ||
                            item.category_name ||
                            "ZANSZI Care"}
                        </p>

                        <h2 className="mt-1 line-clamp-2 text-sm font-black leading-5 text-slate-900 sm:text-base">
                          {item.name}
                        </h2>
                      </button>

                      <p className="mt-1 text-xs text-slate-500">
                        {money(price)} / {item.unit || "piece"}
                      </p>

                      <div className="mt-2 flex flex-wrap items-baseline gap-2">
                        <p className="text-lg font-black text-[#062B5F] sm:text-xl">
                          {money(lineTotal)}
                        </p>

                        {hasDiscount && (
                          <p className="text-xs text-slate-400 line-through">
                            {money(originalPrice * quantity)}
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                        <CheckCircle size={15} weight="fill" />
                        {stock > 0 ? "In stock" : "Stock unavailable"}
                      </div>

                      <p className="mt-1 text-[11px] text-slate-500">
                        Delivery in 2–3 working days
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <div className="inline-flex h-10 items-center overflow-hidden rounded-xl border-2 border-[#F4B400] bg-white">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        disabled={isUpdating || quantity <= 1}
                        onClick={() =>
                          changeQuantity(item, quantity - 1)
                        }
                        className="grid h-full w-10 place-items-center text-[#062B5F] transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Minus size={16} weight="bold" />
                      </button>

                      <span className="grid h-full min-w-10 place-items-center border-x border-amber-200 px-2 text-sm font-black text-slate-900">
                        {isUpdating ? "…" : quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        disabled={isUpdating || atStockLimit}
                        onClick={() =>
                          changeQuantity(item, quantity + 1)
                        }
                        className="grid h-full w-10 place-items-center text-[#062B5F] transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Plus size={16} weight="bold" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isRemoving}
                      onClick={() => remove(item)}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash size={16} />
                      {isRemoving ? "Removing..." : "Remove"}
                    </button>

                    <button
                      type="button"
                      onClick={() => saveForLater(item)}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-[#0F4C9C] transition hover:bg-blue-50"
                    >
                      <Heart size={16} />
                      Save for later
                    </button>
                  </div>

                  {atStockLimit && stock > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-amber-700">
                      Maximum available quantity: {stock}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-sm font-black text-[#0F4C9C]"
          >
            Continue shopping
            <ArrowRight size={16} weight="bold" />
          </Link>
        </section>

        <aside className="hidden h-fit rounded-[26px] border border-slate-200 bg-white p-5 shadow-lg lg:sticky lg:top-24 lg:block">
          <h2 className="text-xl font-black text-slate-900">
            Order Summary
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal ({safeItemCount} items)</span>
              <strong className="text-slate-900">
                {money(safeSubtotal)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Delivery</span>
              <strong className="text-emerald-600">FREE</strong>
            </div>

            {savings > 0 && (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Your savings</span>
                <strong>{money(savings)}</strong>
              </div>
            )}
          </div>

          <div className="mt-5 flex items-end justify-between border-y border-slate-200 py-5">
            <span className="font-black text-slate-900">Total</span>
            <span className="text-2xl font-black text-[#062B5F]">
              {money(total)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/checkout")}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-4 font-black text-[#062B5F] transition hover:bg-[#E5A800]"
          >
            Proceed to Checkout
            <ArrowRight size={18} weight="bold" />
          </button>

          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-[#F5F9FF] p-3">
            <ShieldCheck
              size={20}
              weight="duotone"
              className="mt-0.5 shrink-0 text-[#0F4C9C]"
            />

            <p className="text-xs leading-5 text-slate-600">
              Your order information is protected with secure checkout.
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[73px] z-40 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-12px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-slate-500">
              Subtotal ({safeItemCount} items)
            </p>

            <p className="truncate text-xl font-black text-[#062B5F]">
              {money(total)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/checkout")}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-3.5 text-sm font-black text-[#062B5F] shadow-sm transition active:scale-[0.98]"
          >
            Checkout
            <ArrowRight size={17} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
