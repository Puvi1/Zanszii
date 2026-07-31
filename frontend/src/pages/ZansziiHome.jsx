import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgePercent,
  ChevronRight,
  Clock3,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  Heart,
} from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const FALLBACK = "https://placehold.co/900x700/F1F6FC/0F4C9C?text=ZANSZII";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function ProductCard({ product, onAdd, adding, onOpen, wished, onToggleWishlist }) {
  const image = product.image_url || product.images?.[0] || FALLBACK;
  const originalPrice = Number(product.mrp || product.original_price || product.price || 0);
  const price = Number(product.price || 0);
  const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(product);
      }}
      className="group min-w-[220px] cursor-pointer overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C9C] focus:ring-offset-2 sm:min-w-0"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F3F7FC]">
        <img
          src={image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          onError={(event) => {
            event.currentTarget.src = FALLBACK;
          }}
        />
        {discount > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white">
            {discount}% OFF
          </span>
        )}
        {product.featured && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-[#0F4C9C] backdrop-blur">
            <Star size={13} fill="currentColor" /> Popular
          </span>
        )}
        <button
          type="button"
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleWishlist(product);
          }}
          className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:scale-105"
        >
          <Heart
            size={20}
            className={wished ? "text-rose-500" : "text-slate-500"}
            fill={wished ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
          {product.category?.name || product.category_name || "Zanszii Care"}
        </p>
        <h3 className="mt-1 line-clamp-2 min-h-[44px] text-base font-black text-slate-900">
          {product.name}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{product.unit ? `Per ${product.unit}` : "Premium cleaning solution"}</p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-black text-[#062B5F]">{money(price)}</p>
            {originalPrice > price && <p className="text-xs text-slate-400 line-through">{money(originalPrice)}</p>}
          </div>
          <button
            type="button"
            disabled={product.stock <= 0 || adding}
            onClick={(event) => {
              event.stopPropagation();
              onAdd(product);
            }}
            className="rounded-2xl bg-[#0F4C9C] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#0B3D80] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {product.stock <= 0 ? "Sold out" : adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductSkeleton() {
  return (
    <div className="min-w-[220px] overflow-hidden rounded-[26px] border border-slate-200 bg-white sm:min-w-0">
      <div className="aspect-[4/3] animate-pulse bg-slate-200" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function ZansziiHome() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("zanszii_wishlist") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    Promise.all([api.get("/products"), api.get("/categories")])
      .then(([productResponse, categoryResponse]) => {
        setProducts(Array.isArray(productResponse.data) ? productResponse.data : []);
        setCategories(Array.isArray(categoryResponse.data) ? categoryResponse.data : []);
      })
      .catch((error) => setMessage(formatApiError(error?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  const featured = useMemo(() => {
    const preferred = products.filter((product) => product.featured && Number(product.stock) > 0);
    return (preferred.length ? preferred : products.filter((product) => Number(product.stock) > 0)).slice(0, 6);
  }, [products]);

  const newArrivals = useMemo(() => [...products].reverse().slice(0, 6), [products]);

  const submitSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : "/products");
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
      const next = exists ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem("zanszii_wishlist", JSON.stringify(next));
      setMessage(exists ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`);
      return next;
    });
  };

  const add = async (product) => {
    setAddingId(product.product_id);
    setMessage("");
    try {
      await addItem(product, 1);
      setMessage(`${product.name} added to your cart`);
    } catch (error) {
      setMessage(error.message || "Unable to add this product");
    } finally {
      setAddingId("");
    }
  };

  const firstName = user?.name?.split(" ")?.[0] || "there";

  return (
    <div className="space-y-8 pb-5">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#062B5F] via-[#0F4C9C] to-[#1677D2] px-5 py-7 text-white shadow-[0_25px_70px_rgba(15,76,156,0.28)] sm:px-8 sm:py-10 lg:px-12 lg:py-14">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-[#F4B400]/20 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">
              <Sparkles size={14} /> Cleaner home, easier life
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl font-black leading-tight sm:text-4xl lg:text-6xl">
              Hello {firstName}, make every corner shine.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Everyday cleaning essentials, trusted quality and doorstep delivery—all in one simple shopping experience.
            </p>

            <form onSubmit={submitSearch} className="mt-6 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-xl">
              <Search className="ml-2 text-slate-400" size={21} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search floor cleaner, dish wash..."
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold text-slate-900 outline-none"
              />
              <button className="rounded-xl bg-[#F4B400] px-4 py-2.5 text-sm font-black text-[#062B5F]" type="submit">
                Search
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3 text-xs font-bold text-blue-100">
              <span className="inline-flex items-center gap-1.5"><Truck size={16} /> Doorstep delivery</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={16} /> Quality products</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={16} /> Quick ordering</span>
            </div>
          </div>

          <div className="relative hidden min-h-[300px] lg:block">
            <div className="absolute inset-0 rotate-3 rounded-[38px] border border-white/20 bg-white/10 backdrop-blur" />
            <div className="absolute inset-5 -rotate-2 rounded-[32px] bg-white p-6 text-slate-900 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">Today’s pick</p>
                  <h2 className="mt-2 text-2xl font-black">Fresh home bundle</h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Best value</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#F5F9FF] p-4"><BadgePercent className="text-[#0F4C9C]" /><p className="mt-8 text-sm font-black">Special prices</p></div>
                <div className="rounded-2xl bg-amber-50 p-4"><ShoppingBag className="text-amber-600" /><p className="mt-8 text-sm font-black">Easy checkout</p></div>
              </div>
              <Link to="/products" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-3 font-black text-white">
                Shop all products <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0F4C9C]">
          {message}
        </div>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0F4C9C]">Find it fast</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Shop by category</h2>
          </div>
          <Link to="/products" className="inline-flex items-center gap-1 text-sm font-black text-[#0F4C9C]">View all <ChevronRight size={17} /></Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.slice(0, 6).map((category, index) => (
            <Link
              key={category.category_id}
              to={`/products?category=${category.category_id}`}
              className="group rounded-[24px] border border-slate-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
            >
              <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${index % 2 ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-[#0F4C9C]"}`}>
                <Package size={25} />
              </span>
              <p className="mt-3 line-clamp-1 text-sm font-black text-slate-800">{category.name}</p>
            </Link>
          ))}
          {!loading && categories.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm font-bold text-slate-500">
              Categories will appear here after they are added by admin.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0F4C9C]">Customer favourites</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Best sellers</h2>
          </div>
          <Link to="/products" className="inline-flex items-center gap-1 text-sm font-black text-[#0F4C9C]">Shop all <ChevronRight size={17} /></Link>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => <ProductSkeleton key={index} />)
            : featured.slice(0, 4).map((product) => (
                <ProductCard
                  key={product.product_id}
                  product={product}
                  onAdd={add}
                  adding={addingId === product.product_id}
                  onOpen={openProduct}
                  wished={wishlistIds.includes(product.product_id)}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[28px] bg-[#062B5F] p-6 text-white lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200">Simple shopping promise</p>
          <h2 className="mt-2 text-2xl font-black sm:text-3xl">Good products. Clear prices. Easy ordering.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">Browse, add to cart, confirm your address and place your order without confusing steps.</p>
          <Link to="/products" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-[#062B5F]">
            Start shopping <ArrowRight size={17} />
          </Link>
        </div>
        <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6">
          <BadgePercent size={30} className="text-amber-600" />
          <h3 className="mt-8 text-xl font-black text-slate-900">Value every day</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">Watch this space for customer offers, bundles and limited-time deals.</p>
        </div>
      </section>

      {newArrivals.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#0F4C9C]">Fresh in store</p>
              <h2 className="mt-1 text-2xl font-black text-slate-900">New arrivals</h2>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-4">
            {newArrivals.slice(0, 4).map((product) => (
              <ProductCard
                  key={product.product_id}
                  product={product}
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
    </div>
  );
}
