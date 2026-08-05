import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { api, formatApiError } from "../../lib/api";
import { exportPdf, exportExcel } from "../../utils/exportData";

const statuses = [
  "all",
  "placed",
  "confirmed",
  "processing",
  "assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const label = (value = "") =>
  String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const dateTime = (value) => {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const safeText = (value, fallback = "—") =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);

const calculateSubtotal = (order) => {
  if (order?.subtotal !== undefined && order?.subtotal !== null) {
    return Number(order.subtotal || 0);
  }

  return (order?.items || []).reduce((total, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.price || 0);
    const lineTotal =
      item.line_total !== undefined
        ? Number(item.line_total || 0)
        : quantity * unitPrice;

    return total + lineTotal;
  }, 0);
};

function addInvoiceHeader(doc, order) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 76, 156);
  doc.rect(0, 0, pageWidth, 38, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("ZANSZII", 14, 17);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Professional Home & Cleaning Products", 14, 25);

  doc.setFontSize(8);
  doc.text("Customer Order Invoice", 14, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INVOICE", pageWidth - 14, 18, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    safeText(order.order_number || order.order_id),
    pageWidth - 14,
    27,
    {
      align: "right",
    }
  );
}

function addInvoiceFooter(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 20, pageWidth - 14, pageHeight - 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);

    doc.text(
      "Thank you for shopping with Zanszii.",
      14,
      pageHeight - 13
    );

    doc.text(
      `Page ${page} of ${pageCount}`,
      pageWidth - 14,
      pageHeight - 13,
      {
        align: "right",
      }
    );
  }
}

function generateInvoicePdf(order) {
  const doc = new jsPDF("portrait", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  const subtotal = calculateSubtotal(order);
  const deliveryCharge = Number(order.delivery_charge || 0);
  const discount = Number(order.discount || 0);
  const grandTotal =
    order.total !== undefined && order.total !== null
      ? Number(order.total || 0)
      : subtotal + deliveryCharge - discount;

  addInvoiceHeader(doc, order);

  doc.setTextColor(15, 23, 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Invoice Details", margin, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(
    `Invoice Number: ${safeText(order.order_number || order.order_id)}`,
    margin,
    58
  );

  doc.text(
    `Order Date: ${dateTime(order.created_at)}`,
    margin,
    64
  );

  doc.text(
    `Order Status: ${label(order.status)}`,
    margin,
    70
  );

  doc.text(
    `Payment Method: ${label(order.payment_method || "cash_on_delivery")}`,
    110,
    58
  );

  doc.text(
    `Payment Status: ${label(order.payment_status || "pending")}`,
    110,
    64
  );

  if (order.delivered_at) {
    doc.text(
      `Delivered Date: ${dateTime(order.delivered_at)}`,
      110,
      70
    );
  }

  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 80, 85, 48, 3, 3, "S");
  doc.roundedRect(110, 80, 86, 48, 3, 3, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Customer Details", 19, 90);
  doc.text("Delivery Address", 115, 90);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const customerLines = [
    `Name: ${safeText(order.customer_name)}`,
    `Phone: ${safeText(order.phone)}`,
    `Email: ${safeText(order.customer_email)}`,
  ];

  customerLines.forEach((line, index) => {
    const wrapped = doc.splitTextToSize(line, 74);
    doc.text(wrapped, 19, 99 + index * 9);
  });

  const address = [
    order.delivery_address,
    order.city,
    order.state,
    order.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  const addressLines = doc.splitTextToSize(
    safeText(address, "Address not provided"),
    75
  );

  doc.text(addressLines, 115, 99);

  autoTable(doc, {
    startY: 138,
    head: [
      [
        "No.",
        "Product",
        "Quantity",
        "Unit Price",
        "Amount",
      ],
    ],
    body: (order.items || []).map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.price || 0);
      const amount =
        item.line_total !== undefined
          ? Number(item.line_total || 0)
          : quantity * unitPrice;

      return [
        index + 1,
        safeText(item.name || item.product_name || item.product_id),
        quantity,
        money(unitPrice),
        money(amount),
      ];
    }),
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      valign: "middle",
    },
    headStyles: {
      fillColor: [15, 76, 156],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 249, 255],
    },
    columnStyles: {
      0: {
        halign: "center",
        cellWidth: 14,
      },
      2: {
        halign: "center",
        cellWidth: 24,
      },
      3: {
        halign: "right",
        cellWidth: 32,
      },
      4: {
        halign: "right",
        cellWidth: 32,
      },
    },
    margin: {
      left: margin,
      right: margin,
    },
  });

  let summaryY = (doc.lastAutoTable?.finalY || 150) + 12;

  if (summaryY > 235) {
    doc.addPage();
    summaryY = 25;
  }

  const summaryX = pageWidth - margin - 82;

  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, summaryY, 82, 48, 3, 3, "S");

  const totals = [
    ["Subtotal", money(subtotal)],
    ["Delivery Charge", money(deliveryCharge)],
    ["Discount", `- ${money(discount)}`],
    ["Grand Total", money(grandTotal)],
  ];

  totals.forEach(([name, amount], index) => {
    const y = summaryY + 10 + index * 10;

    doc.setFont(
      "helvetica",
      index === totals.length - 1 ? "bold" : "normal"
    );

    doc.setFontSize(
      index === totals.length - 1 ? 11 : 9
    );

    doc.setTextColor(
      index === totals.length - 1 ? 15 : 71,
      index === totals.length - 1 ? 76 : 85,
      index === totals.length - 1 ? 156 : 105
    );

    doc.text(name, summaryX + 6, y);

    doc.text(amount, summaryX + 76, y, {
      align: "right",
    });
  });

  const detailsY = summaryY + 62;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Order Fulfilment Details", margin, detailsY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.text(
    `Assigned Manager: ${safeText(order.manager_name, "Unassigned")}`,
    margin,
    detailsY + 8
  );

  doc.text(
    `Delivery Partner: ${safeText(
      order.delivery_partner_name,
      "Unassigned"
    )}`,
    margin,
    detailsY + 16
  );

  if (order.notes) {
    const noteLines = doc.splitTextToSize(
      `Order Notes: ${order.notes}`,
      pageWidth - margin * 2
    );

    doc.text(noteLines, margin, detailsY + 24);
  }

  addInvoiceFooter(doc);

  doc.save(
    `${safeText(
      order.order_number || order.order_id,
      "zanszii-invoice"
    )}.pdf`
  );
}

function printInvoice(order) {
  const subtotal = calculateSubtotal(order);
  const deliveryCharge = Number(order.delivery_charge || 0);
  const discount = Number(order.discount || 0);
  const grandTotal =
    order.total !== undefined && order.total !== null
      ? Number(order.total || 0)
      : subtotal + deliveryCharge - discount;

  const itemRows = (order.items || [])
    .map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.price || 0);
      const amount =
        item.line_total !== undefined
          ? Number(item.line_total || 0)
          : quantity * unitPrice;

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${safeText(item.name || item.product_name)}</td>
          <td>${quantity}</td>
          <td>${money(unitPrice)}</td>
          <td>${money(amount)}</td>
        </tr>
      `;
    })
    .join("");

  const address = [
    order.delivery_address,
    order.city,
    order.state,
    order.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  const printWindow = window.open(
    "",
    "_blank",
    "width=1000,height=800"
  );

  if (!printWindow) {
    alert("Please allow pop-ups to print the invoice.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${safeText(
          order.order_number,
          "Zanszii Invoice"
        )}</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 30px;
            font-family: Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
          }

          .invoice {
            max-width: 850px;
            margin: 0 auto;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 24px;
            color: white;
            background: #0f4c9c;
          }

          .header h1 {
            margin: 0;
            font-size: 32px;
          }

          .header p {
            margin: 6px 0 0;
          }

          .invoice-title {
            text-align: right;
          }

          .invoice-title h2 {
            margin: 0;
            font-size: 26px;
          }

          .section-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-top: 24px;
          }

          .box {
            border: 1px solid #dbe4ef;
            border-radius: 10px;
            padding: 18px;
          }

          .box h3 {
            margin-top: 0;
            color: #0f4c9c;
          }

          .box p {
            margin: 7px 0;
          }

          table {
            width: 100%;
            margin-top: 24px;
            border-collapse: collapse;
          }

          th,
          td {
            padding: 12px;
            border: 1px solid #dbe4ef;
            text-align: left;
          }

          th {
            color: white;
            background: #0f4c9c;
          }

          td:nth-child(3),
          td:nth-child(4),
          td:nth-child(5),
          th:nth-child(3),
          th:nth-child(4),
          th:nth-child(5) {
            text-align: right;
          }

          .summary {
            width: 360px;
            margin: 24px 0 0 auto;
            border: 1px solid #dbe4ef;
            border-radius: 10px;
            padding: 16px;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }

          .grand-total {
            margin-top: 6px;
            padding-top: 12px;
            border-top: 2px solid #0f4c9c;
            color: #0f4c9c;
            font-size: 20px;
            font-weight: bold;
          }

          .footer {
            margin-top: 35px;
            padding-top: 18px;
            border-top: 1px solid #dbe4ef;
            text-align: center;
            color: #64748b;
          }

          @media print {
            body {
              padding: 0;
            }

            .no-print {
              display: none;
            }
          }
        </style>
      </head>

      <body>
        <div class="invoice">
          <div class="header">
            <div>
              <h1>ZANSZII</h1>
              <p>Professional Home & Cleaning Products</p>
            </div>

            <div class="invoice-title">
              <h2>INVOICE</h2>
              <p>${safeText(order.order_number || order.order_id)}</p>
            </div>
          </div>

          <div class="section-grid">
            <div class="box">
              <h3>Customer Details</h3>
              <p><strong>Name:</strong> ${safeText(
                order.customer_name
              )}</p>
              <p><strong>Phone:</strong> ${safeText(
                order.phone
              )}</p>
              <p><strong>Email:</strong> ${safeText(
                order.customer_email
              )}</p>
            </div>

            <div class="box">
              <h3>Order Details</h3>
              <p><strong>Date:</strong> ${dateTime(
                order.created_at
              )}</p>
              <p><strong>Status:</strong> ${label(
                order.status
              )}</p>
              <p><strong>Payment:</strong> ${label(
                order.payment_method || "cash_on_delivery"
              )}</p>
              <p><strong>Payment Status:</strong> ${label(
                order.payment_status || "pending"
              )}</p>
            </div>

            <div class="box">
              <h3>Delivery Address</h3>
              <p>${safeText(address)}</p>
            </div>

            <div class="box">
              <h3>Fulfilment Details</h3>
              <p><strong>Manager:</strong> ${safeText(
                order.manager_name,
                "Unassigned"
              )}</p>
              <p><strong>Delivery Partner:</strong> ${safeText(
                order.delivery_partner_name,
                "Unassigned"
              )}</p>
              <p><strong>Notes:</strong> ${safeText(
                order.notes,
                "No notes"
              )}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Product</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              ${itemRows}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row">
              <span>Subtotal</span>
              <strong>${money(subtotal)}</strong>
            </div>

            <div class="summary-row">
              <span>Delivery Charge</span>
              <strong>${money(deliveryCharge)}</strong>
            </div>

            <div class="summary-row">
              <span>Discount</span>
              <strong>- ${money(discount)}</strong>
            </div>

            <div class="summary-row grand-total">
              <span>Grand Total</span>
              <span>${money(grandTotal)}</span>
            </div>
          </div>

          <div class="footer">
            Thank you for shopping with Zanszii.
          </div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [managers, setManagers] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersResponse, managersResponse, deliveryResponse] =
        await Promise.all([
          api.get("/admin/orders"),
          api.get("/admin/managers"),
          api.get("/admin/delivery-partners"),
        ]);

      setOrders(Array.isArray(ordersResponse.data) ? ordersResponse.data : []);
      setManagers(Array.isArray(managersResponse.data) ? managersResponse.data : []);

      const deliveryData = deliveryResponse.data;
      setDeliveryPartners(
        Array.isArray(deliveryData)
          ? deliveryData
          : Array.isArray(deliveryData?.delivery_partners)
          ? deliveryData.delivery_partners
          : []
      );
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const financials = (order) => {
    const subtotal = calculateSubtotal(order);
    const discount = Number(order.discount || 0);
    const delivery = Number(order.delivery_charge || 0);
    const paid = Number(order.total ?? subtotal + delivery - discount);
    const cost = Number(
      order.product_cost ??
        (order.items || []).reduce(
          (sum, item) => sum + Number(item.total_cost || 0),
          0
        )
    );
    const netProfit = Number(order.net_profit ?? paid - cost);
    const loss = netProfit < 0 ? Math.abs(netProfit) : Number(order.loss || 0);

    return {
      subtotal,
      discount,
      delivery,
      paid,
      cost,
      netProfit,
      loss,
      margin: paid > 0 ? (netProfit / paid) * 100 : 0,
    };
  };

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();

    return orders.filter((order) => {
      const statusMatch = filter === "all" || order.status === filter;
      const text = [
        order.order_number,
        order.order_id,
        order.customer_name,
        order.customer_email,
        order.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return statusMatch && (!term || text.includes(term));
    });
  }, [orders, filter, search]);

  const stats = useMemo(() => {
    const count = (status) =>
      orders.filter((order) => order.status === status).length;

    return {
      placed: count("placed"),
      confirmed: count("confirmed"),
      processing: count("processing"),
      outForDelivery: count("out_for_delivery"),
      delivered: count("delivered"),
      cancelled: count("cancelled"),
      revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      profit: orders.reduce((sum, order) => {
        const result = financials(order);
        return sum + Math.max(result.netProfit, 0);
      }, 0),
      loss: orders.reduce((sum, order) => sum + financials(order).loss, 0),
    };
  }, [orders]);

  const rows = shown.map((order) => [
    order.order_number || order.order_id,
    order.customer_name,
    order.phone,
    label(order.status),
    order.manager_name || "Unassigned",
    order.delivery_partner_name || "Unassigned",
    Number(order.total || 0),
    new Date(order.created_at).toLocaleDateString("en-IN"),
  ]);

  const refreshSelected = async (orderId) => {
    const response = await api.get(`/orders/${orderId}`);
    setSelectedOrder(response.data);
  };

  const updateStatus = async (order, newStatus) => {
    setUpdatingOrderId(order.order_id);
    setError("");
    setMessage("");

    try {
      await api.patch(`/orders/${order.order_id}/status`, {
        status: newStatus,
        note: "Updated by admin",
      });

      setMessage(`Order marked ${label(newStatus)}.`);
      await load();

      if (selectedOrder?.order_id === order.order_id) {
        await refreshSelected(order.order_id);
      }
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const assignManager = async (order, managerId) => {
    setUpdatingOrderId(order.order_id);
    setError("");

    try {
      await api.patch(`/admin/orders/${order.order_id}/assign`, {
        manager_id: managerId || null,
      });
      await load();

      if (selectedOrder?.order_id === order.order_id) {
        await refreshSelected(order.order_id);
      }
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const assignDeliveryPartner = async (order, partnerId) => {
    setUpdatingOrderId(order.order_id);
    setError("");

    try {
      await api.patch(
        `/admin/orders/${order.order_id}/assign-delivery-partner`,
        { delivery_partner_id: partnerId || null }
      );
      await load();

      if (selectedOrder?.order_id === order.order_id) {
        await refreshSelected(order.order_id);
      }
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const openOrder = async (order) => {
    setError("");
    try {
      await refreshSelected(order.order_id);
    } catch (requestError) {
      setError(formatApiError(requestError));
    }
  };

  const copyAddress = async (order) => {
    const address = [
      order.delivery_address,
      order.city,
      order.state,
      order.postal_code,
    ]
      .filter(Boolean)
      .join(", ");

    try {
      await navigator.clipboard.writeText(address);
      setMessage("Delivery address copied.");
    } catch {
      setError("Unable to copy the address.");
    }
  };

  const nextStatus = (status) =>
    ({
      placed: "confirmed",
      confirmed: "processing",
      processing: "out_for_delivery",
      assigned: "out_for_delivery",
      out_for_delivery: "delivered",
    }[status] || null);

  const statusClass = (status) =>
    ({
      placed: "bg-amber-50 text-amber-700 border-amber-100",
      confirmed: "bg-blue-50 text-blue-700 border-blue-100",
      processing: "bg-violet-50 text-violet-700 border-violet-100",
      assigned: "bg-cyan-50 text-cyan-700 border-cyan-100",
      out_for_delivery: "bg-orange-50 text-orange-700 border-orange-100",
      delivered: "bg-emerald-50 text-emerald-700 border-emerald-100",
      cancelled: "bg-rose-50 text-rose-700 border-rose-100",
    }[status] || "bg-slate-50 text-slate-700 border-slate-100");

  const orderFlow = [
    "placed",
    "confirmed",
    "processing",
    "assigned",
    "out_for_delivery",
    "delivered",
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
            Order operations
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Premium Order Management
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Manage customers, fulfilment, delivery, invoices and order profit
            from one clean workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() =>
              exportPdf(
                "Zanszii Orders",
                [
                  "Order",
                  "Customer",
                  "Phone",
                  "Status",
                  "Manager",
                  "Delivery Partner",
                  "Total",
                  "Date",
                ],
                rows,
                "zanszii-orders.pdf"
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
          >
            <Download size={17} />
            PDF
          </button>

          <button
            type="button"
            onClick={() =>
              exportExcel(
                [
                  "Order",
                  "Customer",
                  "Phone",
                  "Status",
                  "Manager",
                  "Delivery Partner",
                  "Total",
                  "Date",
                ],
                rows,
                "zanszii-orders.xlsx",
                "Orders"
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-sm font-black text-white"
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["Placed", stats.placed, Package],
          ["Confirmed", stats.confirmed, CheckCircle2],
          ["Processing", stats.processing, RefreshCw],
          ["Out for Delivery", stats.outForDelivery, Truck],
          ["Delivered", stats.delivered, CheckCircle2],
          ["Revenue", money(stats.revenue), TrendingUp],
          [
            stats.loss > 0 ? "Loss" : "Profit",
            money(stats.loss > 0 ? stats.loss : stats.profit),
            stats.loss > 0 ? TrendingDown : TrendingUp,
          ],
        ].map(([title, value, Icon]) => (
          <div
            key={title}
            className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
              <Icon size={19} />
            </span>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
              {title}
            </p>
            <strong className="mt-1 block text-lg font-black text-slate-950">
              {value}
            </strong>
          </div>
        ))}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order, customer, phone or email"
              className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-[#0F4C9C]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {statuses.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setFilter(item)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black ${
                  filter === item
                    ? "bg-[#0F4C9C] text-white"
                    : "border border-slate-200 bg-white text-slate-500"
                }`}
              >
                {label(item)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-72 animate-pulse rounded-[26px] bg-slate-200"
            />
          ))}
        </div>
      ) : shown.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((order) => {
            const result = financials(order);
            const isLoss = result.loss > 0;
            const previewItems = (order.items || []).slice(0, 3);

            return (
              <article
                key={order.order_id}
                className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-xs font-black text-[#0F4C9C]">
                      {order.order_number || order.order_id}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {dateTime(order.created_at)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${statusClass(
                      order.status
                    )}`}
                  >
                    {label(order.status)}
                  </span>
                </div>

                <div className="p-5">
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {safeText(order.customer_name)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {safeText(order.phone)}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {safeText(order.customer_email)}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-xs font-bold text-slate-400">
                        Customer paid
                      </p>
                      <strong className="mt-1 block text-2xl font-black text-slate-950">
                        {money(order.total)}
                      </strong>
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black text-slate-500">
                        {label(order.payment_method || "cash_on_delivery")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-2">
                    {previewItems.map((item, index) => (
                      <div
                        key={item.product_id || index}
                        className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"
                      >
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-white">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-xs font-black text-slate-400">
                              {safeText(item.name, "P").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-800">
                            {safeText(item.name || item.product_name)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Qty {item.quantity} ·{" "}
                            {money(
                              item.line_total ??
                                Number(item.price || 0) *
                                  Number(item.quantity || 0)
                            )}
                          </p>
                        </div>
                      </div>
                    ))}

                    {(order.items || []).length > 3 && (
                      <p className="text-xs font-bold text-slate-400">
                        +{(order.items || []).length - 3} more products
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-blue-50 p-3">
                      <p className="text-[9px] font-black uppercase text-blue-500">
                        Items
                      </p>
                      <strong className="mt-1 block text-sm text-blue-900">
                        {(order.items || []).reduce(
                          (sum, item) => sum + Number(item.quantity || 0),
                          0
                        )}
                      </strong>
                    </div>

                    <div className="rounded-2xl bg-amber-50 p-3">
                      <p className="text-[9px] font-black uppercase text-amber-600">
                        Discount
                      </p>
                      <strong className="mt-1 block text-sm text-amber-900">
                        {money(result.discount)}
                      </strong>
                    </div>

                    <div
                      className={`rounded-2xl p-3 ${
                        isLoss ? "bg-rose-50" : "bg-emerald-50"
                      }`}
                    >
                      <p
                        className={`text-[9px] font-black uppercase ${
                          isLoss ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {isLoss ? "Loss" : "Profit"}
                      </p>
                      <strong
                        className={`mt-1 block text-sm ${
                          isLoss ? "text-rose-900" : "text-emerald-900"
                        }`}
                      >
                        {money(
                          isLoss ? result.loss : Math.max(result.netProfit, 0)
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-500">
                      {order.manager_name || "Manager unassigned"} ·{" "}
                      {order.delivery_partner_name ||
                        "Delivery partner unassigned"}
                    </p>

                    <button
                      type="button"
                      onClick={() => openOrder(order)}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-xs font-black text-white"
                    >
                      View details
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[26px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Package size={40} className="mx-auto text-slate-300" />
          <h3 className="mt-4 text-lg font-black text-slate-800">
            No orders found
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Try another status or search term.
          </p>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close order drawer"
            onClick={() => setSelectedOrder(null)}
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto bg-[#F6F8FC] shadow-2xl">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                  Complete order
                </p>
                <h2 className="mt-1 text-xl font-black text-slate-950">
                  {selectedOrder.order_number || selectedOrder.order_id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              {(() => {
                const result = financials(selectedOrder);
                const next = nextStatus(selectedOrder.status);
                const currentIndex = orderFlow.indexOf(selectedOrder.status);

                return (
                  <>
                    <section className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <User size={20} className="text-[#0F4C9C]" />
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Customer
                        </p>
                        <strong className="mt-1 block text-base text-slate-900">
                          {safeText(selectedOrder.customer_name)}
                        </strong>
                        <p className="mt-1 text-sm text-slate-500">
                          {safeText(selectedOrder.customer_email)}
                        </p>

                        {selectedOrder.phone && (
                          <a
                            href={`tel:${selectedOrder.phone}`}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-[#0F4C9C]"
                          >
                            <Phone size={15} />
                            Call customer
                          </a>
                        )}
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <MapPin size={20} className="text-[#0F4C9C]" />
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                          Delivery address
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                          {[
                            selectedOrder.delivery_address,
                            selectedOrder.city,
                            selectedOrder.state,
                            selectedOrder.postal_code,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyAddress(selectedOrder)}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
                        >
                          <Copy size={15} />
                          Copy address
                        </button>
                      </div>
                    </section>

                    <section className="rounded-[22px] border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                            Current status
                          </p>
                          <span
                            className={`mt-2 inline-block rounded-full border px-3 py-1.5 text-[10px] font-black ${statusClass(
                              selectedOrder.status
                            )}`}
                          >
                            {label(selectedOrder.status)}
                          </span>
                        </div>

                        {next && (
                          <button
                            type="button"
                            disabled={
                              updatingOrderId === selectedOrder.order_id
                            }
                            onClick={() =>
                              updateStatus(selectedOrder, next)
                            }
                            className="rounded-xl bg-[#F4B400] px-4 py-2.5 text-xs font-black text-[#062B5F]"
                          >
                            Mark {label(next)}
                          </button>
                        )}
                      </div>

                      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {orderFlow.map((step, index) => {
                          const complete = currentIndex >= index;

                          return (
                            <div key={step} className="text-center">
                              <div
                                className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-black ${
                                  complete
                                    ? "bg-[#0F4C9C] text-white"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {index + 1}
                              </div>
                              <p className="mt-2 text-[9px] font-black text-slate-500">
                                {label(step)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-[22px] border border-slate-200 bg-white p-4">
                      <h3 className="font-black text-slate-950">Products</h3>

                      <div className="mt-4 grid gap-3">
                        {(selectedOrder.items || []).map((item, index) => {
                          const quantity = Number(item.quantity || 0);
                          const gross = Number(
                            item.gross_revenue ??
                              item.line_total ??
                              Number(item.price || 0) * quantity
                          );
                          const discount = Number(
                            item.allocated_discount || 0
                          );
                          const paid = Number(
                            item.net_revenue ?? gross - discount
                          );
                          const cost = Number(item.total_cost || 0);
                          const profit = Number(
                            item.net_profit ?? paid - cost
                          );
                          const loss =
                            profit < 0
                              ? Math.abs(profit)
                              : Number(item.loss || 0);

                          return (
                            <div
                              key={item.product_id || index}
                              className="rounded-2xl border border-slate-200 p-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
                                  {item.image_url ? (
                                    <img
                                      src={item.image_url}
                                      alt={item.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center font-black text-slate-400">
                                      {safeText(item.name, "P")
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <strong className="block truncate text-sm text-slate-900">
                                    {safeText(item.name || item.product_name)}
                                  </strong>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Qty {quantity} · {money(item.price)} each
                                  </p>
                                </div>

                                <strong
                                  className={
                                    loss > 0
                                      ? "text-rose-600"
                                      : "text-emerald-600"
                                  }
                                >
                                  {loss > 0
                                    ? `-${money(loss)}`
                                    : `+${money(Math.max(profit, 0))}`}
                                </strong>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {[
                                  ["Gross", gross],
                                  ["Discount", discount],
                                  ["Paid", paid],
                                  ["Cost", cost],
                                  [loss > 0 ? "Loss" : "Profit", loss > 0 ? loss : Math.max(profit, 0)],
                                ].map(([title, value]) => (
                                  <div
                                    key={title}
                                    className="rounded-xl bg-slate-50 p-2.5"
                                  >
                                    <p className="text-[9px] font-black uppercase text-slate-400">
                                      {title}
                                    </p>
                                    <strong className="mt-1 block text-xs text-slate-800">
                                      {money(value)}
                                    </strong>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <h3 className="font-black text-slate-950">Fulfilment</h3>

                        <label className="mt-4 block">
                          <span className="text-xs font-black text-slate-500">
                            Manager
                          </span>
                          <select
                            value={selectedOrder.manager_id || ""}
                            disabled={
                              updatingOrderId === selectedOrder.order_id
                            }
                            onChange={(event) =>
                              assignManager(
                                selectedOrder,
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          >
                            <option value="">Unassigned</option>
                            {managers
                              .filter((manager) => manager.active)
                              .map((manager) => (
                                <option
                                  key={manager.user_id}
                                  value={manager.user_id}
                                >
                                  {manager.name}
                                </option>
                              ))}
                          </select>
                        </label>

                        <label className="mt-4 block">
                          <span className="text-xs font-black text-slate-500">
                            Delivery partner
                          </span>
                          <select
                            value={selectedOrder.delivery_partner_id || ""}
                            disabled={
                              updatingOrderId === selectedOrder.order_id
                            }
                            onChange={(event) =>
                              assignDeliveryPartner(
                                selectedOrder,
                                event.target.value
                              )
                            }
                            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                          >
                            <option value="">Unassigned</option>
                            {deliveryPartners
                              .filter((partner) => partner.active !== false)
                              .map((partner) => (
                                <option
                                  key={
                                    partner.user_id ||
                                    partner.delivery_partner_id
                                  }
                                  value={
                                    partner.user_id ||
                                    partner.delivery_partner_id
                                  }
                                >
                                  {partner.name ||
                                    partner.full_name ||
                                    partner.email}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>

                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <h3 className="font-black text-slate-950">
                          Order summary
                        </h3>

                        <div className="mt-4 space-y-3 text-sm">
                          {[
                            ["Gross sales", result.subtotal],
                            ["Discount", result.discount],
                            ["Delivery", result.delivery],
                            ["Customer paid", result.paid],
                            ["Product cost", result.cost],
                          ].map(([title, value]) => (
                            <div
                              key={title}
                              className="flex justify-between gap-3"
                            >
                              <span className="text-slate-500">{title}</span>
                              <strong>{money(value)}</strong>
                            </div>
                          ))}

                          <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base">
                            <span className="font-black text-slate-900">
                              {result.loss > 0 ? "Loss" : "Net profit"}
                            </span>
                            <strong
                              className={
                                result.loss > 0
                                  ? "text-rose-600"
                                  : "text-emerald-600"
                              }
                            >
                              {money(
                                result.loss > 0
                                  ? result.loss
                                  : Math.max(result.netProfit, 0)
                              )}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </section>

                    {selectedOrder.status_history?.length > 0 && (
                      <section className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <h3 className="font-black text-slate-950">
                          Activity timeline
                        </h3>
                        <div className="mt-4 space-y-4">
                          {selectedOrder.status_history.map(
                            (history, index) => (
                              <div
                                key={`${history.at}-${index}`}
                                className="flex gap-3"
                              >
                                <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-[#0F4C9C]" />
                                <div>
                                  <p className="text-sm font-black text-slate-800">
                                    {label(history.status)}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {dateTime(history.at)}
                                  </p>
                                  {history.note && (
                                    <p className="mt-1 text-xs text-slate-500">
                                      {history.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </section>
                    )}

                    <section className="flex flex-wrap justify-end gap-2 rounded-[22px] border border-slate-200 bg-white p-4">
                      <button
                        type="button"
                        onClick={() => printInvoice(selectedOrder)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700"
                      >
                        <Printer size={17} />
                        Print invoice
                      </button>

                      <button
                        type="button"
                        onClick={() => generateInvoicePdf(selectedOrder)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-xs font-black text-white"
                      >
                        <Download size={17} />
                        Invoice PDF
                      </button>

                      {!["delivered", "cancelled"].includes(
                        selectedOrder.status
                      ) && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Cancel this order?")) {
                              updateStatus(selectedOrder, "cancelled");
                            }
                          }}
                          className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-600"
                        >
                          Cancel order
                        </button>
                      )}
                    </section>
                  </>
                );
              })()}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
