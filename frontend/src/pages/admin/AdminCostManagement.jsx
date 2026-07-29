import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Calculator,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { exportRowsToExcel } from "../../utils/exportData";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const emptyCost = {
  wholesale_price: "",
  packaging_cost: "",
  delivery_cost: "",
  other_cost: "",
};

const getProductId = (product) =>
  String(product?.id || product?._id || product?.product_id || "");

const getSellingPrice = (product) =>
  toNumber(
    product?.selling_price ??
      product?.price ??
      product?.sale_price ??
      product?.customer_price
  );

const getCategoryName = (product) => {
  if (typeof product?.category === "string") {
    return product.category;
  }

  return (
    product?.category_name ||
    product?.category?.name ||
    product?.category?.title ||
    "Uncategorized"
  );
};

const getImage = (product) =>
  product?.image_url ||
  product?.image ||
  product?.thumbnail ||
  product?.images?.[0] ||
  "";

const calculateValues = (product, cost) => {
  const sellingPrice = getSellingPrice(product);
  const wholesalePrice = toNumber(cost?.wholesale_price);
  const packagingCost = toNumber(cost?.packaging_cost);
  const deliveryCost = toNumber(cost?.delivery_cost);
  const otherCost = toNumber(cost?.other_cost);

  const totalCost =
    wholesalePrice + packagingCost + deliveryCost + otherCost;

  const profit = sellingPrice - totalCost;

  const margin =
    sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  const configured =
    wholesalePrice > 0 ||
    packagingCost > 0 ||
    deliveryCost > 0 ||
    otherCost > 0;

  return {
    sellingPrice,
    wholesalePrice,
    packagingCost,
    deliveryCost,
    otherCost,
    totalCost,
    profit,
    margin,
    configured,
  };
};

const marginClass = (margin) => {
  if (margin >= 20) return "good";
  if (margin >= 10) return "medium";
  return "low";
};

export default function AdminCostManagement() {
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState({});

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyCost);

  const [deleteProduct, setDeleteProduct] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [success, setSuccess] = useState("");

  const loadProducts = async () => {
    try {
      const response = await api.get("/admin/products");

      return Array.isArray(response.data)
        ? response.data
        : response.data?.products || response.data?.items || [];
    } catch (adminError) {
      const response = await api.get("/products");

      return Array.isArray(response.data)
        ? response.data
        : response.data?.products || response.data?.items || [];
    }
  };

  const loadCosts = async () => {
    try {
      const response = await api.get("/admin/product-costs");

      const list = Array.isArray(response.data)
        ? response.data
        : response.data?.costs ||
          response.data?.product_costs ||
          response.data?.items ||
          [];

      const costMap = {};

      list.forEach((item) => {
        const productId = String(
          item.product_id || item.product?.id || item.id || ""
        );

        if (!productId) return;

        costMap[productId] = {
          wholesale_price: item.wholesale_price ?? 0,
          packaging_cost: item.packaging_cost ?? 0,
          delivery_cost: item.delivery_cost ?? 0,
          other_cost: item.other_cost ?? 0,
        };
      });

      return costMap;
    } catch (costError) {
      if (
        costError?.response?.status === 404 ||
        costError?.response?.status === 405
      ) {
        setWarning(
          "The private product-cost backend endpoint has not been added yet. Products are visible, but Save and Delete will work only after adding the backend endpoints."
        );

        return {};
      }

      throw costError;
    }
  };

  const loadPage = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    setWarning("");

    try {
      const [productList, costMap] = await Promise.all([
        loadProducts(),
        loadCosts(),
      ]);

      setProducts(productList);

      const combinedCosts = { ...costMap };

      productList.forEach((product) => {
        const productId = getProductId(product);

        if (!productId) return;

        if (!combinedCosts[productId]) {
          combinedCosts[productId] = {
            wholesale_price: product.wholesale_price ?? 0,
            packaging_cost: product.packaging_cost ?? 0,
            delivery_cost: product.delivery_cost ?? 0,
            other_cost: product.other_cost ?? 0,
          };
        }
      });

      setCosts(combinedCosts);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const categories = useMemo(() => {
    return [
      ...new Set(
        products
          .map((product) => getCategoryName(product))
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const productsWithFinance = useMemo(() => {
    return products.map((product) => {
      const productId = getProductId(product);
      const cost = costs[productId] || emptyCost;

      return {
        product,
        productId,
        cost,
        values: calculateValues(product, cost),
      };
    });
  }, [products, costs]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return productsWithFinance.filter((item) => {
      const name = String(item.product?.name || "").toLowerCase();
      const category = getCategoryName(item.product);
      const categoryLower = category.toLowerCase();

      const matchesSearch =
        !term ||
        name.includes(term) ||
        categoryLower.includes(term);

      const matchesCategory =
        categoryFilter === "all" ||
        category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "configured" &&
          item.values.configured) ||
        (statusFilter === "pending" &&
          !item.values.configured);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [
    productsWithFinance,
    search,
    categoryFilter,
    statusFilter,
  ]);

  const configuredCount = productsWithFinance.filter(
    (item) => item.values.configured
  ).length;

  const pendingCount =
    productsWithFinance.length - configuredCount;

  const averageMargin = useMemo(() => {
    const configuredItems = productsWithFinance.filter(
      (item) => item.values.configured
    );

    if (!configuredItems.length) return 0;

    const totalMargin = configuredItems.reduce(
      (total, item) => total + item.values.margin,
      0
    );

    return totalMargin / configuredItems.length;
  }, [productsWithFinance]);

  const openEditor = (product) => {
    const productId = getProductId(product);
    const currentCost = costs[productId] || emptyCost;

    setSelectedProduct(product);

    setForm({
      wholesale_price: currentCost.wholesale_price ?? "",
      packaging_cost: currentCost.packaging_cost ?? "",
      delivery_cost: currentCost.delivery_cost ?? "",
      other_cost: currentCost.other_cost ?? "",
    });

    setError("");
    setSuccess("");
  };

  const closeEditor = () => {
    if (saving) return;

    setSelectedProduct(null);
    setForm(emptyCost);
  };

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const editorValues = selectedProduct
    ? calculateValues(selectedProduct, form)
    : calculateValues({}, emptyCost);

  const saveCost = async (event) => {
    event.preventDefault();

    if (!selectedProduct) return;

    const productId = getProductId(selectedProduct);

    if (!productId) {
      setError("Product ID is missing.");
      return;
    }

    const payload = {
      product_id: productId,
      wholesale_price: toNumber(form.wholesale_price),
      packaging_cost: toNumber(form.packaging_cost),
      delivery_cost: toNumber(form.delivery_cost),
      other_cost: toNumber(form.other_cost),
    };

    if (payload.wholesale_price <= 0) {
      setError("Enter a valid wholesale price.");
      return;
    }

    if (editorValues.totalCost > editorValues.sellingPrice) {
      const shouldContinue = window.confirm(
        "The total cost is higher than the selling price. This product will have a negative profit. Do you still want to save?"
      );

      if (!shouldContinue) return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.put(
        `/admin/product-costs/${productId}`,
        payload
      );

      setCosts((current) => ({
        ...current,
        [productId]: {
          wholesale_price: payload.wholesale_price,
          packaging_cost: payload.packaging_cost,
          delivery_cost: payload.delivery_cost,
          other_cost: payload.other_cost,
        },
      }));

      setSuccess(
        `${selectedProduct.name || "Product"} cost details saved successfully.`
      );

      closeEditor();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const removeCost = async () => {
    if (!deleteProduct) return;

    const productId = getProductId(deleteProduct);

    if (!productId) {
      setError("Product ID is missing.");
      return;
    }

    setDeleting(true);
    setError("");
    setSuccess("");

    try {
      await api.delete(`/admin/product-costs/${productId}`);

      setCosts((current) => ({
        ...current,
        [productId]: {
          wholesale_price: 0,
          packaging_cost: 0,
          delivery_cost: 0,
          other_cost: 0,
        },
      }));

      setSuccess(
        `${deleteProduct.name || "Product"} cost details deleted. The product was not deleted.`
      );

      setDeleteProduct(null);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  const exportExcel = () => {
    const rows = filteredProducts.map((item) => ({
      product: item.product?.name || "Product",
      category: getCategoryName(item.product),
      selling_price: item.values.sellingPrice,
      wholesale_price: item.values.wholesalePrice,
      packaging_cost: item.values.packagingCost,
      delivery_cost: item.values.deliveryCost,
      other_cost: item.values.otherCost,
      total_cost: item.values.totalCost,
      profit: item.values.profit,
      margin: `${item.values.margin.toFixed(2)}%`,
      status: item.values.configured
        ? "Configured"
        : "Pending",
    }));

    const columns = [
      { label: "Product", value: (row) => row.product },
      { label: "Category", value: (row) => row.category },
      {
        label: "Selling Price",
        value: (row) => row.selling_price,
      },
      {
        label: "Wholesale Price",
        value: (row) => row.wholesale_price,
      },
      {
        label: "Packaging Cost",
        value: (row) => row.packaging_cost,
      },
      {
        label: "Delivery Cost",
        value: (row) => row.delivery_cost,
      },
      {
        label: "Other Cost",
        value: (row) => row.other_cost,
      },
      {
        label: "Total Cost",
        value: (row) => row.total_cost,
      },
      { label: "Profit", value: (row) => row.profit },
      { label: "Margin", value: (row) => row.margin },
      { label: "Status", value: (row) => row.status },
    ];

    exportRowsToExcel({
      rows,
      columns,
      fileName: "zanszii-product-cost-analysis",
      sheetName: "Product Costs",
    });
  };
const exportPDF = () => {
  const doc = new jsPDF("landscape");

  doc.setFontSize(18);
  doc.text("Zanszii Product Cost Report", 14, 15);

  doc.setFontSize(10);
  doc.text(
    `Generated : ${new Date().toLocaleString()}`,
    14,
    22
  );

  const body = filteredProducts.map((item) => [
    item.product?.name || "",
    getCategoryName(item.product),
    money(item.values.sellingPrice),
    money(item.values.wholesalePrice),
    money(item.values.packagingCost),
    money(item.values.deliveryCost),
    money(item.values.otherCost),
    money(item.values.totalCost),
    money(item.values.profit),
    `${item.values.margin.toFixed(2)}%`,
    item.values.configured ? "Configured" : "Pending",
  ]);

  autoTable(doc, {
    startY: 30,
    head: [[
      "Product",
      "Category",
      "Selling",
      "Wholesale",
      "Packaging",
      "Delivery",
      "Other",
      "Total Cost",
      "Profit",
      "Margin",
      "Status",
    ]],
    body,
    theme: "grid",
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
  });

  doc.save("zanszii-product-cost-report.pdf");
};


  return (
    <div className="admin-page cost-page">
      <div className="cost-page-header">
        <div>
          <span className="eyebrow">
            Private admin finance
          </span>

          <h1>Cost Management</h1>

          <p>
            Manage wholesale prices and operational costs without
            exposing them to customers.
          </p>
        </div>

        <div className="cost-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadPage}
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
            onClick={exportExcel}
            disabled={
              loading || filteredProducts.length === 0
            }
          >
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
<button
  type="button"
  className="btn btn-secondary"
  onClick={exportPDF}
  disabled={
    loading || filteredProducts.length === 0
  }
>
  <Download size={18} />
  Export PDF
</button>

        </div>
      </div>

      {error && (
        <div className="alert alert-error">{error}</div>
      )}

      {warning && (
        <div className="alert cost-warning">{warning}</div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <section className="cost-stat-grid">
        <div className="cost-stat-card">
          <span className="cost-stat-icon">
            <Package size={22} />
          </span>

          <div>
            <small>Total products</small>
            <strong>{products.length}</strong>
          </div>
        </div>

        <div className="cost-stat-card">
          <span className="cost-stat-icon">
            <CheckCircle2 size={22} />
          </span>

          <div>
            <small>Cost configured</small>
            <strong>{configuredCount}</strong>
          </div>
        </div>

        <div className="cost-stat-card">
          <span className="cost-stat-icon">
            <Plus size={22} />
          </span>

          <div>
            <small>Pending cost</small>
            <strong>{pendingCount}</strong>
          </div>
        </div>

        <div className="cost-stat-card">
          <span className="cost-stat-icon">
            <Calculator size={22} />
          </span>

          <div>
            <small>Average margin</small>
            <strong>{averageMargin.toFixed(2)}%</strong>
          </div>
        </div>
      </section>

      <section className="panel cost-table-panel">
        <div className="cost-toolbar">
          <div className="cost-toolbar-title">
            <h2>Product Cost Details</h2>

            <p>
              Add, edit or remove private cost information.
            </p>
          </div>

          <div className="cost-toolbar-controls">
            <label className="cost-search">
              <Search size={18} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search product"
              />
            </label>

            <label className="cost-select">
              <Filter size={17} />

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
              >
                <option value="all">All categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="cost-select">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">All statuses</option>
                <option value="configured">
                  Configured
                </option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="cost-empty-state">
            <RefreshCw size={34} className="spin" />
            <h3>Loading products...</h3>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="cost-empty-state">
            <BadgeIndianRupee size={40} />
            <h3>No products found</h3>
            <p>
              Add products first or change your search filters.
            </p>
          </div>
        ) : (
          <div className="cost-table-wrapper">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Selling Price</th>
                  <th>Status</th>
                  <th>Total Cost</th>
                  <th>Profit</th>
                  <th>Margin</th>
                  <th className="cost-actions-heading">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((item) => {
                  const {
                    product,
                    productId,
                    values,
                  } = item;

                  return (
                    <tr key={productId}>
                      <td>
                        <div className="cost-product-cell">
                          {getImage(product) ? (
                            <img
                              src={getImage(product)}
                              alt={product.name || "Product"}
                            />
                          ) : (
                            <span className="cost-product-placeholder">
                              <Package size={20} />
                            </span>
                          )}

                          <div>
                            <strong>
                              {product.name || "Product"}
                            </strong>

                            <small>
                              {product.sku ||
                                product.code ||
                                "No SKU"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>{getCategoryName(product)}</td>

                      <td>
                        <strong>
                          {money(values.sellingPrice)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`cost-status ${
                            values.configured
                              ? "configured"
                              : "pending"
                          }`}
                        >
                          {values.configured
                            ? "Configured"
                            : "Pending"}
                        </span>
                      </td>

                      <td>{money(values.totalCost)}</td>

                      <td>
                        <strong
                          className={
                            values.profit >= 0
                              ? "cost-positive"
                              : "cost-negative"
                          }
                        >
                          {money(values.profit)}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`margin-pill ${marginClass(
                            values.margin
                          )}`}
                        >
                          {values.configured
                            ? `${values.margin.toFixed(2)}%`
                            : "—"}
                        </span>
                      </td>

                      <td>
                        <div className="cost-row-actions">
                          <button
                            type="button"
                            className="cost-icon-button edit"
                            title={
                              values.configured
                                ? "Edit cost"
                                : "Add cost"
                            }
                            onClick={() => openEditor(product)}
                          >
                            {values.configured ? (
                              <Edit3 size={17} />
                            ) : (
                              <Plus size={18} />
                            )}
                          </button>

                          <button
                            type="button"
                            className="cost-icon-button delete"
                            title="Delete cost details"
                            disabled={!values.configured}
                            onClick={() =>
                              setDeleteProduct(product)
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedProduct && (
        <div
          className="cost-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <form
            className="cost-modal"
            onSubmit={saveCost}
          >
            <div className="cost-modal-header">
              <div>
                <span className="eyebrow">
                  Private cost information
                </span>

                <h2>
                  {calculateValues(
                    selectedProduct,
                    costs[getProductId(selectedProduct)]
                  ).configured
                    ? "Edit Product Cost"
                    : "Add Product Cost"}
                </h2>
              </div>

              <button
                type="button"
                className="cost-modal-close"
                onClick={closeEditor}
                disabled={saving}
              >
                <X size={21} />
              </button>
            </div>

            <div className="cost-selected-product">
              {getImage(selectedProduct) ? (
                <img
                  src={getImage(selectedProduct)}
                  alt={selectedProduct.name || "Product"}
                />
              ) : (
                <span>
                  <Package size={23} />
                </span>
              )}

              <div>
                <strong>
                  {selectedProduct.name || "Product"}
                </strong>

                <small>
                  Selling price:{" "}
                  {money(getSellingPrice(selectedProduct))}
                </small>
              </div>
            </div>

            <div className="cost-form-grid">
              <label>
                <span>Wholesale price *</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.wholesale_price}
                  onChange={(event) =>
                    updateForm(
                      "wholesale_price",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </label>

              <label>
                <span>Packaging cost</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.packaging_cost}
                  onChange={(event) =>
                    updateForm(
                      "packaging_cost",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </label>

              <label>
                <span>Delivery cost</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.delivery_cost}
                  onChange={(event) =>
                    updateForm(
                      "delivery_cost",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </label>

              <label>
                <span>Other expenses</span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.other_cost}
                  onChange={(event) =>
                    updateForm(
                      "other_cost",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </label>
            </div>

            <div className="cost-live-summary">
              <div>
                <small>Total cost</small>
                <strong>{money(editorValues.totalCost)}</strong>
              </div>

              <div>
                <small>Profit per unit</small>
                <strong
                  className={
                    editorValues.profit >= 0
                      ? "cost-positive"
                      : "cost-negative"
                  }
                >
                  {money(editorValues.profit)}
                </strong>
              </div>

              <div>
                <small>Profit margin</small>
                <strong>
                  {editorValues.margin.toFixed(2)}%
                </strong>
              </div>
            </div>

            <div className="cost-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeEditor}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                <BadgeIndianRupee size={18} />

                {saving ? "Saving..." : "Save Cost"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteProduct && (
        <div className="cost-modal-backdrop">
          <div className="cost-delete-dialog">
            <span className="cost-delete-icon">
              <Trash2 size={24} />
            </span>

            <h2>Delete Cost Details?</h2>

            <p>
              This removes the wholesale, packaging, delivery and
              other costs for{" "}
              <strong>{deleteProduct.name}</strong>. The product
              itself will not be deleted.
            </p>

            <div className="cost-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteProduct(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn cost-danger-button"
                onClick={removeCost}
                disabled={deleting}
              >
                <Trash2 size={18} />

                {deleting ? "Deleting..." : "Delete Cost"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
