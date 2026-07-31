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
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <section className="rounded-3xl bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] px-5 py-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Heart size={25} fill="currentColor" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Saved for later
            </p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">My Wishlist</h1>
            <p className="mt-1 text-sm text-blue-100">
              {wishlistIds.length} saved product{wishlistIds.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0F4C9C]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-3"
            >
              <div className="aspect-square animate-pulse rounded-xl bg-slate-200" />
              <div className="mt-3 h-4 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      ) : wishedProducts.length > 0 ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {wishedProducts.map((product) => {
            const image = product.image_url || product.images?.[0] || FALLBACK;

            return (
              <article
                key={product.product_id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/products/${product.product_id}`)}
                  className="block w-full text-left"
                >
                  <div className="aspect-square overflow-hidden rounded-xl bg-[#F4F8FC]">
                    <img
                      src={image}
                      alt={product.name}
                      className="h-full w-full object-contain p-2"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK;
                      }}
                    />
                  </div>

                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#0F4C9C]">
                    {product.category?.name || product.category_name || "Zanszii"}
                  </p>

                  <h2 className="mt-1 line-clamp-2 min-h-[40px] text-sm font-black leading-5 text-slate-900">
                    {product.name}
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    {product.unit ? `Per ${product.unit}` : "Per piece"}
                  </p>

                  <p className="mt-3 text-lg font-black text-slate-900">
                    {money(product.price)}
                  </p>
                </button>

                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    disabled={product.stock <= 0 || addingId === product.product_id}
                    onClick={() => addToCart(product)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C9C] px-3 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
                  >
                    <ShoppingCart size={16} />
                    {product.stock <= 0
                      ? "Sold out"
                      : addingId === product.product_id
                      ? "Adding..."
                      : "Add"}
                  </button>

                  <button
                    type="button"
                    aria-label={`Remove ${product.name} from wishlist`}
                    onClick={() => removeFromWishlist(product)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#0F4C9C]">
            <Package size={30} />
          </span>
          <h2 className="mt-4 text-xl font-black text-slate-900">
            Your wishlist is empty
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Tap the heart icon on any product to save it here for later.
          </p>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="mt-5 rounded-xl bg-[#0F4C9C] px-5 py-3 text-sm font-black text-white"
          >
            Start shopping
          </button>
        </section>
      )}
    </div>
  );
}
