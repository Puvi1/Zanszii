import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarBlank,
  ChevronRight,
  ClipboardList,
  Gift,
  Heart,
  IndianRupee,
  LogOut,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Trophy,
  User,
  WalletCards,
  X,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const WISHLIST_STORAGE_KEY = "zanszii_wishlist";
const RECENTLY_VIEWED_STORAGE_KEY =
  "zanszii_recently_viewed";

const FALLBACK =
  "https://placehold.co/700x700/F5F9FF/0F4C9C?text=ZANSZI";

const ACCOUNT_LINKS = [
  {
    to: "/orders",
    title: "My Orders",
    subtitle: "Track, review and reorder",
    icon: ClipboardList,
    tone: "bg-blue-50 text-blue-700",
  },
  {
    to: "/wishlist",
    title: "Wishlist",
    subtitle: "Products you saved",
    icon: Heart,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    to: "/addresses",
    title: "Saved Addresses",
    subtitle: "Manage delivery locations",
    icon: MapPin,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/offers",
    title: "Offers & Coupons",
    subtitle: "View available savings",
    icon: Tag,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    to: "/notifications",
    title: "Notifications",
    subtitle: "Order and delivery updates",
    icon: Bell,
    tone: "bg-purple-50 text-purple-700",
  },
];

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function readList(key) {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || "[]"
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function orderTone(status) {
  const tones = {
    placed: "bg-amber-50 text-amber-700",
    confirmed: "bg-blue-50 text-blue-700",
    processing: "bg-violet-50 text-violet-700",
    assigned: "bg-cyan-50 text-cyan-700",
    out_for_delivery: "bg-orange-50 text-orange-700",
    delivered: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-rose-50 text-rose-700",
  };

  return (
    tones[status] ||
    "bg-slate-100 text-slate-600"
  );
}

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

export default function CustomerProfile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDashboard, setLoadingDashboard] =
    useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);

  const [wishlistIds] = useState(() =>
    readList(WISHLIST_STORAGE_KEY)
  );

  const [recentlyViewed] = useState(() =>
    readList(RECENTLY_VIEWED_STORAGE_KEY)
  );

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      address:
        typeof user?.address === "string"
          ? user.address
          : "",
      city: user?.city || "",
      state: user?.state || "",
      postal_code: user?.postal_code || "",
    });
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoadingDashboard(true);
      setError("");

      try {
        const [
          ordersResponse,
          addressesResponse,
          offersResponse,
          productsResponse,
        ] = await Promise.all([
          api
            .get("/orders/my")
            .catch(() => ({ data: [] })),
          api
            .get("/addresses")
            .catch(() => ({ data: [] })),
          api
            .get("/offers")
            .catch(() => ({ data: [] })),
          api
            .get("/products")
            .catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        setOrders(
          Array.isArray(ordersResponse.data)
            ? ordersResponse.data
            : []
        );

        setAddresses(
          Array.isArray(addressesResponse.data)
            ? addressesResponse.data
            : []
        );

        const offerData = offersResponse.data;
        setOffers(
          Array.isArray(offerData)
            ? offerData
            : Array.isArray(offerData?.offers)
              ? offerData.offers
              : []
        );

        setProducts(
          Array.isArray(productsResponse.data)
            ? productsResponse.data
            : []
        );
      } catch (requestError) {
        if (!active) return;

        setError(
          formatApiError(
            requestError,
            "Unable to load your account dashboard."
          )
        );
      } finally {
        if (active) {
          setLoadingDashboard(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]:
        field === "phone" ||
        field === "postal_code"
          ? value.replace(/\D/g, "")
          : value,
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (form.phone && form.phone.length !== 10) {
      setError(
        "Mobile number must contain exactly 10 digits."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api.patch("/profile", {
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
      });

      await refreshUser();
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to update your profile."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const initials = (user?.name || "Z")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const totalSpent = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.status !== "cancelled"
        )
        .reduce(
          (sum, order) =>
            sum + Number(order.total || 0),
          0
        ),
    [orders]
  );

  const lifetimeSavings = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.savings ??
              order.discount ??
              0
          ),
        0
      ),
    [orders]
  );

  const deliveredOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "delivered"
      ),
    [orders]
  );

  const recentOrders = useMemo(
    () => orders.slice(0, 5),
    [orders]
  );

  const activeOffers = useMemo(
    () =>
      offers
        .filter((offer) => {
          if (offer.active === false) return false;

          if (!offer.expires_at) return true;

          const expiry = new Date(
            offer.expires_at
          );

          return (
            Number.isNaN(expiry.getTime()) ||
            expiry >= new Date()
          );
        })
        .slice(0, 4),
    [offers]
  );

  const recentlyViewedProducts = useMemo(
    () =>
      recentlyViewed
        .map((stored) => {
          const latest = products.find(
            (product) =>
              product.product_id ===
              stored.product_id
          );

          return latest || stored;
        })
        .filter(Boolean)
        .slice(0, 8),
    [recentlyViewed, products]
  );

  const recommendedProducts = useMemo(() => {
    const viewedCategoryIds = new Set(
      recentlyViewedProducts
        .map(
          (product) => product.category_id
        )
        .filter(Boolean)
    );

    const viewedIds = new Set(
      recentlyViewedProducts.map(
        (product) => product.product_id
      )
    );

    return products
      .filter(
        (product) =>
          Number(product.stock) > 0 &&
          !viewedIds.has(product.product_id)
      )
      .sort((first, second) => {
        const firstScore =
          (first.featured ? 2 : 0) +
          (viewedCategoryIds.has(
            first.category_id
          )
            ? 2
            : 0);

        const secondScore =
          (second.featured ? 2 : 0) +
          (viewedCategoryIds.has(
            second.category_id
          )
            ? 2
            : 0);

        return secondScore - firstScore;
      })
      .slice(0, 6);
  }, [products, recentlyViewedProducts]);

  const profileFields = [
    user?.name,
    user?.email,
    user?.phone,
    user?.city,
    user?.state,
    user?.postal_code,
  ];

  const completedFields =
    profileFields.filter(Boolean).length;

  const completion = Math.round(
    (completedFields / profileFields.length) * 100
  );

  const memberSince =
    user?.created_at
      ? formatDate(user.created_at)
      : "Recently joined";

  const stats = [
    {
      title: "Orders",
      value: orders.length,
      icon: ShoppingBag,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      title: "Total spent",
      value: money(totalSpent),
      icon: IndianRupee,
      tone: "bg-indigo-50 text-indigo-700",
    },
    {
      title: "Savings",
      value: money(lifetimeSavings),
      icon: WalletCards,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Wishlist",
      value: wishlistIds.length,
      icon: Heart,
      tone: "bg-rose-50 text-rose-600",
    },
    {
      title: "Addresses",
      value: addresses.length,
      icon: MapPin,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      title: "Coupons",
      value: activeOffers.length,
      icon: Tag,
      tone: "bg-purple-50 text-purple-700",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#041F46] via-[#062B5F] to-[#0F4C9C] p-6 text-white shadow-[0_24px_70px_rgba(6,43,95,0.28)] sm:p-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[26px] border border-white/20 bg-white/15 text-2xl font-black backdrop-blur">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                {getGreeting()}
              </p>

              <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                {user?.name || "Customer"}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-blue-100">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <CalendarBlank size={14} />
                  Member since {memberSince}
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-[#062B5F]">
                  <Trophy size={14} />
                  ZANSZI Member
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] lg:min-w-[360px]">
            <div className="rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-blue-100">
                    Profile completion
                  </p>
                  <p className="mt-1 text-2xl font-black">
                    {completion}%
                  </p>
                </div>

                <ShieldCheck
                  size={28}
                  className="text-emerald-300"
                />
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-emerald-300 transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError("");
                setMessage("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-white px-5 py-4 text-sm font-black text-[#062B5F]"
            >
              <Pencil size={17} />
              Edit Profile
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      {error && !editing && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map(
          ({ title, value, icon: Icon, tone }) => (
            <div
              key={title}
              className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span
                className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}
              >
                <Icon size={19} />
              </span>

              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                {title}
              </p>

              <strong className="mt-1 block text-xl font-black text-slate-950">
                {loadingDashboard ? "—" : value}
              </strong>
            </div>
          )
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                Recent activity
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Recent orders
              </h2>
            </div>

            <Link
              to="/orders"
              className="text-sm font-black text-[#0F4C9C]"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {loadingDashboard ? (
              [1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-2xl bg-slate-100"
                />
              ))
            ) : recentOrders.length ? (
              recentOrders.map((order) => (
                <Link
                  key={order.order_id}
                  to={`/orders/${order.order_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition hover:bg-slate-50"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
                    <ShoppingBag size={20} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {order.order_number ||
                        order.order_id}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(order.created_at)} ·{" "}
                      {(order.items || []).length} item
                      {(order.items || []).length === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-slate-950">
                      {money(order.total)}
                    </p>

                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-1 text-[9px] font-black ${orderTone(
                        order.status
                      )}`}
                    >
                      {label(order.status)}
                    </span>
                  </div>

                  <ChevronRight
                    size={17}
                    className="shrink-0 text-slate-300"
                  />
                </Link>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                <ShoppingBag
                  size={34}
                  className="mx-auto text-slate-300"
                />

                <h3 className="mt-3 font-black text-slate-900">
                  No orders yet
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Your recent orders will appear here.
                </p>

                <Link
                  to="/products"
                  className="mt-4 inline-flex rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-xs font-black text-white"
                >
                  Start shopping
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <Gift size={23} />
          </span>

          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
            Shopping summary
          </p>

          <h2 className="mt-1 text-2xl font-black text-slate-950">
            Your ZANSZI journey
          </h2>

          <div className="mt-5 space-y-3">
            <SummaryRow
              label="Delivered orders"
              value={deliveredOrders.length}
            />
            <SummaryRow
              label="Total savings"
              value={money(lifetimeSavings)}
            />
            <SummaryRow
              label="Active coupons"
              value={activeOffers.length}
            />
          </div>

          <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Star
                size={21}
                className="text-amber-500"
                fill="currentColor"
              />

              <div>
                <p className="text-sm font-black text-slate-900">
                  Reward points
                </p>
                <p className="text-xs text-slate-500">
                  Coming soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {recentlyViewedProducts.length > 0 && (
        <ProductStrip
          eyebrow="Continue shopping"
          title="Recently viewed"
          products={recentlyViewedProducts}
        />
      )}

      {recommendedProducts.length > 0 && (
        <ProductStrip
          eyebrow="Picked for you"
          title="Recommended products"
          products={recommendedProducts}
        />
      )}

      {activeOffers.length > 0 && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                Available savings
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Coupons for you
              </h2>
            </div>

            <Link
              to="/offers"
              className="text-sm font-black text-[#0F4C9C]"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {activeOffers.map((offer) => (
              <article
                key={
                  offer.offer_id ||
                  offer.code
                }
                className="relative overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50 p-4"
              >
                <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-amber-200/50" />

                <Tag
                  size={20}
                  className="relative text-amber-700"
                />

                <p className="relative mt-3 text-lg font-black text-slate-950">
                  {offer.code}
                </p>

                <p className="relative mt-1 line-clamp-2 text-sm text-slate-600">
                  {offer.title ||
                    offer.description ||
                    "Special ZANSZI offer"}
                </p>

                <Link
                  to="/offers"
                  className="relative mt-4 inline-flex items-center gap-1 text-xs font-black text-amber-800"
                >
                  View offer
                  <ChevronRight size={14} />
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_LINKS.map(
          ({
            to,
            title,
            subtitle,
            icon: Icon,
            tone,
          }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}
                >
                  <Icon size={21} />
                </span>

                <ChevronRight
                  size={19}
                  className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0F4C9C]"
                />
              </div>

              <h2 className="mt-4 font-black text-slate-900">
                {title}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {subtitle}
              </p>
            </Link>
          )
        )}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-[#0F4C9C]">
            <User size={21} />
          </span>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
              Account Information
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              Personal details
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info
            label="Full Name"
            value={user?.name || "Not added"}
          />
          <Info
            label="Email"
            value={user?.email || "Not added"}
          />
          <Info
            label="Mobile"
            value={user?.phone || "Not added"}
          />
          <Info
            label="Location"
            value={
              [user?.city, user?.state]
                .filter(Boolean)
                .join(", ") || "Not added"
            }
          />
        </div>

        <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div>
              <p className="font-black text-slate-900">
                Secure account
              </p>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                Your information is used only for account,
                order and delivery purposes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 font-black text-rose-600"
      >
        <LogOut size={19} />
        Logout
      </button>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5">
          <form
            onSubmit={saveProfile}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                  Account
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  Edit profile
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
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
              <Field
                label="Full name"
                value={form.name}
                onChange={(value) =>
                  updateField("name", value)
                }
                required
              />

              <Field
                label="Mobile number"
                value={form.phone}
                onChange={(value) =>
                  updateField("phone", value)
                }
                inputMode="numeric"
                maxLength={10}
              />

              <Field
                label="City"
                value={form.city}
                onChange={(value) =>
                  updateField("city", value)
                }
              />

              <Field
                label="State"
                value={form.state}
                onChange={(value) =>
                  updateField("state", value)
                }
              />

              <Field
                label="Pincode"
                value={form.postal_code}
                onChange={(value) =>
                  updateField(
                    "postal_code",
                    value
                  )
                }
                inputMode="numeric"
                maxLength={12}
              />

              <label className="sm:col-span-2">
                <span className="text-sm font-black text-slate-800">
                  Delivery address
                </span>

                <textarea
                  value={form.address}
                  onChange={(event) =>
                    updateField(
                      "address",
                      event.target.value
                    )
                  }
                  className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white disabled:opacity-60"
            >
              <Save size={18} />
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ProductStrip({
  eyebrow,
  title,
  products,
}) {
  return (
    <section>
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
          {eyebrow}
        </p>

        <h2 className="mt-1 text-2xl font-black text-slate-950">
          {title}
        </h2>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3">
        {products.map((product) => {
          const image =
            product.image_url ||
            product.images?.[0] ||
            FALLBACK;

          return (
            <Link
              key={product.product_id}
              to={`/products/${product.product_id}`}
              className="group min-w-[165px] max-w-[165px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-w-[185px] sm:max-w-[185px]"
            >
              <div className="aspect-square overflow-hidden bg-[#F7FAFF] p-3">
                <img
                  src={image}
                  alt={product.name}
                  className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                  onError={(event) => {
                    event.currentTarget.src =
                      FALLBACK;
                  }}
                />
              </div>

              <div className="p-3">
                <p className="line-clamp-2 min-h-[36px] text-[13px] font-black leading-[18px] text-slate-900">
                  {product.name}
                </p>

                <p className="mt-2 text-base font-black text-[#062B5F]">
                  {money(product.price)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <span className="text-sm font-semibold text-slate-500">
        {label}
      </span>

      <strong className="text-sm font-black text-slate-950">
        {value}
      </strong>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  inputMode,
  maxLength,
}) {
  return (
    <label>
      <span className="text-sm font-black text-slate-800">
        {label}
      </span>

      <input
        required={required}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
      />
    </label>
  );
}
