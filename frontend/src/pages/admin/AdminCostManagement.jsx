import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  Calculator,
  FileSpreadsheet,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import { api, formatApiError } from "../../lib/api";
import { exportRowsToExcel } from "../../utils/exportData";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const numberValue = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateCostValues = (item) => {
  const sellingPrice = numberValue(item.selling_price ?? item.price);
  const wholesalePrice = numberValue(item.wholesale_price);
  const packagingCost = numberValue(item.packaging_cost);
  const deliveryCost = numberValue(item.delivery_cost);
  const otherCost = numberValue(item.other_cost);

  const totalCost =
    wholesalePrice + packagingCost + deliveryCost + otherCost;

  const profit = sellingPrice - totalCost;

  const profitMargin =
    sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return {
    sellingPrice,
    wholesalePrice,
    packagingCost,
    deliveryCost,
    otherCost,
    totalCost,
    profit,
    profitMargin,
  };
};

export default function AdminCostManagement() {
  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await api.get("/admin/products");

      const productList = Array.isArray(response.data)
        ? response.data
        : response.data?.products || [];

      setProducts(productList);

      const initialCosts = {};

      productList.forEach((product) => {
        const productId = product.id || product._id;

        initialCosts[productId] = {
          wholesale_price: product.wholesale_price ?? 0,
          packaging_cost: product.packaging_cost ?? 0,
          delivery_cost: product.delivery_cost ?? 0,
          other_cost: product.other_cost ?? 0,
        };
      });

      setCosts(initialCosts);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return products;
    }

    return products.filter((product) => {
      const name = String(product.name || "").toLowerCase();
      const category = String(
        product.category_name ||
          product.category?.name ||
          product.category ||
          ""
      ).toLowerCase();

      return name.includes(term) || category.includes(term);
    });
  }, [products, search]);

  const updateCostField = (productId, field, value) => {
    setCosts((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        [field]: value,
      },
    }));
  };

  const saveCosts = async (product) => {
    const productId = product.id || product._id;

    if (!productId) {
      setError("Product ID is missing.");
      return;
    }

    const payload = {
      wholesale_price: numberValue(
        costs[productId]?.wholesale_price
      ),
      packaging_cost: numberValue(
        costs[productId]?.packaging_cost
      ),
      delivery_cost: numberValue(
        costs[productId]?.delivery_cost
      ),
      other_cost: numberValue(costs[productId]?.other_cost),
    };

    setSavingId(productId);
    setError("");
    setMessage("");

    try {
      await api.put(`/admin/products/${productId}/costs`, payload);

      setMessage(
        `${product.name || "Product"} cost details saved successfully.`
      );

      setProducts((currentProducts) =>
        currentProducts.map((currentProduct) => {
          const currentId =
            currentProduct.id || currentProduct._id;

          if (currentId !== productId) {
            return currentProduct;
          }

          return {
            ...currentProduct,
            ...payload,
          };
        })
      );
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSavingId("");
    }
  };

  const exportCostReport = () => {
    const rows = filteredProducts.map((product) => {
      const productId = product.id || product._id;

      const item = {
        ...product,
        ...costs[productId],
      };

      const calculated = calculateCostValues(item);

      return {
        product: product.name || "Product",
        category:
          product.category_name ||
          product.category?.name ||
          product.category ||
          "",
        selling_price: calculated.sellingPrice,
        wholesale_price: calculated.wholesalePrice,
        packaging_cost: calculated.packagingCost,
        delivery_cost: calculated.deliveryCost,
        other_cost: calculated.otherCost,
        total_cost: calculated.totalCost,
        profit: calculated.profit,
        profit_margin: `${calculated.profitMargin.toFixed(2)}%`,
      };
    });

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
      { label: "Total Cost", value: (row) => row.total_cost },
      { label: "Profit", value: (row) => row.profit },
      {
        label: "Profit Margin",
        value: (row) => row.profit_margin,
      },
    ];

    exportRowsToExcel({
      rows,
      columns,
      fileName: "zanszii-product-cost-report",
      sheetName: "Product Costs",
    });
  };

  return (
    <div className="admin-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Private admin finance</span>
          <h1>Cost Management</h1>
          <p>
            Add wholesale and operational costs separately from the
            product form.
          </p>
        </div>

        <div className="export-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadProducts}
            disabled={loading}
          >
            <RefreshCw size={18} />
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={exportCostReport}
            disabled={loading || filteredProducts.length === 0}
          >
            <FileSpreadsheet size={18} />
            Export Excel
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {message && (
        <div className="alert alert-success">{message}</div>
      )}

      <section className="metric-grid compact">
        <div className="metric-card static">
          <span className="metric-icon">
            <BadgeIndianRupee />
          </span>

          <span className="metric-copy">
            <small>Total products</small>
            <strong>{products.length}</strong>
          </span>
        </div>

        <div className="metric-card static">
          <span className="metric-icon">
            <Calculator />
          </span>

          <span className="metric-copy">
            <small>Products shown</small>
            <strong>{filteredProducts.length}</strong>
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="page-heading-row">
          <div>
            <h2>Product Costs</h2>
            <p>
              Selling price is read-only. Cost details are private and
              only available to administrators.
            </p>
          </div>

          <div className="search-box">
            <Search size={18} />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product or category"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw size={28} className="spin" />
            <h3>Loading products...</h3>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <PackageEmptyIcon />
            <h3>No products found</h3>
            <p>
              Add products first or try a different search.
            </p>
          </div>
        ) : (
          <div className="cost-management-grid">
            {filteredProducts.map((product) => {
              const productId = product.id || product._id;

              const item = {
                ...product,
                ...costs[productId],
              };

              const calculated = calculateCostValues(item);

              return (
                <article
                  className="panel export-card cost-product-card"
                  key={productId}
                >
                  <div className="cost-product-header">
                    <div>
                      <span className="eyebrow">
                        {product.category_name ||
                          product.category?.name ||
                          product.category ||
                          "Uncategorized"}
                      </span>

                      <h2>{product.name || "Product"}</h2>

                      <p>
                        Selling price:{" "}
                        <strong>
                          {money(calculated.sellingPrice)}
                        </strong>
                      </p>
                    </div>

                    {product.image_url || product.image ? (
                      <img
                        src={product.image_url || product.image}
                        alt={product.name || "Product"}
                        className="cost-product-image"
                      />
                    ) : null}
                  </div>

                  <div className="cost-input-grid">
                    <label>
                      <span>Wholesale price</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          costs[productId]?.wholesale_price ?? ""
                        }
                        onChange={(event) =>
                          updateCostField(
                            productId,
                            "wholesale_price",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>Packaging cost</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          costs[productId]?.packaging_cost ?? ""
                        }
                        onChange={(event) =>
                          updateCostField(
                            productId,
                            "packaging_cost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>Delivery cost</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          costs[productId]?.delivery_cost ?? ""
                        }
                        onChange={(event) =>
                          updateCostField(
                            productId,
                            "delivery_cost",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      <span>Other expenses</span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={costs[productId]?.other_cost ?? ""}
                        onChange={(event) =>
                          updateCostField(
                            productId,
                            "other_cost",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="cost-summary-grid">
                    <div>
                      <small>Total cost</small>
                      <strong>{money(calculated.totalCost)}</strong>
                    </div>

                    <div>
                      <small>Profit per product</small>
                      <strong>{money(calculated.profit)}</strong>
                    </div>

                    <div>
                      <small>Profit margin</small>
                      <strong>
                        {calculated.profitMargin.toFixed(2)}%
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => saveCosts(product)}
                    disabled={savingId === productId}
                  >
                    <Save size={18} />

                    {savingId === productId
                      ? "Saving..."
                      : "Save Cost"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function PackageEmptyIcon() {
  return <BadgeIndianRupee size={34} />;
}
