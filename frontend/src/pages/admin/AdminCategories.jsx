import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileSpreadsheet,
  GripVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";
import {
  exportRowsToExcel,
  exportRowsToPdf,
} from "../../utils/exportData";

const blank = {
  name: "",
  description: "",
  image_url: "",
  active: true,
};

const columns = [
  { label: "Order", value: (item) => item.display_order ?? 0 },
  { label: "Category", value: (item) => item.name },
  {
    label: "Description",
    value: (item) => item.description || "",
  },
  {
    label: "Status",
    value: (item) =>
      item.active ? "Active" : "Inactive",
  },
];

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(
        "/categories?include_inactive=true"
      );

      const list = Array.isArray(response.data)
        ? response.data
        : [];

      setItems(
        [...list].sort(
          (a, b) =>
            Number(a.display_order ?? 9999) -
              Number(b.display_order ?? 9999) ||
            a.name.localeCompare(b.name)
        )
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return items.filter((item) =>
      `${item.name} ${item.description || ""}`
        .toLowerCase()
        .includes(normalized)
    );
  }, [items, query]);

  const openCreate = () => {
    setEditing(null);
    setForm(blank);
    setError("");
    setMessage("");
    setModal(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      image_url: item.image_url || "",
      active: item.active !== false,
    });
    setError("");
    setMessage("");
    setModal(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (editing) {
        await api.patch(
          `/categories/${editing.category_id}`,
          form
        );
      } else {
        await api.post("/categories", form);
      }

      setModal(false);
      setMessage(
        editing
          ? "Category updated successfully."
          : "Category created successfully."
      );
      await load();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete “${item.name}”?`)) {
      return;
    }

    try {
      await api.delete(
        `/categories/${item.category_id}`
      );
      setMessage("Category deleted successfully.");
      await load();
    } catch (requestError) {
      setError(formatApiError(requestError));
    }
  };

  const saveOrder = async (nextItems) => {
    setOrdering(true);
    setError("");
    setMessage("");

    const ordered = nextItems.map((item, index) => ({
      ...item,
      display_order: index,
    }));

    setItems(ordered);

    try {
      await api.put("/categories/reorder", {
        items: ordered.map((item, index) => ({
          category_id: item.category_id,
          display_order: index,
        })),
      });

      setMessage("Category order updated successfully.");
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to update category order."
        )
      );
      await load();
    } finally {
      setOrdering(false);
    }
  };

  const move = async (categoryId, direction) => {
    if (query.trim()) {
      setError(
        "Clear the search before rearranging categories."
      );
      return;
    }

    const currentIndex = items.findIndex(
      (item) => item.category_id === categoryId
    );
    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= items.length
    ) {
      return;
    }

    const nextItems = [...items];
    [nextItems[currentIndex], nextItems[targetIndex]] = [
      nextItems[targetIndex],
      nextItems[currentIndex],
    ];

    await saveOrder(nextItems);
  };

  return (
    <div className="admin-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Catalogue setup</span>
          <h1>Categories</h1>
          <p>
            Create categories and control their customer-facing order.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          Add category
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {message && (
        <div className="alert alert-success">{message}</div>
      )}

      <div className="panel toolbar-panel">
        <div className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search categories…"
          />
        </div>

        <div className="toolbar-actions">
          <button
            className="btn btn-ghost"
            onClick={() =>
              exportRowsToPdf({
                rows: filtered,
                columns,
                fileName: "zanszii-categories",
                title: "ZANSZI Categories",
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
                fileName: "zanszii-categories",
                sheetName: "Categories",
              })
            }
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>

          <button
            className="icon-btn bordered"
            onClick={load}
            aria-label="Refresh categories"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="panel">
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#64748b",
            fontSize: "12px",
            fontWeight: 800,
          }}
        >
          <GripVertical size={17} />
          Use the arrow buttons to change homepage and shop order.
          {ordering && <span> Saving…</span>}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Category</th>
                <th>Description</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="empty-cell">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((item) => {
                  const itemIndex = items.findIndex(
                    (category) =>
                      category.category_id ===
                      item.category_id
                  );

                  return (
                    <tr key={item.category_id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <strong>{itemIndex + 1}</strong>

                          <div className="row-actions">
                            <button
                              type="button"
                              disabled={
                                ordering ||
                                itemIndex === 0 ||
                                Boolean(query.trim())
                              }
                              onClick={() =>
                                move(item.category_id, -1)
                              }
                              aria-label={`Move ${item.name} up`}
                            >
                              <ArrowUp size={16} />
                            </button>

                            <button
                              type="button"
                              disabled={
                                ordering ||
                                itemIndex === items.length - 1 ||
                                Boolean(query.trim())
                              }
                              onClick={() =>
                                move(item.category_id, 1)
                              }
                              aria-label={`Move ${item.name} down`}
                            >
                              <ArrowDown size={16} />
                            </button>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="product-cell">
                          <div className="product-thumb">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                onError={(event) => {
                                  event.currentTarget.style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <span>
                                {item.name
                                  ?.charAt(0)
                                  ?.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <strong>{item.name}</strong>
                        </div>
                      </td>

                      <td className="muted-cell">
                        {item.description ||
                          "No description"}
                      </td>

                      <td>
                        <span
                          className={`status-chip ${
                            item.active
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {item.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            onClick={() => openEdit(item)}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            className="danger"
                            onClick={() => remove(item)}
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
                  <td colSpan="5" className="empty-cell">
                    No categories found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>
                  {editing
                    ? "Edit category"
                    : "New category"}
                </h2>
                <p>
                  Use a short and clear category name.
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={() => setModal(false)}
              >
                <X />
              </button>
            </div>

            <form
              onSubmit={save}
              className="modal-form"
            >
              <label>
                Name
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Description
                <textarea
                  rows="4"
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Image URL
                <input
                  value={form.image_url}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      image_url: event.target.value,
                    })
                  }
                  placeholder="https://…"
                />
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
                <span>Active and visible</span>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setModal(false)}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
