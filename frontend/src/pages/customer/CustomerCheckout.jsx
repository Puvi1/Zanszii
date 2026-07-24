import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Phone, ShieldCheck } from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

export default function CustomerCheckout() {
  const { user, refreshUser } = useAuth();
  const { items, subtotal, clearCart, reloadCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ delivery_address:"", city:"", state:"Tamil Nadu", postal_code:"", phone:"", notes:"" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(()=>setForm((f)=>({...f, delivery_address:user?.address||"", city:user?.city||"", state:user?.state||"Tamil Nadu", postal_code:user?.postal_code||"", phone:user?.phone||""})),[user]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const { data } = await api.post("/orders", form);
      await reloadCart();
      navigate(`/order-success/${data.order_id}`, { state: { order: data } });
    } catch (err) {
      setError(formatApiError(err?.response?.data?.detail));
    } finally { setSaving(false); }
  };

  if (!items.length) return <div className="rounded-3xl bg-white p-10 text-center"><h1 className="text-2xl font-black">Your cart is empty</h1><button onClick={()=>navigate("/products")} className="mt-5 rounded-2xl bg-[#0F4C9C] px-5 py-3 font-bold text-white">Browse products</button></div>;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-[#0F4C9C]">Checkout</p><h1 className="mt-1 text-3xl font-black">Delivery details</h1>
        {error && <div className="mt-4 rounded-2xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="text-sm font-bold">Full address</span><textarea required value={form.delivery_address} onChange={(e)=>setForm({...form,delivery_address:e.target.value})} className="mt-2 min-h-28 w-full rounded-2xl border p-3 outline-none focus:border-[#0F4C9C]" placeholder="Door no, street, area, landmark"/></label>
          <label><span className="text-sm font-bold">City</span><input required value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} className="mt-2 w-full rounded-2xl border p-3"/></label>
          <label><span className="text-sm font-bold">State</span><input required value={form.state} onChange={(e)=>setForm({...form,state:e.target.value})} className="mt-2 w-full rounded-2xl border p-3"/></label>
          <label><span className="text-sm font-bold">Pincode</span><input required value={form.postal_code} onChange={(e)=>setForm({...form,postal_code:e.target.value})} className="mt-2 w-full rounded-2xl border p-3"/></label>
          <label><span className="text-sm font-bold">Mobile number</span><input required maxLength={10} value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value.replace(/\D/g,"")})} className="mt-2 w-full rounded-2xl border p-3"/></label>
          <label className="sm:col-span-2"><span className="text-sm font-bold">Order notes (optional)</span><textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} className="mt-2 w-full rounded-2xl border p-3"/></label>
        </div>
      </section>
      <aside className="h-fit rounded-3xl bg-[#062B5F] p-6 text-white shadow-xl lg:sticky lg:top-6">
        <h2 className="text-xl font-black">Order summary</h2>
        <div className="mt-5 space-y-3">{items.map((i)=><div key={i.product_id} className="flex justify-between text-sm text-blue-100"><span>{i.name} × {i.quantity}</span><b>₹{Number(i.line_total).toLocaleString("en-IN")}</b></div>)}</div>
        <div className="mt-5 flex justify-between border-t border-white/20 pt-5 text-2xl font-black"><span>Total</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
        <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="font-bold">Cash on Delivery</p><p className="mt-1 text-sm text-blue-100">Pay when your order is delivered.</p></div>
        <button disabled={saving} className="mt-5 w-full rounded-2xl bg-[#F4B400] px-5 py-4 font-black text-[#062B5F] disabled:opacity-60">{saving?"Placing order...":"Place order"}</button>
      </aside>
    </form>
  );
}
