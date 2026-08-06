import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgePercent, Briefcase, CheckCircle, ChevronRight, Edit3, Gift, Home, MapPin, Plus, Star, Tags, Trash2, X } from "lucide-react";
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
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [savingAddress, setSavingAddress] = useState(false);
  const [message, setMessage] = useState("");

  const [availableOffers, setAvailableOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedOffer, setAppliedOffer] = useState(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [showCouponSheet, setShowCouponSheet] = useState(false);

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
          image_url:
            buyNowItem.image_url ||
            buyNowItem.image ||
            (Array.isArray(buyNowItem.images)
              ? buyNowItem.images[0]
              : ""),
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

  const selectedAddress =
    addresses.find(
      (address) => address.address_id === selectedAddressId
    ) || null;

  const appliedDiscount = Number(appliedOffer?.discount || 0);
  const appliedDeliveryCharge = Number(
    appliedOffer?.delivery_charge || 0
  );
  const checkoutTotal = appliedOffer
    ? Number(appliedOffer.total || 0)
    : Number(checkoutSubtotal || 0);
  const totalSavings = Number(appliedOffer?.savings || 0);

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


  const loadAvailableOffers = async () => {
    setOffersLoading(true);

    try {
      const response = await api.get("/offers/available");
      const offers = Array.isArray(response.data?.offers)
        ? response.data.offers
        : [];

      setAvailableOffers(offers);
    } catch {
      setAvailableOffers([]);
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    loadAvailableOffers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const selectAddress = (address) => {
    setSelectedAddressId(address.address_id);
    applyAddress(address);
    setMessage(`${address.label || "Address"} selected.`);
    setError("");
  };

  const openNewAddress = () => {
    setEditingAddressId("");
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

  const editAddress = (address) => {
    setEditingAddressId(address.address_id);
    setNewAddress({
      label: address.label || "Home",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      city: address.city || "",
      state: address.state || "Tamil Nadu",
      postal_code: address.postal_code || "",
      landmark: address.landmark || "",
      is_default: Boolean(address.is_default),
    });
    setShowAddressForm(true);
    setError("");
    setMessage("");
  };

  const closeNewAddress = () => {
    setShowAddressForm(false);
    setEditingAddressId("");
    setNewAddress(EMPTY_ADDRESS);
    setError("");
  };

  const deleteAddress = async (address) => {
    const confirmed = window.confirm(
      `Delete your ${address.label || "saved"} address?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await api.delete(`/addresses/${address.address_id}`);
      setMessage("Address deleted successfully.");
      await loadAddresses();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to delete this address."
        )
      );
    }
  };

  const updateNewAddress = (field, value) => {
    setNewAddress((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveNewAddress = async (event) => {
    event.preventDefault();

    const cleanPhone = newAddress.phone.replace(/\D/g, "");
    const cleanPincode = newAddress.postal_code.replace(/\D/g, "");

    if (newAddress.full_name.trim().length < 2) {
      setError("Please enter the full name.");
      return;
    }

    if (cleanPhone.length !== 10) {
      setError("Mobile number must contain exactly 10 digits.");
      return;
    }

    if (newAddress.address.trim().length < 5) {
      setError("Please enter a complete delivery address.");
      return;
    }

    if (newAddress.city.trim().length < 2) {
      setError("Please enter a valid city.");
      return;
    }

    if (newAddress.state.trim().length < 2) {
      setError("Please enter a valid state.");
      return;
    }

    if (cleanPincode.length < 4) {
      setError("Please enter a valid pincode.");
      return;
    }

    setSavingAddress(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...newAddress,
        full_name: newAddress.full_name.trim(),
        phone: cleanPhone,
        address: newAddress.address.trim(),
        city: newAddress.city.trim(),
        state: newAddress.state.trim(),
        postal_code: cleanPincode,
        landmark: newAddress.landmark.trim(),
      };

      const response = editingAddressId
        ? await api.patch(`/addresses/${editingAddressId}`, payload)
        : await api.post("/addresses", payload);

      const savedAddress = response.data;

      closeNewAddress();
      await loadAddresses();

      if (savedAddress?.address_id) {
        setSelectedAddressId(savedAddress.address_id);
        applyAddress(savedAddress);
      }

      setMessage(
        editingAddressId
          ? "Address updated and selected successfully."
          : "Address saved and selected successfully."
      );
    } catch (requestError) {
      console.error("Address save failed:", requestError);

      setError(
        formatApiError(
          requestError,
          "Unable to save this address. Please verify all fields."
        )
      );
    } finally {
      setSavingAddress(false);
    }
  };


  const validateCoupon = async (code) => {
    const normalizedCode = String(code || "")
      .trim()
      .toUpperCase();

    if (!normalizedCode) {
      setCouponError("Enter a coupon code.");
      return null;
    }

    setCouponApplying(true);
    setCouponError("");
    setMessage("");

    try {
      const response = await api.post("/offers/validate", {
        code: normalizedCode,
        subtotal: Number(checkoutSubtotal || 0),
        delivery_charge: 0,
        items: checkoutItems,
      });

      setCouponCode(normalizedCode);
      setAppliedOffer(response.data);
      setMessage(
        `${response.data.code} applied. You saved ₹${Number(
          response.data.savings || 0
        ).toLocaleString("en-IN")}.`
      );

      return response.data;
    } catch (requestError) {
      setAppliedOffer(null);
      setCouponError(
        formatApiError(
          requestError,
          "Unable to apply this coupon."
        )
      );

      return null;
    } finally {
      setCouponApplying(false);
    }
  };

  const applyCoupon = async () => {
    await validateCoupon(couponCode);
  };

  const applyAvailableOffer = async (offer) => {
    setCouponCode(offer.code || "");
    await validateCoupon(offer.code);
  };

  const removeCoupon = () => {
    setAppliedOffer(null);
    setCouponCode("");
    setCouponError("");
    setMessage("Coupon removed.");
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    setSaving(true);
    setError("");

    try {
      const payload = buyNowItem
        ? {
            ...form,
            coupon_code: appliedOffer?.code || null,
            buy_now_item: {
              product_id: buyNowItem.product_id,
              quantity: Number(buyNowItem.quantity || 1),
            },
          }
        : {
            ...form,
            coupon_code: appliedOffer?.code || null,
          };

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
      <div className="grid gap-5 pb-48 lg:grid-cols-[1.05fr_.95fr] lg:pb-0">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                {buyNowItem ? "Buy Now" : "Checkout"}
              </p>

              <h1 className="mt-0.5 text-xl font-black text-slate-950">
                Complete your order
              </h1>
            </div>

            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black text-[#0F4C9C]">
              Secure checkout
            </span>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
              <CheckCircle size={18} />
              {message}
            </div>
          )}

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Delivery address
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-900">
                  Deliver to
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowAddressPicker(true)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#0F4C9C]"
              >
                Change
              </button>
            </div>

            {loadingAddresses ? (
              <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
            ) : selectedAddress ? (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[#F7FAFF] p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0F4C9C] text-white">
                  {(() => {
                    const Icon =
                      LABEL_ICONS[selectedAddress.label] || MapPin;
                    return <Icon size={19} />;
                  })()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-900">
                      {selectedAddress.full_name}
                    </p>

                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-[#0F4C9C]">
                      {selectedAddress.label || "Address"}
                    </span>

                    {selectedAddress.is_default && (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                    {selectedAddress.address}
                    {selectedAddress.landmark
                      ? `, Near ${selectedAddress.landmark}`
                      : ""}
                    , {selectedAddress.city},{" "}
                    {selectedAddress.state} -{" "}
                    {selectedAddress.postal_code}
                  </p>

                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {selectedAddress.phone}
                  </p>

                  <button
                    type="button"
                    onClick={() => editAddress(selectedAddress)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#0F4C9C]"
                  >
                    <Edit3 size={14} />
                    Edit address
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={openNewAddress}
                className="mt-4 w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center"
              >
                <MapPin
                  size={24}
                  className="mx-auto text-[#0F4C9C]"
                />
                <p className="mt-2 font-black text-slate-900">
                  Add delivery address
                </p>
              </button>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Order items
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-900">
                  {checkoutItems.length} item
                  {checkoutItems.length === 1 ? "" : "s"}
                </h2>
              </div>

              {checkoutItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllItems((current) => !current)}
                  className="text-xs font-black text-[#0F4C9C]"
                >
                  {showAllItems ? "Show less" : "View all"}
                </button>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {(showAllItems
                ? checkoutItems
                : checkoutItems.slice(0, 3)
              ).map((item) => {
                const itemImage =
                  item.image_url ||
                  item.image ||
                  (Array.isArray(item.images)
                    ? item.images[0]
                    : "");

                return (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-3 rounded-2xl bg-slate-50 p-2.5"
                  >
                    <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1">
                      {itemImage ? (
                        <img
                          src={itemImage}
                          alt={item.name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <span className="text-lg font-black text-[#0F4C9C]">
                          {item.name?.charAt(0)?.toUpperCase() ||
                            "Z"}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {item.name}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        Quantity: {item.quantity}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-black text-[#062B5F]">
                      ₹
                      {Number(
                        item.line_total || 0
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>
                );
              })}

              {!showAllItems && checkoutItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllItems(true)}
                  className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-black text-slate-500"
                >
                  +{checkoutItems.length - 3} more item
                  {checkoutItems.length - 3 === 1 ? "" : "s"}
                </button>
              )}
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setShowNotes((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Optional
                </p>

                <h2 className="mt-1 text-lg font-black text-slate-900">
                  Delivery instructions
                </h2>
              </div>

              <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-[#0F4C9C]">
                {showNotes ? "Hide" : "Add note"}
              </span>
            </button>

            {showNotes && (
              <textarea
                value={form.notes}
                onChange={(event) =>
                  updateField("notes", event.target.value)
                }
                className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
                placeholder="Gate code, preferred time or landmark guidance"
              />
            )}
          </section>
        </section>

        <aside className="h-fit rounded-[26px] bg-[#062B5F] p-5 text-white shadow-xl lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-black">Payment summary</h2>

            {buyNowItem && (
              <span className="rounded-full bg-[#F4B400] px-3 py-1 text-xs font-black text-[#062B5F]">
                Buy Now
              </span>
            )}
          </div>

          <div className="mt-4 rounded-2xl bg-white/10 p-3">
            <div className="flex items-center gap-2">
              <BadgePercent
                size={18}
                className="text-[#F4B400]"
              />
              <p className="text-sm font-black">
                Coupon
              </p>
            </div>

            {appliedOffer ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                <div>
                  <p className="text-xs font-black text-white">
                    {appliedOffer.code}
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-100">
                    Saved ₹
                    {Number(
                      appliedOffer.savings || 0
                    ).toLocaleString("en-IN")}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={removeCoupon}
                  className="text-xs font-black text-white"
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div className="mt-3 flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(event) =>
                      setCouponCode(
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="Enter coupon"
                    className="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-xs font-bold uppercase text-white placeholder:text-blue-200 outline-none"
                  />

                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponApplying}
                    className="rounded-xl bg-[#F4B400] px-3 py-2.5 text-xs font-black text-[#062B5F] disabled:opacity-60"
                  >
                    {couponApplying ? "..." : "Apply"}
                  </button>
                </div>

                {couponError && (
                  <p className="mt-2 text-[11px] font-bold text-rose-200">
                    {couponError}
                  </p>
                )}
              </>
            )}

            {!appliedOffer && (
              <div className="mt-3">
                {offersLoading ? (
                  <div className="h-16 animate-pulse rounded-xl bg-white/10" />
                ) : availableOffers.length ? (
                  <>
                    <div className="rounded-xl border border-white/15 bg-white/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
                            Best offer for you
                          </p>
                          <p className="mt-1 truncate text-sm font-black text-white">
                            {availableOffers[0].code}
                          </p>
                          <p className="mt-1 line-clamp-1 text-[11px] text-blue-100">
                            {availableOffers[0].title}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => applyAvailableOffer(availableOffers[0])}
                          disabled={couponApplying}
                          className="shrink-0 rounded-xl bg-[#F4B400] px-3 py-2 text-[11px] font-black text-[#062B5F] disabled:opacity-60"
                        >
                          Apply
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCouponSheet(true)}
                      className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left"
                    >
                      <span className="inline-flex items-center gap-2 text-xs font-black text-blue-100">
                        <Gift size={15} className="text-[#F4B400]" />
                        View all {availableOffers.length} coupons
                      </span>
                      <ChevronRight size={16} className="text-blue-200" />
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-blue-200">
                    No coupons available right now.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between text-blue-100">
              <span>Subtotal</span>
              <span className="font-bold text-white">
                ₹
                {Number(
                  checkoutSubtotal || 0
                ).toLocaleString("en-IN")}
              </span>
            </div>

            {appliedDiscount > 0 && (
              <div className="flex justify-between text-emerald-200">
                <span>Discount</span>
                <span className="font-black">
                  -₹
                  {appliedDiscount.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <div className="flex justify-between text-blue-100">
              <span>Delivery</span>
              <span className="font-bold text-emerald-200">
                {appliedDeliveryCharge > 0
                  ? `₹${appliedDeliveryCharge.toLocaleString(
                      "en-IN"
                    )}`
                  : "FREE"}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between border-t border-white/20 pt-5">
            <div>
              <p className="text-xs text-blue-200">
                Total payable
              </p>
              <p className="mt-1 text-2xl font-black">
                ₹
                {Number(
                  checkoutTotal || checkoutSubtotal || 0
                ).toLocaleString("en-IN")}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-white">
                Cash on Delivery
              </p>
              <p className="mt-1 text-[11px] text-blue-200">
                Pay at doorstep
              </p>
            </div>
          </div>

          {totalSavings > 0 && (
            <div className="mt-3 rounded-xl bg-emerald-400/10 px-3 py-2 text-center text-xs font-black text-emerald-100">
              You saved ₹
              {totalSavings.toLocaleString("en-IN")}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={
              saving ||
              loadingAddresses ||
              !form.delivery_address ||
              !form.city ||
              !form.state ||
              !form.postal_code ||
              !form.phone
            }
            className="mt-5 hidden w-full rounded-2xl bg-[#F4B400] px-5 py-4 font-black text-[#062B5F] transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 lg:block"
          >
            {saving ? "Placing order..." : "Place order"}
          </button>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[76px] z-[70] border-t border-slate-200 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Total
            </p>
            <p className="text-xl font-black text-[#062B5F]">
              ₹
              {Number(
                checkoutTotal || checkoutSubtotal || 0
              ).toLocaleString("en-IN")}
            </p>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={
              saving ||
              loadingAddresses ||
              !form.delivery_address ||
              !form.city ||
              !form.state ||
              !form.postal_code ||
              !form.phone
            }
            className="min-h-12 min-w-[150px] rounded-xl bg-[#F4B400] px-4 text-sm font-black text-[#062B5F] disabled:opacity-60"
          >
            {saving ? "Placing..." : "Place order"}
          </button>
        </div>
      </div>

      {showAddressPicker && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                  Delivery address
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  Select address
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowAddressPicker(false)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {addresses.map((address) => {
                const Icon =
                  LABEL_ICONS[address.label] || MapPin;
                const selected =
                  selectedAddressId === address.address_id;

                return (
                  <button
                    type="button"
                    key={address.address_id}
                    onClick={() => {
                      selectAddress(address);
                      setShowAddressPicker(false);
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-[#0F4C9C] bg-blue-50 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          selected
                            ? "bg-[#0F4C9C] text-white"
                            : "bg-slate-100 text-[#0F4C9C]"
                        }`}
                      >
                        <Icon size={19} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-black text-slate-900">
                            {address.label}
                          </p>

                          {selected && (
                            <CheckCircle
                              size={18}
                              className="text-[#0F4C9C]"
                            />
                          )}
                        </div>

                        <p className="mt-1 text-sm font-bold text-slate-800">
                          {address.full_name}
                        </p>

                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                          {address.address}, {address.city} -{" "}
                          {address.postal_code}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAddressPicker(false);
                openNewAddress();
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-4 py-3 font-black text-white"
            >
              <Plus size={17} />
              Add new address
            </button>
          </div>
        </div>
      )}

      {showCouponSheet && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-5">
          <button
            type="button"
            aria-label="Close coupons"
            className="absolute inset-0"
            onClick={() => setShowCouponSheet(false)}
          />

          <section className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-hidden rounded-t-[30px] bg-white shadow-2xl sm:rounded-[30px]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                  Exclusive savings
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Choose a coupon
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowCouponSheet(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {availableOffers.map((offer, index) => (
                <article
                  key={offer.offer_id || offer.code}
                  className={`relative overflow-hidden rounded-[22px] border p-4 ${
                    index === 0
                      ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {index === 0 && (
                          <span className="rounded-full bg-[#F4B400] px-2 py-1 text-[9px] font-black text-[#062B5F]">
                            BEST OFFER
                          </span>
                        )}
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-[#0F4C9C]">
                          {offer.code}
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-black text-slate-950">
                        {offer.title}
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        {offer.description || "Special ZANSZI coupon"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                        {Number(offer.minimum_order_value || 0) > 0 && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1.5">
                            Min. order ₹{Number(offer.minimum_order_value).toLocaleString("en-IN")}
                          </span>
                        )}
                        {offer.expires_at && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1.5">
                            Limited time
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await applyAvailableOffer(offer);
                        setShowCouponSheet(false);
                      }}
                      disabled={couponApplying}
                      className="shrink-0 rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-xs font-black text-white disabled:opacity-60"
                    >
                      Apply
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {showAddressForm && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5">
          <form
            onSubmit={saveNewAddress}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                  {editingAddressId ? "Edit address" : "New address"}
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  {editingAddressId
                    ? "Update delivery address"
                    : "Add delivery address"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeNewAddress}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

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
                ? editingAddressId
                  ? "Updating address..."
                  : "Saving address..."
                : editingAddressId
                  ? "Update and Use Address"
                  : "Save and Use Address"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
