import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  ImagePlus,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
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
  category_id: "",
  price: "",
  stock: "",
  unit: "piece",
  image_url: "",
  images: [],
  active: true,
  featured: false,
};

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(value || 0);

const columns = [
  { label: "Product", value: (item) => item.name },
  {
    label: "Category",
    value: (item) => item.category?.name || "",
  },
  { label: "Price", value: (item) => item.price },
  { label: "Stock", value: (item) => item.stock },
  { label: "Unit", value: (item) => item.unit },
  {
    label: "Status",
    value: (item) => (item.active ? "Active" : "Inactive"),
  },
];

function cleanImageList(images = []) {
  return [
    ...new Set(
      images
        .map((image) => String(image || "").trim())
        .filter(Boolean)
    ),
  ];
}

function normalizeProductImages(product) {
  const allImages = cleanImageList([
    product?.image_url,
    ...(Array.isArray(product?.images) ? product.images : []),
  ]);

  return {
    primary: allImages[0] || "",
    images: allImages,
  };
}

export default function AdminProducts() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [newImageUrl, setNewImageUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const [productsResponse, categoriesResponse] =
        await Promise.all([
          api.get("/products?include_inactive=true"),
          api.get("/categories?include_inactive=true"),
        ]);

      setItems(
        Array.isArray(productsResponse.data)
          ? productsResponse.data
          : []
      );

      setCategories(
        Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
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

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "all" ||
            item.category_id === category) &&
          `${item.name} ${item.description || ""} ${
            item.category?.name || ""
          }`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [items, category, query]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...blank,
      category_id: categories[0]?.category_id || "",
    });
    setNewImageUrl("");
    setError("");
    setModal(true);
  };

  const openEdit = (item) => {
    const normalized = normalizeProductImages(item);

    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || "",
      category_id: item.category_id,
      price: item.price,
      stock: item.stock,
      unit: item.unit || "piece",
      image_url: normalized.primary,
      images: normalized.images,
      active: item.active !== false,
      featured: Boolean(item.featured),
    });
    setNewImageUrl("");
    setError("");
    setModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModal(false);
    setEditing(null);
    setForm(blank);
    setNewImageUrl("");
  };

  const addImage = () => {
    const value = newImageUrl.trim();

    if (!value) {
      setError("Please enter an image URL.");
      return;
    }

    if (!/^https?:\/\//i.test(value)) {
      setError("Image URL must begin with http:// or https://");
      return;
    }

    if (form.images.includes(value)) {
      setError("This image is already added.");
      return;
    }

    const nextImages = [...form.images, value];

    setForm((current) => ({
      ...current,
      images: nextImages,
      image_url: current.image_url || value,
    }));

    setNewImageUrl("");
    setError("");
  };

  const removeImage = (imageToRemove) => {
    setForm((current) => {
      const nextImages = current.images.filter(
        (image) => image !== imageToRemove
      );

      const nextPrimary =
        current.image_url === imageToRemove
          ? nextImages[0] || ""
          : current.image_url;

      return {
        ...current,
        images: nextImages,
        image_url: nextPrimary,
      };
    });
  };

  const setPrimaryImage = (image) => {
    setForm((current) => {
      const reordered = [
        image,
        ...current.images.filter((item) => item !== image),
      ];

      return {
        ...current,
        image_url: image,
        images: reordered,
      };
    });
  };

  const save = async (event) => {
    event.preventDefault();

    const images = cleanImageList(form.images);
    const primaryImage =
      form.image_url && images.includes(form.image_url)
        ? form.image_url
        : images[0] || "";

    if (!images.length) {
      setError("Add at least one product image.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category_id: form.category_id,
      price: Number(form.price),
      stock: Number(form.stock),
      unit: form.unit.trim(),
      image_url: primaryImage,
      images: [
        primaryImage,
        ...images.filter((image) => image !== primaryImage),
      ],
      active: form.active,
      featured: form.featured,
    };

    setSaving(true);
    setError("");

    try {
      if (editing) {
        await api.patch(
          `/products/${editing.product_id}`,
          payload
        );
      } else {
        await api.post("/products", payload);
      }

      closeModal();
      await load();
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete “${item.name}”?`)) return;

    try {
      await api.delete(`/products/${item.product_id}`);
      await load();
    } catch (requestError) {
      setError(formatApiError(requestError));
    }
  };

  return (
    <div className="admin-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Inventory control</span>
          <h1>Products</h1>
          <p>
            Add products, manage stock and keep pricing clear.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreate}
          disabled={!categories.length}
        >
          <PackagePlus size={18} />
          Add product
        </button>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {!categories.length && !loading && (
        <div className="alert alert-info">
          Create a category before adding your first product.
        </div>
      )}

      <div className="panel toolbar-panel">
        <div className="filter-group">
          <div className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search products…"
            />
          </div>

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
          >
            <option value="all">All categories</option>

            {categories.map((item) => (
              <option
                key={item.category_id}
                value={item.category_id}
              >
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-actions">
          <button
            className="btn btn-ghost"
            onClick={() =>
              exportRowsToPdf({
                rows: filtered,
                columns,
                fileName: "zanszii-products",
                title: "Zanszii Product Report",
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
                fileName: "zanszii-products",
                sheetName: "Products",
              })
            }
          >
            <FileSpreadsheet size={17} />
            Excel
          </button>

          <button
            className="icon-btn bordered"
            onClick={load}
            aria-label="Refresh products"
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
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Images</th>
                <th>Status</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="empty-cell">
                    Loading products…
                  </td>
                </tr>
              ) : filtered.length ? (
                filtered.map((item) => {
                  const normalized =
                    normalizeProductImages(item);

                  return (
                    <tr key={item.product_id}>
                      <td>
                        <div className="product-cell">
                          <div className="product-thumb">
                            {normalized.primary ? (
                              <img
                                src={normalized.primary}
                                alt={item.name}
                                onError={(event) => {
                                  event.currentTarget.style.display =
                                    "none";
                                }}
                              />
                            ) : (
                              <span>{item.name?.[0]}</span>
                            )}
                          </div>

                          <div>
                            <strong>{item.name}</strong>
                            <small>
                              {item.unit || "piece"}
                              {item.featured
                                ? " · Featured"
                                : ""}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{item.category?.name || "—"}</td>

                      <td>
                        <strong>{money(item.price)}</strong>
                      </td>

                      <td>
                        <span
                          className={`stock-pill ${
                            item.stock <= 5 ? "low" : ""
                          }`}
                        >
                          {item.stock}
                        </span>
                      </td>

                      <td>
                        <span className="status-chip status-active">
                          {normalized.images.length} image
                          {normalized.images.length === 1
                            ? ""
                            : "s"}
                        </span>
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
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil size={17} />
                          </button>

                          <button
                            className="danger"
                            onClick={() => remove(item)}
                            aria-label={`Delete ${item.name}`}
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
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-wide">
            <div className="modal-header">
              <div>
                <h2>
                  {editing ? "Edit product" : "New product"}
                </h2>
                <p>
                  Add product details and multiple gallery images.
                </p>
              </div>

              <button
                className="icon-btn"
                onClick={closeModal}
                aria-label="Close product form"
              >
                <X />
              </button>
            </div>

            <form
              onSubmit={save}
              className="modal-form form-grid"
            >
              <label className="span-2">
                Product name
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
                Category
                <select
                  required
                  value={form.category_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      category_id: event.target.value,
                    })
                  }
                >
                  <option value="">Select category</option>

                  {categories.map((item) => (
                    <option
                      key={item.category_id}
                      value={item.category_id}
                    >
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Unit
                <input
                  required
                  value={form.unit}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      unit: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Price (₹)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      price: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                Stock quantity
                <input
                  type="number"
                  min="0"
                  required
                  value={form.stock}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      stock: event.target.value,
                    })
                  }
                />
              </label>

              <div className="span-2">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <strong>Product images</strong>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      Add multiple image URLs and choose the
                      primary image.
                    </p>
                  </div>

                  <span
                    className="status-chip status-active"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {form.images.length} added
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: "10px",
                  }}
                >
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(event) =>
                      setNewImageUrl(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addImage();
                      }
                    }}
                    placeholder="https://example.com/product-image.jpg"
                  />

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={addImage}
                  >
                    <Plus size={17} />
                    Add image
                  </button>
                </div>

                {form.images.length ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(150px, 1fr))",
                      gap: "14px",
                      marginTop: "16px",
                    }}
                  >
                    {form.images.map((image, index) => {
                      const isPrimary =
                        form.image_url === image;

                      return (
                        <div
                          key={image}
                          style={{
                            position: "relative",
                            overflow: "hidden",
                            borderRadius: "18px",
                            border: isPrimary
                              ? "2px solid #0F4C9C"
                              : "1px solid #e2e8f0",
                            background: "#f8fafc",
                          }}
                        >
                          <div
                            style={{
                              aspectRatio: "1 / 1",
                              padding: "10px",
                              background: "#f8fafc",
                            }}
                          >
                            <img
                              src={image}
                              alt={`Product ${index + 1}`}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                borderRadius: "12px",
                              }}
                              onError={(event) => {
                                event.currentTarget.src =
                                  "https://placehold.co/500x500/F1F5F9/64748B?text=Invalid+Image";
                              }}
                            />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              gap: "8px",
                              padding: "10px",
                              borderTop: "1px solid #e2e8f0",
                              background: "white",
                            }}
                          >
                            <button
                              type="button"
                              className={
                                isPrimary
                                  ? "btn btn-primary"
                                  : "btn btn-ghost"
                              }
                              onClick={() =>
                                setPrimaryImage(image)
                              }
                              style={{
                                justifyContent: "center",
                                minWidth: 0,
                              }}
                            >
                              {isPrimary ? (
                                <>
                                  <Check size={15} />
                                  Primary
                                </>
                              ) : (
                                <>
                                  <Star size={15} />
                                  Set primary
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              className="icon-btn bordered"
                              onClick={() => removeImage(image)}
                              aria-label={`Remove image ${
                                index + 1
                              }`}
                              style={{ color: "#e11d48" }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div
                    style={{
                      marginTop: "14px",
                      padding: "28px",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "18px",
                      textAlign: "center",
                      color: "#64748b",
                      background: "#f8fafc",
                    }}
                  >
                    <ImagePlus
                      size={28}
                      style={{ margin: "0 auto 8px" }}
                    />
                    <strong>No product images added</strong>
                    <p
                      style={{
                        margin: "5px 0 0",
                        fontSize: "12px",
                      }}
                    >
                      Add at least one image before saving.
                    </p>
                  </div>
                )}
              </div>

              <label className="span-2">
                Description
                <textarea
                  rows="4"
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
                  checked={form.active}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      active: event.target.checked,
                    })
                  }
                />
                <span>Active</span>
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
                <span>Featured product</span>
              </label>

              <div className="modal-actions span-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
