import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Circle,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";

const TYPE_META = {
  order_placed: {
    icon: ShoppingBag,
    label: "Order",
    tone: "bg-blue-50 text-blue-700",
  },
  order_confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    tone: "bg-indigo-50 text-indigo-700",
  },
  order_processing: {
    icon: PackageCheck,
    label: "Processing",
    tone: "bg-amber-50 text-amber-700",
  },
  order_assigned: {
    icon: Truck,
    label: "Delivery",
    tone: "bg-cyan-50 text-cyan-700",
  },
  order_out_for_delivery: {
    icon: Truck,
    label: "Out for delivery",
    tone: "bg-purple-50 text-purple-700",
  },
  order_delivered: {
    icon: PackageCheck,
    label: "Delivered",
    tone: "bg-emerald-50 text-emerald-700",
  },
  order_cancelled: {
    icon: Bell,
    label: "Cancelled",
    tone: "bg-rose-50 text-rose-700",
  },
  order_delivery_failed: {
    icon: Bell,
    label: "Delivery failed",
    tone: "bg-red-50 text-red-700",
  },
  announcement: {
    icon: Sparkles,
    label: "Announcement",
    tone: "bg-amber-50 text-amber-700",
  },
  general: {
    icon: Bell,
    label: "Notification",
    tone: "bg-slate-100 text-slate-700",
  },
};

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

export default function CustomerNotifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
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
      setUnreadCount(Number(response.data?.unread_count || 0));
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
        (a, b) =>
          Number(Boolean(a.is_read)) - Number(Boolean(b.is_read)) ||
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
      ),
    [notifications]
  );

  const openNotification = async (notification) => {
    setError("");
    setMessage("");

    try {
      if (!notification.is_read) {
        setWorkingId(notification.notification_id);

        const response = await api.patch(
          `/notifications/${notification.notification_id}/read`
        );

        setNotifications((current) =>
          current.map((item) =>
            item.notification_id === notification.notification_id
              ? response.data
              : item
          )
        );

        setUnreadCount((current) => Math.max(0, current - 1));
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
      await api.patch("/notifications/read-all");

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at || new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
      setMessage("All notifications marked as read.");
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to mark notifications as read."
        )
      );
    }
  };

  const deleteNotification = async (event, notificationId) => {
    event.stopPropagation();

    setWorkingId(notificationId);
    setError("");
    setMessage("");

    try {
      const target = notifications.find(
        (item) => item.notification_id === notificationId
      );

      await api.delete(`/notifications/${notificationId}`);

      setNotifications((current) =>
        current.filter(
          (item) => item.notification_id !== notificationId
        )
      );

      if (target && !target.is_read) {
        setUnreadCount((current) => Math.max(0, current - 1));
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
      setMessage("All notifications cleared.");
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
    <div className="mx-auto max-w-4xl space-y-5 pb-24">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
              <Bell size={24} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                Updates
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
                Notifications
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {unreadCount
                  ? `${unreadCount} unread notification${
                      unreadCount === 1 ? "" : "s"
                    }`
                  : "You are all caught up"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-[#0F4C9C] disabled:opacity-40"
            >
              <CheckCheck size={17} />
              Mark all read
            </button>

            <button
              type="button"
              onClick={clearAll}
              disabled={!notifications.length}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-600 disabled:opacity-40"
            >
              <Trash2 size={17} />
              Clear all
            </button>
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

      {loading ? (
        <section className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[24px] bg-slate-200"
            />
          ))}
        </section>
      ) : sortedNotifications.length ? (
        <section className="space-y-3">
          {sortedNotifications.map((notification) => {
            const meta =
              TYPE_META[notification.notification_type] ||
              TYPE_META.general;
            const Icon = meta.icon;
            const unread = !notification.is_read;

            return (
              <article
                key={notification.notification_id}
                role="button"
                tabIndex={0}
                onClick={() => openNotification(notification)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    openNotification(notification);
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
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${meta.tone}`}
                  >
                    <Icon size={21} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                          {meta.label}
                        </p>

                        <h2 className="mt-1 text-base font-black text-slate-900">
                          {notification.title}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">
                          {formatTime(notification.created_at)}
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
                      {notification.message}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
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
                          workingId === notification.notification_id
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
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-[#0F4C9C]">
            <Bell size={30} />
          </span>

          <h2 className="mt-4 text-xl font-black text-slate-900">
            No notifications yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Order updates, delivery alerts and important ZANSZI
            announcements will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
