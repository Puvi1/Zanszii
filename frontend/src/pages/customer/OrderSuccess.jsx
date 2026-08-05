import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle,
  ClipboardText,
  Copy,
  Gift,
  Headset,
  House,
  Package,
  Printer,
  Receipt,
  ShareNetwork,
  ShieldCheck,
  ShoppingBag,
  Sparkle,
  Star,
  Truck,
  Wallet,
} from "@phosphor-icons/react";

import { api, formatApiError } from "../../lib/api";

const FALLBACK =
  "https://placehold.co/700x700/F5F9FF/0F4C9C?text=ZANSZI";

const STATUS_STEPS = [
  "placed",
  "confirmed",
  "processing",
  "assigned",
  "out_for_delivery",
  "delivered",
];

function money(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  });
}

function label(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatDate(value) {
  if (!value) return "Just now";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estimatedDelivery(createdAt) {
  const date = createdAt
    ? new Date(createdAt)
    : new Date();

  date.setDate(date.getDate() + 3);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function productImage(item) {
  return (
    item?.image_url ||
    item?.image ||
    item?.images?.[0] ||
    FALLBACK
  );
}

export default function OrderSuccess() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stateOrder = location.state?.order;

  const [order, setOrder] = useState(
    stateOrder || null
  );
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(
    !stateOrder
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [
          orderResponse,
          productsResponse,
        ] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api
            .get("/products")
            .catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        setOrder(orderResponse.data);
        setProducts(
          Array.isArray(productsResponse.data)
            ? productsResponse.data
            : []
        );
      } catch (requestError) {
        if (!active) return;

        setError(
          formatApiError(
            requestError,
            "Unable to load this order."
          )
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (orderId) {
      load();
    }

    return () => {
      active = false;
    };
  }, [orderId]);

  useEffect(() => {
    if (stateOrder && !products.length) {
      api
        .get("/products")
        .then((response) => {
          setProducts(
            Array.isArray(response.data)
              ? response.data
              : []
          );
        })
        .catch(() => {});
    }
  }, [stateOrder, products.length]);

  const subtotal = Number(
    order?.subtotal ??
      (order?.items || []).reduce(
        (sum, item) =>
          sum +
          Number(
            item.line_total ??
              Number(item.price || 0) *
                Number(item.quantity || 0)
          ),
        0
      )
  );

  const discount = Number(
    order?.discount || 0
  );

  const deliveryCharge = Number(
    order?.delivery_charge || 0
  );

  const total = Number(
    order?.total ??
      subtotal + deliveryCharge - discount
  );

  const savings = Number(
    order?.savings ?? discount
  );

  const itemCount = (order?.items || []).reduce(
    (sum, item) =>
      sum + Number(item.quantity || 0),
    0
  );

  const currentStatusIndex = Math.max(
    0,
    STATUS_STEPS.indexOf(
      order?.status || "placed"
    )
  );

  const recommended = useMemo(() => {
    const orderedIds = new Set(
      (order?.items || []).map(
        (item) => item.product_id
      )
    );

    const orderedCategoryIds = new Set(
      (order?.items || [])
        .map((item) => {
          const product = products.find(
            (candidate) =>
              candidate.product_id ===
              item.product_id
          );

          return product?.category_id;
        })
        .filter(Boolean)
    );

    return products
      .filter(
        (product) =>
          Number(product.stock) > 0 &&
          !orderedIds.has(product.product_id)
      )
      .sort((first, second) => {
        const firstScore =
          (first.featured ? 2 : 0) +
          (orderedCategoryIds.has(
            first.category_id
          )
            ? 2
            : 0);

        const secondScore =
          (second.featured ? 2 : 0) +
          (orderedCategoryIds.has(
            second.category_id
          )
            ? 2
            : 0);

        return secondScore - firstScore;
      })
      .slice(0, 6);
  }, [products, order]);

  const copyOrderNumber = async () => {
    const value =
      order?.order_number ||
      order?.order_id ||
      orderId;

    try {
      await navigator.clipboard.writeText(
        value
      );
      setMessage("Order number copied.");
    } catch {
      setMessage(
        "Unable to copy the order number."
      );
    }
  };

  const shareOrder = async () => {
    const shareData = {
      title: "My ZANSZI order",
      text: `My ZANSZI order ${
        order?.order_number || orderId
      } was placed successfully.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          window.location.href
        );
        setMessage("Order link copied.");
      }
    } catch (shareError) {
      if (shareError?.name !== "AbortError") {
        setMessage(
          "Unable to share this order."
        );
      }
    }
  };

  const printOrder = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 pb-24">
        <div className="h-72 animate-pulse rounded-[32px] bg-slate-200" />

        <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="h-80 animate-pulse rounded-[28px] bg-slate-200" />
          <div className="h-80 animate-pulse rounded-[28px] bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-2xl rounded-[32px] border border-red-100 bg-white px-6 py-16 text-center shadow-sm">
        <Package
          size={52}
          className="mx-auto text-red-400"
        />

        <h1 className="mt-4 text-2xl font-black text-slate-900">
          Order details unavailable
        </h1>

        <p className="mt-2 text-slate-500">
          {error ||
            "We could not load this order."}
        </p>

        <Link
          to="/orders"
          className="mt-6 inline-flex rounded-2xl bg-[#0F4C9C] px-5 py-3 font-black text-white"
        >
          View my orders
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <section className="relative overflow-hidden rounded-[34px] bg-gradient-to-br from-[#041F46] via-[#062B5F] to-[#0F4C9C] px-5 py-8 text-white shadow-[0_26px_80px_rgba(6,43,95,0.28)] sm:px-8 sm:py-10">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-52 w-52 rounded-full bg-emerald-300/10 blur-3xl" />

        <div className="absolute left-8 top-8 h-2 w-2 rounded-full bg-amber-300" />
        <div className="absolute right-24 top-16 h-2.5 w-2.5 rotate-45 bg-emerald-300" />
        <div className="absolute bottom-12 left-1/4 h-2 w-2 rounded-full bg-blue-200" />

        <div className="relative mx-auto max-w-3xl text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-white/15 backdrop-blur">
            <CheckCircle
              size={52}
              weight="fill"
              className="text-emerald-300"
            />
          </span>

          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
            <Sparkle size={15} weight="fill" />
            Order confirmed
          </p>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            Thank you for your order!
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
            Your ZANSZI order has been received.
            We’ll notify you as it moves through
            confirmation, packing and delivery.
          </p>

          <div className="mx-auto mt-6 inline-flex max-w-full items-center gap-3 rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-200">
                Order number
              </p>

              <p className="truncate text-lg font-black">
                {order.order_number ||
                  order.order_id}
              </p>
            </div>

            <button
              type="button"
              onClick={copyOrderNumber}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"
              aria-label="Copy order number"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0F4C9C]">
          {message}
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
                <Truck size={21} />
              </span>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                  Delivery progress
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Track your order
                </h2>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {STATUS_STEPS.map(
                (status, index) => {
                  const complete =
                    index <= currentStatusIndex;

                  return (
                    <div
                      key={status}
                      className="text-center"
                    >
                      <span
                        className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-xs font-black ${
                          complete
                            ? "bg-[#0F4C9C] text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {complete ? (
                          <Check
                            size={16}
                            weight="bold"
                          />
                        ) : (
                          index + 1
                        )}
                      </span>

                      <p className="mt-2 text-[9px] font-black leading-4 text-slate-500">
                        {label(status)}
                      </p>
                    </div>
                  );
                }
              )}
            </div>

            <div className="mt-6 rounded-2xl bg-[#F7FAFF] p-4">
              <div className="flex items-start gap-3">
                <CalendarDays
                  size={20}
                  className="mt-0.5 shrink-0 text-[#0F4C9C]"
                />

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Estimated delivery
                  </p>

                  <p className="mt-1 text-lg font-black text-slate-950">
                    {estimatedDelivery(
                      order.created_at
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-950">
              Ordered items
            </h2>

            <div className="mt-4 space-y-3">
              {(order.items || []).map(
                (item, index) => (
                  <div
                    key={
                      item.product_id || index
                    }
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3"
                  >
                    <div className="h-14 w-14 overflow-hidden rounded-xl bg-[#F7FAFF]">
                      <img
                        src={productImage(item)}
                        alt={
                          item.name ||
                          item.product_name
                        }
                        className="h-full w-full object-contain p-1.5"
                        onError={(event) => {
                          event.currentTarget.src =
                            FALLBACK;
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {item.name ||
                          item.product_name ||
                          "Product"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Qty {item.quantity} ·{" "}
                        {money(item.price)} each
                      </p>
                    </div>

                    <strong className="text-sm text-slate-950">
                      {money(
                        item.line_total ??
                          Number(
                            item.price || 0
                          ) *
                            Number(
                              item.quantity || 0
                            )
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-950">
              Delivery details
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailCard
                icon={House}
                title="Delivery address"
                value={[
                  order.delivery_address,
                  order.city,
                  order.state,
                  order.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />

              <DetailCard
                icon={Wallet}
                title="Payment method"
                value={
                  order.payment_method
                    ? label(
                        order.payment_method
                      )
                    : "Cash on Delivery"
                }
              />

              <DetailCard
                icon={CalendarDays}
                title="Order placed"
                value={formatDate(
                  order.created_at
                )}
              />

              <DetailCard
                icon={Receipt}
                title="Payment status"
                value={label(
                  order.payment_status ||
                    "pending"
                )}
              />
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                <Receipt size={21} />
              </span>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                  Payment summary
                </p>

                <h2 className="mt-1 text-xl font-black text-slate-950">
                  Order total
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <SummaryRow
                label={`Subtotal (${itemCount} item${
                  itemCount === 1 ? "" : "s"
                })`}
                value={money(subtotal)}
              />

              <SummaryRow
                label="Coupon discount"
                value={
                  discount > 0
                    ? `-${money(discount)}`
                    : money(0)
                }
                positive={discount > 0}
              />

              <SummaryRow
                label="Delivery charge"
                value={
                  deliveryCharge > 0
                    ? money(deliveryCharge)
                    : "FREE"
                }
                positive={
                  deliveryCharge === 0
                }
              />

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                <span className="text-base font-black text-slate-950">
                  Total
                </span>

                <strong className="text-2xl font-black text-[#062B5F]">
                  {money(total)}
                </strong>
              </div>
            </div>

            {savings > 0 && (
              <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
                <div className="flex items-center gap-3">
                  <Gift
                    size={21}
                    className="text-emerald-600"
                  />

                  <div>
                    <p className="text-sm font-black text-emerald-800">
                      You saved {money(savings)}
                    </p>

                    <p className="mt-1 text-xs text-emerald-700">
                      Savings applied successfully
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">
              What would you like to do?
            </h2>

            <div className="mt-4 grid gap-3">
              <Link
                to={`/orders/${order.order_id}`}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-4 py-3 text-sm font-black text-white"
              >
                <Truck size={18} />
                Track order
              </Link>

              <Link
                to="/products"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"
              >
                <ShoppingBag size={18} />
                Continue shopping
              </Link>

              <button
                type="button"
                onClick={printOrder}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"
              >
                <Printer size={18} />
                Print order
              </button>

              <button
                type="button"
                onClick={shareOrder}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700"
              >
                <ShareNetwork size={18} />
                Share order
              </button>

              <Link
                to="/orders"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700"
              >
                <ClipboardText size={18} />
                View all orders
              </Link>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <TrustCard
              icon={ShieldCheck}
              title="Quality assured"
              subtitle="Carefully listed products"
            />

            <TrustCard
              icon={Headset}
              title="Customer support"
              subtitle="Help whenever you need it"
            />

            <TrustCard
              icon={Package}
              title="Secure packing"
              subtitle="Handled with care"
            />
          </section>
        </div>
      </section>

      {recommended.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                Continue shopping
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-950">
                Recommended for you
              </h2>
            </div>

            <Link
              to="/products"
              className="inline-flex items-center gap-1 text-sm font-black text-[#0F4C9C]"
            >
              View all
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-3">
            {recommended.map((product) => (
              <Link
                key={product.product_id}
                to={`/products/${product.product_id}`}
                className="group min-w-[165px] max-w-[165px] overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-w-[185px] sm:max-w-[185px]"
              >
                <div className="aspect-square overflow-hidden bg-[#F7FAFF] p-3">
                  <img
                    src={
                      product.image_url ||
                      product.images?.[0] ||
                      FALLBACK
                    }
                    alt={product.name}
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-105"
                    onError={(event) => {
                      event.currentTarget.src =
                        FALLBACK;
                    }}
                  />
                </div>

                <div className="p-3">
                  <p className="line-clamp-2 min-h-[36px] text-[13px] font-black leading-[18px] text-slate-900">
                    {product.name}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-base font-black text-[#062B5F]">
                      {money(product.price)}
                    </p>

                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#0F4C9C] text-white">
                      <ArrowRight
                        size={14}
                        weight="bold"
                      />
                    </span>
                  </div>

                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                    <Star
                      size={12}
                      weight="fill"
                    />
                    Recommended
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  positive = false,
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">
        {label}
      </span>

      <strong
        className={
          positive
            ? "text-emerald-600"
            : "text-slate-900"
        }
      >
        {value}
      </strong>
    </div>
  );
}

function DetailCard({
  icon: Icon,
  title,
  value,
}) {
  return (
    <div className="rounded-2xl bg-[#F7FAFF] p-4">
      <Icon
        size={20}
        className="text-[#0F4C9C]"
      />

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
        {title}
      </p>

      <p className="mt-1 break-words text-sm font-black leading-6 text-slate-900">
        {value || "—"}
      </p>
    </div>
  );
}

function TrustCard({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
      <Icon
        size={21}
        className="text-[#0F4C9C]"
      />

      <p className="mt-3 text-sm font-black text-slate-900">
        {title}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}
