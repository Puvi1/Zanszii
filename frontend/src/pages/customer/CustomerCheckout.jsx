import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle, Home, MapPin, Plus, Star, X } from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useBuyNow } from "../../context/BuyNowContext";


const EMPTY_ADDRESS = {
  label: "Home",
  full_name: "",
  phone: "",
  address: "",
  city: "",
  state: "Tamil Nadu",
  postal_code: "",
  landmark: "",
  is_default: false,
};

const LABEL_ICONS = {
  Home,
  Office: Briefcase,
  Other: MapPin,
};

export default function CustomerCheckout() {
  const { user } = useAuth();
  const { items, subtotal, reloadCart } = useCart();
  const { buyNowItem, clearBuyNow } = useBuyNow();
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [message, setMessage] = useState("");

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

  const applyAddress = (address) => {
    if (!address) return;

    const fullAddress = [
      address.address,
      address.landmark ? `Near ${address.landmark}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    setForm((current) => ({
      ...current,
      delivery_address: fullAddress,
      city: address.city || "",
      state: address.state || "Tamil Nadu",
      postal_code: address.postal_code || "",
      phone: address.phone || "",
    }));
  };

  const loadAddresses = async () => {
    setLoadingAddresses(true);

    try {
      const response = await api.get("/addresses");
      const list = Array.isArray(response.data) ? response.data : [];
      setAddresses(list);

      if (list.length) {
        const defaultAddress =
          list.find((address) => address.is_default) || list[0];

        setSelectedAddressId(defaultAddress.address_id);
        applyAddress(defaultAddress);
      } else {
        setSelectedAddressId("");
        setForm((current) => ({
          ...current,
          delivery_address: user?.address || "",
          city: user?.city || "",
          state: user?.state || "Tamil Nadu",
          postal_code: user?.postal_code || "",
          phone: user?.phone || "",
        }));
      }
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to load saved addresses."
        )
      );
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectAddress = (address) => {
    setSelectedAddressId(address.address_id);
    applyAddress(address);
    setMessage(`${address.label || "Address"} selected.`);
    setError("");
  };

  const openNewAddress = () => {
    setNewAddress({
      ...EMPTY_ADDRESS,
      full_name: user?.name || "",
      phone: user?.phone || "",
      is_default: addresses.length === 0,
    });
    setShowAddressForm(true);
    setError("");
    setMessage("");
  };

  const updateNewAddress = (field, value) => {
    setNewAddress((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveNewAddress = async (event) => {
    event.preventDefault();
    setSavingAddress(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...newAddress,
        phone: newAddress.phone.replace(/\D/g, ""),
        postal_code: newAddress.postal_code.replace(/\D/g, ""),
      };

      const response = await api.post("/addresses", payload);
      const createdAddress = response.data;

      await loadAddresses();

      if (createdAddress?.address_id) {
        setSelectedAddressId(createdAddress.address_id);
        applyAddress(createdAddress);
      }

      setMessage("Address saved and selected.");
      setShowAddressForm(false);
      setNewAddress(EMPTY_ADDRESS);
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to save this address."
        )
      );
    } finally {
      setSavingAddress(false);
    }
  };

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
    <>
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

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-slate-900">
              Select saved address
            </h2>

            <button
              type="button"
              onClick={openNewAddress}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4B400] px-3 py-2 text-xs font-black text-[#062B5F]"
            >
              <Plus size={16} />
              Add Address
            </button>
          </div>

          {message && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
              <CheckCircle size={18} />
              {message}
            </div>
          )}

          {loadingAddresses ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-2xl bg-slate-200"
                />
              ))}
            </div>
          ) : addresses.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {addresses.map((address) => {
                const Icon = LABEL_ICONS[address.label] || MapPin;
                const selected =
                  selectedAddressId === address.address_id;

                return (
                  <button
                    key={address.address_id}
                    type="button"
                    onClick={() => selectAddress(address)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-[#0F4C9C] bg-blue-50 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-xl ${
                          selected
                            ? "bg-[#0F4C9C] text-white"
                            : "bg-slate-100 text-[#0F4C9C]"
                        }`}
                      >
                        <Icon size={20} />
                      </span>

                      <div className="flex items-center gap-2">
                        {address.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                            <Star size={12} fill="currentColor" />
                            Default
                          </span>
                        )}

                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border-2 ${
                            selected
                              ? "border-[#0F4C9C]"
                              : "border-slate-300"
                          }`}
                        >
                          {selected && (
                            <span className="h-2.5 w-2.5 rounded-full bg-[#0F4C9C]" />
                          )}
                        </span>
                      </div>
                    </div>

                    <h3 className="mt-3 font-black text-slate-900">
                      {address.label || "Address"}
                    </h3>

                    <p className="mt-1 text-sm font-bold text-slate-800">
                      {address.full_name}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {address.address}
                      {address.landmark
                        ? `, Near ${address.landmark}`
                        : ""}
                      <br />
                      {address.city}, {address.state} -{" "}
                      {address.postal_code}
                    </p>

                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Phone: {address.phone}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={openNewAddress}
              className="mt-4 w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
            >
              <MapPin
                size={28}
                className="mx-auto text-[#0F4C9C]"
              />
              <p className="mt-2 font-black text-slate-900">
                Add your delivery address
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Save it once and select it during checkout.
              </p>
            </button>
          )}
        </div>

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
          disabled={
            saving ||
            loadingAddresses ||
            !form.delivery_address ||
            !form.city ||
            !form.state ||
            !form.postal_code ||
            !form.phone
          }
          className="mt-5 w-full rounded-2xl bg-[#F4B400] px-5 py-4 font-black text-[#062B5F] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Placing order..." : "Place order"}
        </button>
      </aside>
    </form>

      {showAddressForm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5">
          <form
            onSubmit={saveNewAddress}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                  New address
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  Add delivery address
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowAddressForm(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-black text-slate-800">
                  Address type
                </span>
                <select
                  value={newAddress.label}
                  onChange={(event) =>
                    updateNewAddress("label", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                >
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Full name
                </span>
                <input
                  required
                  value={newAddress.full_name}
                  onChange={(event) =>
                    updateNewAddress("full_name", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Mobile number
                </span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={10}
                  value={newAddress.phone}
                  onChange={(event) =>
                    updateNewAddress(
                      "phone",
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Pincode
                </span>
                <input
                  required
                  inputMode="numeric"
                  maxLength={12}
                  value={newAddress.postal_code}
                  onChange={(event) =>
                    updateNewAddress(
                      "postal_code",
                      event.target.value.replace(/\D/g, "")
                    )
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-sm font-black text-slate-800">
                  Full address
                </span>
                <textarea
                  required
                  value={newAddress.address}
                  onChange={(event) =>
                    updateNewAddress("address", event.target.value)
                  }
                  placeholder="Door number, street and area"
                  className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Landmark
                </span>
                <input
                  value={newAddress.landmark}
                  onChange={(event) =>
                    updateNewAddress("landmark", event.target.value)
                  }
                  placeholder="Optional"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  City
                </span>
                <input
                  required
                  value={newAddress.city}
                  onChange={(event) =>
                    updateNewAddress("city", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  State
                </span>
                <input
                  required
                  value={newAddress.state}
                  onChange={(event) =>
                    updateNewAddress("state", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={newAddress.is_default}
                  onChange={(event) =>
                    updateNewAddress(
                      "is_default",
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-black text-slate-800">
                  Set as default address
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={savingAddress}
              className="mt-6 w-full rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white disabled:opacity-60"
            >
              {savingAddress
                ? "Saving address..."
                : "Save and Use Address"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
