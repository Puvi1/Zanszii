import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlass, ShoppingCart, Star, Package } from "@phosphor-icons/react";
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
  const { addItem, itemCount } = useCart();

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
      <section className="rounded-[30px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.25em] text-blue-200">Zanszii Store</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">Cleaning made simple</h1>
            <p className="mt-2 text-blue-100">Browse products, add to cart and order with Cash on Delivery.</p>
          </div>
          <Link to="/cart" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-3 font-black text-[#062B5F]">
            <ShoppingCart size={20} weight="fill" /> Cart ({itemCount})
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
              className="cursor-pointer overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0F4C9C] focus:ring-offset-2"
            >
              <div className="relative aspect-square overflow-hidden bg-[#F4F8FC] p-3">
                <img src={p.image_url || p.images?.[0] || FALLBACK} alt={p.name} className="h-full w-full object-contain transition duration-300 hover:scale-105" onError={(e)=>e.currentTarget.src=FALLBACK}/>
                {p.featured && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#F4B400] px-3 py-1 text-xs font-black text-[#062B5F]"><Star weight="fill"/> Featured</span>}
              </div>
              <div className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#0F4C9C]">{p.category?.name || "General"}</p>
                <h2 className="mt-1 min-h-[40px] text-base font-black leading-5 text-slate-900">{p.name}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{p.description || "Premium Zanszii cleaning product."}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div><p className="text-lg font-black text-[#062B5F]">₹{Number(p.price).toLocaleString("en-IN")}</p><p className="text-xs text-slate-500">per {p.unit}</p></div>
                  <button disabled={p.stock<=0} onClick={(e)=>{ e.stopPropagation(); add(p); }} className="min-h-9 rounded-xl bg-[#0F4C9C] px-3 py-2 text-xs font-black text-white disabled:bg-slate-300">
                    {p.stock>0 ? "Add to cart" : "Out of stock"}
                  </button>
                </div>
                <p className="mt-3 text-xs font-semibold text-emerald-600">{p.stock} in stock</p>
              </div>
            </article>
          ))}
          {!shown.length && <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center"><Package size={44} className="mx-auto text-slate-400"/><p className="mt-3 font-bold">No products found</p></div>}
        </section>
      )}
    </div>
  );
}
