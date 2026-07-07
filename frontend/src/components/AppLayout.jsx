import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
    House, Target, Phone, Trophy, User, ChartLine,
    Sword, SignOut, ShieldStar, Fire, List, X,
    Users, UsersThree, ChartBar, Crosshair, CalendarCheck, ClipboardText, MedalMilitary, Gift, Flag,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import NotificationBell from "@/components/NotificationBell";
import Avatar from "@/components/Avatar";

const BASE_NAV = [
    { to: "/", icon: House, label: "Dashboard", testId: "nav-dashboard" },
    { to: "/products", icon: Target, label: "Products", testId: "nav-products" },
    { to: "/orders", icon: ClipboardText, label: "Orders", testId: "nav-orders" },
    { to: "/delivery", icon: CalendarCheck, label: "Delivery", testId: "nav-delivery" },
    { to: "/reports", icon: ChartBar, label: "Reports", testId: "nav-reports" },
    { to: "/profile", icon: User, label: "Profile", testId: "nav-profile" },
];
const ADMIN_PRODUCTS_NAV = { to: "/admin/products", icon: Target, label: "Manage Products", testId: "nav-admin-products" };
const ADMIN_ORDERS_NAV = { to: "/admin/orders", icon: ClipboardText, label: "Manage Orders", testId: "nav-admin-orders" };
const ADMIN_CUSTOMERS_NAV = { to: "/admin/customers", icon: Users, label: "Customers", testId: "nav-admin-customers" };
const ADMIN_MANAGERS_NAV = { to: "/admin/managers", icon: UsersThree, label: "Managers", testId: "nav-admin-managers" };

function navForRole(role) {
    if (role === "super_admin" || role === "admin") {
        return [
            ...BASE_NAV,
            ADMIN_PRODUCTS_NAV,
            ADMIN_ORDERS_NAV,
            ADMIN_CUSTOMERS_NAV,
            ADMIN_MANAGERS_NAV,
        ];
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
    return (
        <div className="min-h-screen bg-[#050507] text-white relative">
            {/* Ambient glow */}
            <div className="pointer-events-none fixed inset-0 radial-gold" />

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-white/5 bg-[#08080b]/80 backdrop-blur-xl z-30">
                <div className="p-6 border-b border-white/5">
                    <Link to="/" className="flex items-center gap-3" data-testid="brand-logo">
                        <div className="w-10 h-10 rounded-xl bg-yellow-500 text-black grid place-items-center shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                            <Sword size={22} weight="fill" />
                        </div>
                        <div>
                            <div className="font-display font-black text-white leading-none">ZANSZI</div>
                            <div className="text-[10px] uppercase tracking-[0.3em] text-yellow-500/80 mt-1">ORDER MANAGEMENT</div>
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
                                        ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                                        : "text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent"
                                }`
                            }
                        >
                            <item.icon size={20} weight="duotone" />
                            <span className="font-semibold text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <Avatar user={user} size={40} />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate" data-testid="sidebar-user-name">{user?.name}</div>
                            <div className="text-[10px] uppercase tracking-widest text-yellow-500/80">
                                {user?.role?.replace("_", " ")}
                            </div>
                        </div>
                        <NotificationBell />
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            data-testid="sidebar-logout-btn"
                            title="Logout"
                        >
                            <SignOut size={18} />
                        </button>
                    </div>
                </div>
            </aside>

      {/* Mobile Top Bar */}
<header className="lg:hidden sticky top-0 z-30 bg-[#08080b]/95 backdrop-blur-xl border-b border-white/5">
    <div className="flex items-center justify-between px-4 py-3">

        {/* Left - Logo */}
        <Link
            to="/"
            className="flex items-center gap-3"
            data-testid="brand-logo-mobile"
        >
            <div className="w-11 h-11 rounded-xl bg-yellow-500 text-black flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.45)]">
                <Sword size={22} weight="fill" />
            </div>

            <div className="flex flex-col leading-none">
                <span className="font-display font-black text-xl text-white">
                    ZANSZI
                </span>

                <span className="text-[10px] uppercase tracking-[0.25em] text-yellow-400">
                    ORDER MANAGEMENT
                </span>
            </div>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-3">

            <div className="relative">

                <button
                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                    className="flex items-center gap-2"
                >
                    <Avatar user={user} size={42} />

                    <div className="text-left">
                        <div className="text-sm font-semibold text-white truncate max-w-[80px]">
                            {user?.name?.split(" ")[0]}
                        </div>

                        <div className="text-[11px] text-yellow-400 capitalize leading-none">
                            {user?.club_type || "Converter"}
                        </div>
                    </div>
                </button>

                {profileMenuOpen && (
                    <div className="absolute right-0 top-14 w-52 rounded-xl bg-[#111111] border border-white/10 shadow-2xl overflow-hidden z-50">

                        <button
                            onClick={() => {
                                navigate("/profile");
                                setProfileMenuOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-white/5"
                        >
                            👤 My Profile
                        </button>

                        <button
                            onClick={() => {
                                navigate("/rewards");
                                setProfileMenuOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-white/5"
                        >
                            🏆 My Rewards
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-3 text-left text-red-400 border-t border-white/10 hover:bg-red-500/10"
                        >
                            🚪 Logout
                        </button>

                    </div>
                )}

            </div>

            <button
                onClick={() => setMobileMenuOpen(true)}
                className="text-zinc-300 hover:text-yellow-400 p-1"
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
  <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
   <div className="absolute left-0 top-0 h-full w-80 max-w-[85%] bg-[#08080b] border-r border-white/10 overflow-y-auto z-50">

      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-bold text-white">Menu</h2>

        <button
          onClick={() => setMobileMenuOpen(false)}
          className="text-white p-2"
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
                  ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`
            }
          >
            <item.icon size={20} weight="duotone" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10"
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
            <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#08080b]/95 backdrop-blur-2xl border-t border-white/10">
                <div className="grid grid-cols-5 gap-1 px-2 py-2">
                   {[
   {[
    BASE_NAV[0],
    BASE_NAV[1],
    BASE_NAV[2],
    BASE_NAV[3],
    BASE_NAV[5],
].map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            data-testid={`mobile-${item.testId}`}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 py-2 rounded-xl transition-all ${
                                    isActive ? "text-yellow-400 bg-yellow-500/10" : "text-zinc-500"
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
