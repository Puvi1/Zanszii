import { useEffect, useMemo, useState } from "react";
import { Heart, Package, ShoppingCart, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";

const FALLBACK = "https://placehold.co/700x700/F4F8FC/0F4C9C?text=ZANSZII";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function CustomerWishlist() {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [products, setProducts] = useState([]);
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("zanszii_wishlist") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .get("/products")
      .then((response) => {
        setProducts(Array.isArray(response.data) ? response.data : []);
      })
      .catch((error) => {
        setMessage(formatApiError(error, "Unable to load wishlist products"));
      })
      .finally(() => setLoading(false));
  }, []);

  const wishedProducts = useMemo(
    () => products.filter((product) => wishlistIds.includes(product.product_id)),
    [products, wishlistIds]
  );

  const removeFromWishlist = (product) => {
    const next = wishlistIds.filter((id) => id !== product.product_id);
    setWishlistIds(next);
    localStorage.setItem("zanszii_wishlist", JSON.stringify(next));
    setMessage(`${product.name} removed from wishlist`);
  };

  const addToCart = async (product) => {
    setAddingId(product.product_id);
    setMessage("");

    try {
      await addItem(product, 1);
      setMessage(`${product.name} added to cart`);
    } catch (error) {
      setMessage(error.message || "Unable to add this product");
    } finally {
      setAddingId("");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-24">
      <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
              <Heart size={21} fill="currentColor" />
            </span>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
                Saved items
              </p>
              <h1 className="mt-0.5 text-xl font-black text-slate-950 sm:text-2xl">
                My Wishlist
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {wishlistIds.length} product{wishlistIds.length === 1 ? "" : "s"} saved
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/products")}
            className="shrink-0 rounded-xl bg-[#F7FAFF] px-3 py-2 text-[11px] font-black text-[#0F4C9C]"
          >
            Shop
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-bold text-[#0F4C9C]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-[20px] border border-slate-200 bg-white p-2.5"
            >
              <div className="aspect-square animate-pulse rounded-2xl bg-slate-100" />
              <div className="mt-3 h-3.5 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : wishedProducts.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {wishedProducts.map((product) => {
            const image =
              product.image_url ||
              product.images?.[0] ||
              FALLBACK;

            const inStock = Number(product.stock) > 0;

            return (
              <article
                key={product.product_id}
                className="group overflow-hidden rounded-[20px] border border-slate-200 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/products/${product.product_id}`)
                    }
                    className="block w-full"
                  >
                    <div className="aspect-square overflow-hidden rounded-2xl bg-[#F7FAFF] p-2">
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                        onError={(event) => {
                          event.currentTarget.src = FALLBACK;
                        }}
                      />
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label={`Remove ${product.name} from wishlist`}
                    onClick={() => removeFromWishlist(product)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-rose-500 shadow-sm backdrop-blur"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(`/products/${product.product_id}`)
                  }
                  className="mt-3 block w-full text-left"
                >
                  <p className="truncate text-[9px] font-black uppercase tracking-[0.13em] text-[#0F4C9C]">
                    {product.category?.name ||
                      product.category_name ||
                      "ZANSZI"}
                  </p>

                  <h2 className="mt-1 line-clamp-2 min-h-[36px] text-[13px] font-black leading-[18px] text-slate-900">
                    {product.name}
                  </h2>

                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-[#062B5F]">
                        {money(product.price)}
                      </p>
                      <p
                        className={`mt-0.5 text-[9px] font-bold ${
                          inStock ? "text-emerald-600" : "text-rose-500"
                        }`}
                      >
                        {inStock ? "In stock" : "Sold out"}
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!inStock || addingId === product.product_id}
                  onClick={() => addToCart(product)}
                  className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F4C9C] px-3 text-[11px] font-black text-white disabled:bg-slate-300"
                >
                  <ShoppingCart size={14} />
                  {!inStock
                    ? "Sold out"
                    : addingId === product.product_id
                      ? "Adding..."
                      : "Add to cart"}
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-[26px] border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-sm">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-rose-500">
            <Heart size={29} />
          </span>
          <h2 className="mt-4 text-xl font-black text-slate-900">
            Your wishlist is empty
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Save products you love and come back to them anytime.
          </p>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="mt-5 rounded-xl bg-[#0F4C9C] px-5 py-3 text-sm font-black text-white"
          >
            Explore products
          </button>
        </section>
      )}
    </div>
  );
}
