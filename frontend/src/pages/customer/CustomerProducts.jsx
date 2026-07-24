import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, ShoppingCart, Plus, Minus, X, Package, Star } from "@phosphor-icons/react";
import { toast } from "sonner";
import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";

const PLACEHOLDER = "https://placehold.co/800x600/F5F9FF/0F4C9C?text=ZANSZII";

export default function CustomerProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);

  const { items, itemCount, subtotal, addItem, updateQuantity, removeItem } = useCart();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/products?include_inactive=false");
        setProducts(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        const message = formatApiError(err?.response?.data?.detail || err?.message);
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const categories = useMemo(() => {
    const names = products.map((p) => p.category?.name).filter(Boolean);
    return ["All", ...Array.from(new Set(names))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !term || [product.name, product.description, product.category?.name, product.unit]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      const matchesCategory = category === "All" || product.category?.name === category;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const addToCart = (product) => {
    if (!product.stock) return;
    addItem(product);
    toast.success(`${product.name} added to cart`);
  };

  return (
    <div className="space-y-7" data-testid="customer-products-page">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#062B5F] via-[#0F4C9C] to-[#1769C2] p-6 md:p-10 text-white shadow-xl">
        <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-[#F4B400]/20 blur-2xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
            <Star size={14} weight="fill" className="text-[#F4B400]" /> ZANSZII STORE
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">Clean home. Simple shopping.</h1>
          <p className="mt-3 max-w-2xl text-sm text-blue-100 md:text-base">
            Browse trusted home-care products, check live stock and add everything you need in a few taps.
          </p>

          <div className="mt-7 flex max-w-2xl items-center gap-3 rounded-2xl bg-white p-2 shadow-lg">
            <MagnifyingGlass size={22} className="ml-2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search floor cleaner, home care..."
              className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-slate-900 outline-none md:text-base"
            />
            {search && (
              <button onClick={() => setSearch("")} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((name) => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                category === name
                  ? "bg-[#0F4C9C] text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-[#0F4C9C] hover:text-[#0F4C9C]"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <button
          onClick={() => setCartOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-3 font-bold text-[#062B5F] shadow-md transition hover:-translate-y-0.5"
        >
          <ShoppingCart size={21} weight="fill" /> Cart
          <span className="rounded-full bg-[#062B5F] px-2 py-0.5 text-xs text-white">{itemCount}</span>
        </button>
      </section>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[390px] animate-pulse rounded-3xl border border-slate-200 bg-white p-4">
              <div className="h-52 rounded-2xl bg-slate-100" />
              <div className="mt-5 h-5 w-2/3 rounded bg-slate-100" />
              <div className="mt-3 h-4 w-1/3 rounded bg-slate-100" />
              <div className="mt-6 h-11 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
          <Package size={42} className="mx-auto mb-3" />
          <p className="font-semibold">Unable to load products</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Package size={46} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-800">No products found</h2>
          <p className="mt-1 text-sm text-slate-500">Try another search or category.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const outOfStock = Number(product.stock || 0) <= 0;
            const cartItem = items.find((item) => item.product_id === product.product_id);
            return (
              <article key={product.product_id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#EFF6FF]">
                  <img
                    src={product.image_url || product.images?.[0] || PLACEHOLDER}
                    alt={product.name}
                    onError={(event) => { event.currentTarget.src = PLACEHOLDER; }}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  {product.featured && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#F4B400] px-3 py-1 text-xs font-black text-[#062B5F] shadow">
                      <Star size={13} weight="fill" /> FEATURED
                    </span>
                  )}
                  <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold shadow ${outOfStock ? "bg-red-600 text-white" : "bg-white text-emerald-700"}`}>
                    {outOfStock ? "Out of stock" : `${product.stock} in stock`}
                  </span>
                </div>

                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#0F4C9C]">{product.category?.name || "General"}</p>
                  <h2 className="mt-1 line-clamp-1 text-xl font-black text-slate-900">{product.name}</h2>
                  <p className="mt-2 line-clamp-2 min-h-[40px] text-sm text-slate-500">
                    {product.description || "Quality home-care product from Zanszii."}
                  </p>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-[#062B5F]">₹{Number(product.price || 0).toLocaleString("en-IN")}</p>
                      <p className="text-xs font-medium text-slate-400">per {product.unit || "unit"}</p>
                    </div>

                    {cartItem ? (
                      <div className="flex items-center gap-2 rounded-xl border border-[#0F4C9C]/20 bg-[#EFF6FF] p-1">
                        <button onClick={() => updateQuantity(product.product_id, cartItem.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-lg bg-white text-[#0F4C9C] shadow-sm"><Minus size={16} /></button>
                        <span className="w-6 text-center font-black text-[#062B5F]">{cartItem.quantity}</span>
                        <button onClick={() => updateQuantity(product.product_id, cartItem.quantity + 1)} className="grid h-9 w-9 place-items-center rounded-lg bg-[#0F4C9C] text-white shadow-sm"><Plus size={16} /></button>
                      </div>
                    ) : (
                      <button
                        disabled={outOfStock}
                        onClick={() => addToCart(product)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#062B5F] disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        <Plus size={17} weight="bold" /> Add
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2 className="text-xl font-black text-[#062B5F]">Your Cart</h2>
                <p className="text-xs text-slate-500">{itemCount} item{itemCount === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => setCartOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X size={22} /></button>
            </div>

            <div className="space-y-3 p-5">
              {items.length === 0 ? (
                <div className="py-20 text-center">
                  <ShoppingCart size={50} className="mx-auto text-slate-300" />
                  <h3 className="mt-4 font-bold text-slate-800">Your cart is empty</h3>
                  <p className="mt-1 text-sm text-slate-500">Add a product to get started.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.product_id} className="flex gap-3 rounded-2xl border border-slate-200 p-3">
                    <img src={item.image_url || item.images?.[0] || PLACEHOLDER} alt={item.name} className="h-20 w-20 rounded-xl object-cover bg-[#EFF6FF]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <h3 className="truncate font-bold text-slate-900">{item.name}</h3>
                        <button onClick={() => removeItem(item.product_id)} className="text-slate-400 hover:text-red-600"><X size={17} /></button>
                      </div>
                      <p className="text-sm font-bold text-[#0F4C9C]">₹{Number(item.price || 0).toLocaleString("en-IN")}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200"><Minus size={14} /></button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-[#0F4C9C] text-white"><Plus size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {items.length > 0 && (
              <div className="sticky bottom-0 border-t border-slate-200 bg-white p-5 shadow-[0_-12px_30px_rgba(15,23,42,0.08)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500">Subtotal</span>
                  <span className="text-2xl font-black text-[#062B5F]">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <button
                  onClick={() => toast.info("Full cart and checkout page is the next module")}
                  className="mt-4 w-full rounded-2xl bg-[#F4B400] py-3.5 font-black text-[#062B5F] shadow-md transition hover:brightness-95"
                >
                  Continue to Cart
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
