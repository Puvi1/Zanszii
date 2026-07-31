import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  ClipboardList,
  Heart,
  Home,
  LogOut,
  Menu,
  Package,
  ShoppingCart,
  Tags,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

const customerLinks = [
  ["/", "Home", Home],
  ["/products", "Shop", Package],
  ["/wishlist", "Wishlist", Heart],
  ["/cart", "Cart", ShoppingCart],
  ["/profile", "Profile", User],
];

const managerLinks = [
  ["/manager", "Dashboard", Home],
  ["/manager/deliveries", "Delivery Queue", Truck],
  ["/manager/reports", "Reports", BarChart3],
  ["/profile", "Profile", User],
];

const adminLinks = [
  ["/admin", "Dashboard", Home],
  ["/admin/products", "Products", Package],
  ["/admin/categories", "Categories", Tags],
  ["/admin/orders", "Orders", ClipboardList],
  ["/admin/customers", "Customers", Users],
  ["/admin/managers", "Managers", Truck],
  ["/admin/delivery-partners", "Delivery Partners", Truck],
  ["/admin/cost-management", "Cost Management", BadgeIndianRupee],
  ["/admin/reports", "Reports", BarChart3],
  ["/profile", "Profile", User],
];

function CustomerLayout({ user, signOut }) {
  const { itemCount } = useCart();
const wishlistCount = (() => {
  try {
    return JSON.parse(localStorage.getItem("zanszii_wishlist") || "[]").length;
  } catch {
    return 0;
  }
})();


  return (
    <div className="min-h-screen bg-[#F6F8FC] pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0F4C9C] text-white shadow-lg shadow-blue-200">
              <Boxes size={21} />
            </span>
            <div>
              <strong className="block text-lg font-black leading-none text-[#062B5F]">Zanszii</strong>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Clean living</span>
            </div>
          </NavLink>

          <nav className="hidden items-center gap-1 lg:flex">
            {customerLinks.slice(0, 4).map(([to, text, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                    isActive ? "bg-blue-50 text-[#0F4C9C]" : "text-slate-600 hover:bg-slate-50 hover:text-[#0F4C9C]"
                  }`
                }
              >
                <Icon size={17} /> {text}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NavLink to="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0F4C9C] lg:hidden">
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#F4B400] px-1 text-center text-[10px] font-black text-[#062B5F]">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </NavLink>

            <NavLink to="/profile" className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 lg:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 font-black text-[#0F4C9C]">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </span>
              <div className="max-w-[130px]">
                <p className="truncate text-xs text-slate-400">Welcome</p>
                <strong className="block truncate text-sm text-slate-800">{user?.name || "Customer"}</strong>
              </div>
            </NavLink>

            <button type="button" onClick={signOut} className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 lg:flex" aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {customerLinks.map(([to, text, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black transition ${
                  isActive ? "text-[#0F4C9C]" : "text-slate-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`relative flex h-8 w-10 items-center justify-center rounded-xl ${isActive ? "bg-blue-50" : ""}`}>
                    <Icon size={20} strokeWidth={isActive ? 2.8 : 2} />
                    {to === "/cart" && itemCount > 0 && (
                     <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-[#F4B400] px-1 text-center text-[9px] font-black text-[#062B5F]">
                        {itemCount > 99 ? "99+" : itemCount}
                      </span>
                    )}
 {to === "/wishlist" && wishlistCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-rose-500 px-1 text-center text-[9px] font-black text-white">
    {wishlistCount}
  </span>
)}

                  </span>
                  {text}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  if (user?.role === "customer" || !user?.role) {
    return <CustomerLayout user={user} signOut={signOut} />;
  }

  const links = user?.role === "admin" ? adminLinks : managerLinks;

  return (
    <div className="app-shell">
      {open && <button type="button" className="sidebar-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Boxes size={22} /></div>
          <div><strong>Zanszii</strong><span>Order Management</span></div>
          <button type="button" className="icon-btn mobile-only" aria-label="Close navigation menu" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>

        <nav>
          {links.map(([to, text, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin" || to === "/manager"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <Icon size={20} /><span>{text}</span>
            </NavLink>
          ))}
        </nav>

        <button type="button" className="nav-link logout" onClick={signOut}><LogOut size={20} /><span>Logout</span></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" aria-label="Open navigation menu" onClick={() => setOpen(true)}><Menu size={22} /></button>
          <div><p>Welcome back</p><strong>{user?.name || "User"}</strong></div>
          <span className="role-pill">{user?.role || "customer"}</span>
        </header>
        <section className="page-content"><Outlet /></section>
      </main>
    </div>
  );
}
