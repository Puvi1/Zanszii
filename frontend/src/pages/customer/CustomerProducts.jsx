import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlass, Star, Package } from "@phosphor-icons/react";
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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const { addItem } = useCart();

  useEffect(() => {
    Promise.all([api.get("/products"), api.get("/categories")])
      .then(([p, c]) => { setProducts(p.data); setCategories(c.data); })
      .catch((e) => setMessage(formatApiError(e?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => products.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    const matchesCategory = !categoryId || p.category_id === categoryId;
    return matchesSearch && matchesCategory;
  }), [products, search, categoryId]);

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
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <label className="flex items-center gap-3 rounded-2xl bg-[#F5F9FF] px-4 py-3">
            <MagnifyingGlass size={20} className="text-[#0F4C9C]" />
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search products..." className="w-full bg-transparent outline-none" />
          </label>
          <select value={categoryId} onChange={(e)=>setCategoryId(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 outline-none">
            <option value="">All categories</option>
            {categories.map((c)=><option key={c.category_id} value={c.category_id}>{c.name}</option>)}
          </select>
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
              <div className="relative aspect-square overflow-hidden bg-[#F4F8FC] p-2 sm:p-3">
                <img src={p.image_url || p.images?.[0] || FALLBACK} alt={p.name} className="h-full w-full object-contain transition duration-300 hover:scale-105" onError={(e)=>e.currentTarget.src=FALLBACK}/>
                {p.featured && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#F4B400] px-2 py-1 text-[9px] font-black text-[#062B5F] sm:left-3 sm:top-3 sm:px-3 sm:text-xs"><Star weight="fill"/> Featured</span>}
              </div>
              <div className="p-3 sm:p-4">
                <p className="truncate text-[9px] font-black uppercase tracking-wider text-[#0F4C9C] sm:text-xs">{p.category?.name || "General"}</p>
                <h2 className="mt-1 line-clamp-2 min-h-[36px] text-sm font-black leading-[18px] text-slate-900 sm:min-h-[40px] sm:text-base sm:leading-5">{p.name}</h2>
                <p className="mt-1 hidden line-clamp-2 text-xs text-slate-500 sm:block">{p.description || "Premium Zanszii cleaning product."}</p>
                <div className="mt-2 flex items-end justify-between gap-2 sm:mt-3">
                  <div><p className="text-base font-black text-[#062B5F] sm:text-lg">₹{Number(p.price).toLocaleString("en-IN")}</p><p className="text-xs text-slate-500">per {p.unit}</p></div>
                  <button disabled={p.stock<=0} onClick={(e)=>{ e.stopPropagation(); add(p); }} className="min-h-8 shrink-0 rounded-lg bg-[#0F4C9C] px-2.5 py-1.5 text-[10px] font-black text-white disabled:bg-slate-300 sm:min-h-9 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
                    {p.stock>0 ? "Add to cart" : "Out of stock"}
                  </button>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-emerald-600 sm:mt-3 sm:text-xs">{p.stock} in stock</p>
              </div>
            </article>
          ))}
          {!shown.length && <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center"><Package size={44} className="mx-auto text-slate-400"/><p className="mt-3 font-bold">No products found</p></div>}
        </section>
      )}
    </div>
  );
}
