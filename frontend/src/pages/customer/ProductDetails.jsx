import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Heart,
  ShareNetwork,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  PencilSimple,
  Trash,
  ThumbsUp,
  X,
} from "@phosphor-icons/react";

import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";
import { useBuyNow } from "../../context/BuyNowContext";
import { useAuth } from "../../context/AuthContext";

const FALLBACK =
  "https://placehold.co/900x900/F5F9FF/0F4C9C?text=ZANSZII";

const WISHLIST_STORAGE_KEY = "zanszii_wishlist";

const EMPTY_REVIEW = {
  rating: 5,
  title: "",
  review: "",
  images: [],
};

function formatReviewDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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

  const uniqueImages = [...new Set(candidates)];

  return uniqueImages.length ? uniqueImages : [FALLBACK];
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

export default function ProductDetails() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const { addItem, itemCount } = useCart();
  const { startBuyNow } = useBuyNow();
  const { user } = useAuth();

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
  const [sharing, setSharing] = useState(false);

  const [reviewData, setReviewData] = useState({
    reviews: [],
    total_reviews: 0,
    average_rating: 0,
    rating_breakdown: {},
    own_review: null,
  });
  const [reviewLoading, setReviewLoading] = useState(true);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW);
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [productId]);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError("");
      setMessage("");
      setQuantity(1);

      try {
        const [{ data }, productsResponse, reviewsResponse] =
          await Promise.all([
            api.get(`/products/${productId}`),
            api.get("/products").catch(() => ({ data: [] })),
            api
              .get(`/products/${productId}/reviews`)
              .catch(() => ({
                data: {
                  reviews: [],
                  total_reviews: 0,
                  average_rating: 0,
                  rating_breakdown: {},
                  own_review: null,
                },
              })),
          ]);

        if (!active) return;

        setProduct(data);

        const images = productImages(data);
        setSelectedImage(images[0]);

        const wishlistIds = readWishlist();
        setWishlisted(wishlistIds.includes(data.product_id));

        const allProducts = Array.isArray(productsResponse.data)
          ? productsResponse.data
          : [];

        const matchingProducts = allProducts
          .filter(
            (item) =>
              item.product_id !== data.product_id &&
              (!data.category_id ||
                item.category_id === data.category_id)
          )
          .slice(0, 4);

        setRelated(matchingProducts);
        setReviewData(reviewsResponse.data);
        setReviewLoading(false);
      } catch (requestError) {
        if (!active) return;

        setError(
          formatApiError(
            requestError,
            "Unable to load this product."
          )
        );
      } finally {
        if (active) {
          setLoading(false);
          setReviewLoading(false);
        }
      }
    }

    if (productId) {
      loadProduct();
    }

    return () => {
      active = false;
    };
  }, [productId]);

  const images = useMemo(
    () => productImages(product),
    [product]
  );

  const stock = Number(product?.stock || 0);
  const inStock = stock > 0;
  const maxQuantity = Math.max(
    1,
    Math.min(stock || 1, 10)
  );

  const changeQuantity = (nextQuantity) => {
    setQuantity(
      Math.max(
        1,
        Math.min(nextQuantity, maxQuantity)
      )
    );
  };

  const toggleWishlist = () => {
    if (!product?.product_id) return;

    const currentWishlist = readWishlist();
    const alreadyWishlisted = currentWishlist.includes(
      product.product_id
    );

    const nextWishlist = alreadyWishlisted
      ? currentWishlist.filter(
          (id) => id !== product.product_id
        )
      : [...currentWishlist, product.product_id];

    localStorage.setItem(
      WISHLIST_STORAGE_KEY,
      JSON.stringify(nextWishlist)
    );

    const isNowWishlisted = nextWishlist.includes(
      product.product_id
    );

    setWishlisted(isNowWishlisted);

    setMessage(
      isNowWishlisted
        ? `${product.name} added to wishlist.`
        : `${product.name} removed from wishlist.`
    );
  };

  const handleAddToCart = async () => {
    if (!product || !inStock || adding || buying) {
      return;
    }

    setAdding(true);
    setMessage("");

    try {
      await addItem(product, quantity);
      setMessage(
        `${product.name} added to your cart.`
      );
    } catch (requestError) {
      setMessage(
        requestError.message ||
          "Unable to add this product to cart."
      );
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = () => {
    if (!product || !inStock || adding || buying) {
      return;
    }

    setBuying(true);

    try {
      startBuyNow(product, quantity);
      navigate("/checkout");
    } catch (requestError) {
      setBuying(false);
      setMessage(
        requestError.message ||
          "Unable to continue to checkout."
      );
    }
  };


  const originalPrice = Number(
    product?.mrp ||
      product?.original_price ||
      product?.price ||
      0
  );

  const currentPrice = Number(product?.price || 0);

  const discountPercentage =
    originalPrice > currentPrice
      ? Math.round(
          ((originalPrice - currentPrice) / originalPrice) * 100
        )
      : 0;

  const savingsAmount =
    originalPrice > currentPrice
      ? originalPrice - currentPrice
      : 0;

  const handleShare = async () => {
    if (!product) return;

    setSharing(true);

    try {
      const shareData = {
        title: product.name,
        text: `Check out ${product.name} on ZANSZI`,
        url: window.location.href,
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setMessage("Product link copied.");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setMessage("Unable to share this product.");
      }
    } finally {
      setSharing(false);
    }
  };

  const openReviewModal = () => {
    const ownReview = reviewData.own_review;

    setReviewForm(
      ownReview
        ? {
            rating: Number(ownReview.rating || 5),
            title: ownReview.title || "",
            review: ownReview.review || "",
            images: Array.isArray(ownReview.images)
              ? ownReview.images
              : [],
          }
        : EMPTY_REVIEW
    );

    setReviewError("");
    setReviewMessage("");
    setReviewModalOpen(true);
  };

  const closeReviewModal = () => {
    setReviewModalOpen(false);
    setReviewError("");
  };

  const updateReviewField = (field, value) => {
    setReviewForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submitReview = async (event) => {
    event.preventDefault();

    if (reviewForm.review.trim().length < 3) {
      setReviewError("Please write at least 3 characters.");
      return;
    }

    setReviewSaving(true);
    setReviewError("");
    setReviewMessage("");

    try {
      const payload = {
        rating: Number(reviewForm.rating),
        title: reviewForm.title.trim() || null,
        review: reviewForm.review.trim(),
        images: reviewForm.images,
      };

      const response = reviewData.own_review
        ? await api.patch(
            `/reviews/${reviewData.own_review.review_id}`,
            payload
          )
        : await api.post(
            `/products/${product.product_id}/reviews`,
            payload
          );

      setReviewData(response.data.summary);
      setReviewMessage(
        reviewData.own_review
          ? "Review updated successfully."
          : "Review submitted successfully."
      );
      setReviewModalOpen(false);
    } catch (requestError) {
      setReviewError(
        formatApiError(
          requestError,
          "Unable to save your review."
        )
      );
    } finally {
      setReviewSaving(false);
    }
  };

  const deleteOwnReview = async () => {
    if (!reviewData.own_review) return;

    const confirmed = window.confirm(
      "Delete your review for this product?"
    );

    if (!confirmed) return;

    setReviewError("");
    setReviewMessage("");

    try {
      const response = await api.delete(
        `/reviews/${reviewData.own_review.review_id}`
      );

      setReviewData(response.data.summary);
      setReviewMessage("Review deleted successfully.");
    } catch (requestError) {
      setReviewError(
        formatApiError(
          requestError,
          "Unable to delete your review."
        )
      );
    }
  };

  const toggleHelpful = async (reviewId) => {
    try {
      const response = await api.post(
        `/reviews/${reviewId}/helpful`
      );

      setReviewData((current) => ({
        ...current,
        reviews: current.reviews.map((review) =>
          review.review_id === reviewId
            ? response.data.review
            : review
        ),
        own_review:
          current.own_review?.review_id === reviewId
            ? response.data.review
            : current.own_review,
      }));
    } catch (requestError) {
      setReviewError(
        formatApiError(
          requestError,
          "Unable to update helpful vote."
        )
      );
    }
  };

  const averageRating = Number(
    reviewData.average_rating || 0
  );
  const totalReviews = Number(
    reviewData.total_reviews || 0
  );

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
        <Package
          size={52}
          className="mx-auto text-red-400"
        />

        <h1 className="mt-4 text-2xl font-black text-slate-900">
          Product not available
        </h1>

        <p className="mt-2 text-slate-500">
          {error ||
            "This product could not be found."}
        </p>

        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-3 font-bold text-white"
        >
          <ArrowLeft size={19} />
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 md:pb-10">


      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 font-semibold text-[#0F4C9C]">
          <CheckCircle
            size={21}
            weight="fill"
          />
          {message}
        </div>
      )}

      <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[#F7FAFF]">
            <img
              src={selectedImage || FALLBACK}
              alt={product.name}
              className="h-full w-full object-contain p-4 transition duration-500 hover:scale-105"
              onError={(event) => {
                event.currentTarget.src = FALLBACK;
              }}
            />

            {discountPercentage > 0 && (
              <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                {discountPercentage}% OFF
              </span>
            )}

            {product.featured && (
              <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#F4B400] px-3 py-1.5 text-xs font-black text-[#062B5F] shadow-sm">
                <Star
                  size={15}
                  weight="fill"
                />
                Featured
              </span>
            )}

            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              aria-label="Share product"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-700 shadow-md transition hover:scale-105 disabled:opacity-50"
            >
              <ShareNetwork size={19} weight="bold" />
            </button>

            <button
              type="button"
              onClick={toggleWishlist}
              aria-label={
                wishlisted
                  ? "Remove product from wishlist"
                  : "Add product to wishlist"
              }
              className={`absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full shadow-md transition hover:scale-105 ${
                wishlisted
                  ? "bg-rose-500 text-white"
                  : "bg-white text-slate-700"
              }`}
            >
              <Heart
                size={20}
                weight={wishlisted ? "fill" : "regular"}
              />
            </button>
          </div>

          {images.length > 1 && (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  onClick={() =>
                    setSelectedImage(image)
                  }
                  className={`h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 bg-[#F5F9FF] ${
                    selectedImage === image
                      ? "border-[#0F4C9C]"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${
                      index + 1
                    }`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.src =
                        FALLBACK;
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
              {product.category?.name ||
                product.category_name ||
                "Zanszii Product"}
            </p>

            <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 md:text-4xl">
              {product.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-700">
                <Star size={17} weight="fill" />
                {averageRating.toFixed(1)}
              </span>

              <span className="text-sm font-semibold text-slate-500">
                {totalReviews} customer
                {totalReviews === 1 ? " review" : " reviews"}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-[#F7FAFF] p-4">
              <div className="flex flex-wrap items-end gap-2">
                <p className="text-3xl font-black text-[#062B5F]">
                  {money(currentPrice)}
                </p>

                {originalPrice > currentPrice && (
                  <>
                    <p className="pb-1 text-sm font-bold text-slate-400 line-through">
                      {money(originalPrice)}
                    </p>

                    <span className="mb-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700">
                      Save {money(savingsAmount)}
                    </span>
                  </>
                )}
              </div>

              <p className="mt-1 text-xs font-medium text-slate-500">
                Per {product.unit || "unit"} · Inclusive of taxes
              </p>
            </div>

            {(product.business_name || product.seller_name) && (
              <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Sold by
                </p>
                <p className="mt-1 font-black text-slate-900">
                  {product.business_name || product.seller_name}
                </p>
              </div>
            )}

          {/* Mobile buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3 md:hidden">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock || adding || buying}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-[#0F4C9C] px-3 py-3 text-sm font-black text-[#0F4C9C] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ShoppingCart
                size={20}
                weight="fill"
              />

              {adding ? "Adding..." : "Add to cart"}
            </button>

            <button
              type="button"
              onClick={handleBuyNow}
              disabled={!inStock || adding || buying}
              className="min-h-14 rounded-2xl bg-[#0F4C9C] px-3 py-3 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {buying ? "Please wait..." : "Buy now"}
            </button>
          </div>

            <p className="mt-6 leading-7 text-slate-600">
              {product.description ||
                "Premium Zanszii cleaning product designed for reliable everyday use."}
            </p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <Truck
                size={25}
                className="text-[#0F4C9C]"
              />

              <p className="mt-2 text-sm font-black text-slate-900">
                Fast delivery
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Quick local dispatch
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <ShieldCheck
                size={25}
                className="text-[#0F4C9C]"
              />

              <p className="mt-2 text-sm font-black text-slate-900">
                Quality assured
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Trusted Zanszii quality
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <Package
                size={25}
                className="text-[#0F4C9C]"
              />

              <p className="mt-2 text-sm font-black text-slate-900">
                Secure packing
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Packed with care
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 p-4">
            <div>
              <p
                className={`font-black ${
                  inStock
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {inStock
                  ? "In stock"
                  : "Out of stock"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {inStock
                  ? `${stock} item${
                      stock === 1 ? "" : "s"
                    } currently available`
                  : "Please check again later"}
              </p>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() =>
                  changeQuantity(quantity - 1)
                }
                disabled={quantity <= 1}
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 disabled:opacity-30"
              >
                <Minus
                  size={18}
                  weight="bold"
                />
              </button>

              <span className="min-w-12 text-center text-lg font-black text-slate-900">
                {quantity}
              </span>

              <button
                type="button"
                onClick={() =>
                  changeQuantity(quantity + 1)
                }
                disabled={
                  !inStock ||
                  quantity >= maxQuantity
                }
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 disabled:opacity-30"
              >
                <Plus
                  size={18}
                  weight="bold"
                />
              </button>
            </div>
          </div>


          {/* Desktop buttons */}
          <div className="mt-6 hidden grid-cols-2 gap-3 md:grid">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!inStock || adding || buying}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#0F4C9C] px-5 py-4 font-black text-[#0F4C9C] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingCart
                size={21}
                weight="fill"
              />

              {adding ? "Adding..." : "Add to cart"}
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
        <h2 className="text-2xl font-black text-slate-950">
          Product information
        </h2>

        <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">
              Product ID
            </p>

            <p className="mt-1 break-all font-black text-slate-900">
              {product.product_id}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">
              Unit
            </p>

            <p className="mt-1 font-black text-slate-900">
              {product.unit || "Unit"}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">
              Availability
            </p>

            <p className="mt-1 font-black text-slate-900">
              {inStock
                ? "Available"
                : "Unavailable"}
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-500">
              Payment
            </p>

            <p className="mt-1 font-black text-slate-900">
              Cash on Delivery
            </p>
          </div>
        </div>
      </section>


      <section id="product-reviews" className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
              Customer feedback
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Ratings & Reviews
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openReviewModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-sm font-black text-white"
            >
              <Star size={17} weight="fill" />
              {reviewData.own_review
                ? "Edit Review"
                : "Write Review"}
            </button>

            {reviewData.own_review && (
              <button
                type="button"
                onClick={deleteOwnReview}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600"
              >
                <Trash size={17} />
                Delete
              </button>
            )}
          </div>
        </div>

        {reviewMessage && (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {reviewMessage}
          </div>
        )}

        {reviewError && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {reviewError}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-3xl bg-[#F5F9FF] p-5">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-[#062B5F]">
                {averageRating.toFixed(1)}
              </span>
              <span className="pb-1 text-sm font-bold text-slate-500">
                out of 5
              </span>
            </div>

            <div className="mt-3 flex items-center gap-1 text-[#F4B400]">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={20}
                  weight={
                    index < Math.round(averageRating)
                      ? "fill"
                      : "regular"
                  }
                />
              ))}
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Based on {totalReviews} review
              {totalReviews === 1 ? "" : "s"}
            </p>

            <div className="mt-5 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = Number(
                  reviewData.rating_breakdown?.[String(star)] || 0
                );
                const percentage = totalReviews
                  ? Math.round((count / totalReviews) * 100)
                  : 0;

                return (
                  <div
                    key={star}
                    className="grid grid-cols-[32px_1fr_40px] items-center gap-2 text-xs"
                  >
                    <span className="font-black text-slate-700">
                      {star}★
                    </span>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#F4B400]"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <span className="text-right font-bold text-slate-500">
                      {percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {reviewLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Loading reviews...
              </div>
            ) : reviewData.reviews.length ? (
              reviewData.reviews.map((review) => (
                <article
                  key={review.review_id}
                  className="rounded-3xl border border-slate-200 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 font-black text-[#0F4C9C]">
                        {(review.customer_name || "C")
                          .charAt(0)
                          .toUpperCase()}
                      </span>

                      <div>
                        <p className="font-black text-slate-900">
                          {review.customer_name || "Customer"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {formatReviewDate(review.created_at)}
                        </p>
                      </div>
                    </div>

                    {review.verified_purchase && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-[#F4B400]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        size={16}
                        weight={
                          index < Number(review.rating || 0)
                            ? "fill"
                            : "regular"
                        }
                      />
                    ))}
                  </div>

                  {review.title && (
                    <h3 className="mt-3 font-black text-slate-900">
                      {review.title}
                    </h3>
                  )}

                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                    {review.review}
                  </p>

                  {Array.isArray(review.images) &&
                    review.images.length > 0 && (
                      <div className="mt-4 flex gap-3 overflow-x-auto">
                        {review.images.map((image, index) => (
                          <img
                            key={`${image}-${index}`}
                            src={image}
                            alt={`Review ${index + 1}`}
                            className="h-20 w-20 rounded-2xl object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display =
                                "none";
                            }}
                          />
                        ))}
                      </div>
                    )}

                  <button
                    type="button"
                    onClick={() =>
                      toggleHelpful(review.review_id)
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                  >
                    <ThumbsUp size={16} />
                    Helpful ({review.helpful_count || 0})
                  </button>
                </article>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <Star
                  size={34}
                  className="mx-auto text-slate-400"
                />

                <h3 className="mt-3 text-lg font-black text-slate-900">
                  No reviews yet
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Be the first customer to review this product.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                You may also like
              </p>

              <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                Related products
              </h2>
            </div>

            <Link
              to="/products"
              className="text-xs font-black text-[#0F4C9C] sm:text-sm"
            >
              View all
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {related.map((item) => (
              <Link
                key={item.product_id}
                to={`/products/${item.product_id}`}
                className="group min-w-[158px] max-w-[158px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-w-[180px] sm:max-w-[180px]"
              >
                <div className="relative aspect-square overflow-hidden bg-[#F7FAFF] p-3">
                  <img
                    src={productImages(item)[0]}
                    alt={item.name}
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK;
                    }}
                  />

                  {item.featured && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[9px] font-black text-[#0F4C9C] shadow-sm">
                      <Star size={11} weight="fill" />
                      Popular
                    </span>
                  )}
                </div>

                <div className="p-3">
                  <p className="line-clamp-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#0F4C9C]">
                    {item.category?.name ||
                      item.category_name ||
                      "ZANSZI"}
                  </p>

                  <h3 className="mt-1 line-clamp-2 min-h-[36px] text-[13px] font-black leading-[18px] text-slate-900">
                    {item.name}
                  </h3>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-base font-black text-[#062B5F]">
                      {money(item.price)}
                    </p>

                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#0F4C9C] text-white">
                      <ArrowRight size={14} weight="bold" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!inStock || adding || buying}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#0F4C9C] px-3 text-sm font-black text-[#0F4C9C] disabled:opacity-40"
          >
            <ShoppingCart size={18} weight="fill" />
            {adding ? "Adding..." : "Add to cart"}
          </button>

          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!inStock || adding || buying}
            className="min-h-12 rounded-xl bg-[#0F4C9C] px-3 text-sm font-black text-white disabled:bg-slate-300"
          >
            {buying ? "Please wait..." : "Buy now"}
          </button>
        </div>
      </div>

      {reviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5">
          <form
            onSubmit={submitReview}
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                  Customer review
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  {reviewData.own_review
                    ? "Edit your review"
                    : "Write a review"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeReviewModal}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            {reviewError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {reviewError}
              </div>
            )}

            <div className="mt-6">
              <p className="text-sm font-black text-slate-800">
                Your rating
              </p>

              <div className="mt-2 flex gap-2">
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        updateReviewField("rating", value)
                      }
                      className="text-[#F4B400]"
                    >
                      <Star
                        size={32}
                        weight={
                          value <= reviewForm.rating
                            ? "fill"
                            : "regular"
                        }
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-black text-slate-800">
                Review title
              </span>

              <input
                value={reviewForm.title}
                onChange={(event) =>
                  updateReviewField(
                    "title",
                    event.target.value
                  )
                }
                maxLength={120}
                placeholder="Example: Excellent product"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-black text-slate-800">
                Your review
              </span>

              <textarea
                required
                value={reviewForm.review}
                onChange={(event) =>
                  updateReviewField(
                    "review",
                    event.target.value
                  )
                }
                minLength={3}
                maxLength={3000}
                placeholder="Share your experience with this product"
                className="mt-2 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>

            <button
              type="submit"
              disabled={reviewSaving}
              className="mt-6 w-full rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white disabled:opacity-60"
            >
              {reviewSaving
                ? "Saving review..."
                : reviewData.own_review
                  ? "Update Review"
                  : "Submit Review"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
