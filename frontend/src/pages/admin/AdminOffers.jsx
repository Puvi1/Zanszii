import { useEffect, useMemo, useState } from "react";
import {
  BadgePercent,
  CalendarDays,
  Copy,
  Download,
  FileSpreadsheet,
  Gift,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Truck,
  TrendingUp,
  IndianRupee,
  Wallet,
  AlertTriangle,
  Calculator,
  ReceiptIndianRupee,
  Users,
  ShoppingBag,
  BarChart3,
  X,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";
import {
  exportRowsToExcel,
  exportRowsToPdf,
} from "../../utils/exportData";

const EMPTY_FORM = {
  code: "",
  title: "",
  description: "",
  offer_type: "percentage",
  discount_value: "",
  minimum_order_value: "0",
  maximum_discount: "",
  starts_at: "",
  expires_at: "",
  usage_limit: "",
  per_user_limit: "1",
  first_order_only: false,
  active: true,
  featured: false,
};

function formatDate(value) {
  if (!value) return "No expiry";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
}

function offerLabel(offer) {
  if (offer.offer_type === "percentage") {
    return `${Number(offer.discount_value || 0)}% off`;
  }

  if (offer.offer_type === "flat") {
    return `₹${Number(offer.discount_value || 0).toLocaleString("en-IN")} off`;
  }

  return "Free delivery";
}

function offerStatus(offer) {
  const now = Date.now();

  if (!offer.active) return "Inactive";
  if (offer.starts_at && new Date(offer.starts_at).getTime() > now) {
    return "Scheduled";
  }
  if (offer.expires_at && new Date(offer.expires_at).getTime() < now) {
    return "Expired";
  }

  return "Active";
}

const columns = [
  { label: "Code", value: (item) => item.code },
  { label: "Title", value: (item) => item.title },
  { label: "Offer", value: offerLabel },
  {
    label: "Minimum Order",
    value: (item) => item.minimum_order_value || 0,
  },
  {
    label: "Usage",
    value: (item) =>
      `${item.usage_count || 0}/${item.usage_limit || "Unlimited"}`,
  },
  { label: "Expiry", value: (item) => item.expires_at || "" },
  { label: "Status", value: offerStatus },
];

export default function AdminOffers() {
  const [offers, setOffers] = useState([]);
  const [analytics, setAnalytics] = useState({
    summary: {
      total_coupons: 0,
      active_coupons: 0,
      expired_coupons: 0,
      orders: 0,
      customers: 0,
      gross_sales: 0,
      discount_given: 0,
      net_revenue: 0,
      product_cost: 0,
      net_profit: 0,
      total_loss: 0,
      loss_orders: 0,
      profit_orders: 0,
      profit_margin: 0,
      roi: 0,
    },
    coupons: [],
    orders: [],
    products: [],
    insights: {},
    formula_reference: {},
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showProductReport, setShowProductReport] = useState(false);
  const [showOrderReport, setShowOrderReport] = useState(false);
  const [expandedProductKey, setExpandedProductKey] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [offersResponse, analyticsResponse] =
        await Promise.all([
          api.get("/admin/offers"),
          api.get("/admin/offers/analytics"),
        ]);

      setOffers(
        Array.isArray(offersResponse.data?.offers)
          ? offersResponse.data.offers
          : []
      );

      setAnalytics({
        summary: analyticsResponse.data?.summary || {},
        coupons: Array.isArray(
          analyticsResponse.data?.coupons
        )
          ? analyticsResponse.data.coupons
          : [],
        orders: Array.isArray(
          analyticsResponse.data?.orders
        )
          ? analyticsResponse.data.orders
          : [],
        products: Array.isArray(
          analyticsResponse.data?.products
        )
          ? analyticsResponse.data.products
          : [],
        insights:
          analyticsResponse.data?.insights || {},
        formula_reference:
          analyticsResponse.data?.formula_reference || {},
      });
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to load coupons."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return offers.filter((offer) => {
      const matchesQuery =
        !normalized ||
        `${offer.code} ${offer.title} ${offer.description || ""}`
          .toLowerCase()
          .includes(normalized);

      const matchesStatus =
        statusFilter === "all" ||
        offerStatus(offer).toLowerCase() === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [offers, query, statusFilter]);

  const analyticsByOffer = useMemo(
    () =>
      Object.fromEntries(
        (analytics.coupons || []).map((item) => [
          item.offer_id,
          item,
        ])
      ),
    [analytics.coupons]
  );

  const summary = useMemo(() => {
    const statuses = offers.map(offerStatus);

    return {
      total: offers.length,
      active: statuses.filter((value) => value === "Active").length,
      expired: statuses.filter((value) => value === "Expired").length,
      uses: offers.reduce(
        (sum, offer) => sum + Number(offer.usage_count || 0),
        0
      ),
    };
  }, [offers]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setMessage("");
    setModalOpen(true);
  };

  const openEdit = (offer) => {
    setEditing(offer);
    setForm({
      code: offer.code || "",
      title: offer.title || "",
      description: offer.description || "",
      offer_type: offer.offer_type || "percentage",
      discount_value: String(offer.discount_value ?? ""),
      minimum_order_value: String(
        offer.minimum_order_value ?? 0
      ),
      maximum_discount:
        offer.maximum_discount == null
          ? ""
          : String(offer.maximum_discount),
      starts_at: toLocalInput(offer.starts_at),
      expires_at: toLocalInput(offer.expires_at),
      usage_limit:
        offer.usage_limit == null
          ? ""
          : String(offer.usage_limit),
      per_user_limit: String(offer.per_user_limit || 1),
      first_order_only: Boolean(offer.first_order_only),
      active: offer.active !== false,
      featured: Boolean(offer.featured),
    });
    setError("");
    setMessage("");
    setModalOpen(true);
  };

  const duplicateOffer = (offer) => {
    setEditing(null);
    setForm({
      code: `${offer.code}COPY`,
      title: `${offer.title} Copy`,
      description: offer.description || "",
      offer_type: offer.offer_type || "percentage",
      discount_value: String(offer.discount_value ?? ""),
      minimum_order_value: String(
        offer.minimum_order_value ?? 0
      ),
      maximum_discount:
        offer.maximum_discount == null
          ? ""
          : String(offer.maximum_discount),
      starts_at: "",
      expires_at: "",
      usage_limit:
        offer.usage_limit == null
          ? ""
          : String(offer.usage_limit),
      per_user_limit: String(offer.per_user_limit || 1),
      first_order_only: Boolean(offer.first_order_only),
      active: false,
      featured: false,
    });
    setModalOpen(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      code: form.code.trim().toUpperCase(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      offer_type: form.offer_type,
      discount_value:
        form.offer_type === "free_delivery"
          ? 0
          : Number(form.discount_value || 0),
      minimum_order_value: Number(
        form.minimum_order_value || 0
      ),
      maximum_discount:
        form.offer_type === "percentage" &&
        form.maximum_discount !== ""
          ? Number(form.maximum_discount)
          : null,
      starts_at: form.starts_at
        ? new Date(form.starts_at).toISOString()
        : null,
      expires_at: form.expires_at
        ? new Date(form.expires_at).toISOString()
        : null,
      usage_limit:
        form.usage_limit === ""
          ? null
          : Number(form.usage_limit),
      per_user_limit: Number(form.per_user_limit || 1),
      first_order_only: form.first_order_only,
      category_ids: [],
      product_ids: [],
      active: form.active,
      featured: form.featured,
    };

    try {
      if (editing) {
        await api.patch(
          `/admin/offers/${editing.offer_id}`,
          payload
        );
      } else {
        await api.post("/admin/offers", payload);
      }

      setModalOpen(false);
      setMessage(
        editing
          ? "Coupon updated successfully."
          : "Coupon created successfully."
      );
      await load();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to save this coupon."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (offer) => {
    if (!window.confirm(`Delete coupon “${offer.code}”?`)) {
      return;
    }

    try {
      await api.delete(`/admin/offers/${offer.offer_id}`);
      setMessage("Coupon deleted successfully.");
      await load();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to delete this coupon."
        )
      );
    }
  };

  const toggleActive = async (offer) => {
    try {
      await api.patch(`/admin/offers/${offer.offer_id}`, {
        active: !offer.active,
      });
      await load();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to update coupon status."
        )
      );
    }
  };


  const currency = (value) =>
    `₹${Number(value || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;

  const completeCouponRows = offers.map((offer) => ({
    ...offer,
    ...(analyticsByOffer[offer.offer_id] || {}),
  }));

  const completeReportColumns = [
    { label: "Coupon Code", value: (item) => item.code },
    { label: "Title", value: (item) => item.title },
    { label: "Offer", value: offerLabel },
    { label: "Orders", value: (item) => item.orders || 0 },
    {
      label: "Customers",
      value: (item) => item.customers || 0,
    },
    {
      label: "Gross Sales",
      value: (item) => Number(item.gross_sales || 0),
    },
    {
      label: "Discount Given",
      value: (item) => Number(item.discount_given || 0),
    },
    {
      label: "Net Revenue",
      value: (item) => Number(item.net_revenue || 0),
    },
    {
      label: "Product Cost",
      value: (item) => Number(item.product_cost || 0),
    },
    {
      label: "Net Profit",
      value: (item) => Number(item.net_profit || 0),
    },
    {
      label: "Total Loss",
      value: (item) => Number(item.total_loss || 0),
    },
    {
      label: "Loss Orders",
      value: (item) => Number(item.loss_orders || 0),
    },
    {
      label: "Profit Margin %",
      value: (item) => Number(item.profit_margin || 0),
    },
    {
      label: "ROI",
      value: (item) =>
        item.roi == null ? "N/A" : Number(item.roi),
    },
    {
      label: "Status",
      value: (item) => offerStatus(item),
    },
  ];

  const productReportColumns = [
    { label: "Coupon", value: (item) => item.coupon_code },
    { label: "Product", value: (item) => item.product_name },
    {
      label: "Quantity Sold",
      value: (item) => item.quantity_sold || 0,
    },
    { label: "Orders", value: (item) => item.orders || 0 },
    {
      label: "Gross Sales",
      value: (item) => Number(item.gross_sales || 0),
    },
    {
      label: "Discount Given",
      value: (item) => Number(item.discount_given || 0),
    },
    {
      label: "Net Revenue",
      value: (item) => Number(item.net_revenue || 0),
    },
    {
      label: "Product Cost",
      value: (item) => Number(item.product_cost || 0),
    },
    {
      label: "Net Profit",
      value: (item) => Number(item.net_profit || 0),
    },
    {
      label: "Loss",
      value: (item) => Number(item.loss || 0),
    },
    {
      label: "Profit Margin %",
      value: (item) => Number(item.profit_margin || 0),
    },
  ];

  const orderReportColumns = [
    {
      label: "Order",
      value: (item) =>
        item.order_number || item.order_id,
    },
    { label: "Date", value: (item) => item.created_at || "" },
    {
      label: "Customer",
      value: (item) =>
        item.customer_name || item.customer_email || "",
    },
    { label: "Coupon", value: (item) => item.coupon_code },
    {
      label: "Gross Sales",
      value: (item) => Number(item.gross_sales || 0),
    },
    {
      label: "Discount Given",
      value: (item) => Number(item.discount_given || 0),
    },
    {
      label: "Net Revenue",
      value: (item) => Number(item.net_revenue || 0),
    },
    {
      label: "Product Cost",
      value: (item) => Number(item.product_cost || 0),
    },
    {
      label: "Net Profit",
      value: (item) => Number(item.net_profit || 0),
    },
    {
      label: "Loss",
      value: (item) => Number(item.loss || 0),
    },
  ];

  const exportCompletePdf = () => {
    exportRowsToPdf({
      rows: [
        ...completeCouponRows,
        ...analytics.products,
        ...analytics.orders,
      ],
      columns: completeReportColumns,
      fileName: "zanszii-complete-coupon-report",
      title:
        "ZANSZI Complete Coupon, Product & Loss Report",
      landscape: true,
    });
  };

  const exportCompleteExcel = () => {
    exportRowsToExcel({
      rows: completeCouponRows,
      columns: completeReportColumns,
      fileName: "zanszii-complete-coupon-report",
      sheetName: "Coupon Summary",
      additionalSheets: [
        {
          sheetName: "Product Wise",
          rows: analytics.products,
          columns: productReportColumns,
        },
        {
          sheetName: "Order Wise",
          rows: analytics.orders,
          columns: orderReportColumns,
        },
      ],
    });
  };

  return (
    <div className="admin-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Promotions</span>
          <h1>Coupons & Offers</h1>
          <p>
            Create discounts, control usage and highlight offers.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          Create coupon
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {message && (
        <div className="alert alert-success">{message}</div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        {[
          [
            "Coupon Orders",
            analytics.summary.orders || 0,
            Gift,
          ],
          [
            "Gross Sales",
            `₹${Number(
              analytics.summary.gross_sales || 0
            ).toLocaleString("en-IN")}`,
            TrendingUp,
          ],
          [
            "Discount Given",
            `₹${Number(
              analytics.summary.discount_given || 0
            ).toLocaleString("en-IN")}`,
            BadgePercent,
          ],
          [
            "Net Profit",
            `₹${Number(
              analytics.summary.net_profit || 0
            ).toLocaleString("en-IN")}`,
            Wallet,
          ],
        ].map(([label, value, Icon]) => (
          <div
            key={label}
            className="panel"
            style={{ padding: "16px" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: "#eff6ff",
                  color: "#0F4C9C",
                }}
              >
                <Icon size={19} />
              </span>

              <strong style={{ fontSize: 24 }}>{value}</strong>
            </div>

            <p
              style={{
                margin: "10px 0 0",
                fontSize: 12,
                fontWeight: 800,
                color: "#64748b",
              }}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      <div
        className="panel"
        style={{
          marginBottom: "18px",
          padding: "16px",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        <div>
          <small style={{ color: "#64748b", fontWeight: 800 }}>
            Net revenue
          </small>
          <p style={{ margin: "5px 0 0", fontSize: 20, fontWeight: 900 }}>
            ₹
            {Number(
              analytics.summary.net_revenue || 0
            ).toLocaleString("en-IN")}
          </p>
        </div>

        <div>
          <small style={{ color: "#64748b", fontWeight: 800 }}>
            Product cost
          </small>
          <p style={{ margin: "5px 0 0", fontSize: 20, fontWeight: 900 }}>
            ₹
            {Number(
              analytics.summary.product_cost || 0
            ).toLocaleString("en-IN")}
          </p>
        </div>

        <div>
          <small style={{ color: "#64748b", fontWeight: 800 }}>
            Profit margin
          </small>
          <p style={{ margin: "5px 0 0", fontSize: 20, fontWeight: 900 }}>
            {Number(
              analytics.summary.profit_margin || 0
            ).toFixed(1)}
            %
          </p>
        </div>

        <div>
          <small style={{ color: "#64748b", fontWeight: 800 }}>
            Formula
          </small>
          <p
            style={{
              margin: "5px 0 0",
              fontSize: 12,
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            Net profit = customer-paid revenue − product costs
          </p>
        </div>
      </div>

      <div
        className="panel"
        style={{
          marginBottom: "18px",
          padding: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 14,
                  background: "#eff6ff",
                  color: "#0F4C9C",
                }}
              >
                <Calculator size={20} />
              </span>

              <div>
                <strong style={{ fontSize: 18 }}>
                  Coupon Profit Formula
                </strong>
                <p
                  style={{
                    margin: "3px 0 0",
                    color: "#64748b",
                    fontSize: 12,
                  }}
                >
                  Uses your existing Cost Management values.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: "14px",
                display: "grid",
                gap: "8px",
                fontSize: 13,
                color: "#334155",
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>Gross Sales</strong> = Order subtotal before discount
              </p>
              <p style={{ margin: 0 }}>
                <strong>Discount Given</strong> = Gross Sales − Net Revenue
              </p>
              <p style={{ margin: 0 }}>
                <strong>Net Revenue</strong> = Customer-paid order total
              </p>
              <p style={{ margin: 0 }}>
                <strong>Total Product Cost</strong> = Wholesale + Packaging + Delivery + Other Costs
              </p>
              <p style={{ margin: 0 }}>
                <strong>Net Profit</strong> = Net Revenue − Total Product Cost
              </p>
              <p style={{ margin: 0 }}>
                <strong>Profit Margin</strong> = Net Profit ÷ Net Revenue × 100
              </p>
              <p style={{ margin: 0 }}>
                <strong>Coupon ROI</strong> = Net Profit ÷ Discount Given
              </p>
            </div>
          </div>

          <div
            style={{
              minWidth: 220,
              padding: "14px",
              borderRadius: 16,
              background: "#f8fafc",
            }}
          >
            <small
              style={{
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              Current overall result
            </small>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: 22,
                fontWeight: 900,
                color:
                  Number(analytics.summary.net_profit || 0) < 0
                    ? "#e11d48"
                    : "#047857",
              }}
            >
              {currency(analytics.summary.net_profit || 0)}
            </p>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: 12,
                color: "#64748b",
              }}
            >
              {Number(
                analytics.summary.profit_margin || 0
              ).toFixed(1)}
              % profit margin
            </p>
          </div>
        </div>
      </div>

      <div
        className="panel"
        style={{
          marginBottom: "18px",
          padding: "18px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: 18 }}>
              Complete Coupon Business Report
            </strong>
            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Includes coupon summary, order-wise profit/loss,
              product-wise discount allocation, costs, margins,
              ROI and loss-making products.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={exportCompletePdf}
            >
              <Download size={17} />
              Export Complete PDF
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={exportCompleteExcel}
            >
              <FileSpreadsheet size={17} />
              Export Complete Excel
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: "16px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            ["Coupon Summary", `${analytics.coupons.length} coupons`, Gift],
            ["Orders Used", `${analytics.orders.length} orders`, ShoppingBag],
            ["Product Details", `${analytics.products.length} product rows`, ReceiptIndianRupee],
            ["Loss Orders", `${analytics.summary.loss_orders || 0} orders`, AlertTriangle],
            ["Total Loss", currency(analytics.summary.total_loss || 0), Wallet],
          ].map(([title, value, Icon]) => (
            <div
              key={title}
              style={{
                padding: "14px",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
                background: "#fff",
              }}
            >
              <Icon size={18} color="#0F4C9C" />
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 800,
                }}
              >
                {title}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="panel"
        style={{
          marginBottom: "18px",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: 17 }}>
              Product-wise Coupon Impact
            </strong>
            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Compact product profitability and exact discount allocation.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setShowProductReport((current) => !current)
            }
          >
            {showProductReport ? "Hide details" : "View product report"}
          </button>
        </div>

        <div
          style={{
            marginTop: "14px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "10px",
          }}
        >
          {[
            [
              "Products",
              analytics.products.length,
              ReceiptIndianRupee,
            ],
            [
              "Discount",
              currency(
                analytics.summary.discount_given || 0
              ),
              BadgePercent,
            ],
            [
              "Net Profit",
              currency(
                Math.max(
                  Number(
                    analytics.summary.net_profit || 0
                  ),
                  0
                )
              ),
              TrendingUp,
            ],
            [
              "Total Loss",
              currency(
                analytics.summary.total_loss || 0
              ),
              AlertTriangle,
            ],
          ].map(([title, value, Icon]) => (
            <div
              key={title}
              style={{
                padding: "12px",
                borderRadius: 14,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <Icon size={17} color="#0F4C9C" />
              <p
                style={{
                  margin: "7px 0 0",
                  fontSize: 11,
                  color: "#64748b",
                  fontWeight: 800,
                }}
              >
                {title}
              </p>
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 17,
                  fontWeight: 900,
                  color:
                    title === "Total Loss"
                      ? "#e11d48"
                      : "#0f172a",
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {showProductReport && (
          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gap: "10px",
            }}
          >
            {analytics.products.length ? (
              analytics.products.map((item) => {
                const rowKey = `${item.coupon_code}-${item.product_id}`;
                const expanded =
                  expandedProductKey === rowKey;
                const margin = Number(
                  item.profit_margin || 0
                );
                const resultLabel =
                  item.loss > 0
                    ? "Loss"
                    : margin >= 40
                      ? "Excellent"
                      : margin >= 20
                        ? "Good"
                        : margin >= 10
                          ? "Average"
                          : margin > 0
                            ? "Low"
                            : "No profit";

                return (
                  <div
                    key={rowKey}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProductKey(
                          expanded ? "" : rowKey
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "13px 14px",
                        border: 0,
                        background: "white",
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(150px, 1.4fr) minmax(90px, .8fr) minmax(90px, .7fr) auto",
                        alignItems: "center",
                        gap: "10px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#0f172a",
                          }}
                        >
                          {item.product_name}
                        </strong>
                        <small
                          style={{
                            color: "#64748b",
                            fontWeight: 800,
                          }}
                        >
                          {item.coupon_code} · Qty{" "}
                          {item.quantity_sold}
                        </small>
                      </div>

                      <div>
                        <small style={{ color: "#64748b" }}>
                          Discount
                        </small>
                        <strong
                          style={{
                            display: "block",
                            color: "#d97706",
                          }}
                        >
                          {currency(item.discount_given)}
                        </strong>
                      </div>

                      <div>
                        <small style={{ color: "#64748b" }}>
                          Result
                        </small>
                        <strong
                          style={{
                            display: "block",
                            color:
                              item.loss > 0
                                ? "#e11d48"
                                : "#047857",
                          }}
                        >
                          {item.loss > 0
                            ? `-${currency(item.loss)}`
                            : `+${currency(
                                Math.max(
                                  Number(
                                    item.net_profit || 0
                                  ),
                                  0
                                )
                              )}`}
                        </strong>
                      </div>

                      <span
                        style={{
                          borderRadius: 999,
                          padding: "5px 9px",
                          fontSize: 10,
                          fontWeight: 900,
                          background:
                            item.loss > 0
                              ? "#fff1f2"
                              : "#ecfdf5",
                          color:
                            item.loss > 0
                              ? "#be123c"
                              : "#047857",
                        }}
                      >
                        {resultLabel}
                      </span>
                    </button>

                    {expanded && (
                      <div
                        style={{
                          padding: "14px",
                          borderTop:
                            "1px solid #e2e8f0",
                          background: "#f8fafc",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: "10px",
                        }}
                      >
                        {[
                          ["Gross Sales", item.gross_sales],
                          ["Discount", item.discount_given],
                          ["Net Revenue", item.net_revenue],
                          ["Product Cost", item.product_cost],
                          [
                            "Profit",
                            Math.max(
                              Number(item.net_profit || 0),
                              0
                            ),
                          ],
                          ["Loss", item.loss],
                          [
                            "Margin",
                            `${Number(
                              item.profit_margin || 0
                            ).toFixed(1)}%`,
                          ],
                          ["Orders", item.orders],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            style={{
                              padding: "10px",
                              borderRadius: 12,
                              background: "white",
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
                              {typeof value === "number"
                                ? currency(value)
                                : value}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="empty-cell">
                Product coupon analytics will appear after coupon orders.
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="panel"
        style={{
          marginBottom: "18px",
          padding: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: 17 }}>
              Order-wise Profit & Loss
            </strong>
            <p
              style={{
                margin: "4px 0 0",
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Open any coupon order to understand customer payment,
              product cost, profit and loss.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setShowOrderReport((current) => !current)
            }
          >
            {showOrderReport ? "Hide orders" : "View order report"}
          </button>
        </div>

        {showOrderReport && (
          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gap: "10px",
            }}
          >
            {analytics.orders.length ? (
              analytics.orders.map((order) => {
                const expanded =
                  expandedOrderId === order.order_id;
                const isLoss =
                  Number(order.loss || 0) > 0;

                return (
                  <div
                    key={order.order_id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedOrderId(
                          expanded ? "" : order.order_id
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "13px 14px",
                        border: 0,
                        background: "white",
                        display: "grid",
                        gridTemplateColumns:
                          "minmax(150px, 1.4fr) minmax(100px, .8fr) minmax(100px, .8fr) auto",
                        alignItems: "center",
                        gap: "10px",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#0f172a",
                          }}
                        >
                          {order.order_number ||
                            order.order_id}
                        </strong>
                        <small style={{ color: "#64748b" }}>
                          {order.customer_name ||
                            order.customer_email ||
                            "Customer"}{" "}
                          · {order.coupon_code}
                        </small>
                      </div>

                      <div>
                        <small style={{ color: "#64748b" }}>
                          Customer Paid
                        </small>
                        <strong
                          style={{ display: "block" }}
                        >
                          {currency(order.net_revenue)}
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
                            ? `-${currency(order.loss)}`
                            : `+${currency(
                                Math.max(
                                  Number(
                                    order.net_profit || 0
                                  ),
                                  0
                                )
                              )}`}
                        </strong>
                      </div>

                      <span
                        style={{
                          borderRadius: 999,
                          padding: "5px 9px",
                          fontSize: 10,
                          fontWeight: 900,
                          background: isLoss
                            ? "#fff1f2"
                            : "#ecfdf5",
                          color: isLoss
                            ? "#be123c"
                            : "#047857",
                        }}
                      >
                        {isLoss ? "Loss" : "Profit"}
                      </span>
                    </button>

                    {expanded && (
                      <div
                        style={{
                          borderTop:
                            "1px solid #e2e8f0",
                          background: "#f8fafc",
                          padding: "14px",
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(130px, 1fr))",
                            gap: "10px",
                          }}
                        >
                          {[
                            ["Gross Sales", order.gross_sales],
                            [
                              "Discount",
                              order.discount_given,
                            ],
                            [
                              "Customer Paid",
                              order.net_revenue,
                            ],
                            [
                              "Product Cost",
                              order.product_cost,
                            ],
                            [
                              "Profit",
                              Math.max(
                                Number(
                                  order.net_profit || 0
                                ),
                                0
                              ),
                            ],
                            ["Loss", order.loss],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              style={{
                                padding: "10px",
                                borderRadius: 12,
                                background: "white",
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
                                {currency(value)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            marginTop: "12px",
                            display: "grid",
                            gap: "8px",
                          }}
                        >
                          {(order.items || []).map((item) => (
                            <div
                              key={`${order.order_id}-${item.product_id}`}
                              style={{
                                padding: "11px 12px",
                                borderRadius: 12,
                                background: "white",
                                border:
                                  "1px solid #e2e8f0",
                                display: "grid",
                                gridTemplateColumns:
                                  "minmax(140px, 1fr) repeat(4, minmax(80px, .7fr))",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              <div>
                                <strong
                                  style={{
                                    display: "block",
                                  }}
                                >
                                  {item.name}
                                </strong>
                                <small
                                  style={{
                                    color: "#64748b",
                                  }}
                                >
                                  Qty {item.quantity}
                                </small>
                              </div>
                              <div>
                                <small>Gross</small>
                                <strong
                                  style={{
                                    display: "block",
                                  }}
                                >
                                  {currency(
                                    item.gross_revenue ||
                                      item.line_total
                                  )}
                                </strong>
                              </div>
                              <div>
                                <small>Discount</small>
                                <strong
                                  style={{
                                    display: "block",
                                    color: "#d97706",
                                  }}
                                >
                                  {currency(
                                    item.allocated_discount
                                  )}
                                </strong>
                              </div>
                              <div>
                                <small>Cost</small>
                                <strong
                                  style={{
                                    display: "block",
                                  }}
                                >
                                  {currency(
                                    item.total_cost
                                  )}
                                </strong>
                              </div>
                              <div>
                                <small>Result</small>
                                <strong
                                  style={{
                                    display: "block",
                                    color:
                                      Number(
                                        item.loss || 0
                                      ) > 0
                                        ? "#e11d48"
                                        : "#047857",
                                  }}
                                >
                                  {Number(
                                    item.loss || 0
                                  ) > 0
                                    ? `-${currency(
                                        item.loss
                                      )}`
                                    : `+${currency(
                                        Math.max(
                                          Number(
                                            item.net_profit ||
                                              0
                                          ),
                                          0
                                        )
                                      )}`}
                                </strong>
                              </div>
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
                Order-wise report will appear after coupon orders.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel toolbar-panel">
        <div className="filter-group">
          <div className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search code or title…"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            className="btn btn-ghost"
            onClick={() =>
              exportRowsToPdf({
                rows: filtered,
                columns,
                fileName: "zanszii-coupons",
                title: "ZANSZI Coupons & Offers",
                landscape: true,
              })
            }
          >
            <Download size={17} />
            PDF
          </button>

          <button
            className="btn btn-ghost"
            onClick={() =>
              exportRowsToExcel({
                rows: filtered,
                columns,
                fileName: "zanszii-coupons",
                sheetName: "Coupons",
              })
            }
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>

          <button
            className="icon-btn bordered"
            onClick={load}
            aria-label="Refresh coupons"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Coupon</th>
                <th>Offer</th>
                <th>Orders</th>
                <th>Gross sales</th>
                <th>Discount</th>
                <th>Net profit</th>
                <th>Margin</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="empty-cell">
                    Loading coupons…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((offer) => {
                  const status = offerStatus(offer);

                  return (
                    <tr key={offer.offer_id}>
                      <td>
                        <div>
                          <strong>{offer.code}</strong>
                          <small
                            style={{
                              display: "block",
                              marginTop: 4,
                            }}
                          >
                            {offer.title}
                          </small>
                        </div>
                      </td>

                      <td>
                        <strong>{offerLabel(offer)}</strong>
                        {offer.featured && (
                          <small
                            style={{
                              display: "block",
                              marginTop: 4,
                              color: "#d97706",
                            }}
                          >
                            Featured
                          </small>
                        )}
                      </td>

                      {(() => {
                        const insight =
                          analyticsByOffer[offer.offer_id] || {
                            orders: 0,
                            gross_sales: 0,
                            discount_given: 0,
                            net_profit: 0,
                            profit_margin: 0,
                            loss_making: false,
                          };

                        return (
                          <>
                            <td>{insight.orders}</td>

                            <td>
                              ₹
                              {Number(
                                insight.gross_sales || 0
                              ).toLocaleString("en-IN")}
                            </td>

                            <td>
                              ₹
                              {Number(
                                insight.discount_given || 0
                              ).toLocaleString("en-IN")}
                            </td>

                            <td>
                              <strong
                                style={{
                                  color: insight.loss_making
                                    ? "#e11d48"
                                    : "#047857",
                                }}
                              >
                                ₹
                                {Number(
                                  insight.net_profit || 0
                                ).toLocaleString("en-IN")}
                              </strong>

                              {insight.loss_making && (
                                <small
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    marginTop: 4,
                                    color: "#e11d48",
                                    fontWeight: 800,
                                  }}
                                >
                                  <AlertTriangle size={12} />
                                  Loss making
                                </small>
                              )}
                            </td>

                            <td>
                              {Number(
                                insight.profit_margin || 0
                              ).toFixed(1)}
                              %
                            </td>
                          </>
                        );
                      })()}

                      <td>
                        <button
                          type="button"
                          onClick={() => toggleActive(offer)}
                          className={`status-chip ${
                            status === "Active"
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {status}
                        </button>
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            onClick={() => openEdit(offer)}
                            aria-label={`Edit ${offer.code}`}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              duplicateOffer(offer)
                            }
                            aria-label={`Duplicate ${offer.code}`}
                          >
                            <Copy size={17} />
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() => remove(offer)}
                            aria-label={`Delete ${offer.code}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="empty-cell">
                    No coupons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card modal-wide">
            <div className="modal-header">
              <div>
                <h2>
                  {editing ? "Edit coupon" : "Create coupon"}
                </h2>
                <p>
                  Configure discount rules and availability.
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setModalOpen(false)}
              >
                <X />
              </button>
            </div>

            <form
              onSubmit={save}
              className="modal-form form-grid"
            >
              <label>
                Coupon code
                <input
                  required
                  minLength={3}
                  value={form.code}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      code: event.target.value.toUpperCase(),
                    })
                  }
                />
              </label>

              <label>
                Title
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Offer type
                <select
                  value={form.offer_type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      offer_type: event.target.value,
                    })
                  }
                >
                  <option value="percentage">
                    Percentage discount
                  </option>
                  <option value="flat">Flat discount</option>
                  <option value="free_delivery">
                    Free delivery
                  </option>
                </select>
              </label>

              <label>
                Discount value
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={
                    form.offer_type === "free_delivery"
                  }
                  required={
                    form.offer_type !== "free_delivery"
                  }
                  value={form.discount_value}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      discount_value: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Minimum order value
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimum_order_value}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      minimum_order_value:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Maximum discount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={
                    form.offer_type !== "percentage"
                  }
                  value={form.maximum_discount}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      maximum_discount:
                        event.target.value,
                    })
                  }
                  placeholder="Optional"
                />
              </label>

              <label>
                Start date
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      starts_at: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Expiry date
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      expires_at: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Total usage limit
                <input
                  type="number"
                  min="1"
                  value={form.usage_limit}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      usage_limit: event.target.value,
                    })
                  }
                  placeholder="Unlimited"
                />
              </label>

              <label>
                Per-customer limit
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.per_user_limit}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      per_user_limit:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="span-2">
                Description
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                />
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={form.first_order_only}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      first_order_only:
                        event.target.checked,
                    })
                  }
                />
                <span>First order only</span>
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      featured: event.target.checked,
                    })
                  }
                />
                <span>Featured offer</span>
              </label>

              <label className="switch-row">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      active: event.target.checked,
                    })
                  }
                />
                <span>Active and usable</span>
              </label>

              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : editing
                      ? "Update coupon"
                      : "Create coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
