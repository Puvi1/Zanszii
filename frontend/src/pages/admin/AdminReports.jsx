import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api, formatApiError } from "../../lib/api";
import { exportRowsToExcel } from "../../utils/exportData";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const number = (value) =>
  new Intl.NumberFormat("en-IN").format(Number(value || 0));

const safeText = (value, fallback = "—") =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);

const productColumns = [
  { label: "Product", value: (row) => row.product_name },
  { label: "Category", value: (row) => row.category },
  { label: "Units Sold", value: (row) => row.quantity_sold },
  { label: "Revenue", value: (row) => row.revenue },
  { label: "Cost", value: (row) => row.cost },
  { label: "Profit", value: (row) => row.profit },
  {
    label: "Margin",
    value: (row) => `${Number(row.margin || 0).toFixed(2)}%`,
  },
];

const getTop = (items, field, limit = 6) =>
  [...(items || [])]
    .sort((a, b) => Number(b?.[field] || 0) - Number(a?.[field] || 0))
    .slice(0, limit);

const drawMetricCard = (doc, x, y, width, label, value) => {
  doc.setDrawColor(225, 231, 239);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, 24, 3, 3, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label, x + 5, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(String(value), x + 5, y + 18);
};

const drawBarChart = (
  doc,
  { x, y, width, height, title, data, labelKey, valueKey }
) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x, y);

  if (!data.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("No data available", x, y + 10);
    return;
  }

  const maxValue = Math.max(
    ...data.map((item) => Number(item?.[valueKey] || 0)),
    1
  );
  const rowHeight = Math.min(11, height / data.length);

  data.forEach((item, index) => {
    const rowY = y + 7 + index * rowHeight;
    const label = safeText(item?.[labelKey], "Product").slice(0, 22);
    const value = Number(item?.[valueKey] || 0);
    const availableWidth = width - 64;
    const barWidth = (value / maxValue) * availableWidth;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(label, x, rowY + 4);

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x + 46, rowY, availableWidth, 5, 1, 1, "F");
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(x + 46, rowY, Math.max(barWidth, 1), 5, 1, 1, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(
      valueKey === "quantity_sold" ? number(value) : money(value),
      x + width,
      rowY + 4,
      { align: "right" }
    );
  });
};

const drawLineChart = (doc, { x, y, width, height, title, data }) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title, x, y);

  const plotX = x + 8;
  const plotY = y + 8;
  const plotW = width - 16;
  const plotH = height - 18;

  doc.setDrawColor(203, 213, 225);
  doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
  doc.line(plotX, plotY, plotX, plotY + plotH);

  if (!data.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("No trend data available", plotX + 4, plotY + 12);
    return;
  }

  const maxValue = Math.max(
    ...data.map((item) => Number(item.revenue || 0)),
    1
  );
  const stepX = data.length > 1 ? plotW / (data.length - 1) : plotW;
  const points = data.map((item, index) => ({
    x: plotX + index * stepX,
    y: plotY + plotH - (Number(item.revenue || 0) / maxValue) * plotH,
  }));

  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  points.forEach((point, index) => {
    if (index > 0) {
      doc.line(points[index - 1].x, points[index - 1].y, point.x, point.y);
    }
    doc.setFillColor(37, 99, 235);
    doc.circle(point.x, point.y, 1.2, "F");
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  const indexes = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  [...new Set(indexes)].forEach((index) => {
    const label = data[index]?.date || data[index]?.month || "";
    doc.text(label.slice(5), points[index].x, plotY + plotH + 5, {
      align: "center",
    });
  });
};

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/reports");
      setData(response.data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const productAnalysis = data?.product_analysis || [];
  const categoryAnalysis = data?.category_analysis || [];
  const topCustomers = data?.top_customers || [];
  const trendData = data?.monthly_sales?.length
    ? data.monthly_sales
    : data?.daily_sales || [];

  const topRevenueProducts = useMemo(
    () => getTop(productAnalysis, "revenue", 6),
    [productAnalysis]
  );

  const topProfitProducts = useMemo(
    () => getTop(productAnalysis, "profit", 6),
    [productAnalysis]
  );

  const exportExcel = () => {
    exportRowsToExcel({
      rows: productAnalysis,
      columns: productColumns,
      fileName: "zanszii-detailed-business-report",
      sheetName: "Product Analysis",
    });
  };

  const exportDetailedPDF = () => {
    if (!data) return;
    setExporting(true);

    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 46, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.text("ZANSZII", margin, 20);
      doc.setFontSize(15);
      doc.text("Business Performance & Profit Analytics Report", margin, 31);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(
        `Generated: ${new Date(data.generated_at || Date.now()).toLocaleString("en-IN")}`,
        margin,
        39
      );

      drawMetricCard(doc, margin, 54, 50, "Total revenue", money(data.revenue));
      drawMetricCard(doc, margin + 55, 54, 50, "Total cost", money(data.total_cost));
      drawMetricCard(doc, margin + 110, 54, 50, "Gross profit", money(data.gross_profit));
      drawMetricCard(
        doc,
        margin + 165,
        54,
        50,
        "Profit margin",
        `${Number(data.profit_margin || 0).toFixed(2)}%`
      );
      drawMetricCard(doc, margin + 220, 54, 50, "Units sold", number(data.total_units_sold));

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("Executive highlights", margin, 89);

      const highlights = [
        [
          "Best-selling product",
          data.best_selling_product?.product_name,
          `${number(data.best_selling_product?.quantity_sold)} units`,
        ],
        [
          "Highest revenue product",
          data.highest_revenue_product?.product_name,
          money(data.highest_revenue_product?.revenue),
        ],
        [
          "Most profitable product",
          data.most_profitable_product?.product_name,
          money(data.most_profitable_product?.profit),
        ],
        [
          "Highest margin product",
          data.highest_margin_product?.product_name,
          `${Number(data.highest_margin_product?.margin || 0).toFixed(2)}%`,
        ],
      ];

      highlights.forEach((item, index) => {
        const x = margin + index * 68;
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, 94, 63, 31, 3, 3, "S");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(item[0], x + 4, 102);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(safeText(item[1]).slice(0, 28), x + 4, 112);
        doc.setFontSize(8);
        doc.setTextColor(37, 99, 235);
        doc.text(item[2], x + 4, 120);
      });

      drawBarChart(doc, {
        x: margin,
        y: 139,
        width: 126,
        height: 52,
        title: "Top products by revenue",
        data: topRevenueProducts,
        labelKey: "product_name",
        valueKey: "revenue",
      });

      drawBarChart(doc, {
        x: 154,
        y: 139,
        width: 126,
        height: 52,
        title: "Top products by profit",
        data: topProfitProducts,
        labelKey: "product_name",
        valueKey: "profit",
      });

      doc.addPage("landscape");
      drawLineChart(doc, {
        x: margin,
        y: 20,
        width: 130,
        height: 72,
        title: "Revenue trend",
        data: trendData,
      });
      drawBarChart(doc, {
        x: 154,
        y: 20,
        width: 126,
        height: 72,
        title: "Best-selling products by quantity",
        data: getTop(productAnalysis, "quantity_sold", 7),
        labelKey: "product_name",
        valueKey: "quantity_sold",
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("Product-wise profit analysis", margin, 107);

      autoTable(doc, {
        startY: 113,
        head: [["Product", "Category", "Units", "Revenue", "Cost", "Profit", "Margin"]],
        body: productAnalysis.map((item) => [
          item.product_name,
          item.category,
          number(item.quantity_sold),
          money(item.revenue),
          money(item.cost),
          money(item.profit),
          `${Number(item.margin || 0).toFixed(2)}%`,
        ]),
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2.2, valign: "middle" },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      doc.addPage("landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("Category performance", margin, 18);

      autoTable(doc, {
        startY: 25,
        head: [["Category", "Units", "Revenue", "Cost", "Profit", "Margin"]],
        body: categoryAnalysis.map((item) => [
          item.category,
          number(item.quantity_sold),
          money(item.revenue),
          money(item.cost),
          money(item.profit),
          `${Number(item.margin || 0).toFixed(2)}%`,
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
        },
        styles: { fontSize: 8, cellPadding: 2.5 },
        margin: { left: margin, right: margin },
      });

      const categoryEnd = doc.lastAutoTable?.finalY || 70;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text("Top customers", margin, categoryEnd + 14);

      autoTable(doc, {
        startY: categoryEnd + 20,
        head: [["Customer", "Email", "Orders", "Revenue"]],
        body: topCustomers.map((item) => [
          item.customer_name,
          item.customer_email || "—",
          number(item.orders),
          money(item.revenue),
        ]),
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
        },
        styles: { fontSize: 8, cellPadding: 2.4 },
        margin: { left: margin, right: margin },
      });

      doc.addPage("landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Management insights", margin, 20);

      const insights = [
        data.best_selling_product
          ? `${data.best_selling_product.product_name} is the best-selling product with ${number(data.best_selling_product.quantity_sold)} units sold.`
          : "No delivered product sales are available yet.",
        data.most_profitable_product
          ? `${data.most_profitable_product.product_name} generated the highest product profit of ${money(data.most_profitable_product.profit)}.`
          : "Profit performance will appear after delivered sales are available.",
        data.highest_margin_product
          ? `${data.highest_margin_product.product_name} has the strongest margin at ${Number(data.highest_margin_product.margin || 0).toFixed(2)}%.`
          : "Margin comparison is not available yet.",
        categoryAnalysis[0]
          ? `${categoryAnalysis[0].category} is the leading category with ${money(categoryAnalysis[0].revenue)} in revenue.`
          : "Category performance is not available yet.",
        `Average order value is ${money(data.average_order_value)} across ${number(data.delivered_orders)} delivered orders.`,
        `Overall gross profit is ${money(data.gross_profit)} with a margin of ${Number(data.profit_margin || 0).toFixed(2)}%.`,
      ];

      insights.forEach((insight, index) => {
        const y = 34 + index * 20;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 2, 2, "FD");
        doc.setFillColor(37, 99, 235);
        doc.circle(margin + 6, y + 7, 1.7, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text(insight, margin + 12, y + 8.5);
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Results are based on delivered orders and the latest costs configured in Cost Management.",
        margin,
        pageHeight - 12
      );

      const pageCount = doc.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Zanszii confidential business report • Page ${page} of ${pageCount}`,
          pageWidth - margin,
          pageHeight - 6,
          { align: "right" }
        );
      }

      doc.save(
        `zanszii-detailed-business-report-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="admin-page">
        <div className="cost-empty-state">
          <RefreshCw size={34} className="spin" />
          <h3>Preparing business analytics...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page reports-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Business intelligence</span>
          <h1>Reports & Profit Analytics</h1>
          <p>
            Understand sales, costs, profit, customers and top-performing products.
          </p>
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={exportDetailedPDF}
            disabled={loading || exporting || !data}
          >
            <Download size={18} />
            {exporting ? "Creating PDF..." : "Download Detailed PDF"}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportExcel}
            disabled={loading || productAnalysis.length === 0}
          >
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="metric-grid compact">
        <div className="metric-card static">
          <span className="metric-icon"><IndianRupee /></span>
          <span className="metric-copy">
            <small>Total revenue</small>
            <strong>{money(data?.revenue)}</strong>
          </span>
        </div>

        <div className="metric-card static">
          <span className="metric-icon"><TrendingUp /></span>
          <span className="metric-copy">
            <small>Gross profit</small>
            <strong>{money(data?.gross_profit)}</strong>
          </span>
        </div>

        <div className="metric-card static">
          <span className="metric-icon"><BarChart3 /></span>
          <span className="metric-copy">
            <small>Profit margin</small>
            <strong>{Number(data?.profit_margin || 0).toFixed(2)}%</strong>
          </span>
        </div>

        <div className="metric-card static">
          <span className="metric-icon"><ShoppingBag /></span>
          <span className="metric-copy">
            <small>Delivered orders</small>
            <strong>{number(data?.delivered_orders)}</strong>
          </span>
        </div>

        <div className="metric-card static">
          <span className="metric-icon"><PackageCheck /></span>
          <span className="metric-copy">
            <small>Units sold</small>
            <strong>{number(data?.total_units_sold)}</strong>
          </span>
        </div>

        <div className="metric-card static">
          <span className="metric-icon"><Users /></span>
          <span className="metric-copy">
            <small>Customers</small>
            <strong>{number(data?.customers)}</strong>
          </span>
        </div>
      </section>

      <section className="report-card-grid">
        <div className="panel export-card">
          <div>
            <span className="eyebrow">Best seller</span>
            <h2>{safeText(data?.best_selling_product?.product_name, "No sales yet")}</h2>
            <p>
              {number(data?.best_selling_product?.quantity_sold)} units sold ·{" "}
              {money(data?.best_selling_product?.revenue)} revenue
            </p>
          </div>
          <Trophy size={34} />
        </div>

        <div className="panel export-card">
          <div>
            <span className="eyebrow">Most profitable</span>
            <h2>{safeText(data?.most_profitable_product?.product_name, "No profit data")}</h2>
            <p>
              {money(data?.most_profitable_product?.profit)} profit ·{" "}
              {Number(data?.most_profitable_product?.margin || 0).toFixed(2)}% margin
            </p>
          </div>
          <TrendingUp size={34} />
        </div>
      </section>

      <section className="panel">
        <div className="page-heading-row">
          <div>
            <h2>Product Profit Analysis</h2>
            <p>Delivered sales combined with private product cost information.</p>
          </div>
        </div>

        {productAnalysis.length === 0 ? (
          <div className="cost-empty-state">
            <PackageCheck size={38} />
            <h3>No delivered product sales yet</h3>
            <p>Product performance will appear after orders are delivered.</p>
          </div>
        ) : (
          <div className="cost-table-wrapper">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Units</th>
                  <th>Revenue</th>
                  <th>Total Cost</th>
                  <th>Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {productAnalysis.map((item) => (
                  <tr key={item.product_id || item.product_name}>
                    <td><strong>{item.product_name}</strong></td>
                    <td>{item.category}</td>
                    <td>{number(item.quantity_sold)}</td>
                    <td>{money(item.revenue)}</td>
                    <td>{money(item.cost)}</td>
                    <td>
                      <strong
                        className={
                          Number(item.profit) >= 0
                            ? "cost-positive"
                            : "cost-negative"
                        }
                      >
                        {money(item.profit)}
                      </strong>
                    </td>
                    <td>{Number(item.margin || 0).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
