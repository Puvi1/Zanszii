import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, ClipboardList, Package, ShoppingCart, Truck, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const roleCards = {
  customer: [["Browse Products", "View available Zanszii products", "/products", Package], ["Your Cart", "Review items before ordering", "/cart", ShoppingCart], ["My Orders", "Track your latest orders", "/orders", ClipboardList]],
  manager: [["Delivery Queue", "View orders assigned for delivery", "/manager/deliveries", Truck], ["Delivery Reports", "Review delivery performance", "/manager/reports", BarChart3]],
  admin: [["Products", "Manage catalog and stock", "/admin/products", Package], ["Orders", "Process and assign all orders", "/admin/orders", ClipboardList], ["Customers", "View registered customers", "/admin/customers", Users], ["Reports", "See business performance", "/admin/reports", BarChart3]],
};

export default function ZansziiHome() {
 const { user } = useAuth(); const cards = roleCards[user?.role] || roleCards.customer;
 return <><div className="page-heading"><div><span className="eyebrow">ZANSZII CONTROL CENTER</span><h1>{user?.role === "admin" ? "Admin Dashboard" : user?.role === "manager" ? "Manager Dashboard" : "Welcome to Zanszii"}</h1><p>Everything you need is organized below.</p></div></div><div className="quick-grid">{cards.map(([title,text,to,Icon]) => <Link className="quick-card" to={to} key={title}><div className="quick-icon"><Icon/></div><div><h3>{title}</h3><p>{text}</p></div><ArrowRight className="card-arrow"/></Link>)}</div><div className="notice-card"><strong>Frontend foundation installed successfully.</strong><p>Authentication, role-based routing, navigation and the Zanszii theme are now connected. Product, cart, order, admin and manager feature pages come in the next stages.</p></div></>;
}
