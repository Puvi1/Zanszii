import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../../lib/api";

const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const date = (value) => value ? new Date(value).toLocaleString("en-IN") : "-";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [c, o] = await Promise.all([
        api.get("/admin/customers"),
        api.get("/admin/orders"),
      ]);
      setCustomers(c.data || []);
      setOrders(o.data || []);
    } catch (e) {
      setError(formatApiError(e?.response?.data?.detail) || "Unable to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => customers.map((customer) => {
    const customerId = customer.user_id || customer.customer_id || customer.id;
    const customerOrders = orders.filter((order) =>
      order.customer_id === customerId ||
      order.user_id === customerId ||
      order.customer_email === customer.email
    );
    const validOrders = customerOrders.filter((order) => order.status !== "cancelled");
    return {
      ...customer,
      customerId,
      customerOrders,
      totalOrders: customerOrders.length,
      totalSpent: validOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      lastOrder: customerOrders.slice().sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0],
    };
  }), [customers, orders]);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((customer) => [customer.name, customer.full_name, customer.email, customer.phone, customer.city]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [rows, search]);

  const stats = {
    total: rows.length,
    active: rows.filter((customer) => customer.totalOrders > 0).length,
    repeat: rows.filter((customer) => customer.totalOrders > 1).length,
    revenue: rows.reduce((sum, customer) => sum + customer.totalSpent, 0),
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-sm font-bold text-[#0F4C9C]">Admin</p><h1 className="text-3xl font-black">Customer Management</h1><p className="text-slate-500">View customers, orders and spending.</p></div>
      <button onClick={load} className="rounded-xl bg-[#0F4C9C] px-5 py-3 font-bold text-white">Refresh</button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[["Total Customers", stats.total],["Customers With Orders", stats.active],["Repeat Customers", stats.repeat],["Customer Revenue", money(stats.revenue)]].map(([label,value]) =>
        <div key={label} className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}
    </div>

    <div className="rounded-3xl border bg-white p-4 shadow-sm"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, phone, email or city..." className="w-full rounded-2xl border px-4 py-3" /></div>
    {error && <div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}

    <div className="overflow-x-auto rounded-3xl border bg-white shadow-sm"><table className="min-w-full text-sm"><thead className="bg-[#F5F9FF]"><tr>{["Customer","Contact","Orders","Total Spent","Last Order","Action"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>
      {loading && <tr><td colSpan="6" className="px-4 py-12 text-center">Loading...</td></tr>}
      {!loading && shown.map((customer)=><tr key={customer.customerId || customer.email} className="border-t"><td className="px-4 py-4"><b>{customer.name || customer.full_name || "Customer"}</b><div className="text-xs text-slate-500">{customer.city || "City not added"}</div></td><td className="px-4 py-4">{customer.phone || "-"}<div className="text-xs text-slate-500">{customer.email || "-"}</div></td><td className="px-4 py-4 font-bold">{customer.totalOrders}</td><td className="px-4 py-4 font-black">{money(customer.totalSpent)}</td><td className="px-4 py-4">{customer.lastOrder ? date(customer.lastOrder.created_at) : "No orders"}</td><td className="px-4 py-4"><button onClick={()=>setSelected(customer)} className="font-bold text-[#0F4C9C]">View details</button></td></tr>)}
      {!loading && shown.length===0 && <tr><td colSpan="6" className="px-4 py-12 text-center">No customers found.</td></tr>}
    </tbody></table></div>

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6"><div className="flex justify-between"><div><p className="text-sm font-bold text-[#0F4C9C]">Customer Profile</p><h2 className="text-2xl font-black">{selected.name || selected.full_name || "Customer"}</h2></div><button onClick={()=>setSelected(null)} className="rounded-xl border px-4 py-2 font-bold">Close</button></div><div className="mt-6 grid gap-4 md:grid-cols-3">{[["Phone",selected.phone||"-"],["Email",selected.email||"-"],["City",selected.city||"-"],["Total Orders",selected.totalOrders],["Total Spent",money(selected.totalSpent)],["Joined",date(selected.created_at)]].map(([label,value])=><div key={label} className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-black">{value}</p></div>)}</div><h3 className="mt-8 text-lg font-black">Order History</h3><div className="mt-3 overflow-x-auto rounded-2xl border"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["Order","Status","Total","Date"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{selected.customerOrders.map(order=><tr key={order.order_id} className="border-t"><td className="px-4 py-3 font-bold">{order.order_number || order.order_id}</td><td className="px-4 py-3">{String(order.status||"-").replaceAll("_"," ")}</td><td className="px-4 py-3 font-black">{money(order.total)}</td><td className="px-4 py-3">{date(order.created_at)}</td></tr>)}{selected.customerOrders.length===0 && <tr><td colSpan="4" className="px-4 py-8 text-center">No orders yet.</td></tr>}</tbody></table></div></div></div>}
  </div>;
}
