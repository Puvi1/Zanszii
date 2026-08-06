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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/offers");
      setOffers(
        Array.isArray(response.data?.offers)
          ? response.data.offers
          : []
      );
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
          ["Total Coupons", summary.total, Gift],
          ["Active", summary.active, BadgePercent],
          ["Expired", summary.expired, CalendarDays],
          ["Total Uses", summary.uses, Star],
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
                <th>Minimum order</th>
                <th>Usage</th>
                <th>Expiry</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
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

                      <td>
                        ₹
                        {Number(
                          offer.minimum_order_value || 0
                        ).toLocaleString("en-IN")}
                      </td>

                      <td>
                        {offer.usage_count || 0}
                        {" / "}
                        {offer.usage_limit || "∞"}
                      </td>

                      <td>{formatDate(offer.expires_at)}</td>

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
                  <td colSpan="7" className="empty-cell">
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
