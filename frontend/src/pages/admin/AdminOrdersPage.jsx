import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileSpreadsheet,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCw,
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
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [ordersResponse, managersResponse, deliveryPartnersResponse] =
        await Promise.all([
          api.get("/admin/orders"),
          api.get("/admin/managers"),
          api.get("/admin/delivery-partners"),
        ]);

      setOrders(
        Array.isArray(ordersResponse.data)
          ? ordersResponse.data
          : []
      );

      setManagers(
        Array.isArray(managersResponse.data)
          ? managersResponse.data
          : []
      );

      const deliveryPartnerData = deliveryPartnersResponse.data;
      setDeliveryPartners(
        Array.isArray(deliveryPartnerData)
          ? deliveryPartnerData
          : Array.isArray(deliveryPartnerData?.delivery_partners)
          ? deliveryPartnerData.delivery_partners
          : []
      );
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    if (filter === "all") return orders;

    return orders.filter(
      (order) => order.status === filter
    );
  }, [orders, filter]);

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

  const updateStatus = async (order, newStatus) => {
    setUpdatingOrderId(order.order_id);
    setError("");

    try {
      await api.patch(
        `/orders/${order.order_id}/status`,
        {
          status: newStatus,
          note: "Updated by admin",
        }
      );

      await load();

      if (selectedOrder?.order_id === order.order_id) {
        const response = await api.get(
          `/orders/${order.order_id}`
        );

        setSelectedOrder(response.data);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const assignManager = async (order, managerId) => {
    setUpdatingOrderId(order.order_id);
    setError("");

    try {
      await api.patch(
        `/admin/orders/${order.order_id}/assign`,
        {
          manager_id: managerId || null,
        }
      );

      await load();

      if (selectedOrder?.order_id === order.order_id) {
        const response = await api.get(
          `/orders/${order.order_id}`
        );

        setSelectedOrder(response.data);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const assignDeliveryPartner = async (order, deliveryPartnerId) => {
    setUpdatingOrderId(order.order_id);
    setError("");

    try {
      await api.patch(
        `/admin/orders/${order.order_id}/assign-delivery-partner`,
        {
          delivery_partner_id: deliveryPartnerId || null,
        }
      );

      await load();

      if (selectedOrder?.order_id === order.order_id) {
        const response = await api.get(
          `/orders/${order.order_id}`
        );

        setSelectedOrder(response.data);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setUpdatingOrderId("");
    }
  };

  const openOrder = async (order) => {
    setError("");

    try {
      const response = await api.get(
        `/orders/${order.order_id}`
      );

      setSelectedOrder(response.data);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold text-[#0F4C9C]">
            Admin
          </p>

          <h1 className="text-3xl font-black">
            Manage Orders
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            View complete customer orders and download
            individual invoices.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 font-bold"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
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
            className="flex items-center gap-2 rounded-xl border px-4 py-2 font-bold"
          >
            <Download size={17} />
            All Orders PDF
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
            className="flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-4 py-2 font-bold text-white"
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {statuses.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => setFilter(item)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
              filter === item
                ? "bg-[#0F4C9C] text-white"
                : "border bg-white"
            }`}
          >
            {label(item)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F5F9FF]">
            <tr>
              {[
                "Order",
                "Customer",
                "Total",
                "Status",
                "Manager",
                "Delivery Partner",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {shown.map((order) => (
              <tr
                key={order.order_id}
                className="border-t hover:bg-slate-50"
              >
                <td className="px-4 py-4">
                  <b>
                    {order.order_number || order.order_id}
                  </b>

                  <div className="text-xs text-slate-500">
                    {dateTime(order.created_at)}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="font-semibold">
                    {order.customer_name}
                  </div>

                  <div className="text-xs text-slate-500">
                    {order.phone}
                  </div>
                </td>

                <td className="px-4 py-4 font-black">
                  {money(order.total)}
                </td>

                <td className="px-4 py-4">
                  <select
                    value={order.status}
                    disabled={
                      updatingOrderId === order.order_id ||
                      ["delivered", "cancelled"].includes(
                        order.status
                      )
                    }
                    onChange={(event) =>
                      updateStatus(order, event.target.value)
                    }
                    className="rounded-xl border px-3 py-2"
                  >
                    {statuses.slice(1).map((item) => (
                      <option key={item} value={item}>
                        {label(item)}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-4">
                  <select
                    value={order.manager_id || ""}
                    disabled={
                      updatingOrderId === order.order_id
                    }
                    onChange={(event) =>
                      assignManager(
                        order,
                        event.target.value
                      )
                    }
                    className="rounded-xl border px-3 py-2"
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
                </td>

                <td className="px-4 py-4">
                  <select
                    value={order.delivery_partner_id || ""}
                    disabled={
                      updatingOrderId === order.order_id
                    }
                    onChange={(event) =>
                      assignDeliveryPartner(
                        order,
                        event.target.value
                      )
                    }
                    className="min-w-[180px] rounded-xl border px-3 py-2"
                  >
                    <option value="">Unassigned</option>

                    {deliveryPartners
                      .filter((partner) => partner.active !== false)
                      .map((partner) => (
                        <option
                          key={partner.user_id || partner.delivery_partner_id}
                          value={partner.user_id || partner.delivery_partner_id}
                        >
                          {partner.name || partner.full_name || partner.email}
                        </option>
                      ))}
                  </select>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openOrder(order)}
                      className="flex items-center gap-1 font-bold text-[#0F4C9C]"
                    >
                      <Eye size={16} />
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        generateInvoicePdf(order)
                      }
                      className="flex items-center gap-1 font-bold text-emerald-700"
                    >
                      <Download size={16} />
                      Invoice
                    </button>

                    <button
                      type="button"
                      onClick={() => printInvoice(order)}
                      className="flex items-center gap-1 font-bold text-slate-700"
                    >
                      <Printer size={16} />
                      Print
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!loading && shown.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No orders found for this status.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <p className="text-sm font-bold text-[#0F4C9C]">
                  Complete Order Details
                </p>

                <h2 className="text-xl font-black">
                  {selectedOrder.order_number ||
                    selectedOrder.order_id}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border p-2"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <User
                    size={20}
                    className="text-[#0F4C9C]"
                  />

                  <p className="mt-3 text-xs font-bold uppercase text-slate-500">
                    Customer
                  </p>

                  <p className="mt-1 font-black">
                    {safeText(
                      selectedOrder.customer_name
                    )}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {safeText(
                      selectedOrder.customer_email
                    )}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <Phone
                    size={20}
                    className="text-[#0F4C9C]"
                  />

                  <p className="mt-3 text-xs font-bold uppercase text-slate-500">
                    Phone
                  </p>

                  <p className="mt-1 font-black">
                    {safeText(selectedOrder.phone)}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <Package
                    size={20}
                    className="text-[#0F4C9C]"
                  />

                  <p className="mt-3 text-xs font-bold uppercase text-slate-500">
                    Order Status
                  </p>

                  <p className="mt-1 font-black">
                    {label(selectedOrder.status)}
                  </p>

                  <p className="mt-1 text-sm text-slate-600">
                    {dateTime(selectedOrder.created_at)}
                  </p>
                </div>

                <div className="rounded-2xl border bg-slate-50 p-4">
                  <MapPin
                    size={20}
                    className="text-[#0F4C9C]"
                  />

                  <p className="mt-3 text-xs font-bold uppercase text-slate-500">
                    Delivery Address
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {[
                      selectedOrder.delivery_address,
                      selectedOrder.city,
                      selectedOrder.state,
                      selectedOrder.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#F5F9FF]">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        Product
                      </th>

                      <th className="px-4 py-3 text-right">
                        Quantity
                      </th>

                      <th className="px-4 py-3 text-right">
                        Unit Price
                      </th>

                      <th className="px-4 py-3 text-right">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {(selectedOrder.items || []).map(
                      (item, index) => {
                        const quantity = Number(
                          item.quantity || 0
                        );

                        const price = Number(
                          item.price || 0
                        );

                        const total =
                          item.line_total !== undefined
                            ? Number(
                                item.line_total || 0
                              )
                            : quantity * price;

                        return (
                          <tr
                            key={
                              item.product_id || index
                            }
                            className="border-t"
                          >
                            <td className="px-4 py-4">
                              <strong>
                                {safeText(
                                  item.name ||
                                    item.product_name
                                )}
                              </strong>

                              {item.unit && (
                                <div className="text-xs text-slate-500">
                                  Unit: {item.unit}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-4 text-right">
                              {quantity}
                            </td>

                            <td className="px-4 py-4 text-right">
                              {money(price)}
                            </td>

                            <td className="px-4 py-4 text-right font-black">
                              {money(total)}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border p-5">
                  <h3 className="font-black">
                    Fulfilment Details
                  </h3>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Manager
                      </span>

                      <strong>
                        {safeText(
                          selectedOrder.manager_name,
                          "Unassigned"
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Delivery Partner
                      </span>

                      <strong>
                        {safeText(
                          selectedOrder.delivery_partner_name,
                          "Unassigned"
                        )}
                      </strong>
                    </div>

                    <div>
                      <label className="mb-2 block text-slate-500">
                        Assign Delivery Partner
                      </label>
                      <select
                        value={selectedOrder.delivery_partner_id || ""}
                        disabled={updatingOrderId === selectedOrder.order_id}
                        onChange={(event) =>
                          assignDeliveryPartner(
                            selectedOrder,
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border px-3 py-2"
                      >
                        <option value="">Unassigned</option>
                        {deliveryPartners
                          .filter((partner) => partner.active !== false)
                          .map((partner) => (
                            <option
                              key={partner.user_id || partner.delivery_partner_id}
                              value={partner.user_id || partner.delivery_partner_id}
                            >
                              {partner.name || partner.full_name || partner.email}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Payment Method
                      </span>

                      <strong>
                        {label(
                          selectedOrder.payment_method ||
                            "cash_on_delivery"
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Payment Status
                      </span>

                      <strong>
                        {label(
                          selectedOrder.payment_status ||
                            "pending"
                        )}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-500">
                        Notes
                      </span>

                      <p className="mt-1 font-semibold">
                        {safeText(
                          selectedOrder.notes,
                          "No order notes"
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-5">
                  <h3 className="font-black">
                    Payment Summary
                  </h3>

                  <div className="mt-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Subtotal
                      </span>

                      <strong>
                        {money(
                          calculateSubtotal(
                            selectedOrder
                          )
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Delivery Charge
                      </span>

                      <strong>
                        {money(
                          selectedOrder.delivery_charge
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        Discount
                      </span>

                      <strong>
                        -{" "}
                        {money(
                          selectedOrder.discount
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between border-t pt-4 text-lg">
                      <span className="font-black">
                        Grand Total
                      </span>

                      <strong className="text-[#0F4C9C]">
                        {money(selectedOrder.total)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {selectedOrder.status_history?.length >
                0 && (
                <div className="rounded-2xl border p-5">
                  <h3 className="font-black">
                    Order Status Timeline
                  </h3>

                  <div className="mt-4 space-y-4">
                    {selectedOrder.status_history.map(
                      (history, index) => (
                        <div
                          key={`${history.at}-${index}`}
                          className="flex gap-3"
                        >
                          <div className="mt-1 h-3 w-3 rounded-full bg-[#0F4C9C]" />

                          <div>
                            <p className="font-bold">
                              {label(history.status)}
                            </p>

                            <p className="text-xs text-slate-500">
                              {dateTime(history.at)}
                            </p>

                            {history.note && (
                              <p className="mt-1 text-sm text-slate-600">
                                {history.note}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                <button
                  type="button"
                  onClick={() =>
                    printInvoice(selectedOrder)
                  }
                  className="flex items-center gap-2 rounded-xl border px-5 py-3 font-bold"
                >
                  <Printer size={18} />
                  Print Invoice
                </button>

                <button
                  type="button"
                  onClick={() =>
                    generateInvoicePdf(selectedOrder)
                  }
                  className="flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-5 py-3 font-bold text-white"
                >
                  <Download size={18} />
                  Download Invoice PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
                 }
