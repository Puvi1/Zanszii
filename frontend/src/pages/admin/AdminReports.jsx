import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BadgePercent,
  Box,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
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

const percent = (value) =>
  `${Number(value || 0).toFixed(1)}%`;

const resultTone = (value) => {
  const amount = Number(value || 0);

  if (amount < 0) return "#e11d48";
  if (amount === 0) return "#64748b";
  return "#047857";
};

const healthTone = (score) => {
  if (score >= 80) return "#047857";
  if (score >= 60) return "#d97706";
  return "#e11d48";
};

export default function AdminReports() {
  const [report, setReport] = useState(null);
  const [couponAnalytics, setCouponAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState("overview");
  const [expandedOrderId, setExpandedOrderId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [
        reportResponse,
        couponResponse,
        productResponse,
        orderResponse,
      ] = await Promise.all([
        api.get("/admin/reports"),
        api.get("/admin/offers/analytics"),
        api.get("/admin/products"),
        api.get("/admin/orders"),
      ]);

      setReport(reportResponse.data || {});
      setCouponAnalytics(couponResponse.data || {});
      setProducts(
        Array.isArray(productResponse.data?.products)
          ? productResponse.data.products
          : []
      );
      setOrders(
        Array.isArray(orderResponse.data)
          ? orderResponse.data
          : []
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to prepare the complete business report."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const completedOrders = useMemo(
    () =>
      orders.filter((order) =>
        ["delivered", "completed"].includes(order.status)
      ),
    [orders]
  );

  const orderProfitRows = useMemo(() => {
    return completedOrders.map((order) => {
      const grossSales = Number(
        order.subtotal ??
          (order.items || []).reduce(
            (sum, item) =>
              sum + Number(item.line_total || 0),
            0
          )
      );

      const discount = Number(order.discount || 0);
      const netRevenue = Number(
        order.total ?? grossSales - discount
      );

      const productCost = Number(
        order.product_cost ??
          (order.items || []).reduce(
            (sum, item) =>
              sum + Number(item.total_cost || 0),
            0
          )
      );

      const netProfit = Number(
        order.net_profit ?? netRevenue - productCost
      );

      const loss =
        netProfit < 0
          ? Math.abs(netProfit)
          : Number(order.loss || 0);

      return {
        ...order,
        gross_sales: grossSales,
        discount_given: discount,
        net_revenue: netRevenue,
        product_cost: productCost,
        net_profit: netProfit,
        loss,
        profit_margin:
          netRevenue > 0
            ? (netProfit / netRevenue) * 100
            : 0,
      };
    });
  }, [completedOrders]);

  const stockSummary = useMemo(() => {
    const activeProducts = products.filter(
      (product) => product.active !== false
    );
    const lowStock = activeProducts.filter(
      (product) =>
        Number(product.stock || 0) > 0 &&
        Number(product.stock || 0) <= 5
    );
    const outOfStock = activeProducts.filter(
      (product) => Number(product.stock || 0) <= 0
    );

    return {
      total: products.length,
      active: activeProducts.length,
      lowStock,
      outOfStock,
      inventoryValue: products.reduce(
        (sum, product) => {
          const unitCost =
            Number(product.wholesale_price || 0) +
            Number(product.packaging_cost || 0) +
            Number(product.delivery_cost || 0) +
            Number(product.other_cost || 0);

          return (
            sum +
            unitCost * Number(product.stock || 0)
          );
        },
        0
      ),
    };
  }, [products]);

  const financial = useMemo(() => {
    const revenue = Number(report?.revenue || 0);
    const productCost = Number(report?.total_cost || 0);

    const couponDiscount = Number(
      couponAnalytics?.summary?.discount_given || 0
    );
    const couponRevenue = Number(
      couponAnalytics?.summary?.net_revenue || 0
    );
    const couponProfit = Number(
      couponAnalytics?.summary?.net_profit || 0
    );
    const couponLoss = Number(
      couponAnalytics?.summary?.total_loss || 0
    );

    const orderLoss = orderProfitRows.reduce(
      (sum, order) => sum + Number(order.loss || 0),
      0
    );

    const netProfit = revenue - productCost;
    const totalLoss = Math.max(couponLoss, orderLoss);

    return {
      revenue,
      productCost,
      couponDiscount,
      couponRevenue,
      couponProfit,
      couponLoss,
      netProfit,
      totalLoss,
      margin:
        revenue > 0 ? (netProfit / revenue) * 100 : 0,
    };
  }, [report, couponAnalytics, orderProfitRows]);

  const healthScore = useMemo(() => {
    let score = 100;

    if (financial.margin < 10) score -= 25;
    else if (financial.margin < 20) score -= 12;

    if (financial.totalLoss > 0) score -= 15;

    if (stockSummary.outOfStock.length > 0) score -= 12;
    if (stockSummary.lowStock.length > 3) score -= 8;

    if (
      Number(
        couponAnalytics?.summary?.profit_margin || 0
      ) < 0
    ) {
      score -= 15;
    }

    if (Number(report?.cancelled_orders || 0) > 5) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }, [
    financial,
    stockSummary,
    couponAnalytics,
    report,
  ]);

  const insights = useMemo(() => {
    const result = [];

    if (report?.most_profitable_product) {
      result.push(
        `${report.most_profitable_product.product_name} is the most profitable product with ${money(
          report.most_profitable_product.profit
        )} profit.`
      );
    }

    if (couponAnalytics?.insights?.best_coupon) {
      result.push(
        `${couponAnalytics.insights.best_coupon.code} is the best-performing coupon with ${money(
          couponAnalytics.insights.best_coupon.net_profit
        )} net profit.`
      );
    }

    if (
      couponAnalytics?.insights?.highest_loss_product &&
      Number(
        couponAnalytics.insights.highest_loss_product
          .loss || 0
      ) > 0
    ) {
      result.push(
        `${couponAnalytics.insights.highest_loss_product.product_name} has the highest coupon-related loss of ${money(
          couponAnalytics.insights.highest_loss_product
            .loss
        )}.`
      );
    }

    if (stockSummary.outOfStock.length) {
      result.push(
        `${stockSummary.outOfStock.length} products are out of stock and need attention.`
      );
    }

    if (stockSummary.lowStock.length) {
      result.push(
        `${stockSummary.lowStock.length} products are running low on stock.`
      );
    }

    result.push(
      `Overall business margin is ${percent(
        financial.margin
      )}.`
    );

    return result;
  }, [
    report,
    couponAnalytics,
    stockSummary,
    financial,
  ]);

  const exportExcel = () => {
    const rows = [
      {
        section: "Executive Summary",
        metric: "Total Revenue",
        value: financial.revenue,
      },
      {
        section: "Executive Summary",
        metric: "Total Product Cost",
        value: financial.productCost,
      },
      {
        section: "Executive Summary",
        metric: "Coupon Discount Given",
        value: financial.couponDiscount,
      },
      {
        section: "Executive Summary",
        metric: "Net Profit",
        value: financial.netProfit,
      },
      {
        section: "Executive Summary",
        metric: "Total Loss",
        value: financial.totalLoss,
      },
      ...((report?.product_analysis || []).map(
        (item) => ({
          section: "Product Analysis",
          metric: item.product_name,
          value: item.profit,
          revenue: item.revenue,
          cost: item.cost,
          margin: item.margin,
        })
      )),
      ...((couponAnalytics?.products || []).map(
        (item) => ({
          section: "Coupon Product Impact",
          metric: `${item.coupon_code} - ${item.product_name}`,
          value: item.net_profit,
          revenue: item.net_revenue,
          cost: item.product_cost,
          discount: item.discount_given,
          loss: item.loss,
        })
      )),
      ...orderProfitRows.map((order) => ({
        section: "Order Profit & Loss",
        metric:
          order.order_number || order.order_id,
        value: order.net_profit,
        revenue: order.net_revenue,
        cost: order.product_cost,
        discount: order.discount_given,
        loss: order.loss,
      })),
    ];

    exportRowsToExcel({
      rows,
      columns: [
        {
          label: "Section",
          value: (row) => row.section,
        },
        {
          label: "Metric / Item",
          value: (row) => row.metric,
        },
        {
          label: "Value / Profit",
          value: (row) => row.value ?? "",
        },
        {
          label: "Revenue",
          value: (row) => row.revenue ?? "",
        },
        {
          label: "Cost",
          value: (row) => row.cost ?? "",
        },
        {
          label: "Discount",
          value: (row) => row.discount ?? "",
        },
        {
          label: "Loss",
          value: (row) => row.loss ?? "",
        },
        {
          label: "Margin",
          value: (row) => row.margin ?? "",
        },
      ],
      fileName: "zanszi-complete-business-report",
      sheetName: "Complete Report",
    });
  };

  const exportDetailedPDF = () => {
    if (!report) return;

    setExporting(true);

    try {
      const doc = new jsPDF(
        "landscape",
        "mm",
        "a4"
      );
      const width =
        doc.internal.pageSize.getWidth();
      const height =
        doc.internal.pageSize.getHeight();
      const margin = 14;

      const addHeader = (title, subtitle) => {
        doc.setFillColor(6, 43, 95);
        doc.rect(0, 0, width, 34, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("ZANSZI", margin, 15);

        doc.setFontSize(13);
        doc.text(title, margin, 24);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(203, 213, 225);
        doc.text(subtitle, margin, 30);
      };

      addHeader(
        "Complete Business Intelligence Report",
        `Generated ${new Date().toLocaleString(
          "en-IN"
        )}`
      );

      const metrics = [
        ["Revenue", money(financial.revenue)],
        ["Product Cost", money(financial.productCost)],
        [
          "Coupon Discount",
          money(financial.couponDiscount),
        ],
        ["Net Profit", money(financial.netProfit)],
        ["Total Loss", money(financial.totalLoss)],
        ["Margin", percent(financial.margin)],
        ["Health Score", `${healthScore}/100`],
      ];

      metrics.forEach(([label, value], index) => {
        const x = margin + index * 38.5;

        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(
          x,
          43,
          34,
          22,
          2,
          2,
          "FD"
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, x + 3, 50);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(String(value), x + 3, 60);
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("Executive Insights", margin, 78);

      insights.slice(0, 6).forEach(
        (insight, index) => {
          const y = 86 + index * 14;

          doc.setFillColor(248, 250, 252);
          doc.roundedRect(
            margin,
            y,
            width - margin * 2,
            10,
            2,
            2,
            "F"
          );

          doc.setFillColor(37, 99, 235);
          doc.circle(margin + 5, y + 5, 1.3, "F");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(insight, margin + 10, y + 6);
        }
      );

      doc.addPage("landscape");
      addHeader(
        "Product Profitability",
        "Revenue, cost, profit, loss and margin by product"
      );

      autoTable(doc, {
        startY: 42,
        head: [
          [
            "Product",
            "Category",
            "Units",
            "Revenue",
            "Cost",
            "Profit",
            "Margin",
          ],
        ],
        body: (report.product_analysis || []).map(
          (item) => [
            item.product_name,
            item.category,
            number(item.quantity_sold),
            money(item.revenue),
            money(item.cost),
            money(item.profit),
            percent(item.margin),
          ]
        ),
        theme: "grid",
        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
        },
        headStyles: {
          fillColor: [6, 43, 95],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: {
          left: margin,
          right: margin,
        },
      });

      doc.addPage("landscape");
      addHeader(
        "Coupon Performance & Product Impact",
        "Coupon discount, revenue, cost, profit and loss"
      );

      autoTable(doc, {
        startY: 42,
        head: [
          [
            "Coupon",
            "Product",
            "Qty",
            "Gross",
            "Discount",
            "Net Revenue",
            "Cost",
            "Profit",
            "Loss",
          ],
        ],
        body: (
          couponAnalytics?.products || []
        ).map((item) => [
          item.coupon_code,
          item.product_name,
          number(item.quantity_sold),
          money(item.gross_sales),
          money(item.discount_given),
          money(item.net_revenue),
          money(item.product_cost),
          money(
            Math.max(
              Number(item.net_profit || 0),
              0
            )
          ),
          money(item.loss),
        ]),
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [15, 76, 156],
          textColor: [255, 255, 255],
        },
        margin: {
          left: margin,
          right: margin,
        },
      });

      doc.addPage("landscape");
      addHeader(
        "Order-wise Profit & Loss",
        "Every delivered order with revenue, discount, cost, profit and loss"
      );

      autoTable(doc, {
        startY: 42,
        head: [
          [
            "Order",
            "Customer",
            "Coupon",
            "Gross",
            "Discount",
            "Net Revenue",
            "Cost",
            "Profit",
            "Loss",
            "Margin",
          ],
        ],
        body: orderProfitRows.map((order) => [
          order.order_number || order.order_id,
          order.customer_name ||
            order.customer_email ||
            "Customer",
          order.coupon_code || "—",
          money(order.gross_sales),
          money(order.discount_given),
          money(order.net_revenue),
          money(order.product_cost),
          money(
            Math.max(
              Number(order.net_profit || 0),
              0
            )
          ),
          money(order.loss),
          percent(order.profit_margin),
        ]),
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [6, 43, 95],
          textColor: [255, 255, 255],
        },
        margin: {
          left: margin,
          right: margin,
        },
      });

      doc.addPage("landscape");
      addHeader(
        "Inventory & Risk",
        "Low-stock, out-of-stock and current inventory value"
      );

      autoTable(doc, {
        startY: 42,
        head: [
          [
            "Product",
            "Stock",
            "Selling Price",
            "Unit Cost",
            "Stock Value",
            "Status",
          ],
        ],
        body: products.map((product) => {
          const unitCost =
            Number(product.wholesale_price || 0) +
            Number(product.packaging_cost || 0) +
            Number(product.delivery_cost || 0) +
            Number(product.other_cost || 0);

          const stock = Number(product.stock || 0);

          return [
            product.name,
            number(stock),
            money(product.price),
            money(unitCost),
            money(unitCost * stock),
            stock <= 0
              ? "Out of stock"
              : stock <= 5
                ? "Low stock"
                : "Healthy",
          ];
        }),
        theme: "grid",
        styles: {
          fontSize: 7,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [15, 76, 156],
          textColor: [255, 255, 255],
        },
        margin: {
          left: margin,
          right: margin,
        },
      });

      const pageCount =
        doc.getNumberOfPages();

      for (
        let page = 1;
        page <= pageCount;
        page += 1
      ) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);

        doc.text(
          `ZANSZI confidential report • Page ${page} of ${pageCount}`,
          width - margin,
          height - 6,
          { align: "right" }
        );
      }

      doc.save(
        `zanszi-complete-business-report-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf`
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="admin-page">
        <div className="cost-empty-state">
          <RefreshCw
            size={34}
            className="spin"
          />
          <h3>
            Preparing complete business intelligence...
          </h3>
        </div>
      </div>
    );
  }

  const tabs = [
    ["overview", "Overview"],
    ["finance", "Finance"],
    ["sales", "Sales & Orders"],
    ["coupons", "Coupons"],
    ["inventory", "Inventory"],
  ];

  return (
    <div className="admin-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">
            Executive business intelligence
          </span>

          <h1>Complete Business Report</h1>

          <p>
            Sales, costs, coupons, profit, loss, inventory
            and order performance in one professional dashboard.
          </p>
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={18}
              className={loading ? "spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={exportDetailedPDF}
            disabled={
              loading || exporting || !report
            }
          >
            <Download size={18} />
            {exporting
              ? "Creating report..."
              : "Complete PDF"}
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={exportExcel}
            disabled={loading || !report}
          >
            <FileSpreadsheet size={18} />
            Complete Excel
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <section
        className="panel"
        style={{
          padding: 18,
          marginBottom: 18,
          background:
            "linear-gradient(135deg, #062B5F, #0F4C9C)",
          color: "white",
          border: "none",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(200px, .7fr) minmax(240px, 1.3fr)",
            gap: 20,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: ".14em",
                color: "#bfdbfe",
              }}
            >
              Business Health
            </p>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <strong
                style={{
                  fontSize: 46,
                  color: "white",
                }}
              >
                {healthScore}
              </strong>
              <span style={{ color: "#bfdbfe" }}>
                / 100
              </span>
            </div>

            <p
              style={{
                margin: "5px 0 0",
                color: "#dbeafe",
                fontSize: 13,
              }}
            >
              {healthScore >= 80
                ? "Healthy business performance"
                : healthScore >= 60
                  ? "Stable, but needs attention"
                  : "Critical areas need action"}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            {[
              [
                "Revenue",
                money(financial.revenue),
                IndianRupee,
              ],
              [
                "Net Profit",
                money(financial.netProfit),
                Wallet,
              ],
              [
                "Total Loss",
                money(financial.totalLoss),
                TrendingDown,
              ],
              [
                "Margin",
                percent(financial.margin),
                BarChart3,
              ],
            ].map(([label, value, Icon]) => (
              <div
                key={label}
                style={{
                  padding: 13,
                  borderRadius: 15,
                  background: "rgba(255,255,255,.10)",
                  border:
                    "1px solid rgba(255,255,255,.12)",
                }}
              >
                <Icon size={18} />
                <p
                  style={{
                    margin: "7px 0 0",
                    fontSize: 11,
                    color: "#bfdbfe",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </p>
                <strong
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 18,
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div
        className="panel"
        style={{
          marginBottom: 18,
          padding: 8,
          display: "flex",
          gap: 6,
          overflowX: "auto",
        }}
      >
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setActiveTab(value)}
            style={{
              border: 0,
              borderRadius: 11,
              padding: "10px 14px",
              whiteSpace: "nowrap",
              fontWeight: 900,
              cursor: "pointer",
              background:
                activeTab === value
                  ? "#0F4C9C"
                  : "transparent",
              color:
                activeTab === value
                  ? "white"
                  : "#64748b",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <>
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 18,
            }}
          >
            {[
              [
                "Total Revenue",
                money(financial.revenue),
                IndianRupee,
              ],
              [
                "Product Cost",
                money(financial.productCost),
                Box,
              ],
              [
                "Coupon Discount",
                money(financial.couponDiscount),
                BadgePercent,
              ],
              [
                "Net Profit",
                money(financial.netProfit),
                TrendingUp,
              ],
              [
                "Total Loss",
                money(financial.totalLoss),
                TrendingDown,
              ],
              [
                "Delivered Orders",
                number(report?.delivered_orders),
                ShoppingBag,
              ],
            ].map(([label, value, Icon]) => (
              <div
                key={label}
                className="panel"
                style={{ padding: 15 }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 13,
                    background: "#eff6ff",
                    color: "#0F4C9C",
                  }}
                >
                  <Icon size={18} />
                </span>

                <p
                  style={{
                    margin: "10px 0 0",
                    fontSize: 11,
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </p>

                <strong
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 19,
                    color:
                      label === "Total Loss"
                        ? "#e11d48"
                        : "#0f172a",
                  }}
                >
                  {value}
                </strong>
              </div>
            ))}
          </section>

          <section
            className="panel"
            style={{ padding: 18 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: "#fff7ed",
                  color: "#d97706",
                }}
              >
                <Sparkles size={20} />
              </span>

              <div>
                <strong style={{ fontSize: 18 }}>
                  Management Insights
                </strong>
                <p
                  style={{
                    margin: "3px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Quick actions from current business data.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: 15,
                display: "grid",
                gap: 9,
              }}
            >
              {insights.map((insight, index) => (
                <div
                  key={`${insight}-${index}`}
                  style={{
                    padding: "12px 13px",
                    borderRadius: 13,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                    fontSize: 13,
                  }}
                >
                  {insight}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "finance" && (
        <section
          className="panel"
          style={{ padding: 18 }}
        >
          <h2 style={{ marginTop: 0 }}>
            Financial Overview
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginTop: 14,
            }}
          >
            {[
              ["Sales Revenue", financial.revenue],
              ["Product Cost", financial.productCost],
              [
                "Coupon Discount",
                financial.couponDiscount,
              ],
              ["Net Profit", financial.netProfit],
              ["Total Loss", financial.totalLoss],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 15,
                  borderRadius: 15,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <small
                  style={{
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </small>

                <p
                  style={{
                    margin: "5px 0 0",
                    fontSize: 20,
                    fontWeight: 900,
                    color:
                      label === "Total Loss"
                        ? "#e11d48"
                        : resultTone(
                            label === "Net Profit"
                              ? value
                              : 1
                          ),
                  }}
                >
                  {money(value)}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 15,
              borderRadius: 15,
              background: "#eff6ff",
              color: "#1e3a8a",
              lineHeight: 1.7,
              fontSize: 13,
            }}
          >
            <strong>Net Profit Formula:</strong>{" "}
            Revenue − Product Costs. Coupon discounts are
            tracked separately and are already reflected in
            customer-paid revenue for coupon orders.
          </div>
        </section>
      )}

      {activeTab === "sales" && (
        <section
          className="panel"
          style={{ padding: 18 }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Order-wise Profit & Loss
            </h2>
            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Expand any delivered order for complete details.
            </p>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 9,
            }}
          >
            {orderProfitRows.length ? (
              orderProfitRows.map((order) => {
                const expanded =
                  expandedOrderId === order.order_id;
                const isLoss =
                  Number(order.loss || 0) > 0;

                return (
                  <div
                    key={order.order_id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 15,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrderId(
                          expanded
                            ? ""
                            : order.order_id
                        )
                      }
                      style={{
                        width: "100%",
                        border: 0,
                        background: "white",
                        padding: "13px 14px",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(150px, 1.4fr) minmax(100px, .8fr) minmax(100px, .8fr) auto",
                        gap: 10,
                        alignItems: "center",
                        textAlign: "left",
                      }}
                    >
                      <div>
                        <strong>
                          {order.order_number ||
                            order.order_id}
                        </strong>
                        <small
                          style={{
                            display: "block",
                            marginTop: 3,
                            color: "#64748b",
                          }}
                        >
                          {order.customer_name ||
                            "Customer"}{" "}
                          · {order.coupon_code || "No coupon"}
                        </small>
                      </div>

                      <div>
                        <small style={{ color: "#64748b" }}>
                          Revenue
                        </small>
                        <strong
                          style={{ display: "block" }}
                        >
                          {money(order.net_revenue)}
                        </strong>
                      </div>

                      <div>
                        <small style={{ color: "#64748b" }}>
                          Result
                        </small>
                        <strong
                          style={{
                            display: "block",
                            color: isLoss
                              ? "#e11d48"
                              : "#047857",
                          }}
                        >
                          {isLoss
                            ? `-${money(order.loss)}`
                            : `+${money(
                                Math.max(
                                  Number(
                                    order.net_profit || 0
                                  ),
                                  0
                                )
                              )}`}
                        </strong>
                      </div>

                      {expanded ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </button>

                    {expanded && (
                      <div
                        style={{
                          padding: 14,
                          background: "#f8fafc",
                          borderTop:
                            "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(130px, 1fr))",
                            gap: 9,
                          }}
                        >
                          {[
                            [
                              "Gross Sales",
                              order.gross_sales,
                            ],
                            [
                              "Discount",
                              order.discount_given,
                            ],
                            [
                              "Net Revenue",
                              order.net_revenue,
                            ],
                            [
                              "Product Cost",
                              order.product_cost,
                            ],
                            [
                              "Net Profit",
                              order.net_profit,
                            ],
                            ["Loss", order.loss],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                padding: 11,
                                background: "white",
                                borderRadius: 12,
                                border:
                                  "1px solid #e2e8f0",
                              }}
                            >
                              <small
                                style={{
                                  color: "#64748b",
                                  fontWeight: 800,
                                }}
                              >
                                {label}
                              </small>
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  fontWeight: 900,
                                  color:
                                    label === "Loss" &&
                                    Number(value) > 0
                                      ? "#e11d48"
                                      : "#0f172a",
                                }}
                              >
                                {money(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-cell">
                No delivered orders available.
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "coupons" && (
        <section
          className="panel"
          style={{ padding: 18 }}
        >
          <h2 style={{ marginTop: 0 }}>
            Coupon Performance
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 11,
              marginBottom: 16,
            }}
          >
            {[
              [
                "Coupon Orders",
                number(
                  couponAnalytics?.summary?.orders
                ),
              ],
              [
                "Discount Given",
                money(
                  couponAnalytics?.summary
                    ?.discount_given
                ),
              ],
              [
                "Coupon Profit",
                money(
                  couponAnalytics?.summary?.net_profit
                ),
              ],
              [
                "Coupon Loss",
                money(
                  couponAnalytics?.summary?.total_loss
                ),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <small
                  style={{
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </small>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 18,
                    fontWeight: 900,
                    color:
                      label === "Coupon Loss"
                        ? "#e11d48"
                        : "#0f172a",
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coupon</th>
                  <th>Orders</th>
                  <th>Gross</th>
                  <th>Discount</th>
                  <th>Cost</th>
                  <th>Profit</th>
                  <th>Loss</th>
                  <th>Margin</th>
                </tr>
              </thead>

              <tbody>
                {(couponAnalytics?.coupons || [])
                  .length ? (
                  couponAnalytics.coupons.map(
                    (item) => (
                      <tr key={item.offer_id}>
                        <td>
                          <strong>{item.code}</strong>
                        </td>
                        <td>{item.orders}</td>
                        <td>
                          {money(item.gross_sales)}
                        </td>
                        <td>
                          {money(item.discount_given)}
                        </td>
                        <td>
                          {money(item.product_cost)}
                        </td>
                        <td>
                          <strong
                            style={{
                              color: "#047857",
                            }}
                          >
                            {money(
                              Math.max(
                                Number(
                                  item.net_profit || 0
                                ),
                                0
                              )
                            )}
                          </strong>
                        </td>
                        <td>
                          <strong
                            style={{
                              color:
                                Number(
                                  item.total_loss || 0
                                ) > 0
                                  ? "#e11d48"
                                  : "#64748b",
                            }}
                          >
                            {money(item.total_loss)}
                          </strong>
                        </td>
                        <td>
                          {percent(
                            item.profit_margin
                          )}
                        </td>
                      </tr>
                    )
                  )
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      className="empty-cell"
                    >
                      No coupon analytics available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "inventory" && (
        <section
          className="panel"
          style={{ padding: 18 }}
        >
          <h2 style={{ marginTop: 0 }}>
            Inventory Health
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 11,
            }}
          >
            {[
              ["Products", stockSummary.total],
              ["Active", stockSummary.active],
              [
                "Low Stock",
                stockSummary.lowStock.length,
              ],
              [
                "Out of Stock",
                stockSummary.outOfStock.length,
              ],
              [
                "Inventory Cost Value",
                money(stockSummary.inventoryValue),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <small
                  style={{
                    color: "#64748b",
                    fontWeight: 800,
                  }}
                >
                  {label}
                </small>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 18,
                    fontWeight: 900,
                    color:
                      label === "Out of Stock" &&
                      Number(value) > 0
                        ? "#e11d48"
                        : "#0f172a",
                  }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>

          {(stockSummary.lowStock.length > 0 ||
            stockSummary.outOfStock.length >
              0) && (
            <div
              style={{
                marginTop: 16,
                display: "grid",
                gap: 9,
              }}
            >
              {[
                ...stockSummary.outOfStock,
                ...stockSummary.lowStock,
              ].map((product) => (
                <div
                  key={product.product_id}
                  style={{
                    padding: "12px 13px",
                    borderRadius: 13,
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>{product.name}</strong>
                    <small
                      style={{
                        display: "block",
                        marginTop: 3,
                        color: "#64748b",
                      }}
                    >
                      Current stock:{" "}
                      {number(product.stock)}
                    </small>
                  </div>

                  <span
                    style={{
                      borderRadius: 999,
                      padding: "5px 9px",
                      fontSize: 10,
                      fontWeight: 900,
                      background:
                        Number(product.stock || 0) <= 0
                          ? "#fff1f2"
                          : "#fff7ed",
                      color:
                        Number(product.stock || 0) <= 0
                          ? "#be123c"
                          : "#c2410c",
                    }}
                  >
                    {Number(product.stock || 0) <= 0
                      ? "Out of stock"
                      : "Low stock"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
