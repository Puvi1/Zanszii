import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";

export default function OrderSuccess() {
  const { orderId } = useParams();
  const order = useLocation().state?.order;
  return (
    <div className="mx-auto max-w-2xl rounded-[32px] border border-emerald-200 bg-white p-8 text-center shadow-xl">
      <CheckCircle size={76} weight="fill" className="mx-auto text-emerald-500"/>
      <h1 className="mt-4 text-3xl font-black">Order placed successfully!</h1>
      <p className="mt-2 text-slate-500">Your Zanszii order has been received and will be confirmed shortly.</p>
      <div className="mt-6 rounded-2xl bg-[#F5F9FF] p-5">
        <p className="text-sm text-slate-500">Order number</p>
        <p className="mt-1 text-xl font-black text-[#0F4C9C]">{order?.order_number || orderId}</p>
        {order?.total != null && <p className="mt-2 font-bold">Total: ₹{Number(order.total).toLocaleString("en-IN")}</p>}
      </div>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/orders" className="rounded-2xl bg-[#0F4C9C] px-6 py-3 font-bold text-white">View my orders</Link>
        <Link to="/products" className="rounded-2xl border border-slate-200 px-6 py-3 font-bold">Continue shopping</Link>
      </div>
    </div>
  );
}
