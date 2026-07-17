import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChartBar,
  CheckCircle,
  Clock,
  CurrencyInr,
  Package,
  Plus,
  ShoppingCartSimple,
  Storefront,
  Truck,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function getArray(response) {
  const data = response?.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.orders)) {
    return data.orders;
  }

  if (Array.isArray(data?.products)) {
    return data.products;
  }

  if (Array.isArray(data?.users)) {
    return data.users;
  }

  if (Array.isArray(data?.customers)) {
    return data.customers;
  }

  return [];
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusClasses(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "delivered") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized === "out_for_delivery" ||
    normalized === "shipped" ||
    normalized === "assigned"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (
    normalized === "cancelled" ||
    normalized === "rejected"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    normalized === "confirmed" ||
    normalized === "processing"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function displayStatus(status) {
  const normalized = normalizeStatus(status || "pending");

  return normalized
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function Dashboard() {
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState("");

  const role = user?.role || "customer";
  const isAdmin = role === "admin" || role === "super_admin";
  const isManager = role === "manager";

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadMessage("");

    const requests = [
      api.get("/orders"),
      api.get("/products"),
    ];

    if (isAdmin) {
      requests.push(api.get("/users"));
    }

    const results = await Promise.allSettled(requests);

    if (results[0]?.status === "fulfilled") {
      setOrders(getArray(results[0].value));
    } else {
      setOrders([]);
    }

    if (results[1]?.status === "fulfilled") {
      setProducts(getArray(results[1].value));
    } else {
      setProducts([]);
    }

    if (isAdmin && results[2]?.status === "fulfilled") {
      const users = getArray(results[2].value);

      setCustomers(
        users.filter((item) => {
          const itemRole = item?.role || "customer";
          return itemRole === "customer" || itemRole === "member";
        })
      );
    } else {
      setCustomers([]);
    }

    const failedCount = results.filter(
      (result) => result.status === "rejected"
    ).length;

    if (failedCount > 0) {
      setLoadMessage(
        "Some dashboard information is not available yet. The order-management backend will be connected in the next steps."
      );
    }

    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statistics = useMemo(() => {
    const pendingStatuses = [
      "pending",
      "placed",
      "confirmed",
      "processing",
    ];

    const deliveryStatuses = [
      "assigned",
      "shipped",
      "out_for_delivery",
    ];

    const totalOrders = orders.length;

    const pendingOrders = orders.filter((order) =>
      pendingStatuses.includes(normalizeStatus(order?.status))
    ).length;

    const deliveryOrders = orders.filter((order) =>
      deliveryStatuses.includes(normalizeStatus(order?.status))
    ).length;

    const deliveredOrders = orders.filter(
      (order) => normalizeStatus(order?.status) === "delivered"
    ).length;

    const totalRevenue = orders
      .filter(
        (order) =>
          normalizeStatus(order?.status) !== "cancelled"
      )
      .reduce(
        (total, order) =>
          total +
          Number(
            order?.total_amount ??
              order?.total ??
              order?.grand_total ??
              0
          ),
        0
      );

    const lowStockProducts = products.filter((product) => {
      const stock = Number(
        product?.stock ??
          product?.quantity ??
          product?.stock_quantity ??
          0
      );

      const minimumStock = Number(
        product?.minimum_stock ??
          product?.low_stock_limit ??
          5
      );

      return stock <= minimumStock;
    });

    return {
      totalOrders,
      pendingOrders,
      deliveryOrders,
      deliveredOrders,
      totalRevenue,
      lowStockProducts,
    };
  }, [orders, products]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((first, second) => {
        const firstDate = new Date(
          first?.created_at ||
            first?.order_date ||
            first?.date ||
            0
        ).getTime();

        const secondDate = new Date(
          second?.created_at ||
            second?.order_date ||
            second?.date ||
            0
        ).getTime();

        return secondDate - firstDate;
      })
      .slice(0, 6);
  }, [orders]);

  const firstName =
    user?.name?.trim()?.split(/\s+/)[0] || "User";

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dashboardTitle = isAdmin
    ? "Business overview"
    : isManager
    ? "Delivery overview"
    : "Your order dashboard";

  const dashboardDescription = isAdmin
    ? "Monitor products, customer orders, deliveries and business performance."
    : isManager
    ? "Review assigned orders and keep every delivery updated."
    : "Browse cleaning products, place orders and track your deliveries.";

  if (loading) {
    return (
      <div
        className="flex min-h-[55vh] items-center justify-center"
        data-testid="dashboard-loading"
      >
        <div className="text-center">
          <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-[#0F4C9C]" />

          <p className="mt-4 text-sm font-semibold text-slate-500">
            Loading Zanszii dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 lg:space-y-8"
      data-testid="dashboard-page"
    >
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl bg-[#062B5F] p-6 text-white shadow-xl md:p-8"
      >
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#0F4C9C] opacity-70 blur-3xl" />

        <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#F4B400] opacity-10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#F4B400]">
              {today}
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              Welcome back,{" "}
              <span className="text-[#F4B400]">
                {firstName}.
              </span>
            </h1>

            <h2 className="mt-3 text-xl font-bold text-blue-100">
              {dashboardTitle}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80 md:text-base">
              {dashboardDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {isAdmin && (
              <Link
                to="/admin/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-5 py-3 text-sm font-bold text-[#062B5F] shadow-lg transition hover:bg-yellow-400"
              >
                <Plus size={18} weight="bold" />
                Add Product
              </Link>
            )}

            {isManager && (
              <Link
                to="/delivery"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-5 py-3 text-sm font-bold text-[#062B5F] shadow-lg transition hover:bg-yellow-400"
              >
                <Truck size={19} weight="duotone" />
                Delivery Queue
              </Link>
            )}

            {!isAdmin && !isManager && (
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4B400] px-5 py-3 text-sm font-bold text-[#062B5F] shadow-lg transition hover:bg-yellow-400"
              >
                <Storefront size={19} weight="duotone" />
                Browse Products
              </Link>
            )}

            <Link
              to="/orders"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              View Orders
              <ArrowRight size={17} weight="bold" />
            </Link>
          </div>
        </div>
      </motion.section>

      {loadMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <WarningCircle
            size={22}
            weight="duotone"
            className="mt-0.5 shrink-0 text-amber-600"
          />

          <div>
            <p className="text-sm font-bold text-amber-800">
              Dashboard setup in progress
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-700">
              {loadMessage}
            </p>
          </div>
        </div>
      )}

      <section
        className={`grid gap-4 ${
          isAdmin
            ? "grid-cols-2 lg:grid-cols-5"
            : "grid-cols-2 lg:grid-cols-4"
        }`}
      >
        <DashboardStatCard
          icon={ShoppingCartSimple}
          label="Total Orders"
          value={statistics.totalOrders}
          description="All orders"
          tone="blue"
        />

        <DashboardStatCard
          icon={Clock}
          label="Pending"
          value={statistics.pendingOrders}
          description="Needs action"
          tone="amber"
        />

        <DashboardStatCard
          icon={Truck}
          label="Delivery"
          value={statistics.deliveryOrders}
          description="In progress"
          tone="purple"
        />

        <DashboardStatCard
          icon={CheckCircle}
          label="Delivered"
          value={statistics.deliveredOrders}
          description="Completed"
          tone="emerald"
        />

        {isAdmin && (
          <DashboardStatCard
            icon={CurrencyInr}
            label="Revenue"
            value={formatCurrency(statistics.totalRevenue)}
            description="Order value"
            tone="gold"
            compact
          />
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 md:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0F4C9C]">
                Latest activity
              </p>

              <h3 className="mt-1 text-xl font-black text-[#062B5F]">
                Recent Orders
              </h3>
            </div>

            <Link
              to="/orders"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#0F4C9C] hover:underline"
            >
              See all
              <ArrowRight size={16} />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 md:px-6">
                      Order
                    </th>

                    <th className="px-5 py-3">
                      Customer
                    </th>

                    <th className="px-5 py-3">
                      Date
                    </th>

                    <th className="px-5 py-3">
                      Amount
                    </th>

                    <th className="px-5 py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentOrders.map((order, index) => {
                    const orderId =
                      order?.order_number ||
                      order?.order_id ||
                      order?.id ||
                      `ORD-${index + 1}`;

                    const customerName =
                      order?.customer_name ||
                      order?.customer?.name ||
                      order?.user_name ||
                      "Customer";

                    const amount =
                      order?.total_amount ??
                      order?.total ??
                      order?.grand_total ??
                      0;

                    const date =
                      order?.created_at ||
                      order?.order_date ||
                      order?.date;

                    return (
                      <tr
                        key={`${orderId}-${index}`}
                        className="text-sm text-slate-700 transition hover:bg-blue-50/40"
                      >
                        <td className="whitespace-nowrap px-5 py-4 font-bold text-[#062B5F] md:px-6">
                          #{orderId}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          {customerName}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                          {formatDate(date)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 font-bold">
                          {formatCurrency(amount)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                              order?.status
                            )}`}
                          >
                            {displayStatus(order?.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={ShoppingCartSimple}
              title="No orders yet"
              description={
                isAdmin || isManager
                  ? "Customer orders will appear here once they are placed."
                  : "Browse products and place your first Zanszii order."
              }
              actionLabel={
                isAdmin || isManager
                  ? "View Orders"
                  : "Browse Products"
              }
              actionPath={
                isAdmin || isManager
                  ? "/orders"
                  : "/products"
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0F4C9C]">
                  Quick access
                </p>

                <h3 className="mt-1 text-xl font-black text-[#062B5F]">
                  Actions
                </h3>
              </div>

              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-[#0F4C9C]">
                <Storefront size={24} weight="duotone" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {!isManager && (
                <QuickAction
                  icon={Package}
                  label={
                    isAdmin
                      ? "Manage Products"
                      : "Browse Products"
                  }
                  description={
                    isAdmin
                      ? "Add and update stock"
                      : "Explore cleaning products"
                  }
                  to={
                    isAdmin
                      ? "/admin/products"
                      : "/products"
                  }
                />
              )}

              <QuickAction
                icon={ShoppingCartSimple}
                label={
                  isAdmin
                    ? "Manage Orders"
                    : isManager
                    ? "Assigned Orders"
                    : "My Orders"
                }
                description={
                  isAdmin
                    ? "Review all customer orders"
                    : isManager
                    ? "View orders assigned to you"
                    : "Track your order history"
                }
                to={isAdmin ? "/admin/orders" : "/orders"}
              />

              {(isAdmin || isManager) && (
                <QuickAction
                  icon={Truck}
                  label="Delivery Queue"
                  description="Update delivery progress"
                  to="/delivery"
                />
              )}

              {isAdmin && (
                <QuickAction
                  icon={ChartBar}
                  label="Business Reports"
                  description="Review order performance"
                  to="/reports"
                />
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0F4C9C]">
                    Business records
                  </p>

                  <h3 className="mt-1 text-xl font-black text-[#062B5F]">
                    Store Summary
                  </h3>
                </div>

                <Users
                  size={29}
                  weight="duotone"
                  className="text-[#F4B400]"
                />
              </div>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Products"
                  value={products.length}
                />

                <SummaryRow
                  label="Customers"
                  value={customers.length}
                />

                <SummaryRow
                  label="Low-stock products"
                  value={statistics.lowStockProducts.length}
                  warning={
                    statistics.lowStockProducts.length > 0
                  }
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {isAdmin &&
        statistics.lowStockProducts.length > 0 && (
          <section className="rounded-2xl border border-red-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-red-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
                  <WarningCircle
                    size={25}
                    weight="duotone"
                  />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
                    Stock warning
                  </p>

                  <h3 className="mt-1 text-xl font-black text-[#062B5F]">
                    Low-stock products
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Update these products before they become
                    unavailable.
                  </p>
                </div>
              </div>

              <Link
                to="/admin/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
              >
                Manage Stock
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
              {statistics.lowStockProducts
                .slice(0, 6)
                .map((product, index) => {
                  const productId =
                    product?.product_id ||
                    product?.id ||
                    index;

                  const stock = Number(
                    product?.stock ??
                      product?.quantity ??
                      product?.stock_quantity ??
                      0
                  );

                  return (
                    <div
                      key={productId}
                      className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/50 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[#062B5F]">
                          {product?.name ||
                            product?.product_name ||
                            "Product"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Current stock
                        </p>
                      </div>

                      <span className="ml-3 rounded-lg bg-white px-3 py-1.5 text-sm font-black text-red-600 shadow-sm">
                        {stock}
                      </span>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
    </div>
  );
}

function DashboardStatCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
  compact = false,
}) {
  const toneClasses = {
    blue: {
      icon: "bg-blue-50 text-[#0F4C9C]",
      border: "hover:border-blue-200",
    },
    amber: {
      icon: "bg-amber-50 text-amber-600",
      border: "hover:border-amber-200",
    },
    purple: {
      icon: "bg-purple-50 text-purple-600",
      border: "hover:border-purple-200",
    },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      border: "hover:border-emerald-200",
    },
    gold: {
      icon: "bg-yellow-50 text-[#C99000]",
      border: "hover:border-yellow-200",
    },
  };

  const selectedTone = toneClasses[tone] || toneClasses.blue;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition md:p-5 ${selectedTone.border}`}
    >
      <div
        className={`grid h-11 w-11 place-items-center rounded-xl ${selectedTone.icon}`}
      >
        <Icon size={24} weight="duotone" />
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 font-black tracking-tight text-[#062B5F] ${
          compact
            ? "text-xl md:text-2xl"
            : "text-3xl"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </motion.div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  to,
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/60"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F5F9FF] text-[#0F4C9C] transition group-hover:bg-white">
        <Icon size={21} weight="duotone" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#062B5F]">
          {label}
        </p>

        <p className="mt-0.5 truncate text-xs text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight
        size={17}
        className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#0F4C9C]"
      />
    </Link>
  );
}

function SummaryRow({ label, value, warning = false }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-slate-500">
        {label}
      </span>

      <span
        className={`text-base font-black ${
          warning ? "text-red-600" : "text-[#062B5F]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionPath,
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
        <Icon size={32} weight="duotone" />
      </div>

      <h4 className="mt-5 text-lg font-black text-[#062B5F]">
        {title}
      </h4>

      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>

      <Link
        to={actionPath}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0B3D7D]"
      >
        {actionLabel}
        <ArrowRight size={16} weight="bold" />
      </Link>
    </div>
  );
}
