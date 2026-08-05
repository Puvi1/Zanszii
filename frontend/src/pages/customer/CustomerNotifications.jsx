import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock3,
  Filter,
  Gift,
  Megaphone,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Truck,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";

const TYPE_META = {
  order_placed: {
    icon: ShoppingBag,
    label: "Order",
    category: "orders",
    tone: "bg-blue-50 text-blue-700",
  },
  order_confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    category: "orders",
    tone: "bg-indigo-50 text-indigo-700",
  },
  order_processing: {
    icon: PackageCheck,
    label: "Processing",
    category: "orders",
    tone: "bg-amber-50 text-amber-700",
  },
  order_assigned: {
    icon: Truck,
    label: "Delivery",
    category: "orders",
    tone: "bg-cyan-50 text-cyan-700",
  },
  order_out_for_delivery: {
    icon: Truck,
    label: "Out for delivery",
    category: "orders",
    tone: "bg-purple-50 text-purple-700",
  },
  order_delivered: {
    icon: PackageCheck,
    label: "Delivered",
    category: "orders",
    tone: "bg-emerald-50 text-emerald-700",
  },
  order_cancelled: {
    icon: Bell,
    label: "Cancelled",
    category: "orders",
    tone: "bg-rose-50 text-rose-700",
  },
  order_delivery_failed: {
    icon: Bell,
    label: "Delivery failed",
    category: "orders",
    tone: "bg-red-50 text-red-700",
  },
  coupon: {
    icon: Tag,
    label: "Coupon",
    category: "offers",
    tone: "bg-amber-50 text-amber-700",
  },
  offer: {
    icon: Gift,
    label: "Offer",
    category: "offers",
    tone: "bg-pink-50 text-pink-700",
  },
  announcement: {
    icon: Megaphone,
    label: "Announcement",
    category: "updates",
    tone: "bg-orange-50 text-orange-700",
  },
  general: {
    icon: Bell,
    label: "Notification",
    category: "updates",
    tone: "bg-slate-100 text-slate-700",
  },
};

const FILTERS = [
  ["all", "All"],
  ["unread", "Unread"],
  ["orders", "Orders"],
  ["offers", "Offers"],
  ["updates", "Updates"],
];

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function groupLabel(value) {
  const date = new Date(value);
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const target = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const diffDays = Math.round(
    (today - target) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

export default function CustomerNotifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/notifications");
      const list = Array.isArray(response.data?.notifications)
        ? response.data.notifications
        : [];

      setNotifications(list);
      setUnreadCount(
        Number(response.data?.unread_count || 0)
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to load notifications."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (first, second) =>
          Number(Boolean(first.is_read)) -
            Number(Boolean(second.is_read)) ||
          new Date(second.created_at || 0) -
            new Date(first.created_at || 0)
      ),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return sortedNotifications.filter(
      (notification) => {
        const meta =
          TYPE_META[
            notification.notification_type
          ] || TYPE_META.general;

        if (filter === "all") return true;
        if (filter === "unread") {
          return !notification.is_read;
        }

        return meta.category === filter;
      }
    );
  }, [sortedNotifications, filter]);

  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce(
      (groups, notification) => {
        const key = groupLabel(
          notification.created_at
        );

        groups[key] = [
          ...(groups[key] || []),
          notification,
        ];

        return groups;
      },
      {}
    );
  }, [filteredNotifications]);

  const counts = useMemo(() => {
    const result = {
      all: notifications.length,
      unread: unreadCount,
      orders: 0,
      offers: 0,
      updates: 0,
    };

    notifications.forEach((notification) => {
      const meta =
        TYPE_META[
          notification.notification_type
        ] || TYPE_META.general;

      result[meta.category] =
        (result[meta.category] || 0) + 1;
    });

    return result;
  }, [notifications, unreadCount]);

  const openNotification = async (
    notification
  ) => {
    setError("");
    setMessage("");

    try {
      if (!notification.is_read) {
        setWorkingId(
          notification.notification_id
        );

        const response = await api.patch(
          `/notifications/${notification.notification_id}/read`
        );

        setNotifications((current) =>
          current.map((item) =>
            item.notification_id ===
            notification.notification_id
              ? response.data
              : item
          )
        );

        setUnreadCount((current) =>
          Math.max(0, current - 1)
        );
      }

      if (notification.link) {
        navigate(notification.link);
      }
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to open this notification."
        )
      );
    } finally {
      setWorkingId("");
    }
  };

  const markAllRead = async () => {
    if (!unreadCount) return;

    setError("");
    setMessage("");

    try {
      await api.patch(
        "/notifications/read-all"
      );

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at:
            item.read_at ||
            new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
      setMessage(
        "All notifications marked as read."
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to mark notifications as read."
        )
      );
    }
  };

  const deleteNotification = async (
    event,
    notificationId
  ) => {
    event.stopPropagation();

    setWorkingId(notificationId);
    setError("");
    setMessage("");

    try {
      const target = notifications.find(
        (item) =>
          item.notification_id ===
          notificationId
      );

      await api.delete(
        `/notifications/${notificationId}`
      );

      setNotifications((current) =>
        current.filter(
          (item) =>
            item.notification_id !==
            notificationId
        )
      );

      if (target && !target.is_read) {
        setUnreadCount((current) =>
          Math.max(0, current - 1)
        );
      }

      setMessage("Notification deleted.");
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to delete this notification."
        )
      );
    } finally {
      setWorkingId("");
    }
  };

  const clearAll = async () => {
    if (!notifications.length) return;

    const confirmed = window.confirm(
      "Clear all notifications?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await api.delete("/notifications");
      setNotifications([]);
      setUnreadCount(0);
      setMessage(
        "All notifications cleared."
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to clear notifications."
        )
      );
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#041F46] via-[#062B5F] to-[#0F4C9C] p-5 text-white shadow-[0_24px_70px_rgba(6,43,95,0.25)] sm:p-7">
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-[20px] bg-white/15 backdrop-blur">
              <Bell size={27} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Notification center
              </p>

              <h1 className="mt-1 text-3xl font-black sm:text-4xl">
                Stay updated
              </h1>

              <p className="mt-1 text-sm text-blue-100">
                {unreadCount
                  ? `${unreadCount} unread notification${
                      unreadCount === 1
                        ? ""
                        : "s"
                    }`
                  : "You are all caught up"}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <SummaryCard
              icon={Bell}
              label="Unread"
              value={unreadCount}
            />

            <SummaryCard
              icon={ShoppingBag}
              label="Orders"
              value={counts.orders}
            />

            <SummaryCard
              icon={Sparkles}
              label="Offers"
              value={counts.offers}
            />
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map(([value, title]) => (
              <button
                type="button"
                key={value}
                onClick={() => setFilter(value)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
                  filter === value
                    ? "bg-[#0F4C9C] text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {value === "all" ? (
                  <Filter size={14} />
                ) : value === "orders" ? (
                  <ShoppingBag size={14} />
                ) : value === "offers" ? (
                  <Gift size={14} />
                ) : value === "updates" ? (
                  <Megaphone size={14} />
                ) : (
                  <Circle size={10} />
                )}

                {title}

                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] ${
                    filter === value
                      ? "bg-white/15"
                      : "bg-slate-100"
                  }`}
                >
                  {counts[value] || 0}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadNotifications}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={
                  loading ? "animate-spin" : ""
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-[#0F4C9C] disabled:opacity-40"
            >
              <CheckCheck size={15} />
              Mark all read
            </button>

            <button
              type="button"
              onClick={clearAll}
              disabled={!notifications.length}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 disabled:opacity-40"
            >
              <Trash2 size={15} />
              Clear all
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="space-y-3">
          {Array.from({ length: 5 }).map(
            (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-[24px] bg-slate-200"
              />
            )
          )}
        </section>
      ) : filteredNotifications.length ? (
        <section className="space-y-6">
          {["Today", "Yesterday", "Earlier"]
            .filter(
              (group) =>
                groupedNotifications[group]?.length
            )
            .map((group) => (
              <div key={group}>
                <div className="mb-3 flex items-center gap-2">
                  <Clock3
                    size={15}
                    className="text-slate-400"
                  />
                  <h2 className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                    {group}
                  </h2>
                </div>

                <div className="space-y-3">
                  {groupedNotifications[
                    group
                  ].map((notification) => {
                    const meta =
                      TYPE_META[
                        notification.notification_type
                      ] || TYPE_META.general;

                    const Icon = meta.icon;
                    const unread =
                      !notification.is_read;

                    return (
                      <article
                        key={
                          notification.notification_id
                        }
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          openNotification(
                            notification
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key === " "
                          ) {
                            openNotification(
                              notification
                            );
                          }
                        }}
                        className={`relative cursor-pointer overflow-hidden rounded-[24px] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${
                          unread
                            ? "border-blue-200 ring-1 ring-blue-50"
                            : "border-slate-200"
                        }`}
                      >
                        {unread && (
                          <span className="absolute inset-y-0 left-0 w-1 bg-[#0F4C9C]" />
                        )}

                        <div className="flex items-start gap-4">
                          <span
                            className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${meta.tone}`}
                          >
                            <Icon size={22} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                    {meta.label}
                                  </p>

                                  {unread && (
                                    <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black text-[#0F4C9C]">
                                      New
                                    </span>
                                  )}
                                </div>

                                <h3 className="mt-1 text-base font-black text-slate-900">
                                  {
                                    notification.title
                                  }
                                </h3>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <span className="text-[11px] font-semibold text-slate-400">
                                  {formatTime(
                                    notification.created_at
                                  )}
                                </span>

                                {unread ? (
                                  <Circle
                                    size={10}
                                    fill="currentColor"
                                    className="text-[#0F4C9C]"
                                  />
                                ) : (
                                  <CheckCircle2
                                    size={15}
                                    className="text-emerald-500"
                                  />
                                )}
                              </div>
                            </div>

                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {
                                notification.message
                              }
                            </p>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                              <span className="text-xs font-black text-[#0F4C9C]">
                                {notification.link
                                  ? "Open details"
                                  : unread
                                    ? "Mark as read"
                                    : "Read"}
                              </span>

                              <button
                                type="button"
                                onClick={(event) =>
                                  deleteNotification(
                                    event,
                                    notification.notification_id
                                  )
                                }
                                disabled={
                                  workingId ===
                                  notification.notification_id
                                }
                                aria-label="Delete notification"
                                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
        </section>
      ) : (
        <section className="rounded-[30px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-blue-50 text-[#0F4C9C]">
            <Bell size={34} />
          </span>

          <h2 className="mt-5 text-2xl font-black text-slate-900">
            You’re all caught up
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            We’ll notify you about order updates,
            deliveries, coupons, offers and important
            ZANSZI announcements.
          </p>

          {filter !== "all" && (
            <button
              type="button"
              onClick={() => setFilter("all")}
              className="mt-5 inline-flex rounded-xl bg-[#0F4C9C] px-4 py-2.5 text-xs font-black text-white"
            >
              View all notifications
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-[18px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <Icon
        size={17}
        className="text-blue-200"
      />

      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-blue-200">
        {label}
      </p>

      <strong className="mt-1 block text-xl font-black">
        {value}
      </strong>
    </div>
  );
}
