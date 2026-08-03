import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  Heart,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
  Zap,
} from "lucide-react";

import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const FALLBACK =
  "https://placehold.co/900x700/F1F6FC/0F4C9C?text=ZANSZI";

const WISHLIST_STORAGE_KEY = "zanszii_wishlist";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const banners = [
  {
    eyebrow: "Trusted local shopping",
    title: "Discover useful products from local businesses",
    description:
      "Shop everyday essentials, gifts, foods, frames, printing services and more in one simple place.",
    action: "Explore products",
    link: "/products",
    accent: "from-[#062B5F] via-[#0F4C9C] to-[#1677D2]",
  },
  {
    eyebrow: "Easy ordering",
    title: "Find what you need in just a few taps",
    description:
      "Search quickly, add to cart and place your order with a smooth customer-first experience.",
    action: "Start shopping",
    link: "/products",
    accent: "from-[#084C61] via-[#0A7B83] to-[#20A39E]",
  },
  {
    eyebrow: "Offers & savings",
    title: "More value from trusted stores",
    description:
      "Explore active offers, popular picks and new arrivals across ZANSZI.",
    action: "View offers",
    link: "/offers",
    accent: "from-[#6A3D08] via-[#B76E00] to-[#F4B400]",
  },
];

const categoryIcons = [
  "🏠",
  "🌶️",
  "🖼️",
  "🖨️",
  "🧸",
  "🎁",
  "🏡",
  "✨",
];
const featuredStores = [
  {
    name: "ZANSZI Home Essentials",
    category: "Home Essentials",
    location: "Chennai",
    rating: "4.8",
    icon: "🏠",
  },
  {
    name: "Dream Frames",
    category: "Photos & Frames",
    location: "Chennai",
    rating: "4.7",
    icon: "🖼️",
  },
  {
    name: "Amma Masala",
    category: "Foods & Masala",
    location: "Chennai",
    rating: "4.9",
    icon: "🌶️",
  },
  {
    name: "Print Hub",
    category: "Printing Services",
    location: "Chennai",
    rating: "4.6",
    icon: "🖨️",
  },
];


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

function ProductCard({
  product,
  onAdd,
  adding,
  onOpen,
  wished,
  onToggleWishlist,
  compact = false,
}) {
  const image =
    product.image_url || product.images?.[0] || FALLBACK;

  const originalPrice = Number(
    product.mrp ||
      product.original_price ||
      product.price ||
      0
  );

  const price = Number(product.price || 0);

  const discount =
    originalPrice > price
      ? Math.round(
          ((originalPrice - price) / originalPrice) *
            100
        )
      : 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          onOpen(product);
        }
      }}
      className={`group cursor-pointer overflow-hidden border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C9C] focus:ring-offset-2 ${
        compact
          ? "min-w-[166px] rounded-[20px] sm:min-w-[190px]"
          : "min-w-[190px] rounded-[22px] sm:min-w-0"
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-[#F4F8FC] p-3">
        <img
          src={image}
          alt={product.name}
          className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = FALLBACK;
          }}
        />

        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-white sm:text-xs">
            {discount}% OFF
          </span>
        )}

        {product.featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black text-[#0F4C9C] backdrop-blur sm:text-xs">
            <Star size={13} fill="currentColor" />
            Popular
          </span>
        )}

        <button
          type="button"
          aria-label={
            wished
              ? "Remove from wishlist"
              : "Add to wishlist"
          }
          onClick={(event) => {
            event.stopPropagation();
            onToggleWishlist(product);
          }}
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-105"
        >
          <Heart
            size={18}
            className={
              wished
                ? "text-rose-500"
                : "text-slate-500"
            }
            fill={wished ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="p-3">
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-[#0F4C9C] sm:text-[10px]">
          {product.category?.name ||
            product.category_name ||
            "Local Store"}
        </p>

        <h3
          className={`mt-1 line-clamp-2 font-black text-slate-900 ${
            compact
              ? "min-h-[36px] text-[13px] leading-[18px]"
              : "min-h-[38px] text-sm leading-5"
          }`}
        >
          {product.name}
        </h3>

        <p className="mt-0.5 text-[11px] text-slate-500">
          {product.business_name ||
            product.seller_name ||
            (product.unit ? `Per ${product.unit}` : "Trusted local seller")}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div>
            <p
              className={`font-black text-[#062B5F] ${
                compact ? "text-base" : "text-lg"
              }`}
            >
              {money(price)}
            </p>

            {originalPrice > price && (
              <p className="text-xs text-slate-400 line-through">
                {money(originalPrice)}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={
              Number(product.stock) <= 0 || adding
            }
            onClick={(event) => {
              event.stopPropagation();
              onAdd(product);
            }}
            className="min-h-9 rounded-xl bg-[#0F4C9C] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#0B3D80] disabled:cursor-not-allowed disabled:bg-slate-300 sm:text-xs"
          >
            {Number(product.stock) <= 0
              ? "Sold out"
              : adding
                ? "Adding..."
                : "Add 🛒"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton({ compact = false }) {
  return (
    <div
      className={`overflow-hidden border border-slate-200 bg-white ${
        compact
          ? "min-w-[166px] rounded-[20px] sm:min-w-[190px]"
          : "min-w-[190px] rounded-[22px] sm:min-w-0"
      }`}
    >
      <div className="aspect-square animate-pulse bg-slate-200" />

      <div className="space-y-2.5 p-3">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function ZANSZIHome() {
  const { user } = useAuth();
  const { addItem, itemCount = 0 } = useCart();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [activeBanner, setActiveBanner] = useState(0);
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60 + 45 * 60 + 18);
  const [wishlistIds, setWishlistIds] =
    useState(readWishlist);

  useEffect(() => {
    Promise.all([
      api.get("/products"),
      api.get("/categories"),
    ])
      .then(
        ([productResponse, categoryResponse]) => {
          setProducts(
            Array.isArray(productResponse.data)
              ? productResponse.data
              : []
          );

          setCategories(
            Array.isArray(categoryResponse.data)
              ? categoryResponse.data
              : []
          );
        }
      )
      .catch((error) =>
        setMessage(
          formatApiError(
            error,
            "Unable to load the home page."
          )
        )
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const slider = window.setInterval(() => {
      setActiveBanner(
        (current) => (current + 1) % banners.length
      );
    }, 4000);

    return () => window.clearInterval(slider);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft((current) =>
        current > 0 ? current - 1 : 3 * 60 * 60
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const featured = useMemo(() => {
    const preferred = products.filter(
      (product) =>
        product.featured &&
        Number(product.stock) > 0
    );

    return (
      preferred.length
        ? preferred
        : products.filter(
            (product) => Number(product.stock) > 0
          )
    ).slice(0, 8);
  }, [products]);

  const newArrivals = useMemo(
    () => [...products].reverse().slice(0, 8),
    [products]
  );

  const flashDeals = useMemo(() => {
    const discounted = products.filter((product) => {
      const price = Number(product.price || 0);
      const originalPrice = Number(
        product.mrp ||
          product.original_price ||
          product.price ||
          0
      );

      return (
        Number(product.stock) > 0 &&
        originalPrice > price
      );
    });

    return (
      discounted.length ? discounted : featured
    ).slice(0, 6);
  }, [products, featured]);

  const recommended = useMemo(() => {
    return products
      .filter((product) => Number(product.stock) > 0)
      .slice(0, 6);
  }, [products]);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();

    navigate(
      query
        ? `/products?search=${encodeURIComponent(query)}`
        : "/products"
    );
  };

  const openProduct = (product) => {
    if (!product?.product_id) return;

    navigate(`/products/${product.product_id}`);
  };

  const toggleWishlist = (product) => {
    const id = product?.product_id;
    if (!id) return;

    setWishlistIds((current) => {
      const exists = current.includes(id);

      const next = exists
        ? current.filter((item) => item !== id)
        : [...current, id];

      localStorage.setItem(
        WISHLIST_STORAGE_KEY,
        JSON.stringify(next)
      );

      setMessage(
        exists
          ? `${product.name} removed from wishlist`
          : `${product.name} added to wishlist`
      );

      return next;
    });
  };

  const add = async (product) => {
    setAddingId(product.product_id);
    setMessage("");

    try {
      await addItem(product, 1);
      setMessage(
        `${product.name} added to your cart`
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Unable to add this product"
      );
    } finally {
      setAddingId("");
    }
  };

  const previousBanner = () => {
    setActiveBanner(
      (current) =>
        (current - 1 + banners.length) %
        banners.length
    );
  };

  const nextBanner = () => {
    setActiveBanner(
      (current) => (current + 1) % banners.length
    );
  };

  const hours = String(
    Math.floor(timeLeft / 3600)
  ).padStart(2, "0");

  const minutes = String(
    Math.floor((timeLeft % 3600) / 60)
  ).padStart(2, "0");

  const seconds = String(timeLeft % 60).padStart(
    2,
    "0"
  );

  const firstName =
    user?.name?.split(" ")?.[0] || "there";

  const deliveryLocation =
    user?.city ||
    user?.address?.city ||
    "Select delivery location";

  const activeSlide = banners[activeBanner];

  return (
    <div className="space-y-6 pb-28 md:space-y-8 md:pb-8">

      <section className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
        <form
          onSubmit={submitSearch}
          className="flex items-center gap-2 rounded-2xl bg-[#F5F9FF] p-1.5"
        >
          <Search
            className="ml-2 text-slate-400"
            size={20}
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search products, stores or categories..."
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold text-slate-900 outline-none"
          />

          <button
            className="rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-xs font-black text-white sm:text-sm"
            type="submit"
          >
            Search
          </button>
        </form>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0F4C9C]">
          {message}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
              Browse quickly
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Shop by category
            </h2>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-xs font-black text-[#0F4C9C] sm:text-sm"
          >
            View all
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {categories.slice(0, 8).map((category, index) => (
            <Link
              key={category.category_id}
              to={`/products?category=${category.category_id}`}
              className="group flex min-w-[92px] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F5F9FF] text-base transition group-hover:scale-105">
                {categoryIcons[index % categoryIcons.length]}
              </span>

              <span className="line-clamp-1 text-[11px] font-black text-slate-800 sm:text-xs">
                {category.name}
              </span>
            </Link>
          ))}

          {!loading && categories.length === 0 && (
            <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-white py-6 text-center text-sm font-bold text-slate-500">
              Categories will appear here after they are added by admin.
            </div>
          )}
        </div>
      </section>

      <section
        className={`relative overflow-hidden rounded-[24px] bg-gradient-to-br ${activeSlide.accent} px-5 py-5 text-white shadow-[0_18px_50px_rgba(15,76,156,0.20)] sm:px-7 sm:py-7 lg:px-9 lg:py-8`}
      >
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

        <div className="relative grid min-h-[180px] gap-6 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] backdrop-blur">
              <Sparkles size={14} />
              {activeSlide.eyebrow}
            </span>

            <h1 className="mt-3 max-w-2xl text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
              {activeSlide.title}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-white/85">
              {activeSlide.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                to={activeSlide.link}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#062B5F] shadow-lg"
              >
                {activeSlide.action}
                <ArrowRight size={17} />
              </Link>

              <span className="text-sm font-bold text-white/80">
                Hello {firstName} 👋
              </span>
            </div>
          </div>

          <div className="hidden lg:flex lg:justify-end">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <ShoppingBag size={22} />
                <p className="mt-4 text-sm font-black">
                  Easy shopping
                </p>
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <ShieldCheck size={22} />
                <p className="mt-4 text-sm font-black">
                  Trusted stores
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={previousBanner}
          aria-label="Previous banner"
          className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30 sm:grid"
        >
          <ChevronLeft size={21} />
        </button>

        <button
          type="button"
          onClick={nextBanner}
          aria-label="Next banner"
          className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/20 text-white backdrop-blur transition hover:bg-black/30 sm:grid"
        >
          <ChevronRight size={21} />
        </button>

        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((banner, index) => (
            <button
              type="button"
              key={banner.title}
              onClick={() => setActiveBanner(index)}
              aria-label={`Open banner ${index + 1}`}
              className={`h-2 rounded-full transition-all ${
                index === activeBanner
                  ? "w-7 bg-white"
                  : "w-2 bg-white/45"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-600">
              <Zap size={15} fill="currentColor" />
              Limited-time savings
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              Flash deals
            </h2>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
            <Clock3 size={17} className="text-amber-600" />

            <span>{hours}</span>
            <span className="text-slate-400">:</span>
            <span>{minutes}</span>
            <span className="text-slate-400">:</span>
            <span>{seconds}</span>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {loading
            ? Array.from({ length: 4 }).map(
                (_, index) => (
                  <ProductSkeleton
                    key={index}
                    compact
                  />
                )
              )
            : flashDeals.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  compact
                  onAdd={add}
                  adding={
                    addingId === product.product_id
                  }
                  onOpen={openProduct}
                  wished={wishlistIds.includes(
                    product.product_id
                  )}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
              Trusted stores
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
              Featured businesses
            </h2>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {featuredStores.map((store) => (
            <article
              key={store.name}
              className="min-w-[210px] rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#F5F9FF] text-xl">
                  {store.icon}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700">
                  <Star size={12} fill="currentColor" />
                  {store.rating}
                </span>
              </div>

              <h3 className="mt-4 font-black text-slate-900">
                {store.name}
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                {store.category} · {store.location}
              </p>

              <button
                type="button"
                onClick={() => navigate("/products")}
                className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[#0F4C9C]"
              >
                View products
                <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0F4C9C]">
              Picked for you
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              Recommended products
            </h2>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-sm font-black text-[#0F4C9C]"
          >
            Shop all
            <ChevronRight size={17} />
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map(
                (_, index) => (
                  <ProductSkeleton key={index} />
                )
              )
            : recommended
                .slice(0, 4)
                .map((product) => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    onAdd={add}
                    adding={
                      addingId === product.product_id
                    }
                    onOpen={openProduct}
                    wished={wishlistIds.includes(
                      product.product_id
                    )}
                    onToggleWishlist={
                      toggleWishlist
                    }
                  />
                ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          to="/products"
          className="group overflow-hidden rounded-[28px] bg-[#062B5F] p-6 text-white shadow-lg md:col-span-2"
        >
          <Truck size={30} className="text-blue-200" />

          <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-blue-200">
            Easy ordering
          </p>

          <h2 className="mt-2 text-2xl font-black sm:text-3xl">
            Useful products from trusted local stores
          </h2>

          <span className="mt-5 inline-flex items-center gap-2 text-sm font-black">
            Start shopping
            <ArrowRight
              size={17}
              className="transition group-hover:translate-x-1"
            />
          </span>
        </Link>

        <Link
          to="/products"
          className="group rounded-[28px] border border-amber-200 bg-amber-50 p-6 shadow-sm"
        >
          <BadgePercent
            size={30}
            className="text-amber-600"
          />

          <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-amber-700">
            Today's offers
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-900">
            More value on everyday essentials
          </h3>

          <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber-700">
            Explore deals
            <ArrowRight
              size={17}
              className="transition group-hover:translate-x-1"
            />
          </span>
        </Link>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.2em] text-[#0F4C9C]">
              <Flame size={15} />
              Customer favourites
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              Best sellers
            </h2>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-sm font-black text-[#0F4C9C]"
          >
            View all
            <ChevronRight size={17} />
          </Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3">
          {loading
            ? Array.from({ length: 4 }).map(
                (_, index) => (
                  <ProductSkeleton
                    key={index}
                    compact
                  />
                )
              )
            : featured.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  compact
                  onAdd={add}
                  adding={
                    addingId === product.product_id
                  }
                  onOpen={openProduct}
                  wished={wishlistIds.includes(
                    product.product_id
                  )}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
        </div>
      </section>

      {newArrivals.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0F4C9C]">
                Fresh in store
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                New arrivals
              </h2>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3">
            {newArrivals
              .slice(0, 6)
              .map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  compact
                  onAdd={add}
                  adding={
                    addingId === product.product_id
                  }
                  onOpen={openProduct}
                  wished={wishlistIds.includes(
                    product.product_id
                  )}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
          </div>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <Truck
            size={24}
            className="text-[#0F4C9C]"
          />

          <p className="mt-3 text-sm font-black text-slate-900">
            Doorstep delivery
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Convenient doorstep delivery for everyday products.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ShieldCheck
            size={24}
            className="text-[#0F4C9C]"
          />

          <p className="mt-3 text-sm font-black text-slate-900">
            Quality assured
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Carefully listed products from trusted sellers.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ShoppingBag
            size={24}
            className="text-[#0F4C9C]"
          />

          <p className="mt-3 text-sm font-black text-slate-900">
            Easy checkout
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Search, add to cart and order in just a few steps.
          </p>
        </div>
      </section>

      {Number(itemCount) > 0 && (
        <Link
          to="/cart"
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-24px)] max-w-lg -translate-x-1/2 items-center justify-between rounded-[22px] bg-[#062B5F] px-4 py-3 text-white shadow-[0_18px_50px_rgba(6,43,95,0.4)] md:hidden"
        >
          <div className="flex items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
              <ShoppingCart size={21} />

              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#F4B400] px-1 text-[10px] font-black text-[#062B5F]">
                {itemCount}
              </span>
            </span>

            <div>
              <p className="text-sm font-black">
                {itemCount}{" "}
                {Number(itemCount) === 1
                  ? "item"
                  : "items"}{" "}
                in cart
              </p>

              <p className="text-xs text-blue-100">
                Ready to checkout
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-sm font-black">
            View cart
            <ArrowRight size={17} />
          </span>
        </Link>
      )}
    </div>
  );
}
