import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Heart,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
} from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";

const FALLBACK = "https://placehold.co/900x900/F5F9FF/0F4C9C?text=ZANSZII";

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function productImages(product) {
  const candidates = [
    ...(Array.isArray(product?.images) ? product.images : []),
    product?.image_url,
    product?.image,
  ].filter(Boolean);

  return [...new Set(candidates)].length ? [...new Set(candidates)] : [FALLBACK];
}

export default function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addItem, itemCount } = useCart();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [selectedImage, setSelectedImage] = useState(FALLBACK);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const [{ data }, productsResponse] = await Promise.all([
          api.get(`/products/${productId}`),
          api.get("/products").catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        setProduct(data);
        const images = productImages(data);
        setSelectedImage(images[0]);

        const allProducts = Array.isArray(productsResponse.data) ? productsResponse.data : [];
        const matching = allProducts
          .filter(
            (item) =>
              item.product_id !== data.product_id &&
              (!data.category_id || item.category_id === data.category_id)
          )
          .slice(0, 4);
        setRelated(matching);
      } catch (requestError) {
        if (!active) return;
        setError(formatApiError(requestError, "Unable to load this product."));
      } finally {
        if (active) setLoading(false);
      }
    }

    if (productId) loadProduct();
    return () => {
      active = false;
    };
  }, [productId]);

  const images = useMemo(() => productImages(product), [product]);
  const stock = Number(product?.stock || 0);
  const inStock = stock > 0;
  const maxQuantity = Math.max(1, Math.min(stock || 1, 10));

  const changeQuantity = (next) => {
    setQuantity(Math.max(1, Math.min(next, maxQuantity)));
  };

  const handleAddToCart = async () => {
    if (!product || !inStock) return;
    setAdding(true);
    setMessage("");
    try {
      await addItem(product, quantity);
      setMessage(`${product.name} added to your cart.`);
    } catch (requestError) {
      setMessage(requestError.message || "Unable to add this product to cart.");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!product || !inStock) return;
    setBuying(true);
    setMessage("");
    try {
      await addItem(product, quantity);
      navigate("/checkout");
    } catch (requestError) {
      setMessage(requestError.message || "Unable to continue to checkout.");
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[32px] bg-slate-200" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-6 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-32 animate-pulse rounded-3xl bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="rounded-[32px] border border-red-100 bg-white px-6 py-16 text-center shadow-sm">
        <Package size={52} className="mx-auto text-red-400" />
        <h1 className="mt-4 text-2xl font-black text-slate-900">Product not available</h1>
        <p className="mt-2 text-slate-500">{error || "This product could not be found."}</p>
        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-3 font-bold text-white"
        >
          <ArrowLeft size={19} /> Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-28 md:pb-10">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 shadow-sm"
        >
          <ArrowLeft size={19} /> Back
        </button>
        <Link
          to="/cart"
          className="inline-flex items-center gap-2 rounded-2xl bg-[#062B5F] px-4 py-3 font-bold text-white"
        >
          <ShoppingCart size={20} weight="fill" /> Cart ({itemCount})
        </Link>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 font-semibold text-[#0F4C9C]">
          <CheckCircle size={21} weight="fill" /> {message}
        </div>
      )}

      <section className="grid gap-8 rounded-[34px] border border-slate-200 bg-white p-4 shadow-sm md:p-7 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[28px] bg-[#F5F9FF]">
            <img
              src={selectedImage || FALLBACK}
              alt={product.name}
              className="h-full w-full object-contain p-4 transition duration-500 hover:scale-110"
              onError={(event) => {
                event.currentTarget.src = FALLBACK;
              }}
            />

            {product.featured && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#F4B400] px-3 py-1.5 text-xs font-black text-[#062B5F] shadow-sm">
                <Star size={15} weight="fill" /> Featured
              </span>
            )}

            <button
              type="button"
              onClick={() => setWishlisted((value) => !value)}
              aria-label="Save product"
              className={`absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full shadow-md transition ${
                wishlisted ? "bg-rose-500 text-white" : "bg-white text-slate-700"
              }`}
            >
              <Heart size={22} weight={wishlisted ? "fill" : "regular"} />
            </button>
          </div>

          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={() => setSelectedImage(image)}
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-[#F5F9FF] ${
                    selectedImage === image ? "border-[#0F4C9C]" : "border-transparent"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-[#0F4C9C]">
              {product.category?.name || product.category_name || "Zanszii Product"}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 md:text-4xl">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">
                <Star size={17} weight="fill" /> {Number(product.rating || 4.8).toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-slate-500">
                {product.review_count || 0} customer reviews
              </span>
            </div>

            <div className="mt-6 rounded-3xl bg-[#F5F9FF] p-5">
              <p className="text-3xl font-black text-[#062B5F]">{money(product.price)}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Price per {product.unit || "unit"} · Inclusive of applicable taxes
              </p>
            </div>

            <p className="mt-6 leading-7 text-slate-600">
              {product.description || "Premium Zanszii cleaning product designed for reliable everyday use."}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <Truck size={25} className="text-[#0F4C9C]" />
              <p className="mt-2 text-sm font-black text-slate-900">Fast delivery</p>
              <p className="mt-1 text-xs text-slate-500">Quick local dispatch</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <ShieldCheck size={25} className="text-[#0F4C9C]" />
              <p className="mt-2 text-sm font-black text-slate-900">Quality assured</p>
              <p className="mt-1 text-xs text-slate-500">Trusted Zanszii quality</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <Package size={25} className="text-[#0F4C9C]" />
              <p className="mt-2 text-sm font-black text-slate-900">Secure packing</p>
              <p className="mt-1 text-xs text-slate-500">Packed with care</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 p-4">
            <div>
              <p className={`font-black ${inStock ? "text-emerald-600" : "text-red-500"}`}>
                {inStock ? "In stock" : "Out of stock"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {inStock ? `${stock} item${stock === 1 ? "" : "s"} currently available` : "Please check again later"}
              </p>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => changeQuantity(quantity - 1)}
                disabled={quantity <= 1}
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 disabled:opacity-30"
              >
                <Minus size={18} weight="bold" />
              </button>
              <span className="min-w-12 text-center text-lg font-black text-slate-900">{quantity}</span>
              <button
                type="button"
                onClick={() => changeQuantity(quantity + 1)}
                disabled={!inStock || quantity >= maxQuantity}
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 disabled:opacity-30"
              >
                <Plus size={18} weight="bold" />
              </button>
            </div>
          </div>

          <div className="mt-6 hidden grid-cols-2 gap-3 md:grid">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock || adding || buying}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0F4C9C] px-5 py-4 font-black text-[#0F4C9C] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart size={21} weight="fill" /> {adding ? "Adding..." : "Add to cart"}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!inStock || adding || buying}
              className="rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white shadow-lg transition hover:bg-[#0B3C7D] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {buying ? "Please wait..." : "Buy now"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-slate-950">Product information</h2>
        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">Product ID</p>
            <p className="mt-1 break-all font-black text-slate-900">{product.product_id}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">Unit</p>
            <p className="mt-1 font-black text-slate-900">{product.unit || "Unit"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">Availability</p>
            <p className="mt-1 font-black text-slate-900">{inStock ? "Available" : "Unavailable"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">Payment</p>
            <p className="mt-1 font-black text-slate-900">Cash on Delivery</p>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#0F4C9C]">You may also like</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Related products</h2>
            </div>
            <Link to="/products" className="font-bold text-[#0F4C9C]">View all</Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <Link
                key={item.product_id}
                to={`/products/${item.product_id}`}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="aspect-square bg-[#F5F9FF]">
                  <img
                    src={productImages(item)[0]}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK;
                    }}
                  />
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-black text-slate-900">{item.name}</h3>
                  <p className="mt-2 text-lg font-black text-[#062B5F]">{money(item.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,.12)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!inStock || adding || buying}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0F4C9C] px-4 py-3 font-black text-[#0F4C9C] disabled:opacity-40"
          >
            <ShoppingCart size={20} weight="fill" /> {adding ? "Adding..." : "Add"}
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!inStock || adding || buying}
            className="rounded-2xl bg-[#0F4C9C] px-4 py-3 font-black text-white disabled:bg-slate-300"
          >
            {buying ? "Please wait..." : "Buy now"}
          </button>
        </div>
      </div>
    </div>
  );
}

