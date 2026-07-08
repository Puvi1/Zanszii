import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  House,
  Target,
  User,
  SignOut,
  List,
  X,
  Users,
  UsersThree,
  ChartBar,
  CalendarCheck,
  ClipboardText,
  Package,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import NotificationBell from "@/components/NotificationBell";
import Avatar from "@/components/Avatar";

const BASE_NAV = [
  { to: "/", icon: House, label: "Dashboard", testId: "nav-dashboard" },
  { to: "/products", icon: Package, label: "Products", testId: "nav-products" },
  { to: "/orders", icon: ClipboardText, label: "Orders", testId: "nav-orders" },
  { to: "/delivery", icon: CalendarCheck, label: "Delivery", testId: "nav-delivery" },
  { to: "/reports", icon: ChartBar, label: "Reports", testId: "nav-reports" },
  { to: "/profile", icon: User, label: "Profile", testId: "nav-profile" },
];

const ADMIN_NAV = [
  { to: "/admin/products", icon: Target, label: "Manage Products", testId: "nav-admin-products" },
  { to: "/admin/orders", icon: ClipboardText, label: "Manage Orders", testId: "nav-admin-orders" },
  { to: "/admin/customers", icon: Users, label: "Customers", testId: "nav-admin-customers" },
  { to: "/admin/managers", icon: UsersThree, label: "Managers", testId: "nav-admin-managers" },
];

function navForRole(role) {
  if (role === "super_admin" || role === "admin") {
    return [...BASE_NAV, ...ADMIN_NAV];
  }

  if (role === "manager") {
    return [
      { to: "/", icon: House, label: "Dashboard", testId: "nav-dashboard" },
      { to: "/delivery", icon: CalendarCheck, label: "Delivery", testId: "nav-delivery" },
      { to: "/orders", icon: ClipboardText, label: "Orders", testId: "nav-orders" },
      { to: "/profile", icon: User, label: "Profile", testId: "nav-profile" },
    ];
  }

  return BASE_NAV;
}

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const nav = navForRole(user?.role);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleLabel = user?.role?.replace("_", " ") || "Customer";

  return (
    <div className="min-h-screen bg-[#F5F9FF] text-[#0F172A] relative">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-[#E5E7EB] bg-white z-30 shadow-sm">
        <div className="p-6 border-b border-[#E5E7EB]">
          <Link to="/" className="flex items-center gap-3" data-testid="brand-logo">
            <div className="w-11 h-11 rounded-xl bg-[#0F4C9C] text-white grid place-items-center shadow-lg">
              <span className="font-black text-2xl">Z</span>
            </div>
            <div>
              <div className="font-display font-black text-[#0F172A] leading-none">ZANSZI</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-[#0F4C9C] mt-1">
                ORDER MANAGEMENT
              </div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={item.testId}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#0F4C9C] text-white shadow-md"
                    : "text-slate-500 hover:text-[#0F4C9C] hover:bg-[#EFF6FF]"
                }`
              }
            >
              <item.icon size={20} weight="duotone" />
              <span className="font-semibold text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
            <Avatar user={user} size={40} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#0F172A] truncate">
                {user?.name || "User"}
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#0F4C9C]">
                {roleLabel}
              </div>
            </div>
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#062B5F] border-b border-blue-900 shadow-md">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3" data-testid="brand-logo-mobile">
            <div className="w-11 h-11 rounded-xl bg-white text-[#0F4C9C] flex items-center justify-center shadow">
              <span className="font-black text-2xl">Z</span>
            </div>

            <div className="flex flex-col leading-none">
              <span className="font-display font-black text-xl text-white">ZANSZI</span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-[#F4B400]">
                ORDER MANAGEMENT
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2"
              >
                <Avatar user={user} size={42} />
                <div className="text-left">
                  <div className="text-sm font-semibold text-white truncate max-w-[80px]">
                    {user?.name?.split(" ")[0] || "User"}
                  </div>
                  <div className="text-[11px] text-[#F4B400] capitalize leading-none">
                    {roleLabel}
                  </div>
                </div>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-14 w-52 rounded-xl bg-white border border-[#E5E7EB] shadow-2xl overflow-hidden z-50">
                  <button
                    onClick={() => {
                      navigate("/profile");
                      setProfileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-[#0F172A] hover:bg-[#EFF6FF]"
                  >
                    👤 My Profile
                  </button>

                  <button
                    onClick={() => {
                      navigate("/orders");
                      setProfileMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-[#0F172A] hover:bg-[#EFF6FF]"
                  >
                    📦 My Orders
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 text-left text-red-600 border-t border-[#E5E7EB] hover:bg-red-50"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-white hover:text-[#F4B400] p-1"
              aria-label="Open menu"
            >
              <List size={30} />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <motion.main
        key={typeof window !== "undefined" ? window.location.pathname : "root"}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="lg:pl-64 pb-24 lg:pb-8 relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </motion.main>

      {/* Mobile Full Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm">
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85%] bg-white border-r border-[#E5E7EB] overflow-y-auto z-50 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-bold text-[#0F172A]">Menu</h2>

              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#0F172A] p-2"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 space-y-2">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-[#0F4C9C] text-white"
                        : "text-slate-500 hover:text-[#0F4C9C] hover:bg-[#EFF6FF]"
                    }`
                  }
                >
                  <item.icon size={20} weight="duotone" />
                  <span>{item.label}</span>
                </NavLink>
              ))}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50"
              >
                <SignOut size={20} />
                Logout
              </button>
            </div>
          </div>

          <div
            className="absolute inset-0 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#062B5F] border-t border-blue-900 shadow-2xl">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {[BASE_NAV[0], BASE_NAV[1], BASE_NAV[2], BASE_NAV[3], BASE_NAV[4]].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              data-testid={`mobile-${item.testId}`}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                  isActive ? "text-white bg-[#0F4C9C]" : "text-blue-100"
                }`
              }
            >
              <item.icon size={20} weight="duotone" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
