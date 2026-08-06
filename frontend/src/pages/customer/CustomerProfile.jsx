import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  ClipboardList,
  Crown,
  FileText,
  Heart,
  HelpCircle,
  LogOut,
  Mail,
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

const SECTIONS = [
  {
    title: "My Account",
    items: [
      {
        to: "/orders",
        label: "My Orders",
        icon: ClipboardList,
      },
      {
        to: "/addresses",
        label: "My Addresses",
        icon: MapPin,
      },
      {
        to: "/wishlist",
        label: "My Wishlist",
        icon: Heart,
      },
      {
        to: "/offers",
        label: "My Coupons",
        icon: Tag,
      },
      {
        to: "/notifications",
        label: "Notifications",
        icon: Bell,
      },
      {
        to: "/become-partner",
        label: "Become a ZANSZI Partner",
        icon: BriefcaseBusiness,
        accent: true,
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        to: "/support",
        label: "Help & Support",
        icon: HelpCircle,
      },
      {
        to: "mailto:support@zanszii.com",
        label: "Contact Us",
        icon: Mail,
        external: true,
      },
    ],
  },
  {
    title: "About",
    items: [
      {
        to: "/privacy",
        label: "Privacy Policy",
        icon: ShieldCheck,
      },
      {
        to: "/terms",
        label: "Terms & Conditions",
        icon: FileText,
      },
    ],
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
      address:
        typeof user?.address === "string"
          ? user.address
          : "",
      city: user?.city || "",
      state: user?.state || "",
      postal_code: user?.postal_code || "",
    });
  }, [user]);

  const initials = (user?.name || "Z")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]:
        field === "phone" ||
        field === "postal_code"
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
      setError(
        "Mobile number must contain exactly 10 digits."
      );
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-amber-300 bg-[#062B5F] text-2xl font-black text-white">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black text-slate-950">
              {user?.name || "Customer"}
            </h1>

            <p className="mt-1 truncate text-sm text-slate-500">
              {user?.phone || user?.email || "ZANSZI customer"}
            </p>

            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setError("");
                setMessage("");
              }}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#062B5F] px-3 py-2 text-xs font-black text-white"
            >
              <Pencil size={14} />
              Edit Profile
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-[22px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-[#062B5F]">
              <Crown size={22} />
            </span>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-100">
                ZANSZI Club
              </p>
              <p className="mt-1 font-black">
                Gold Member
              </p>
            </div>
          </div>

          <Link
            to="/offers"
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#062B5F]"
          >
            View Benefits
          </Link>
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

      {SECTIONS.map((section) => (
        <section
          key={section.title}
          className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
        >
          <p className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
            {section.title}
          </p>

          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-100">
            {section.items.map(
              ({
                to,
                label,
                icon: Icon,
                external,
                accent,
              }, index) => {
                const className = `flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 ${
                  index ? "border-t border-slate-100" : ""
                }`;

                const content = (
                  <>
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                        accent
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-[#0F4C9C]"
                      }`}
                    >
                      <Icon size={17} />
                    </span>

                    <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-800">
                      {label}
                    </span>

                    <ChevronRight
                      size={17}
                      className="shrink-0 text-slate-300"
                    />
                  </>
                );

                return external ? (
                  <a
                    key={label}
                    href={to}
                    className={className}
                  >
                    {content}
                  </a>
                ) : (
                  <Link
                    key={label}
                    to={to}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              }
            )}
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={signOut}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-5 py-4 font-black text-rose-600 shadow-sm"
      >
        <LogOut size={18} />
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
                onChange={(value) =>
                  updateField("name", value)
                }
                required
              />

              <Field
                label="Mobile number"
                value={form.phone}
                onChange={(value) =>
                  updateField("phone", value)
                }
                inputMode="numeric"
                maxLength={10}
              />

              <Field
                label="City"
                value={form.city}
                onChange={(value) =>
                  updateField("city", value)
                }
              />

              <Field
                label="State"
                value={form.state}
                onChange={(value) =>
                  updateField("state", value)
                }
              />

              <Field
                label="Pincode"
                value={form.postal_code}
                onChange={(value) =>
                  updateField("postal_code", value)
                }
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
                    updateField(
                      "address",
                      event.target.value
                    )
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
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
      />
    </label>
  );
}
