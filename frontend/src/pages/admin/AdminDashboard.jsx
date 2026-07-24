import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { BarChart3, Boxes, ClipboardList, IndianRupee, PackageCheck, RefreshCw, ShoppingBag, Users } from "lucide-react";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
const statusLabel = (status = "") => status.replaceAll("_", " ");

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true); setError("");
    try { const response = await api.get("/admin/reports"); setData(response.data); }
    catch (err) { setError(formatApiError(err)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cards = useMemo(() => [
    ["Products", data?.products, Boxes, "/admin/products"],
    ["Total orders", data?.orders, ShoppingBag, "/admin/orders"],
    ["Pending delivery", data?.pending_orders, ClipboardList, "/admin/orders"],
    ["Delivered", data?.delivered_orders, PackageCheck, "/admin/orders"],
    ["Customers", data?.customers, Users, "/admin/customers"],
    ["Revenue", money(data?.revenue), IndianRupee, "/admin/reports"],
  ], [data]);

  if (loading) return <div className="panel loading-panel"><RefreshCw className="spin"/> Loading dashboard…</div>;

  return <div className="admin-page">
    <div className="page-heading-row">
      <div><span className="eyebrow">Business overview</span><h1>Admin Dashboard</h1><p>Everything important, in one clear view.</p></div>
      <button className="btn btn-secondary" onClick={load}><RefreshCw size={18}/> Refresh</button>
    </div>
    {error && <div className="alert alert-error">{error}</div>}

    <section className="metric-grid">
      {cards.map(([label, value, Icon, path]) => <button className="metric-card" key={label} onClick={() => navigate(path)}>
        <span className="metric-icon"><Icon size={22}/></span><span className="metric-copy"><small>{label}</small><strong>{value ?? 0}</strong></span><span className="metric-arrow">→</span>
      </button>)}
    </section>

    <section className="dashboard-grid">
      <div className="panel panel-large">
        <div className="panel-header"><div><h2>Recent orders</h2><p>Latest activity across your store.</p></div><button className="text-btn" onClick={() => navigate("/admin/orders")}>View all</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th></tr></thead><tbody>
          {(data?.recent_orders || []).length ? data.recent_orders.map((order) => <tr key={order.order_id}><td><strong>{order.order_number || order.order_id?.slice(-8)}</strong></td><td>{order.customer_name || order.user_name || "Customer"}</td><td><span className={`status-chip status-${order.status}`}>{statusLabel(order.status)}</span></td><td>{money(order.total)}</td><td>{order.created_at ? new Date(order.created_at).toLocaleDateString("en-IN") : "—"}</td></tr>) : <tr><td colSpan="5" className="empty-cell">No orders yet.</td></tr>}
        </tbody></table></div>
      </div>
      <div className="panel quick-panel"><div className="panel-header"><div><h2>Quick actions</h2><p>Common admin tasks.</p></div><BarChart3 size={22}/></div>
        <button className="quick-action" onClick={() => navigate("/admin/products")}><Boxes size={20}/><span><strong>Add or edit products</strong><small>Manage price, stock and visibility</small></span></button>
        <button className="quick-action" onClick={() => navigate("/admin/categories")}><PackageCheck size={20}/><span><strong>Organize categories</strong><small>Keep your catalogue easy to browse</small></span></button>
        <button className="quick-action" onClick={() => navigate("/admin/reports")}><BarChart3 size={20}/><span><strong>Export reports</strong><small>Download PDF and Excel files</small></span></button>
      </div>
    </section>
  </div>;
}

