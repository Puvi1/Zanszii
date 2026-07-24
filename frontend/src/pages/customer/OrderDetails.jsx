import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";

const steps=["placed","confirmed","processing","out_for_delivery","delivered"];
const labels={placed:"Placed",confirmed:"Confirmed",processing:"Processing",out_for_delivery:"Out for delivery",delivered:"Delivered",cancelled:"Cancelled"};

export default function OrderDetails(){
 const {orderId}=useParams(); const [order,setOrder]=useState(null); const [error,setError]=useState("");
 useEffect(()=>{api.get(`/orders/${orderId}`).then(r=>setOrder(r.data)).catch(e=>setError(formatApiError(e?.response?.data?.detail)))},[orderId]);
 if(error)return <div className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</div>;
 if(!order)return <div className="py-20 text-center">Loading order...</div>;
 const active=steps.indexOf(order.status);
 return <div className="space-y-6"><section className="rounded-3xl bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-6 text-white"><p className="text-blue-200">Order details</p><h1 className="mt-1 text-3xl font-black">{order.order_number}</h1><p className="mt-2">{new Date(order.created_at).toLocaleString("en-IN")}</p></section>
 <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Order status</h2>{order.status==="cancelled"?<div className="mt-4 rounded-2xl bg-red-50 p-4 font-bold text-red-700">Order cancelled</div>:<div className="mt-6 grid gap-3 sm:grid-cols-5">{steps.map((s,i)=><div key={s} className={`rounded-2xl p-3 text-center text-xs font-bold ${i<=active?"bg-[#0F4C9C] text-white":"bg-slate-100 text-slate-500"}`}>{labels[s]}</div>)}</div>}</section>
 <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Items</h2><div className="mt-4 space-y-4">{order.items.map(i=><div key={i.product_id} className="flex justify-between border-b pb-4"><div><b>{i.name}</b><p className="text-sm text-slate-500">₹{i.price} × {i.quantity}</p></div><b>₹{Number(i.line_total).toLocaleString("en-IN")}</b></div>)}</div></section>
 <aside className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-black">Delivery</h2><p className="mt-4 text-slate-600">{order.delivery_address}<br/>{order.city}, {order.state} - {order.postal_code}</p><p className="mt-3 font-bold">{order.phone}</p><div className="mt-5 flex justify-between border-t pt-5 text-2xl font-black"><span>Total</span><span>₹{Number(order.total).toLocaleString("en-IN")}</span></div></aside></div></div>
}
