import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useBuyNow } from "../../context/BuyNowContext";

export default function CustomerCheckout() {
  const { user } = useAuth();
  const { items, subtotal, reloadCart } = useCart();
  const { buyNowItem, clearBuyNow } = useBuyNow();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    delivery_address: "",
    city: "",
    state: "Tamil Nadu",
    postal_code: "",
    phone: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const checkoutItems = buyNowItem
    ? [
        {
          product_id: buyNowItem.product_id,
          name: buyNowItem.name,
          quantity: buyNowItem.quantity,
          line_total:
            Number(buyNowItem.price || 0) *
            Number(buyNowItem.quantity || 1),
        },
      ]
    : items;

  const checkoutSubtotal = buyNowItem
    ? Number(buyNowItem.price || 0) *
      Number(buyNowItem.quantity || 1)
    : Number(subtotal || 0);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      delivery_address: user?.address || "",
      city: user?.city || "",
      state: user?.state || "Tamil Nadu",
      postal_code: user?.postal_code || "",
      phone: user?.phone || "",
    }));
  }, [user]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = buyNowItem
        ? {
            ...form,
            buy_now_item: {
              product_id: buyNowItem.product_id,
              quantity: Number(buyNowItem.quantity || 1),
            },
          }
        : form;

      const { data } = await api.post("/orders", payload);

      if (buyNowItem) {
        clearBuyNow();
      } else {
        await reloadCart();
      }

      navigate(`/order-success/${data.order_id}`, {
        state: { order: data },
      });
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to place your order. Please try again."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (!checkoutItems.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-black text-slate-900">
          Your cart is empty
        </h1>
        <p className="mt-2 text-slate-500">
          Add a product before continuing to checkout.
        </p>
        <button
          type="button"
          onClick={() => navigate("/products")}
          className="mt-5 rounded-2xl bg-[#0F4C9C] px-5 py-3 font-bold text-white"
        >
          Browse products
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-6 pb-24 lg:grid-cols-[1.2fr_.8fr] lg:pb-0"
    >
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#0F4C9C]">
          {buyNowItem ? "Buy Now Checkout" : "Checkout"}
        </p>

        <h1 className="mt-1 text-3xl font-black text-slate-950">
          Delivery details
        </h1>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-3 font-semibold text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-slate-800">
              Full address
            </span>
            <textarea
              required
              value={form.delivery_address}
              onChange={(event) =>
                updateField("delivery_address", event.target.value)
              }
              className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
              placeholder="Door number, street, area and landmark"
            />
          </label>

          <label>
            <span className="text-sm font-bold text-slate-800">City</span>
            <input
              required
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label>
            <span className="text-sm font-bold text-slate-800">State</span>
            <input
              required
              value={form.state}
              onChange={(event) => updateField("state", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label>
            <span className="text-sm font-bold text-slate-800">Pincode</span>
            <input
              required
              inputMode="numeric"
              maxLength={12}
              value={form.postal_code}
              onChange={(event) =>
                updateField(
                  "postal_code",
                  event.target.value.replace(/\D/g, "")
                )
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label>
            <span className="text-sm font-bold text-slate-800">
              Mobile number
            </span>
            <input
              required
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(event) =>
                updateField("phone", event.target.value.replace(/\D/g, ""))
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-sm font-bold text-slate-800">
              Order notes (optional)
            </span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
              placeholder="Any delivery instructions"
            />
          </label>
        </div>
      </section>

      <aside className="h-fit rounded-3xl bg-[#062B5F] p-6 text-white shadow-xl lg:sticky lg:top-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Order summary</h2>
          {buyNowItem && (
            <span className="rounded-full bg-[#F4B400] px-3 py-1 text-xs font-black text-[#062B5F]">
              Buy Now
            </span>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {checkoutItems.map((item) => (
            <div
              key={item.product_id}
              className="flex items-start justify-between gap-4 text-sm text-blue-100"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-white">
                  {item.name}
                </span>
                <span>Quantity: {item.quantity}</span>
              </span>

              <b className="shrink-0 text-white">
                ₹{Number(item.line_total || 0).toLocaleString("en-IN")}
              </b>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-between border-t border-white/20 pt-5 text-2xl font-black">
          <span>Total</span>
          <span>
            ₹{Number(checkoutSubtotal || 0).toLocaleString("en-IN")}
          </span>
        </div>

        <div className="mt-5 rounded-2xl bg-white/10 p-4">
          <p className="font-bold">Cash on Delivery</p>
          <p className="mt-1 text-sm text-blue-100">
            Pay when your order is delivered.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 w-full rounded-2xl bg-[#F4B400] px-5 py-4 font-black text-[#062B5F] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Placing order..." : "Place order"}
        </button>
      </aside>
    </form>
  );
}
