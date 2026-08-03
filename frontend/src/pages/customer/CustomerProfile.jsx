import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  Heart,
  LogOut,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  Tag,
  User,
  X,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const ACCOUNT_LINKS = [
  {
    to: "/orders",
    title: "My Orders",
    subtitle: "Track, review and reorder",
    icon: ClipboardList,
    tone: "bg-blue-50 text-blue-700",
  },
  {
    to: "/wishlist",
    title: "Wishlist",
    subtitle: "Products you saved",
    icon: Heart,
    tone: "bg-rose-50 text-rose-600",
  },
  {
    to: "/addresses",
    title: "Saved Addresses",
    subtitle: "Manage delivery locations",
    icon: MapPin,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/offers",
    title: "Offers & Coupons",
    subtitle: "View available savings",
    icon: Tag,
    tone: "bg-amber-50 text-amber-700",
  },
  {
    to: "/notifications",
    title: "Notifications",
    subtitle: "Order and delivery updates",
    icon: Bell,
    tone: "bg-purple-50 text-purple-700",
  },
];

export default function CustomerProfile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
  });

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      address: user?.address || "",
      city: user?.city || "",
      state: user?.state || "",
      postal_code: user?.postal_code || "",
    });
  }, [user]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]:
        field === "phone" || field === "postal_code"
          ? value.replace(/\D/g, "")
          : value,
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    if (form.name.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (form.phone && form.phone.length !== 10) {
      setError("Mobile number must contain exactly 10 digits.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api.patch("/profile", {
        ...form,
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        postal_code: form.postal_code.trim(),
      });

      await refreshUser();
      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to update your profile."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  const initials = (user?.name || "Z")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white/15 text-2xl font-black backdrop-blur">
              {initials}
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                My Account
              </p>

              <h1 className="mt-1 text-3xl font-black">
                Hi, {user?.name || "Customer"}
              </h1>

              <p className="mt-1 text-sm text-blue-100">
                Manage orders, offers, addresses and profile details
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setError("");
              setMessage("");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-[#062B5F]"
          >
            <Pencil size={17} />
            Edit Profile
          </button>
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}

      {error && !editing && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACCOUNT_LINKS.map(({ to, title, subtitle, icon: Icon, tone }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}>
                <Icon size={21} />
              </span>

              <ChevronRight
                size={19}
                className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#0F4C9C]"
              />
            </div>

            <h2 className="mt-4 font-black text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-[#0F4C9C]">
            <User size={21} />
          </span>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
              Account Information
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-900">
              Personal details
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Info label="Full Name" value={user?.name || "Not added"} />
          <Info label="Email" value={user?.email || "Not added"} />
          <Info label="Mobile" value={user?.phone || "Not added"} />
          <Info
            label="Location"
            value={
              [user?.city, user?.state].filter(Boolean).join(", ") ||
              "Not added"
            }
          />
        </div>

        <div className="mt-5 rounded-2xl bg-[#F7F9FC] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={20}
              className="mt-0.5 shrink-0 text-emerald-600"
            />

            <div>
              <p className="font-black text-slate-900">
                Secure account
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Your personal information is used only for account and delivery purposes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 font-black text-rose-600"
      >
        <LogOut size={19} />
        Logout
      </button>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 backdrop-blur-sm sm:items-center sm:p-5">
          <form
            onSubmit={saveProfile}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                  Account
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  Edit profile
                </h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                value={form.name}
                onChange={(value) => updateField("name", value)}
                required
              />

              <Field
                label="Mobile number"
                value={form.phone}
                onChange={(value) => updateField("phone", value)}
                inputMode="numeric"
                maxLength={10}
              />

              <Field
                label="City"
                value={form.city}
                onChange={(value) => updateField("city", value)}
              />

              <Field
                label="State"
                value={form.state}
                onChange={(value) => updateField("state", value)}
              />

              <Field
                label="Pincode"
                value={form.postal_code}
                onChange={(value) => updateField("postal_code", value)}
                inputMode="numeric"
                maxLength={12}
              />

              <label className="sm:col-span-2">
                <span className="text-sm font-black text-slate-800">
                  Delivery address
                </span>
                <textarea
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  inputMode,
  maxLength,
}) {
  return (
    <label>
      <span className="text-sm font-black text-slate-800">
        {label}
      </span>
      <input
        required={required}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
      />
    </label>
  );
}
