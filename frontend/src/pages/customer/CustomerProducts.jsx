import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Funnel, MagnifyingGlass, Package, ShoppingCart, SortAscending, Star } from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";

const FALLBACK = "https://placehold.co/800x600/F5F9FF/0F4C9C?text=ZANSZII";

export default function CustomerProducts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("category") || "");
  const [sortBy, setSortBy] = useState("featured");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const { addItem } = useCart();

  useEffect(() => {
    Promise.all([api.get("/products"), api.get("/categories")])
      .then(([p, c]) => { setProducts(p.data); setCategories(c.data); })
      .catch((e) => setMessage(formatApiError(e?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = search.toLowerCase().trim();

    const filtered = products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q);

      const matchesCategory =
        !categoryId || p.category_id === categoryId;

      return matchesSearch && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price_low") {
        return Number(a.price || 0) - Number(b.price || 0);
      }

      if (sortBy === "price_high") {
        return Number(b.price || 0) - Number(a.price || 0);
      }

      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }

      if (sortBy === "stock") {
        return Number(b.stock || 0) - Number(a.stock || 0);
      }

      return Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    });
  }, [products, search, categoryId, sortBy]);

  const add = async (product) => {
    try {
      await addItem(product, 1);
      setMessage(`${product.name} added to cart`);
    } catch (e) {
      setMessage(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] px-4 py-4 text-white shadow-lg sm:rounded-[28px] sm:px-6 sm:py-6">
        <div className="max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200 sm:text-xs">
            ZANSZI STORE
          </p>

          <h1 className="mt-1.5 text-2xl font-black leading-tight sm:mt-2 sm:text-3xl lg:text-4xl">
            Cleaning made simple
          </h1>

          <p className="mt-1.5 max-w-xl text-xs leading-5 text-blue-100 sm:mt-2 sm:text-sm">
            Browse trusted cleaning products and order easily with Cash on Delivery.
          </p>
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="flex items-center gap-3 rounded-2xl bg-[#F5F9FF] px-4 py-3">
            <MagnifyingGlass size={20} className="text-[#0F4C9C]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <SortAscending size={20} className="text-[#0F4C9C]" />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none"
            >
              <option value="featured">Featured first</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="stock">Most in stock</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">
            <Funnel size={14} />
            Filter
          </span>

          <button
            type="button"
            onClick={() => setCategoryId("")}
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-black transition ${
              !categoryId
                ? "bg-[#0F4C9C] text-white"
                : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            All
          </button>

          {categories.map((category) => (
            <button
              key={category.category_id}
              type="button"
              onClick={() => setCategoryId(category.category_id)}
              className={`shrink-0 rounded-full px-3 py-2 text-xs font-black transition ${
                categoryId === category.category_id
                  ? "bg-[#0F4C9C] text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {shown.length} {shown.length === 1 ? "product" : "products"}
          </span>

          {(search || categoryId) && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategoryId("");
              }}
              className="font-black text-[#0F4C9C]"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>

      {message && <div className="rounded-2xl bg-blue-50 px-4 py-3 font-semibold text-[#0F4C9C]">{message}</div>}

      {loading ? <div className="py-16 text-center">Loading products...</div> : (
        <section className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
          {shown.map((p)=>(
            <article
              key={p.product_id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/products/${p.product_id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate(`/products/${p.product_id}`);
                }
              }}
              className="cursor-pointer overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C9C] focus:ring-offset-2 sm:rounded-[22px]"
            >
              <div className="relative aspect-square overflow-hidden bg-[#F4F8FC] p-2.5 sm:p-4">
                <img
                  src={p.image_url || p.images?.[0] || FALLBACK}
                  alt={p.name}
                  className="h-full w-full object-contain transition duration-300 hover:scale-105"
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK;
                  }}
                />

                {p.featured && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#F4B400] px-2 py-1 text-[9px] font-black text-[#062B5F] sm:left-3 sm:top-3 sm:px-3 sm:text-xs">
                    <Star size={12} weight="fill" />
                    Featured
                  </span>
                )}
              </div>

              <div className="p-3 sm:p-4">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-[#0F4C9C] sm:text-xs">
                  {p.category?.name || "General"}
                </p>

                <h2 className="mt-1 line-clamp-2 min-h-[38px] text-sm font-black leading-[19px] text-slate-900 sm:min-h-[44px] sm:text-base sm:leading-5">
                  {p.name}
                </h2>

                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5 text-[#F4B400]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        size={12}
                        weight={index < 4 ? "fill" : "regular"}
                      />
                    ))}
                  </div>

                  <span className="text-[10px] font-bold text-slate-500 sm:text-xs">
                    4.8
                  </span>
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-[#062B5F] sm:text-xl">
                      ₹{Number(p.price).toLocaleString("en-IN")}
                    </p>

                    <p className="text-[10px] text-slate-500 sm:text-xs">
                      per {p.unit}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={p.stock <= 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      add(p);
                    }}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0F4C9C] px-3 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-[#0B3D80] disabled:bg-slate-300 sm:min-h-10 sm:px-4 sm:text-xs"
                  >
                    <span>{p.stock > 0 ? "Add" : "Out"}</span>
                    <ShoppingCart size={16} weight="bold" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span
                    className={`text-[10px] font-black sm:text-xs ${
                      p.stock > 10
                        ? "text-emerald-600"
                        : p.stock > 0
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {p.stock > 10
                      ? `${p.stock} in stock`
                      : p.stock > 0
                        ? `Only ${p.stock} left`
                        : "Out of stock"}
                  </span>

                  <span className="text-[10px] font-bold text-slate-400">
                    COD
                  </span>
                </div>
              </div>
            </article>
          ))}
          {!shown.length && <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center"><Package size={44} className="mx-auto text-slate-400"/><p className="mt-3 font-bold">No products found</p></div>}
        </section>
      )}
    </div>
  );
}
