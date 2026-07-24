import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "../../lib/api";
import { exportPdf, exportExcel } from "../../utils/exportData";

const statuses=["all","placed","confirmed","processing","out_for_delivery","delivered","cancelled"];
const label=s=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function AdminOrders(){
 const [orders,setOrders]=useState([]),[managers,setManagers]=useState([]),[filter,setFilter]=useState("all"),[error,setError]=useState("");
 const load=()=>Promise.all([api.get("/admin/orders"),api.get("/admin/managers")]).then(([o,m])=>{setOrders(o.data);setManagers(m.data)}).catch(e=>setError(formatApiError(e?.response?.data?.detail)));
 useEffect(()=>{load()},[]);
 const shown=useMemo(()=>filter==="all"?orders:orders.filter(o=>o.status===filter),[orders,filter]);
 const status=async(o,s)=>{await api.patch(`/orders/${o.order_id}/status`,{status:s,note:`Updated by admin`});load()};
 const assign=async(o,manager_id)=>{await api.patch(`/admin/orders/${o.order_id}/assign`,{manager_id:manager_id||null});load()};
 const rows=shown.map(o=>[o.order_number,o.customer_name,o.phone,label(o.status),o.manager_name||"Unassigned",o.total,new Date(o.created_at).toLocaleDateString("en-IN")]);
 return <div className="space-y-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-bold text-[#0F4C9C]">Admin</p><h1 className="text-3xl font-black">Manage orders</h1></div><div className="flex gap-2"><button onClick={()=>exportPdf("Zanszii Orders",["Order","Customer","Phone","Status","Manager","Total","Date"],rows,"zanszii-orders.pdf")} className="rounded-xl border px-4 py-2 font-bold">PDF</button><button onClick={()=>exportExcel(["Order","Customer","Phone","Status","Manager","Total","Date"],rows,"zanszii-orders.xlsx","Orders")} className="rounded-xl bg-[#0F4C9C] px-4 py-2 font-bold text-white">Excel</button></div></div>
 <div className="flex gap-2 overflow-x-auto">{statuses.map(s=><button key={s} onClick={()=>setFilter(s)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${filter===s?"bg-[#0F4C9C] text-white":"bg-white border"}`}>{label(s)}</button>)}</div>{error&&<div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>}
 <div className="overflow-x-auto rounded-3xl border bg-white shadow-sm"><table className="min-w-full text-sm"><thead className="bg-[#F5F9FF]"><tr>{["Order","Customer","Total","Status","Manager","Actions"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody>{shown.map(o=><tr key={o.order_id} className="border-t"><td className="px-4 py-4"><b>{o.order_number}</b><div className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString("en-IN")}</div></td><td className="px-4 py-4">{o.customer_name}<div className="text-xs text-slate-500">{o.phone}</div></td><td className="px-4 py-4 font-black">₹{Number(o.total).toLocaleString("en-IN")}</td><td className="px-4 py-4"><select value={o.status} onChange={e=>status(o,e.target.value)} className="rounded-xl border px-3 py-2">{statuses.slice(1).map(s=><option key={s} value={s}>{label(s)}</option>)}</select></td><td className="px-4 py-4"><select value={o.manager_id||""} onChange={e=>assign(o,e.target.value)} className="rounded-xl border px-3 py-2"><option value="">Unassigned</option>{managers.filter(m=>m.active).map(m=><option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></td><td className="px-4 py-4"><button onClick={()=>window.print()} className="font-bold text-[#0F4C9C]">Print</button></td></tr>)}</tbody></table></div></div>
}
