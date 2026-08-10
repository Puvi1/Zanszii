import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowClockwise,
  ArrowRight,
  CalendarBlank,
  CheckCircle,
  DownloadSimple,
  CaretRight,
  MapPin,
  Package,
  ShoppingCart,
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
  assigned: "Processing",
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

const getAddress = (order) => {
  if (!order) return "";

  if (
    typeof order.delivery_address === "string" &&
    order.delivery_address.trim()
  ) {
    const tail = [order.city, order.state, order.postal_code]
      .filter(Boolean)
      .join(", ");

    return [order.delivery_address.trim(), tail].filter(Boolean).join(", ");
  }

  const address =
    order.shipping_address ||
    order.address ||
    order.deliveryAddress ||
    {};

  if (typeof address === "string") return address;

  return [
    address.address_line_1,
    address.address_line_2,
    address.area,
    address.landmark,
    address.city,
    address.state,
    address.postal_code || address.pincode,
  ]
    .filter(Boolean)
    .join(", ");
};

const getProgressIndex = (status) => {
  if (status === "assigned") return 2;

  const index = STEPS.indexOf(status);
  return index < 0 ? 0 : index;
};

function OrderTimeline({ status }) {
  if (status === "cancelled" || status === "delivery_failed") {
    return (
      <div
        className={`rounded-2xl px-4 py-3 text-xs font-black ${
          status === "cancelled"
            ? "bg-red-50 text-red-700"
            : "bg-rose-50 text-rose-700"
        }`}
      >
        {status === "cancelled"
          ? "This order was cancelled."
          : "Delivery was unsuccessful."}
      </div>
    );
  }

  const activeIndex = getProgressIndex(status);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[470px] grid-cols-5 px-1">
        {STEPS.map((step, index) => {
          const complete = index <= activeIndex;
          const connectorComplete = index <= activeIndex;

          return (
            <div key={step} className="relative text-center">
              {index > 0 && (
                <span
                  className={`absolute right-1/2 top-[10px] h-[2px] w-full rounded-full ${
                    connectorComplete ? "bg-[#0F5DB8]" : "bg-slate-200"
                  }`}
                />
              )}

              <span
                className={`relative z-10 mx-auto grid h-5 w-5 place-items-center rounded-full border-[3px] ${
                  complete
                    ? "border-[#0F5DB8] bg-[#0F5DB8] text-white"
                    : "border-slate-200 bg-white text-slate-300"
                }`}
              >
                {complete ? (
                  <CheckCircle size={10} weight="fill" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>

              <p
                className={`mt-1.5 text-[8px] font-black leading-4 ${
                  complete ? "text-[#0A4B94]" : "text-slate-400"
                }`}
              >
                {LABELS[step]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function invoiceHtml(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const address = getAddress(order);

  const rows = items
    .map(
      (item) => `
        <tr>
          <td>${item.name || "Product"}</td>
          <td style="text-align:center">${Number(item.quantity || 1)}</td>
          <td style="text-align:right">${money(item.price)}</td>
          <td style="text-align:right">${money(
            item.line_total ||
              Number(item.price || 0) * Number(item.quantity || 1)
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
          th,
          td {
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
            <div class="muted">
              ${order.order_number || order.order_id || ""}
            </div>
            <div class="muted">${formatDate(order.created_at)}</div>
          </div>
        </div>

        <div class="section">
          <strong>Delivery address</strong>
          <div class="muted" style="margin-top:6px">
            ${address || "Address unavailable"}
          </div>
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

        <div class="total">
          Grand Total: ${money(order.total)}
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

export default function MyOrders() {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reorderingId, setReorderingId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      setLoading(true);
      setError("");

      try {
        const { data } = await api.get("/orders/my");

        if (!active) return;

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
            ? data.orders
            : [];

        setOrders(list);
      } catch (requestError) {
        if (!active) return;

        setError(
          formatApiError(
            requestError,
            "Unable to load your orders."
          )
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
      ),
    [orders]
  );

  const reorder = async (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];

    if (!items.length) return;

    const id = order.order_id || order.order_number;

    setReorderingId(id);
    setError("");

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

      navigate("/cart");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Some products could not be added to your cart."
      );
    } finally {
      setReorderingId("");
    }
  };

  const printInvoice = (order) => {
    const popup = window.open(
      "",
      "_blank",
      "width=900,height=800"
    );

    if (!popup) {
      setError(
        "Please allow pop-ups to print the invoice."
      );
      return;
    }

    popup.document.open();
    popup.document.write(invoiceHtml(order));
    popup.document.close();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 pb-28">
        <div className="h-24 animate-pulse rounded-[24px] bg-slate-200" />

        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-[340px] animate-pulse rounded-[28px] bg-slate-200"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28">
      {/* Compact Premium Header */}
      <section className="flex items-center justify-between gap-4 px-1 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F1F6FD] text-[#0F4C9C] ring-1 ring-blue-100">
            <Package size={22} weight="duotone" />
          </div>

          <div className="min-w-0">
            <h1 className="text-[22px] font-black tracking-tight text-slate-950 sm:text-[28px]">
              My Orders
            </h1>

            <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
              Track, review and reorder your ZANSZI purchases.
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          {error}
        </div>
      )}

      {sortedOrders.length === 0 ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
            <ShoppingCart size={22} />
          </div>

          <h2 className="mt-4 text-xl font-black text-slate-950">
            No orders yet
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Your first ZANSZI order will appear here.
          </p>

          <button
            type="button"
            onClick={() => navigate("/products")}
            className="mt-5 rounded-2xl bg-[#0F5DB8] px-5 py-3 text-sm font-black text-white shadow-sm"
          >
            Start shopping
          </button>
        </section>
      ) : (
        <div className="space-y-4">
          {sortedOrders.map((order) => {
            const id =
              order.order_id || order.order_number;

            const status = order.status || "placed";

            const items = Array.isArray(order.items)
              ? order.items
              : [];

            const firstItem = items[0];

            const address = getAddress(order);

            const total = Number(
              order.total || order.subtotal || 0
            );

            const isReordering =
              reorderingId === id;

            return (
              <article
                key={id}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.07)]"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-[15px] font-black tracking-[0.01em] text-slate-950 sm:text-base">
                          {order.order_number ||
                            order.order_id}
                        </h2>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ring-1 ${
                            STATUS_STYLES[status] ||
                            STATUS_STYLES.placed
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          {LABELS[status] || "Placed"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarBlank size={14} />
                          {formatDate(
                            order.created_at
                          )}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                          <Package size={14} />
                          {items.length}{" "}
                          {items.length === 1
                            ? "item"
                            : "items"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <p className="text-lg font-black text-[#062B5F]">
                        {money(total)}
                      </p>
                      <CaretRight size={14} className="text-slate-400" />
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {items.slice(0, 6).map((item, index) => (
                          <button
                            key={`${item.product_id || item.name}-${index}`}
                            type="button"
                            onClick={() =>
                              item.product_id &&
                              navigate(`/products/${item.product_id}`)
                            }
                            className="group relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-[#F7FAFF] p-1.5"
                            aria-label={item.name || "Purchased item"}
                          >
                            <img
                              src={
                                item.image_url ||
                                item.images?.[0] ||
                                FALLBACK
                              }
                              alt={item.name || "Product"}
                              className="h-full w-full object-contain transition group-hover:scale-105"
                              onError={(event) => {
                                event.currentTarget.src = FALLBACK;
                              }}
                            />

                            <span className="absolute -bottom-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-slate-900 px-1 text-[8px] font-black text-white">
                              ×{Number(item.quantity || 1)}
                            </span>
                          </button>
                        ))}

                        {items.length > 6 && (
                          <div className="grid h-12 min-w-12 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 px-2 text-center">
                            <span className="text-[10px] font-black text-slate-600">
                              +{items.length - 6}
                            </span>
                          </div>
                        )}
                      </div>

                      {items.length === 1 && firstItem && (
                        <p className="mt-2 truncate text-xs font-black text-slate-900">
                          {firstItem.name || "Product"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  <div className="mt-4 flex gap-2.5 rounded-xl border border-slate-200 bg-[#FBFCFE] px-3 py-2.5">
                    <MapPin
                      size={16}
                      weight="duotone"
                      className="mt-0.5 shrink-0 text-[#0F5DB8]"
                    />

                    <p className="line-clamp-2 text-[11px] font-medium leading-4 text-slate-600">
                      {address ||
                        "Delivery address unavailable"}
                    </p>
                  </div>

                  <div className="mt-4">
                    <OrderTimeline
                      status={status}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-t border-slate-100 bg-[#FCFDFE] p-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/orders/${id}`)
                    }
                    className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-[#0F5DB8] px-3 py-2.5 text-[10px] font-black text-white shadow-[0_8px_20px_rgba(15,93,184,0.22)] transition active:scale-[0.98] sm:text-[11px]"
                  >
                    View Order
                    <ArrowRight
                      size={15}
                      weight="bold"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => reorder(order)}
                    disabled={isReordering}
                    className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 sm:text-[11px]"
                  >
                    <ArrowClockwise
                      size={15}
                      weight="bold"
                    />

                    {isReordering
                      ? "Adding..."
                      : "Reorder"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      printInvoice(order)
                    }
                    className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] sm:text-[11px]"
                  >
                    <DownloadSimple
                      size={15}
                      weight="bold"
                    />
                    Invoice
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
