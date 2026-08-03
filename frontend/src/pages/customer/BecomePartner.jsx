import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  FileText,
  ImagePlus,
  MapPin,
  Pencil,
  Phone,
  Send,
  ShieldCheck,
  Store,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

const EMPTY_FORM = {
  business_name: "",
  owner_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  business_type: "",
  description: "",
  logo_url: "",
  banner_url: "",
  address: "",
  city: "",
  state: "Tamil Nadu",
  postal_code: "",
  gst_number: "",
  business_license_url: "",
  pickup_address: "",
};

const STATUS_UI = {
  pending: {
    title: "Application under review",
    description:
      "Your details have been submitted. Our team will review them shortly.",
    icon: Clock3,
    badge: "bg-amber-50 text-amber-700 border-amber-100",
  },
  changes_requested: {
    title: "Changes requested",
    description:
      "Please update the requested details and resubmit your application.",
    icon: Pencil,
    badge: "bg-orange-50 text-orange-700 border-orange-100",
  },
  approved: {
    title: "You are now a ZANSZI Partner",
    description:
      "Your business has been approved and your partner store is ready.",
    icon: BadgeCheck,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  rejected: {
    title: "Application not approved",
    description:
      "Review the admin note below before submitting a new application.",
    icon: XCircle,
    badge: "bg-rose-50 text-rose-700 border-rose-100",
  },
};

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BecomePartner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    owner_name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canEdit = useMemo(
    () =>
      !application ||
      ["pending", "changes_requested"].includes(
        application.status
      ),
    [application]
  );

  useEffect(() => {
    let active = true;

    async function loadApplication() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get(
          "/vendor-applications/me"
        );

        if (!active) return;

        const data = response.data || null;
        setApplication(data);

        if (data) {
          setForm({
            business_name: data.business_name || "",
            owner_name: data.owner_name || user?.name || "",
            phone: data.phone || user?.phone || "",
            whatsapp: data.whatsapp || "",
            email: data.email || user?.email || "",
            business_type: data.business_type || "",
            description: data.description || "",
            logo_url: data.logo_url || "",
            banner_url: data.banner_url || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "Tamil Nadu",
            postal_code: data.postal_code || "",
            gst_number: data.gst_number || "",
            business_license_url:
              data.business_license_url || "",
            pickup_address: data.pickup_address || "",
          });

          setEditing(
            data.status === "changes_requested"
          );
        }
      } catch (requestError) {
        setError(
          formatApiError(
            requestError,
            "Unable to load your partner application."
          )
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplication();

    return () => {
      active = false;
    };
  }, [user]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const phone = form.phone.replace(/\D/g, "");
    const whatsapp = form.whatsapp.replace(/\D/g, "");
    const postalCode = form.postal_code.replace(/\D/g, "");

    if (phone.length !== 10) {
      setError("Mobile number must contain exactly 10 digits.");
      setSaving(false);
      return;
    }

    if (whatsapp && whatsapp.length !== 10) {
      setError("WhatsApp number must contain exactly 10 digits.");
      setSaving(false);
      return;
    }

    const payload = {
      ...form,
      business_name: form.business_name.trim(),
      owner_name: form.owner_name.trim(),
      phone,
      whatsapp: whatsapp || null,
      email: form.email.trim().toLowerCase(),
      business_type: form.business_type.trim(),
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      address: form.address.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      postal_code: postalCode,
      gst_number: form.gst_number.trim() || null,
      business_license_url:
        form.business_license_url.trim() || null,
      pickup_address:
        form.pickup_address.trim() || null,
    };

    try {
      const response = application?.application_id
        ? await api.patch(
            `/vendor-applications/${application.application_id}`,
            payload
          )
        : await api.post(
            "/vendor-applications",
            payload
          );

      setApplication(response.data);
      setEditing(false);
      setMessage(
        application
          ? "Application updated and resubmitted successfully."
          : "Partner application submitted successfully."
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to submit your partner application."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-[28px] bg-slate-200" />
        <div className="h-[520px] animate-pulse rounded-[28px] bg-slate-200" />
      </div>
    );
  }

  if (application && !editing) {
    const status =
      STATUS_UI[application.status] ||
      STATUS_UI.pending;
    const StatusIcon = status.icon;

    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#062B5F] via-[#0F4C9C] to-[#1677D2] p-6 text-white shadow-xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">
                ZANSZI Partner Program
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                {status.title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
                {status.description}
              </p>
            </div>

            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 backdrop-blur">
              <StatusIcon size={28} />
            </span>
          </div>
        </section>

        {message && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
                Application status
              </p>

              <h2 className="mt-1 text-2xl font-black text-slate-900">
                {application.business_name}
              </h2>
            </div>

            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-black capitalize ${status.badge}`}
            >
              {application.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">
                Owner
              </p>
              <p className="mt-1 font-black text-slate-900">
                {application.owner_name}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">
                Business type
              </p>
              <p className="mt-1 font-black text-slate-900">
                {application.business_type}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500">
                Submitted
              </p>
              <p className="mt-1 font-black text-slate-900">
                {formatDate(application.created_at)}
              </p>
            </div>
          </div>

          {application.admin_note && (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                Admin note
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                {application.admin_note}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {application.status ===
              "changes_requested" && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-3 font-black text-white"
              >
                <Pencil size={17} />
                Update application
              </button>
            )}

            {application.status === "approved" && (
              <button
                type="button"
                onClick={() =>
                  navigate("/partner")
                }
                className="inline-flex items-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-3 font-black text-[#062B5F]"
              >
                Open Partner Dashboard
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#062B5F] via-[#0F4C9C] to-[#1677D2] p-6 text-white shadow-xl sm:p-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-100">
              Become a ZANSZI Partner
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Grow your local business online
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
              Create your store, reach more customers and manage
              products, inventory and orders through ZANSZI.
            </p>
          </div>

          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white/10 backdrop-blur">
            <Store size={31} />
          </span>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
            <Building2 size={22} />
          </span>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#0F4C9C]">
              Business details
            </p>
            <h2 className="text-xl font-black text-slate-900">
              Partner application
            </h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-sm font-black text-slate-800">
              Business name
            </span>
            <input
              required
              value={form.business_name}
              onChange={(event) =>
                updateField(
                  "business_name",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label>
            <span className="text-sm font-black text-slate-800">
              Owner name
            </span>
            <input
              required
              value={form.owner_name}
              onChange={(event) =>
                updateField(
                  "owner_name",
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label>
            <span className="text-sm font-black text-slate-800">
              Mobile number
            </span>
            <div className="relative mt-2">
              <Phone
                size={17}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                required
                inputMode="numeric"
                maxLength={10}
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value.replace(/\D/g, "")
                  )
                }
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-[#0F4C9C]"
              />
            </div>
          </label>

          <label>
            <span className="text-sm font-black text-slate-800">
              WhatsApp number
            </span>
            <input
              inputMode="numeric"
              maxLength={10}
              value={form.whatsapp}
              onChange={(event) =>
                updateField(
                  "whatsapp",
                  event.target.value.replace(/\D/g, "")
                )
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              placeholder="Optional"
            />
          </label>

          <label>
            <span className="text-sm font-black text-slate-800">
              Business email
            </span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                updateField("email", event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label>
            <span className="text-sm font-black text-slate-800">
              Business type
            </span>
            <input
              required
              value={form.business_type}
              onChange={(event) =>
                updateField(
                  "business_type",
                  event.target.value
                )
              }
              placeholder="Home care, foods, printing, toys..."
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-sm font-black text-slate-800">
              Business description
            </span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) =>
                updateField(
                  "description",
                  event.target.value
                )
              }
              placeholder="Tell customers what your business offers"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
            />
          </label>
        </div>

        <div className="mt-7 border-t border-slate-200 pt-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <ImagePlus size={20} />
            </span>
            <div>
              <p className="font-black text-slate-900">
                Store branding
              </p>
              <p className="text-xs text-slate-500">
                Logo and banner can be updated later.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-black text-slate-800">
                Logo URL
              </span>
              <input
                type="url"
                value={form.logo_url}
                onChange={(event) =>
                  updateField(
                    "logo_url",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                placeholder="https://..."
              />
            </label>

            <label>
              <span className="text-sm font-black text-slate-800">
                Banner URL
              </span>
              <input
                type="url"
                value={form.banner_url}
                onChange={(event) =>
                  updateField(
                    "banner_url",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                placeholder="https://..."
              />
            </label>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200 pt-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <MapPin size={20} />
            </span>
            <div>
              <p className="font-black text-slate-900">
                Business location
              </p>
              <p className="text-xs text-slate-500">
                Used for verification and pickup planning.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-sm font-black text-slate-800">
                Business address
              </span>
              <textarea
                required
                rows={3}
                value={form.address}
                onChange={(event) =>
                  updateField(
                    "address",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>

            <label>
              <span className="text-sm font-black text-slate-800">
                City
              </span>
              <input
                required
                value={form.city}
                onChange={(event) =>
                  updateField("city", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>

            <label>
              <span className="text-sm font-black text-slate-800">
                State
              </span>
              <input
                required
                value={form.state}
                onChange={(event) =>
                  updateField("state", event.target.value)
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>

            <label>
              <span className="text-sm font-black text-slate-800">
                Pincode
              </span>
              <input
                required
                inputMode="numeric"
                value={form.postal_code}
                onChange={(event) =>
                  updateField(
                    "postal_code",
                    event.target.value.replace(/\D/g, "")
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>

            <label>
              <span className="text-sm font-black text-slate-800">
                Pickup address
              </span>
              <input
                value={form.pickup_address}
                onChange={(event) =>
                  updateField(
                    "pickup_address",
                    event.target.value
                  )
                }
                placeholder="Optional if same as business address"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
              />
            </label>
          </div>
        </div>

        <div className="mt-7 border-t border-slate-200 pt-7">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <FileText size={20} />
            </span>
            <div>
              <p className="font-black text-slate-900">
                Verification details
              </p>
              <p className="text-xs text-slate-500">
                Optional now, but may be requested during review.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-sm font-black text-slate-800">
                GST number
              </span>
              <input
                value={form.gst_number}
                onChange={(event) =>
                  updateField(
                    "gst_number",
                    event.target.value.toUpperCase()
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                placeholder="Optional"
              />
            </label>

            <label>
              <span className="text-sm font-black text-slate-800">
                Business license URL
              </span>
              <input
                type="url"
                value={form.business_license_url}
                onChange={(event) =>
                  updateField(
                    "business_license_url",
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                placeholder="Optional"
              />
            </label>
          </div>
        </div>

        <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={21}
              className="mt-0.5 shrink-0 text-[#0F4C9C]"
            />
            <p className="text-xs leading-5 text-slate-600">
              Submitting this form does not make the store public
              immediately. ZANSZI admin approval is required before
              your business appears in the marketplace.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !canEdit}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white shadow-lg disabled:opacity-60"
        >
          {saving ? (
            "Submitting application..."
          ) : (
            <>
              <Send size={18} />
              {application
                ? "Update and Resubmit"
                : "Submit Partner Application"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
