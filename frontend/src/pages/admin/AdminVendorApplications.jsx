import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  X,
  XCircle,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";

const STATUS_OPTIONS = [
  { value: "all", label: "All applications" },
  { value: "pending", label: "Pending" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLE = {
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  changes_requested:
    "bg-orange-50 text-orange-700 border-orange-100",
  approved:
    "bg-emerald-50 text-emerald-700 border-emerald-100",
  rejected: "bg-rose-50 text-rose-700 border-rose-100",
};

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(value = "") {
  return value.replaceAll("_", " ");
}

export default function AdminVendorApplications() {
  const [applications, setApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] =
    useState(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [adminNote, setAdminNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadApplications = async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint =
        status === "all"
          ? "/admin/vendor-applications"
          : `/admin/vendor-applications?status=${status}`;

      const response = await api.get(endpoint);

      setApplications(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to load partner applications."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [status]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return applications;

    return applications.filter((application) =>
      [
        application.business_name,
        application.owner_name,
        application.email,
        application.phone,
        application.business_type,
        application.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [applications, query]);

  const counts = useMemo(
    () => ({
      all: applications.length,
      pending: applications.filter(
        (item) => item.status === "pending"
      ).length,
      changes_requested: applications.filter(
        (item) => item.status === "changes_requested"
      ).length,
      approved: applications.filter(
        (item) => item.status === "approved"
      ).length,
      rejected: applications.filter(
        (item) => item.status === "rejected"
      ).length,
    }),
    [applications]
  );

  const openApplication = async (application) => {
    setDetailLoading(true);
    setSelectedApplication(application);
    setAdminNote(application.admin_note || "");
    setError("");
    setMessage("");

    try {
      const response = await api.get(
        `/admin/vendor-applications/${application.application_id}`
      );

      setSelectedApplication(response.data);
      setAdminNote(response.data?.admin_note || "");
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to load application details."
        )
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeApplication = () => {
    if (saving) return;

    setSelectedApplication(null);
    setAdminNote("");
  };

  const reviewApplication = async (nextStatus) => {
    if (!selectedApplication?.application_id) return;

    if (
      ["changes_requested", "rejected"].includes(nextStatus) &&
      !adminNote.trim()
    ) {
      setError(
        nextStatus === "changes_requested"
          ? "Add a note explaining the required changes."
          : "Add a reason before rejecting this application."
      );
      return;
    }

    const confirmationText =
      nextStatus === "approved"
        ? "Approve this partner application?"
        : nextStatus === "changes_requested"
          ? "Request changes from this applicant?"
          : "Reject this partner application?";

    if (!window.confirm(confirmationText)) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.patch(
        `/admin/vendor-applications/${selectedApplication.application_id}/review`,
        {
          status: nextStatus,
          admin_note: adminNote.trim() || null,
        }
      );

      setSelectedApplication(response.data);
      setMessage(
        nextStatus === "approved"
          ? "Partner approved and store created successfully."
          : nextStatus === "changes_requested"
            ? "Changes requested successfully."
            : "Application rejected successfully."
      );

      await loadApplications();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to update this application."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Marketplace partners</span>
          <h1>Partner Applications</h1>
          <p>
            Review business applications and control who can sell
            through ZANSZI.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={loadApplications}
        >
          <RefreshCw size={17} />
          Refresh
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
            "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "14px",
          marginBottom: "18px",
        }}
      >
        {[
          {
            label: "All",
            value: "all",
            icon: Building2,
          },
          {
            label: "Pending",
            value: "pending",
            icon: Clock3,
          },
          {
            label: "Changes",
            value: "changes_requested",
            icon: ShieldAlert,
          },
          {
            label: "Approved",
            value: "approved",
            icon: BadgeCheck,
          },
          {
            label: "Rejected",
            value: "rejected",
            icon: XCircle,
          },
        ].map((item) => {
          const Icon = item.icon;
          const active = status === item.value;

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatus(item.value)}
              className="panel"
              style={{
                padding: "16px",
                textAlign: "left",
                border: active
                  ? "2px solid #0F4C9C"
                  : "1px solid #e2e8f0",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "14px",
                    display: "grid",
                    placeItems: "center",
                    background: active ? "#0F4C9C" : "#eff6ff",
                    color: active ? "white" : "#0F4C9C",
                  }}
                >
                  <Icon size={19} />
                </span>

                <strong style={{ fontSize: "24px" }}>
                  {counts[item.value] ?? 0}
                </strong>
              </div>

              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#475569",
                }}
              >
                {item.label}
              </p>
            </button>
          );
        })}
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
              placeholder="Search business, owner, email..."
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            {STATUS_OPTIONS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-actions">
          <Filter size={18} />
          <span style={{ fontSize: "13px", fontWeight: 800 }}>
            {filteredApplications.length} found
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Type</th>
                <th>Location</th>
                <th>Submitted</th>
                <th>Status</th>
                <th className="actions-col">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    Loading partner applications…
                  </td>
                </tr>
              ) : filteredApplications.length ? (
                filteredApplications.map((application) => (
                  <tr key={application.application_id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          {application.logo_url ? (
                            <img
                              src={application.logo_url}
                              alt=""
                              onError={(event) => {
                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            <span>
                              {application.business_name
                                ?.charAt(0)
                                ?.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div>
                          <strong>
                            {application.business_name}
                          </strong>
                          <small>{application.email}</small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <strong>
                        {application.owner_name}
                      </strong>
                      <br />
                      <small>{application.phone}</small>
                    </td>

                    <td>{application.business_type}</td>

                    <td>
                      {application.city},{" "}
                      {application.state}
                    </td>

                    <td>{formatDate(application.created_at)}</td>

                    <td>
                      <span
                        className={`status-chip border capitalize ${
                          STATUS_STYLE[application.status] || ""
                        }`}
                      >
                        {statusLabel(application.status)}
                      </span>
                    </td>

                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openApplication(application)
                          }
                          aria-label={`Review ${application.business_name}`}
                        >
                          <Eye size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    No partner applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedApplication && (
        <div className="modal-backdrop">
          <div className="modal-card modal-wide">
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  Partner application
                </span>
                <h2>
                  {selectedApplication.business_name}
                </h2>
                <p>
                  Review the complete business details before taking
                  action.
                </p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={closeApplication}
              >
                <X />
              </button>
            </div>

            {detailLoading ? (
              <div className="empty-cell">
                Loading application details…
              </div>
            ) : (
              <div className="modal-form">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {[
                    ["Owner", selectedApplication.owner_name],
                    ["Mobile", selectedApplication.phone],
                    ["WhatsApp", selectedApplication.whatsapp || "—"],
                    ["Email", selectedApplication.email],
                    ["Business Type", selectedApplication.business_type],
                    [
                      "Submitted",
                      formatDate(selectedApplication.created_at),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: "14px",
                        borderRadius: "16px",
                        background: "#f8fafc",
                      }}
                    >
                      <small
                        style={{
                          color: "#64748b",
                          fontWeight: 700,
                        }}
                      >
                        {label}
                      </small>
                      <p
                        style={{
                          margin: "5px 0 0",
                          fontWeight: 900,
                          color: "#0f172a",
                        }}
                      >
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "16px",
                    padding: "16px",
                    borderRadius: "18px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <strong>Business description</strong>
                  <p
                    style={{
                      margin: "8px 0 0",
                      color: "#475569",
                      lineHeight: 1.7,
                    }}
                  >
                    {selectedApplication.description ||
                      "No description provided."}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    padding: "16px",
                    borderRadius: "18px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <strong>Business address</strong>
                  <p
                    style={{
                      margin: "8px 0 0",
                      color: "#475569",
                      lineHeight: 1.7,
                    }}
                  >
                    {selectedApplication.address}
                    <br />
                    {selectedApplication.city},{" "}
                    {selectedApplication.state} -{" "}
                    {selectedApplication.postal_code}
                  </p>

                  {selectedApplication.pickup_address && (
                    <p
                      style={{
                        margin: "10px 0 0",
                        color: "#475569",
                      }}
                    >
                      <strong>Pickup:</strong>{" "}
                      {selectedApplication.pickup_address}
                    </p>
                  )}
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                  }}
                >
                  {selectedApplication.logo_url && (
                    <a
                      href={selectedApplication.logo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                    >
                      View Logo
                    </a>
                  )}

                  {selectedApplication.banner_url && (
                    <a
                      href={selectedApplication.banner_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                    >
                      View Banner
                    </a>
                  )}

                  {selectedApplication.business_license_url && (
                    <a
                      href={
                        selectedApplication.business_license_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                    >
                      View License
                    </a>
                  )}
                </div>

                <label style={{ marginTop: "18px", display: "block" }}>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 900,
                      color: "#1e293b",
                    }}
                  >
                    Admin note
                  </span>

                  <textarea
                    rows="4"
                    value={adminNote}
                    onChange={(event) =>
                      setAdminNote(event.target.value)
                    }
                    placeholder="Add approval note, requested changes, or rejection reason"
                    style={{
                      marginTop: "8px",
                      width: "100%",
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "12px",
                      outline: "none",
                    }}
                  />
                </label>

                {selectedApplication.status !== "approved" && (
                  <div
                    style={{
                      marginTop: "18px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(170px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={() =>
                        reviewApplication("approved")
                      }
                    >
                      <CheckCircle2 size={17} />
                      Approve Partner
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={saving}
                      onClick={() =>
                        reviewApplication(
                          "changes_requested"
                        )
                      }
                    >
                      <ShieldAlert size={17} />
                      Request Changes
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={saving}
                      onClick={() =>
                        reviewApplication("rejected")
                      }
                      style={{ color: "#e11d48" }}
                    >
                      <Ban size={17} />
                      Reject
                    </button>
                  </div>
                )}

                {selectedApplication.status === "approved" && (
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "14px",
                      borderRadius: "16px",
                      background: "#ecfdf5",
                      color: "#047857",
                      fontWeight: 800,
                    }}
                  >
                    This partner is approved and a store has already
                    been created.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
