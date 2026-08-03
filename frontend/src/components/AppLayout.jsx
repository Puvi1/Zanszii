import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BadgeIndianRupee,
  BadgePercent,
  Bell,
  BarChart3,
  Boxes,
  ClipboardList,
  Heart,
  Home,
  LogOut,
  MapPin,
  Menu,
  Package,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";

const customerLinks = [
  ["/", "Home", Home],
  ["/products", "Shop", Package],
  ["/orders", "Orders", ClipboardList],
  ["/wishlist", "Wishlist", Heart],
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
  ["/admin/vendor-applications", "Partner Applications", Store],
  ["/admin/offers", "Coupons & Offers", BadgePercent],
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
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    let active = true;

    const loadUnreadCount = async () => {
      try {
        const response = await api.get("/notifications/unread-count");

        if (active) {
          setUnreadNotifications(
            Number(response.data?.unread_count || 0)
          );
        }
      } catch {
        if (active) {
          setUnreadNotifications(0);
        }
      }
    };

    loadUnreadCount();

    const interval = window.setInterval(
      loadUnreadCount,
      30000
    );

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const wishlistCount = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("zanszii_wishlist") || "[]"
      ).length;
    } catch {
      return 0;
    }
  })();

  const deliveryLocation =
    user?.city ||
    user?.address?.city ||
    "Select location";

  return (
    <div className="min-h-screen bg-[#F6F8FC] pb-24 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <NavLink
            to="/"
            aria-label="Go to ZANSZI home"
            className="flex shrink-0 items-center gap-2.5 rounded-2xl transition hover:opacity-90"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0F4C9C] text-white shadow-lg shadow-blue-200/70">
              <Boxes size={22} />
            </span>

            <div className="hidden sm:block">
              <strong className="block text-lg font-black leading-none tracking-wide text-[#062B5F]">
                ZANSZI
              </strong>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Clean Living
              </span>
            </div>
          </NavLink>

          <NavLink
            to="/profile"
            className="min-w-0 flex-1 rounded-2xl px-2 py-1.5 transition hover:bg-slate-50 sm:px-3"
          >
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 sm:text-[11px]">
              <MapPin size={14} className="shrink-0 text-[#0F4C9C]" />
              Deliver to
            </span>

            <strong className="mt-0.5 block truncate text-xs font-black capitalize text-slate-900 sm:text-sm">
              {deliveryLocation}
            </strong>
          </NavLink>

          <nav className="hidden items-center gap-1 lg:flex">
            {customerLinks.slice(0, 4).map(([to, text, Icon]) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                    isActive
                      ? "bg-blue-50 text-[#0F4C9C]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-[#0F4C9C]"
                  }`
                }
              >
                <Icon size={17} />
                {text}
              </NavLink>
            ))}

            <NavLink
              to="/become-partner"
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  isActive
                    ? "bg-blue-50 text-[#0F4C9C]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-[#0F4C9C]"
                }`
              }
            >
              <Store size={17} />
              Partner
            </NavLink>
          </nav>

          <NavLink
            to="/notifications"
            aria-label="Open notifications"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 sm:h-11 sm:w-11 sm:rounded-2xl"
          >
            <Bell size={19} />

            {unreadNotifications > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-h-[19px] min-w-[19px] place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white ring-2 ring-white">
                {unreadNotifications > 99
                  ? "99+"
                  : unreadNotifications}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/cart"
            aria-label="Open cart"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#062B5F] text-white shadow-sm transition hover:bg-[#0F4C9C] sm:h-11 sm:w-11 sm:rounded-2xl"
          >
            <ShoppingCart size={20} />

            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid min-h-[19px] min-w-[19px] place-items-center rounded-full bg-[#F4B400] px-1 text-[9px] font-black text-[#062B5F] ring-2 ring-white">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/profile"
            className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 lg:flex"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 font-black text-[#0F4C9C]">
              {(user?.name || "U").charAt(0).toUpperCase()}
            </span>

            <div className="max-w-[120px]">
              <p className="truncate text-xs text-slate-400">Welcome</p>
              <strong className="block truncate text-sm text-slate-800">
                {user?.name || "Customer"}
              </strong>
            </div>
          </NavLink>

          <button
            type="button"
            onClick={signOut}
            className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-red-50 hover:text-red-600 lg:flex"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <NavLink
        to="/become-partner"
        aria-label="Become a ZANSZI Partner"
        className="fixed bottom-[86px] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[#0F4C9C] px-4 py-3 text-xs font-black text-white shadow-lg lg:hidden"
      >
        <Store size={17} />
        Partner
      </NavLink>

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
                  <span
                    className={`relative flex h-8 w-10 items-center justify-center rounded-xl ${
                      isActive ? "bg-blue-50" : ""
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.8 : 2} />

                    {to === "/cart" && itemCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-[#F4B400] px-1 text-center text-[9px] font-black text-[#062B5F]">
                        {itemCount > 99 ? "99+" : itemCount}
                      </span>
                    )}

                    {to === "/wishlist" && wishlistCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-rose-500 px-1 text-center text-[9px] font-black text-white">
                        {wishlistCount > 99 ? "99+" : wishlistCount}
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
          <div><strong>ZANSZI</strong><span>Order Management</span></div>
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
