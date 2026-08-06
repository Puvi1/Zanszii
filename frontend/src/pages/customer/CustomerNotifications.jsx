import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Circle,
  Gift,
  PackageCheck,
  ShoppingBag,
  Tag,
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
    label: "Delivery",
    tone: "bg-purple-50 text-purple-700",
  },
  order_delivered: {
    icon: PackageCheck,
    label: "Delivered",
    tone: "bg-emerald-50 text-emerald-700",
  },
  coupon: {
    icon: Tag,
    label: "Coupon",
    tone: "bg-amber-50 text-amber-700",
  },
  offer: {
    icon: Gift,
    label: "Offer",
    tone: "bg-pink-50 text-pink-700",
  },
  general: {
    icon: Bell,
    label: "Update",
    tone: "bg-slate-100 text-slate-700",
  },
};

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

export default function CustomerNotifications() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/notifications");
      setNotifications(
        Array.isArray(response.data?.notifications)
          ? response.data.notifications
          : []
      );
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

  const filtered = useMemo(() => {
    const sorted = [...notifications].sort(
      (first, second) =>
        Number(Boolean(first.is_read)) -
          Number(Boolean(second.is_read)) ||
        new Date(second.created_at || 0) -
          new Date(first.created_at || 0)
    );

    if (filter === "unread") {
      return sorted.filter((item) => !item.is_read);
    }

    return sorted;
  }, [notifications, filter]);

  const markAllRead = async () => {
    if (!unreadCount) return;

    try {
      await api.patch("/notifications/read-all");
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          is_read: true,
        }))
      );
      setUnreadCount(0);
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to mark notifications as read."
        )
      );
    }
  };

  const openNotification = async (notification) => {
    try {
      if (!notification.is_read) {
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
    }
  };

  const deleteNotification = async (
    event,
    notification
  ) => {
    event.stopPropagation();

    try {
      await api.delete(
        `/notifications/${notification.notification_id}`
      );

      setNotifications((current) =>
        current.filter(
          (item) =>
            item.notification_id !==
            notification.notification_id
        )
      );

      if (!notification.is_read) {
        setUnreadCount((current) =>
          Math.max(0, current - 1)
        );
      }
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to delete this notification."
        )
      );
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
              <Bell size={22} />
            </span>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                Notifications
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">
                Your updates
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {unreadCount
                  ? `${unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            disabled={!unreadCount}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-[#0F4C9C] disabled:opacity-40"
          >
            <CheckCheck size={15} />
            Mark read
          </button>
        </div>

        <div className="mt-5 inline-flex rounded-xl bg-slate-100 p-1">
          {[
            ["all", "All"],
            ["unread", "Unread"],
          ].map(([value, title]) => (
            <button
              type="button"
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-lg px-4 py-2 text-xs font-black ${
                filter === value
                  ? "bg-white text-[#0F4C9C] shadow-sm"
                  : "text-slate-500"
              }`}
            >
              {title}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-[22px] bg-slate-200"
            />
          ))}
        </div>
      ) : filtered.length ? (
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          {filtered.map((notification, index) => {
            const meta =
              TYPE_META[notification.notification_type] ||
              TYPE_META.general;
            const Icon = meta.icon;

            return (
              <button
                type="button"
                key={notification.notification_id}
                onClick={() => openNotification(notification)}
                className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50 sm:p-5 ${
                  index ? "border-t border-slate-100" : ""
                } ${
                  notification.is_read
                    ? ""
                    : "bg-blue-50/35"
                }`}
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${meta.tone}`}
                >
                  <Icon size={19} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-black text-slate-900">
                      {notification.title}
                    </span>

                    {!notification.is_read && (
                      <Circle
                        size={8}
                        fill="currentColor"
                        className="shrink-0 text-rose-500"
                      />
                    )}
                  </span>

                  <span className="mt-1 line-clamp-2 block text-sm leading-5 text-slate-500">
                    {notification.message}
                  </span>

                  <span className="mt-2 block text-[11px] font-bold text-slate-400">
                    {meta.label} ·{" "}
                    {formatTime(notification.created_at)}
                  </span>
                </span>

                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) =>
                    deleteNotification(event, notification)
                  }
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </span>
              </button>
            );
          })}
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <Bell size={34} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-xl font-black text-slate-900">
            You’re all caught up
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Order, delivery and offer updates will appear here.
          </p>
        </section>
      )}
    </div>
  );
}
