import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  Copy,
  DownloadSimple,
  MapPin,
  Package,
  Phone,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Truck,
  User,
} from "@phosphor-icons/react";

import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";

const FALLBACK =
  "https://placehold.co/500x500/F4F8FC/0F4C9C?text=ZANSZI";

const STEPS = [
  "placed",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
];

const LABELS = {
  placed: "Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  assigned: "Assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  delivery_failed: "Delivery failed",
};

const STATUS_STYLES = {
  placed: "bg-blue-50 text-blue-700 ring-blue-100",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  processing: "bg-amber-50 text-amber-700 ring-amber-100",
  assigned: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  out_for_delivery: "bg-purple-50 text-purple-700 ring-purple-100",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  cancelled: "bg-red-50 text-red-700 ring-red-100",
  delivery_failed: "bg-rose-50 text-rose-700 ring-rose-100",
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function getProgress(status) {
  if (status === "cancelled" || status === "delivery_failed") {
    return 0;
  }

  if (status === "assigned") {
    return 3;
  }

  const index = STEPS.indexOf(status);
  return index < 0 ? 1 : index + 1;
}

function Timeline({ order }) {
  if (order.status === "cancelled") {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-black text-red-700">
        This order was cancelled.
      </div>
    );
  }

  if (order.status === "delivery_failed") {
    return (
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-black text-rose-700">
        Delivery was unsuccessful. Please contact support.
      </div>
    );
  }

  const currentProgress = getProgress(order.status);
  const history = Array.isArray(order.status_history)
    ? order.status_history
    : [];

  const getStepHistory = (step) => {
    if (step === "out_for_delivery") {
      return history.find(
        (entry) => entry.status === "out_for_delivery"
      );
    }

    return history.find((entry) => entry.status === step);
  };

  return (
    <div className="space-y-0">
      {STEPS.map((step, index) => {
        const complete = index < currentProgress;
        const current = index === currentProgress - 1;
        const entry = getStepHistory(step);

        return (
          <div
            key={step}
            className="relative grid grid-cols-[42px_1fr] gap-4"
          >
            {index < STEPS.length - 1 && (
              <span
                className={`absolute left-[20px] top-10 h-[calc(100%-8px)] w-0.5 ${
                  complete ? "bg-[#0F4C9C]" : "bg-slate-200"
                }`}
              />
            )}

            <span
              className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 ${
                complete
                  ? "border-[#0F4C9C] bg-[#0F4C9C] text-white"
                  : current
                    ? "border-[#F4B400] bg-amber-50 text-amber-600"
                    : "border-slate-300 bg-white text-slate-300"
              }`}
            >
              {complete ? (
                <CheckCircle size={22} weight="fill" />
              ) : current ? (
                <Clock size={20} weight="bold" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-current" />
              )}
            </span>

            <div className="pb-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p
                  className={`font-black ${
                    complete || current
                      ? "text-slate-900"
                      : "text-slate-400"
                  }`}
                >
                  {LABELS[step]}
                </p>

                {entry?.at && (
                  <span className="text-xs font-semibold text-slate-400">
                    {formatDate(entry.at)}
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                {entry?.note ||
                  (step === "placed"
                    ? "We received your order."
                    : step === "confirmed"
                      ? "Your order will be confirmed shortly."
                      : step === "processing"
                        ? "Your products are being prepared."
                        : step === "out_for_delivery"
                          ? "Your package will be handed to the delivery partner."
                          : "Your order will be delivered to your address.")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function invoiceHtml(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${item.name || "Product"}</td>
          <td style="text-align:center">${Number(item.quantity || 0)}</td>
          <td style="text-align:right">${money(item.price)}</td>
          <td style="text-align:right">${money(
            item.line_total ||
              Number(item.price || 0) * Number(item.quantity || 0)
          )}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${order.order_number || "ZANSZI Invoice"}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 32px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding-bottom: 20px;
            border-bottom: 2px solid #0F4C9C;
          }
          .brand {
            color: #062B5F;
            font-size: 28px;
            font-weight: 800;
          }
          .muted {
            color: #64748b;
            font-size: 13px;
          }
          .section {
            margin-top: 24px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 12px;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 8px;
            text-align: left;
          }
          th {
            background: #f8fafc;
          }
          .total {
            text-align: right;
            font-size: 22px;
            font-weight: 800;
            margin-top: 20px;
            color: #062B5F;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">ZANSZI</div>
            <div class="muted">Clean Living</div>
          </div>
          <div style="text-align:right">
            <strong>Invoice</strong>
            <div class="muted">${order.order_number || order.order_id || ""}</div>
            <div class="muted">${formatDate(order.created_at)}</div>
          </div>
        </div>

        <div class="section">
          <strong>Delivery address</strong>
          <div class="muted" style="margin-top:6px">
            ${order.delivery_address || ""}<br />
            ${order.city || ""}, ${order.state || ""} - ${order.postal_code || ""}
          </div>
          <div class="muted">${order.phone || ""}</div>
        </div>

        <div class="section">
          <strong>Order items</strong>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Price</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="total">Grand Total: ${money(order.total)}</div>
        <div class="muted" style="margin-top:8px;text-align:right">
          Payment: ${
            order.payment_method === "cash_on_delivery"
              ? "Cash on Delivery"
              : order.payment_method || "Not specified"
          }
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `;
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [order, setOrder] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [{ data }, productResponse] = await Promise.all([
          api.get(`/orders/${orderId}`),
          api.get("/products").catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        setOrder(data);

        const orderProductIds = new Set(
          (data.items || []).map((item) => item.product_id)
        );

        const products = Array.isArray(productResponse.data)
          ? productResponse.data
          : [];

        setRelated(
          products
            .filter(
              (product) =>
                Number(product.stock) > 0 &&
                !orderProductIds.has(product.product_id)
            )
            .slice(0, 4)
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

  const items = useMemo(
    () => (Array.isArray(order?.items) ? order.items : []),
    [order]
  );

  const subtotal = Number(order?.subtotal || order?.total || 0);
  const deliveryCharge = Number(order?.delivery_charge || 0);
  const total = Number(order?.total || subtotal + deliveryCharge);

  const reorder = async () => {
    if (!items.length) return;

    setReordering(true);
    setError("");
    setMessage("");

    try {
      for (const item of items) {
        await addItem(
          {
            ...item,
            product_id: item.product_id,
            name: item.name,
            price: item.price,
            stock: item.stock || 999,
            unit: item.unit || "piece",
            image_url: item.image_url,
          },
          Number(item.quantity || 1)
        );
      }

      setMessage("Items added to your cart.");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Some products could not be added to your cart."
      );
    } finally {
      setReordering(false);
    }
  };

  const copyOrderNumber = async () => {
    const value = order?.order_number || order?.order_id;

    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Unable to copy the order number.");
    }
  };

  const estimatedDeliveryText = (() => {
    if (order?.status === "delivered") {
      return order?.delivered_at
        ? `Delivered on ${formatDate(order.delivered_at)}`
        : "Order delivered";
    }

    if (order?.status === "out_for_delivery") {
      return "Expected today";
    }

    if (order?.status === "assigned") {
      return "Delivery partner assigned";
    }

    if (order?.status === "cancelled") {
      return "Order cancelled";
    }

    return "Estimated delivery will appear after confirmation";
  })();

  const printInvoice = () => {
    if (!order) return;

    const popup = window.open("", "_blank", "width=900,height=800");

    if (!popup) {
      setError("Please allow pop-ups to print the invoice.");
      return;
    }

    popup.document.open();
    popup.document.write(invoiceHtml(order));
    popup.document.close();
  };

  if (loading) {
    return (
      <div className="space-y-5 pb-24">
        <div className="h-36 animate-pulse rounded-[28px] bg-slate-200" />
        <div className="h-44 animate-pulse rounded-[28px] bg-slate-200" />
        <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
          <div className="h-72 animate-pulse rounded-[28px] bg-slate-200" />
          <div className="h-72 animate-pulse rounded-[28px] bg-slate-200" />
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const status = order.status || "placed";

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/orders")}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"
        >
          <ArrowLeft size={18} weight="bold" />
          My Orders
        </button>

        <span
          className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${
            STATUS_STYLES[status] || STATUS_STYLES.placed
          }`}
        >
          {LABELS[status] || "Placed"}
        </span>
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
              Order details
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h1 className="break-all text-xl font-black leading-tight text-slate-900 sm:text-2xl">
                {order.order_number || order.order_id}
              </h1>

              <button
                type="button"
                onClick={copyOrderNumber}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-black text-[#0F4C9C] transition hover:bg-blue-50"
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CalendarBlank size={15} />
                {formatDate(order.created_at)}
              </span>

              <span className="inline-flex items-center gap-1.5">
                <Package size={15} />
                {items.length} {items.length === 1 ? "product" : "products"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F7F9FC] p-3 sm:min-w-[245px] sm:justify-end sm:bg-transparent sm:p-0">
            <div className="sm:text-right">
              <span
                className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-black ring-1 ${
                  STATUS_STYLES[status] || STATUS_STYLES.placed
                }`}
              >
                {LABELS[status] || "Placed"}
              </span>

              <p className="mt-2 text-xs font-semibold text-slate-500">
                {estimatedDeliveryText}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Total
              </p>
              <p className="mt-0.5 text-2xl font-black text-[#062B5F]">
                {money(total)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
              Live progress
            </p>

            <h2 className="mt-1 text-2xl font-black text-slate-900">
              Order tracking
            </h2>
          </div>

          <Truck size={28} className="text-[#0F4C9C]" />
        </div>

        <Timeline order={order} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-slate-900">
              Products
            </h2>

            <span className="text-sm font-bold text-slate-500">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {items.map((item) => (
              <article
                key={item.product_id}
                className="grid grid-cols-[96px_1fr] gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[115px_1fr]"
              >
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/products/${item.product_id}`)
                  }
                  className="aspect-square overflow-hidden rounded-2xl bg-white p-2"
                >
                  <img
                    src={item.image_url || item.images?.[0] || FALLBACK}
                    alt={item.name}
                    className="h-full w-full object-contain"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK;
                    }}
                  />
                </button>

                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/products/${item.product_id}`)
                    }
                    className="text-left"
                  >
                    <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-900 sm:text-base">
                      {item.name}
                    </h3>
                  </button>

                  <p className="mt-2 text-xs text-slate-500">
                    {money(item.price)} × {item.quantity}
                  </p>

                  <p className="mt-2 text-lg font-black text-[#062B5F]">
                    {money(
                      item.line_total ||
                        Number(item.price || 0) *
                          Number(item.quantity || 0)
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      addItem(
                        {
                          ...item,
                          stock: item.stock || 999,
                          unit: item.unit || "piece",
                        },
                        1
                      )
                    }
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#0F4C9C]"
                  >
                    <ShoppingCart size={16} />
                    Buy Again
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
                <MapPin size={22} />
              </span>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0F4C9C]">
                  Delivery address
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  Shipping details
                </h2>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="flex items-center gap-2 font-black text-slate-900">
                <User size={17} />
                {order.customer_name || "Customer"}
              </p>

              <p className="leading-6">
                {order.delivery_address}
                <br />
                {order.city}, {order.state} - {order.postal_code}
              </p>

              <p className="flex items-center gap-2 font-bold text-slate-700">
                <Phone size={17} />
                {order.phone}
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Receipt size={22} />
              </span>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                  Payment
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-900">
                  Price details
                </h2>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <strong className="text-slate-900">
                  {money(subtotal)}
                </strong>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Delivery</span>
                <strong className="text-emerald-600">
                  {deliveryCharge > 0
                    ? money(deliveryCharge)
                    : "FREE"}
                </strong>
              </div>

              {Number(order.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>
                    Discount
                    {order.coupon_code
                      ? ` (${order.coupon_code})`
                      : ""}
                  </span>
                  <strong>
                    -{money(order.discount)}
                  </strong>
                </div>
              )}

              <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-black text-slate-900">
                <span>Total</span>
                <span className="text-[#062B5F]">{money(total)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#F5F9FF] p-3">
              <p className="text-sm font-black text-slate-900">
                {order.payment_method === "cash_on_delivery"
                  ? "Cash on Delivery"
                  : order.payment_method || "Payment method"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Status: {order.payment_status || "Pending"}
              </p>
            </div>
          </section>

          {order.delivery_partner_name && (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-purple-50 text-purple-700">
                  <Truck size={22} />
                </span>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">
                    Delivery partner
                  </p>
                  <h2 className="mt-1 text-lg font-black text-slate-900">
                    {order.delivery_partner_name}
                  </h2>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {order.delivery_partner_phone && (
                  <a
                    href={`tel:${order.delivery_partner_phone}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-3 text-sm font-black text-white"
                  >
                    <Phone size={17} />
                    Call delivery partner
                  </a>
                )}

                {(order.delivery_partner_vehicle_type ||
                  order.delivery_partner_vehicle_number) && (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    {order.delivery_partner_vehicle_type && (
                      <p>
                        <span className="font-black text-slate-800">
                          Vehicle:
                        </span>{" "}
                        {order.delivery_partner_vehicle_type}
                      </p>
                    )}

                    {order.delivery_partner_vehicle_number && (
                      <p className="mt-1">
                        <span className="font-black text-slate-800">
                          Number:
                        </span>{" "}
                        {order.delivery_partner_vehicle_number}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={reorder}
          disabled={reordering}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-4 text-sm font-black text-white disabled:opacity-50"
        >
          <ArrowClockwise size={18} />
          {reordering ? "Adding..." : "Reorder"}
        </button>

        <button
          type="button"
          onClick={printInvoice}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        >
          <DownloadSimple size={18} />
          Download Invoice
        </button>

        <button
          type="button"
          onClick={() => navigate("/support")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
        >
          <Phone size={18} />
          Contact Support
        </button>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck size={24} className="text-[#0F4C9C]" />

          <div>
            <h2 className="font-black text-slate-900">Need help?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Keep your order number ready when contacting support.
            </p>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                You may also like
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                Recommended products
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

          <div className="flex gap-4 overflow-x-auto pb-3">
            {related.map((product) => (
              <Link
                key={product.product_id}
                to={`/products/${product.product_id}`}
                className="min-w-[180px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:min-w-[210px]"
              >
                <div className="aspect-square bg-[#F4F8FC] p-3">
                  <img
                    src={
                      product.image_url ||
                      product.images?.[0] ||
                      FALLBACK
                    }
                    alt={product.name}
                    className="h-full w-full object-contain"
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK;
                    }}
                  />
                </div>

                <div className="p-3">
                  <h3 className="line-clamp-2 min-h-[40px] text-sm font-black text-slate-900">
                    {product.name}
                  </h3>

                  <p className="mt-2 text-lg font-black text-[#062B5F]">
                    {money(product.price)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
