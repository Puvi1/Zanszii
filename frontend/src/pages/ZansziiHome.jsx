import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Gift,
  Grid3X3,
  Heart,
  Home,
  Image as ImageIcon,
  PackageSearch,
  Printer,
  Search,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  ToyBrick,
  UtensilsCrossed,
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

const CATEGORY_ICON_MAP = {
  home: Home,
  "home essentials": Home,
  "home care": Home,
  cleaning: PackageSearch,
  "bathroom cleaner": PackageSearch,
  foods: UtensilsCrossed,
  food: UtensilsCrossed,
  masala: UtensilsCrossed,
  frames: ImageIcon,
  "photos & frames": ImageIcon,
  printing: Printer,
  print: Printer,
  toys: ToyBrick,
  gifts: Gift,
  store: Store,
};

function getCategoryIcon(categoryName = "") {
  const normalized = String(categoryName).trim().toLowerCase();

  if (CATEGORY_ICON_MAP[normalized]) {
    return CATEGORY_ICON_MAP[normalized];
  }

  if (normalized.includes("home")) return Home;
  if (normalized.includes("clean")) return PackageSearch;
  if (normalized.includes("food") || normalized.includes("masala")) {
    return UtensilsCrossed;
  }
  if (normalized.includes("frame") || normalized.includes("photo")) {
    return ImageIcon;
  }
  if (normalized.includes("print")) return Printer;
  if (normalized.includes("toy")) return ToyBrick;
  if (normalized.includes("gift")) return Gift;

  return Store;
}

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
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#0F4C9C] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#0B3D80] disabled:cursor-not-allowed disabled:bg-slate-300 sm:text-xs"
          >
            {Number(product.stock) <= 0
              ? "Sold out"
              : adding
                ? "Adding..."
                : <>
                    Add
                    <ShoppingCart size={14} />
                  </>}
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

  const activeSlide = banners[activeBanner];

  return (
    <div className="space-y-4 pb-28 md:space-y-7 md:pb-8">
      <form
        onSubmit={submitSearch}
        className="flex h-10 items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:h-11"
      >
        <Search size={17} className="shrink-0 text-slate-400" />

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products, stores or categories"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-slate-900 outline-none placeholder:text-slate-400 sm:text-sm"
        />

        <button
          type="submit"
          aria-label="Search"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#062B5F] text-white shadow-sm transition hover:bg-[#0F4C9C]"
        >
          <Search size={14} />
        </button>
      </form>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0F4C9C]">
          {message}
        </div>
      )}

      <section aria-label="Product categories">
        <div className="flex gap-2 overflow-x-auto px-0.5 pb-1">
          {categories.slice(0, 7).map((category) => {
            const Icon = getCategoryIcon(category.name);

            return (
              <Link
                key={category.category_id}
                to={`/products?category=${category.category_id}`}
                className="group flex min-w-[56px] flex-col items-center text-center"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[15px] border border-slate-200 bg-white text-[#0F4C9C] shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:bg-blue-50">
                  <Icon size={17} strokeWidth={2.1} />
                </span>

                <span className="mt-1.5 line-clamp-2 text-[9px] font-black leading-[12px] text-slate-700">
                  {category.name}
                </span>
              </Link>
            );
          })}

          <Link
            to="/products"
            className="group flex min-w-[56px] flex-col items-center text-center"
          >
            <span className="grid h-10 w-10 place-items-center rounded-[15px] border border-slate-200 bg-white text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.05)] transition group-hover:-translate-y-0.5 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-[#0F4C9C]">
              <Grid3X3 size={17} strokeWidth={2.1} />
            </span>

            <span className="mt-1.5 text-[9px] font-black text-slate-700">
              More
            </span>
          </Link>

          {!loading && categories.length === 0 && (
            <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-white py-4 text-center text-sm font-bold text-slate-500">
              Categories will appear here after they are added by admin.
            </div>
          )}
        </div>
      </section>

      <section
        className={`relative overflow-hidden rounded-[22px] bg-gradient-to-r ${activeSlide.accent} px-4 py-4 text-white shadow-[0_12px_30px_rgba(15,76,156,0.16)] sm:px-6 sm:py-5`}
      >
        <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 right-1/3 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

        <div className="relative min-h-[118px] pr-0 sm:min-h-[124px] sm:pr-28">
          <p className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/70">
            <Sparkles size={12} />
            {activeSlide.eyebrow}
          </p>

          <h1 className="mt-2 max-w-md text-[19px] font-black leading-[1.16] sm:text-2xl">
            {activeSlide.title}
          </h1>

          <p className="mt-1.5 line-clamp-2 max-w-md text-[10px] leading-4 text-white/78 sm:text-xs">
            {activeSlide.description}
          </p>

          <Link
            to={activeSlide.link}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[10px] font-black text-[#062B5F] shadow-md"
          >
            {activeSlide.action}
            <ArrowRight size={13} />
          </Link>

          <div className="absolute right-1 top-1/2 hidden h-20 w-20 -translate-y-1/2 sm:grid sm:place-items-center">
            <div className="relative h-full w-full rounded-[22px] border border-white/15 bg-white/10 backdrop-blur">
              <Store
                size={21}
                className="absolute left-3 top-3 text-white/85"
              />
              <span className="absolute bottom-3 left-4 h-9 w-5 rounded-t-lg rounded-b-md bg-white/90 shadow" />
              <span className="absolute bottom-3 left-10 h-13 w-6 rounded-t-lg rounded-b-md bg-blue-200/90 shadow" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={previousBanner}
          aria-label="Previous banner"
          className="absolute left-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/10 text-white backdrop-blur md:grid"
        >
          <ChevronLeft size={15} />
        </button>

        <button
          type="button"
          onClick={nextBanner}
          aria-label="Next banner"
          className="absolute right-2 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-black/10 text-white backdrop-blur md:grid"
        >
          <ChevronRight size={15} />
        </button>

        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((banner, index) => (
            <button
              type="button"
              key={banner.title}
              onClick={() => setActiveBanner(index)}
              aria-label={`Open banner ${index + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                index === activeBanner
                  ? "w-4 bg-white"
                  : "w-1.5 bg-white/35"
              }`}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_7px_22px_rgba(15,23,42,0.05)] sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-amber-600">
              <Zap size={14} fill="currentColor" />
              Flash savings
            </p>

            <h2 className="text-lg font-black text-slate-900">
              Flash deals
            </h2>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-xs font-black text-amber-700">
            <Clock3 size={15} />

            <span>{hours}</span>
            <span className="text-amber-300">:</span>
            <span>{minutes}</span>
            <span className="text-amber-300">:</span>
            <span>{seconds}</span>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <ProductSkeleton key={index} compact />
              ))
            : flashDeals.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  compact
                  onAdd={add}
                  adding={addingId === product.product_id}
                  onOpen={openProduct}
                  wished={wishlistIds.includes(product.product_id)}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
            Best sellers
          </h2>

          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-xs font-black text-[#0F4C9C] sm:text-sm"
          >
            View all
            <ChevronRight size={16} />
          </Link>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <ProductSkeleton key={index} compact />
              ))
            : featured.map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  compact
                  onAdd={add}
                  adding={addingId === product.product_id}
                  onOpen={openProduct}
                  wished={wishlistIds.includes(product.product_id)}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
        </div>
      </section>

      {newArrivals.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
              New arrivals
            </h2>

            <Link
              to="/products"
              className="inline-flex items-center gap-1 text-xs font-black text-[#0F4C9C] sm:text-sm"
            >
              View all
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {newArrivals.slice(0, 6).map((product) => (
              <ProductCard
                key={product.product_id}
                product={product}
                compact
                onAdd={add}
                adding={addingId === product.product_id}
                onOpen={openProduct}
                wished={wishlistIds.includes(product.product_id)}
                onToggleWishlist={toggleWishlist}
              />
            ))}
          </div>
        </section>
      )}

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
