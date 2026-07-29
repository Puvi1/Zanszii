import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BadgeIndianRupee,
  BarChart3,
  Boxes,
  ClipboardList,
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

const customerLinks = [
  ["/", "Home", Home],
  ["/products", "Products", Package],
  ["/cart", "Cart", ShoppingCart],
  ["/orders", "My Orders", ClipboardList],
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

  // NEW
  ["/admin/delivery-partners", "Delivery Partners", Truck],

  ["/admin/cost-management", "Cost Management", BadgeIndianRupee],
  ["/admin/reports", "Reports", BarChart3],
  ["/profile", "Profile", User],
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links =
    user?.role === "admin"
      ? adminLinks
      : user?.role === "manager"
        ? managerLinks
        : customerLinks;

  const signOut = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="app-shell">
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Boxes size={22} />
          </div>

          <div>
            <strong>Zanszii</strong>
            <span>Order Management</span>
          </div>

          <button
            type="button"
            className="icon-btn mobile-only"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={
                to === "/" ||
                to === "/admin" ||
                to === "/manager"
              }
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                isActive
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          className="nav-link logout"
          onClick={signOut}
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label="Open navigation menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>

          <div>
            <p>Welcome back</p>
            <strong>{user?.name || "User"}</strong>
          </div>

          <span className="role-pill">
            {user?.role || "customer"}
          </span>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
