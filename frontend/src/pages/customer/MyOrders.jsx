import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";

const labels={placed:"Placed",confirmed:"Confirmed",processing:"Processing",out_for_delivery:"Out for delivery",delivered:"Delivered",cancelled:"Cancelled"};
const colors={placed:"bg-blue-50 text-blue-700",confirmed:"bg-indigo-50 text-indigo-700",processing:"bg-amber-50 text-amber-700",out_for_delivery:"bg-purple-50 text-purple-700",delivered:"bg-emerald-50 text-emerald-700",cancelled:"bg-red-50 text-red-700"};

export default function MyOrders(){
 const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 useEffect(()=>{api.get("/orders/my").then(r=>setOrders(r.data)).catch(e=>setError(formatApiError(e?.response?.data?.detail))).finally(()=>setLoading(false))},[]);
 if(loading)return <div className="py-20 text-center">Loading orders...</div>;
 return <div className="space-y-5"><div><p className="text-sm font-bold text-[#0F4C9C]">Orders</p><h1 className="text-3xl font-black">My orders</h1></div>
 {error&&<div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}
 {!orders.length?<div className="rounded-3xl bg-white p-12 text-center"><h2 className="text-2xl font-black">No orders yet</h2><Link to="/products" className="mt-5 inline-flex rounded-2xl bg-[#0F4C9C] px-5 py-3 font-bold text-white">Shop now</Link></div>:
 orders.map(o=><Link key={o.order_id} to={`/orders/${o.order_id}`} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-slate-500">{new Date(o.created_at).toLocaleString("en-IN")}</p><h2 className="mt-1 text-lg font-black">{o.order_number}</h2><p className="mt-1 text-sm text-slate-500">{o.items?.length||0} product(s)</p></div><div className="flex items-center gap-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${colors[o.status]}`}>{labels[o.status]}</span><b className="text-xl text-[#062B5F]">₹{Number(o.total).toLocaleString("en-IN")}</b></div></div></Link>)}
 </div>
}
