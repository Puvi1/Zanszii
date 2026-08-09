import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowClockwise,
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  Clock,
  DownloadSimple,
  MapPin,
  Package,
  Receipt,
  ShoppingBag,
  Truck,
} from "@phosphor-icons/react";

import { api, formatApiError } from "../../lib/api";
import { useCart } from "../../context/CartContext";

const FALLBACK =
  "https://placehold.co/300x300/F4F8FC/0F4C9C?text=ZANSZI";

const STATUS_LABELS = {
  placed: "Placed",
  confirmed: "Confirmed",
  processing: "Processing",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STYLES = {
  placed: "bg-blue-50 text-blue-700 ring-blue-100",
  confirmed: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  processing: "bg-amber-50 text-amber-700 ring-amber-100",
  out_for_delivery: "bg-purple-50 text-purple-700 ring-purple-100",
  delivered: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  cancelled: "bg-red-50 text-red-700 ring-red-100",
};

const STATUS_SEQUENCE = [
  "placed",
  "confirmed",
  "processing",
  "out_for_delivery",
  "delivered",
];

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
  if (status === "cancelled") return 0;
  const index = STATUS_SEQUENCE.indexOf(status);
  return index < 0 ? 1 : index + 1;
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

  const address = [
    order.delivery_address,
    order.city,
    order.state,
    order.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${order.order_number || "ZANSZI Invoice"}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
          .header { display:flex; justify-content:space-between; gap:24px; padding-bottom:20px; border-bottom:2px solid #0F4C9C; }
          .brand { color:#062B5F; font-size:28px; font-weight:800; }
          .muted { color:#64748b; font-size:13px; }
          .section { margin-top:24px; }
          table { width:100%; border-collapse:collapse; margin-top:12px; }
          th, td { border-bottom:1px solid #e2e8f0; padding:12px 8px; text-align:left; }
          th { background:#f8fafc; }
          .total { text-align:right; font-size:22px; font-weight:800; margin-top:20px; color:#062B5F; }
          @media print { button { display:none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div><div class="brand">ZANSZI</div><div class="muted">Clean Living</div></div>
          <div style="text-align:right"><strong>Invoice</strong><div class="muted">${order.order_number || order.order_id || ""}</div><div class="muted">${formatDate(order.created_at)}</div></div>
        </div>
        <div class="section"><strong>Delivery address</strong><div class="muted" style="margin-top:6px">${address || "Not provided"}</div><div class="muted">${order.phone || ""}</div></div>
        <div class="section"><strong>Order items</strong><table><thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="total">Grand Total: ${money(order.total)}</div>
        <div class="muted" style="margin-top:8px;text-align:right">Payment: Cash on Delivery</div>
        <script>window.onload = function () { window.print(); };</script>
      </body>
    </html>
  `;
}

function OrderTimeline({ status }) {
  if (status === "cancelled") {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">
        <Clock size={16} weight="fill" />
        This order was cancelled
      </div>
    );
  }

  const progress = getProgress(status);

  return (
    <div className="mt-5">
      <div className="grid grid-cols-5 gap-1">
        {STATUS_SEQUENCE.map((step, index) => {
          const complete = index < progress;

          return (
            <div key={step} className="text-center">
              <div className="relative flex items-center">
                {index > 0 && (
                  <span className={`absolute right-1/2 h-1 w-full ${complete ? "bg-[#0F4C9C]" : "bg-slate-200"}`} />
                )}
                <span className={`relative z-10 mx-auto grid h-7 w-7 place-items-center rounded-full border-2 ${complete ? "border-[#0F4C9C] bg-[#0F4C9C] text-white" : "border-slate-300 bg-white text-slate-300"}`}>
                  {complete ? <CheckCircle size={17} weight="fill" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                </span>
              </div>
              <p className={`mt-2 text-[9px] font-black sm:text-[10px] ${complete ? "text-[#0F4C9C]" : "text-slate-400"}`}>{STATUS_LABELS[step]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MyOrders() {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reorderingId, setReorderingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadOrders = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/orders/my");
      setOrders(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      setError(formatApiError(requestError, "Unable to load your orders."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()),
    [orders]
  );


  const filteredOrders = useMemo(
    () =>
      statusFilter === "all"
        ? sortedOrders
        : sortedOrders.filter((order) => order.status === statusFilter),
    [sortedOrders, statusFilter]
  );

  const statusCounts = useMemo(() => {
    const counts = {
      all: sortedOrders.length,
      placed: 0,
      confirmed: 0,
      processing: 0,
      out_for_delivery: 0,
      delivered: 0,
    };

    sortedOrders.forEach((order) => {
      if (counts[order.status] !== undefined) {
        counts[order.status] += 1;
      }
    });

    return counts;
  }, [sortedOrders]);

  const reorder = async (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) return;

    setReorderingId(order.order_id);
    setMessage("");
    setError("");

    try {
      for (const item of items) {
        await addItem({ ...item, product_id: item.product_id, name: item.name, price: item.price, stock: item.stock || 999, unit: item.unit || "piece", image_url: item.image_url }, Number(item.quantity || 1));
      }
      setMessage(`${items.length} product${items.length === 1 ? "" : "s"} added to your cart.`);
    } catch (requestError) {
      setError(requestError?.message || "Some products could not be added to your cart.");
    } finally {
      setReorderingId("");
    }
  };

  const downloadInvoice = (order) => {
    const invoiceWindow = window.open("", "_blank", "width=900,height=800");
    if (!invoiceWindow) {
      setError("Please allow pop-ups to download the invoice.");
      return;
    }
    invoiceWindow.document.open();
    invoiceWindow.document.write(invoiceHtml(order));
    invoiceWindow.document.close();
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="h-24 animate-pulse rounded-[26px] bg-slate-200" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-[26px] border border-slate-200 bg-white p-5">
            <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-6 h-20 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-24">
      <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
              <Package size={22} weight="duotone" />
            </span>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                Order history
              </p>
              <h1 className="mt-0.5 text-xl font-black text-slate-950 sm:text-2xl">
                My Orders
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Track, reorder and manage purchases.
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-2xl bg-[#F7FAFF] px-3 py-2 text-right">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              Total
            </p>
            <p className="text-lg font-black text-[#062B5F]">
              {sortedOrders.length}
            </p>
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[22px] border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-1.5 overflow-x-auto">
          {[
            ["all", "All"],
            ["placed", "Placed"],
            ["confirmed", "Confirmed"],
            ["processing", "Processing"],
            ["out_for_delivery", "On the way"],
            ["delivered", "Delivered"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-black transition ${
                statusFilter === value
                  ? "bg-[#0F4C9C] text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                  statusFilter === value
                    ? "bg-white/15"
                    : "bg-slate-100"
                }`}
              >
                {statusCounts[value] || 0}
              </span>
            </button>
          ))}
        </div>
      </section>

      {!filteredOrders.length ? (
        <section className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-[#0F4C9C]">
            <ShoppingBag size={30} weight="duotone" />
          </span>
          <h2 className="mt-4 text-xl font-black text-slate-900">
            {sortedOrders.length ? "No orders in this status" : "No orders yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            {sortedOrders.length
              ? "Choose another status to see your orders."
              : "Once you place your first order, you can track it here."}
          </p>
          {!sortedOrders.length && (
            <Link
              to="/products"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-5 py-3 text-sm font-black text-white"
            >
              Start shopping
              <ArrowRight size={16} weight="bold" />
            </Link>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          {filteredOrders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const status = order.status || "placed";
            const firstItem = items[0];
            const address = [
              order.city,
              order.state,
            ].filter(Boolean).join(", ");

            return (
              <article
                key={order.order_id}
                className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:border-blue-100 hover:shadow-md"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-black text-slate-950 sm:text-base">
                          {order.order_number || order.order_id}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black ring-1 ${
                            STATUS_STYLES[status] || STATUS_STYLES.placed
                          }`}
                        >
                          {STATUS_LABELS[status] || "Placed"}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarBlank size={13} />
                          {formatDate(order.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Package size={13} />
                          {items.length} {items.length === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>

                    <p className="shrink-0 text-lg font-black text-[#062B5F]">
                      {money(order.total)}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F7FAFF] p-1.5">
                        <img
                          src={
                            firstItem?.image_url ||
                            firstItem?.images?.[0] ||
                            FALLBACK
                          }
                          alt={firstItem?.name || "Order product"}
                          className="h-full w-full object-contain"
                          onError={(event) => {
                            event.currentTarget.src = FALLBACK;
                          }}
                        />
                        {items.length > 1 && (
                          <span className="absolute bottom-1 right-1 rounded-full bg-[#062B5F] px-1.5 py-0.5 text-[8px] font-black text-white">
                            +{items.length - 1}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-900">
                          {firstItem?.name || "Order items"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {address || "Delivery address saved"}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#0F4C9C]">
                          <Truck size={13} />
                          {status === "delivered"
                            ? "Delivered"
                            : "Track delivery"}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/orders/${order.order_id}`)}
                        className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0F4C9C] px-3 text-[11px] font-black text-white sm:flex-none"
                      >
                        View
                        <ArrowRight size={14} weight="bold" />
                      </button>

                      <button
                        type="button"
                        disabled={reorderingId === order.order_id}
                        onClick={() => reorder(order)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-[#0F4C9C] disabled:opacity-50"
                        aria-label="Reorder"
                      >
                        <ArrowClockwise size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadInvoice(order)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600"
                        aria-label="Invoice"
                      >
                        <DownloadSimple size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <OrderTimeline status={status} />
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
