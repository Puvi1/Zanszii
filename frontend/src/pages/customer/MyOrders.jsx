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
    <div className="space-y-5 pb-24">
      <section className="rounded-[28px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Package size={29} weight="duotone" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">Order history</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">My Orders</h1>
            <p className="mt-1 text-sm text-blue-100">Track, review and reorder your ZANSZI purchases.</p>
          </div>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      {!sortedOrders.length ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#0F4C9C]"><ShoppingBag size={38} weight="duotone" /></span>
          <h2 className="mt-5 text-2xl font-black text-slate-900">No orders yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Once you place your first order, you can track it here.</p>
          <Link to="/products" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#0F4C9C] px-6 py-3 text-sm font-black text-white">Start shopping<ArrowRight size={17} weight="bold" /></Link>
        </section>
      ) : (
        <section className="space-y-4">
          {sortedOrders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const status = order.status || "placed";
            const address = [order.delivery_address, order.city, order.state, order.postal_code].filter(Boolean).join(", ");

            return (
              <article key={order.order_id} className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:shadow-lg">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-black text-slate-900 sm:text-lg">{order.order_number || order.order_id}</h2>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black ring-1 ${STATUS_STYLES[status] || STATUS_STYLES.placed}`}>{STATUS_LABELS[status] || "Placed"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><CalendarBlank size={15} />{formatDate(order.created_at)}</span>
                        <span className="inline-flex items-center gap-1.5"><Package size={15} />{items.length} {items.length === 1 ? "product" : "products"}</span>
                      </div>
                    </div>
                    <p className="text-xl font-black text-[#062B5F] sm:text-2xl">{money(order.total)}</p>
                  </div>

                  <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                    {items.slice(0, 4).map((item, index) => (
                      <div key={`${item.product_id || index}-${index}`} className="flex min-w-[180px] items-center gap-3 rounded-2xl bg-[#F5F9FF] p-2.5">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white p-1.5">
                          <img src={item.image_url || item.images?.[0] || FALLBACK} alt={item.name || "Product"} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.src = FALLBACK; }} />
                        </div>
                        <div className="min-w-0"><p className="line-clamp-2 text-xs font-black leading-4 text-slate-900">{item.name || "Product"}</p><p className="mt-1 text-[11px] text-slate-500">Qty: {item.quantity || 1}</p></div>
                      </div>
                    ))}
                    {items.length > 4 && <div className="grid min-w-[80px] place-items-center rounded-2xl bg-slate-100 p-3 text-sm font-black text-slate-600">+{items.length - 4}</div>}
                  </div>

                  {address && <div className="mt-4 flex items-start gap-2 rounded-2xl border border-slate-100 bg-white p-3"><MapPin size={18} className="mt-0.5 shrink-0 text-[#0F4C9C]" /><p className="line-clamp-2 text-xs leading-5 text-slate-600">{address}</p></div>}
                  <OrderTimeline status={status} />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/70 p-3 sm:px-5">
                  <button type="button" onClick={() => navigate(`/orders/${order.order_id}`)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0F4C9C] px-4 text-xs font-black text-white sm:flex-none">View Order<ArrowRight size={16} weight="bold" /></button>
                  <button type="button" disabled={reorderingId === order.order_id} onClick={() => reorder(order)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-[#0F4C9C] disabled:opacity-50 sm:flex-none"><ArrowClockwise size={16} />{reorderingId === order.order_id ? "Adding..." : "Reorder"}</button>
                  <button type="button" onClick={() => downloadInvoice(order)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 sm:flex-none"><DownloadSimple size={16} />Invoice</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><Truck size={23} className="text-[#0F4C9C]" /><p className="mt-3 text-sm font-black text-slate-900">Track delivery</p><p className="mt-1 text-xs leading-5 text-slate-500">Follow every step from order placement to delivery.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><Receipt size={23} className="text-[#0F4C9C]" /><p className="mt-3 text-sm font-black text-slate-900">Invoice access</p><p className="mt-1 text-xs leading-5 text-slate-500">Open and print an invoice for every order.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4"><ArrowClockwise size={23} className="text-[#0F4C9C]" /><p className="mt-3 text-sm font-black text-slate-900">Quick reorder</p><p className="mt-1 text-xs leading-5 text-slate-500">Add previously ordered products back to your cart.</p></div>
      </section>
    </div>
  );
}
