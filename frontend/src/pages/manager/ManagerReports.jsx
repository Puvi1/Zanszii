import { useEffect, useState } from "react";
import { api } from "../../lib/api";
export default function ManagerReports(){
 const [r,setR]=useState(null); useEffect(()=>{api.get("/manager/reports").then(x=>setR(x.data))},[]);
 if(!r)return <div className="py-20 text-center">Loading report...</div>;
 const cards=[["Total orders",r.total_orders],["Delivered",r.delivered_orders],["Active deliveries",r.active_deliveries],["Delivered revenue",`₹${Number(r.delivered_revenue).toLocaleString("en-IN")}`]];
 return <div><p className="text-sm font-bold text-[#0F4C9C]">Manager</p><h1 className="text-3xl font-black">Delivery reports</h1><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([a,b])=><div key={a} className="rounded-3xl border bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">{a}</p><p className="mt-2 text-3xl font-black text-[#062B5F]">{b}</p></div>)}</div></div>
}
