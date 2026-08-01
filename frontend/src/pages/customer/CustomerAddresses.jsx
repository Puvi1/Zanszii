import { useEffect, useState } from "react";
import {
  Briefcase,
  CheckCircle,
  Edit3,
  Home,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";

const EMPTY_FORM = {
  label: "Home",
  full_name: "",
  phone: "",
  address: "",
  city: "",
  state: "Tamil Nadu",
  postal_code: "",
  landmark: "",
  is_default: false,
};

const LABEL_ICONS = {
  Home,
  Office: Briefcase,
  Other: MapPin,
};

export default function CustomerAddresses() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAddresses = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/addresses");
      setAddresses(
        Array.isArray(response.data) ? response.data : []
      );
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to load saved addresses."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openNewAddress = () => {
    setEditingId("");
    setForm({
      ...EMPTY_FORM,
      is_default: addresses.length === 0,
    });
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const editAddress = (address) => {
    setEditingId(address.address_id);
    setForm({
      label: address.label || "Home",
      full_name: address.full_name || "",
      phone: address.phone || "",
      address: address.address || "",
      city: address.city || "",
      state: address.state || "Tamil Nadu",
      postal_code: address.postal_code || "",
      landmark: address.landmark || "",
      is_default: Boolean(address.is_default),
    });
    setMessage("");
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId("");
    setForm(EMPTY_FORM);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...form,
        phone: form.phone.replace(/\D/g, ""),
        postal_code: form.postal_code.replace(/\D/g, ""),
      };

      if (editingId) {
        await api.patch(`/addresses/${editingId}`, payload);
        setMessage("Address updated successfully.");
      } else {
        await api.post("/addresses", payload);
        setMessage("Address added successfully.");
      }

      closeForm();
      await loadAddresses();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to save this address."
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (address) => {
    const confirmed = window.confirm(
      `Delete ${address.label || "this"} address?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      await api.delete(`/addresses/${address.address_id}`);
      setMessage("Address deleted.");
      await loadAddresses();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to delete this address."
        )
      );
    }
  };

  const makeDefault = async (address) => {
    if (address.is_default) return;

    setError("");
    setMessage("");

    try {
      await api.patch(
        `/addresses/${address.address_id}/default`
      );
      setMessage(`${address.label} set as default address.`);
      await loadAddresses();
    } catch (requestError) {
      setError(
        formatApiError(
          requestError,
          "Unable to set default address."
        )
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-24">
      <section className="rounded-[28px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <MapPin size={28} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Delivery details
              </p>

              <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                Address Book
              </h1>

              <p className="mt-1 text-sm text-blue-100">
                Save Home, Office and other delivery addresses.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openNewAddress}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F4B400] px-5 py-3 text-sm font-black text-[#062B5F]"
          >
            <Plus size={18} />
            Add Address
          </button>
        </div>
      </section>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          <CheckCircle size={18} />
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-[24px] bg-slate-200"
            />
          ))}
        </section>
      ) : addresses.length ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => {
            const Icon =
              LABEL_ICONS[address.label] || MapPin;

            return (
              <article
                key={address.address_id}
                className={`relative rounded-[24px] border bg-white p-5 shadow-sm ${
                  address.is_default
                    ? "border-[#0F4C9C] ring-2 ring-blue-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
                    <Icon size={21} />
                  </span>

                  {address.is_default && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                      <Star size={13} fill="currentColor" />
                      Default
                    </span>
                  )}
                </div>

                <h2 className="mt-4 text-lg font-black text-slate-900">
                  {address.label}
                </h2>

                <p className="mt-2 font-bold text-slate-800">
                  {address.full_name}
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {address.address}
                  {address.landmark
                    ? `, Near ${address.landmark}`
                    : ""}
                  <br />
                  {address.city}, {address.state} -{" "}
                  {address.postal_code}
                </p>

                <p className="mt-2 text-sm font-semibold text-slate-500">
                  Phone: {address.phone}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => editAddress(address)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-[#0F4C9C]"
                  >
                    <Edit3 size={16} />
                    Edit
                  </button>

                  {!address.is_default && (
                    <button
                      type="button"
                      onClick={() => makeDefault(address)}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-black text-emerald-700"
                    >
                      <Star size={16} />
                      Set Default
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => removeAddress(address)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 text-xs font-black text-rose-600"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-[#0F4C9C]">
            <MapPin size={30} />
          </span>

          <h2 className="mt-4 text-xl font-black text-slate-900">
            No saved addresses
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add an address once and select it quickly during checkout.
          </p>

          <button
            type="button"
            onClick={openNewAddress}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0F4C9C] px-5 py-3 text-sm font-black text-white"
          >
            <Plus size={17} />
            Add your first address
          </button>
        </section>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[30px] bg-white p-5 shadow-2xl sm:rounded-[30px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#0F4C9C]">
                  {editingId ? "Update address" : "New address"}
                </p>

                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  {editingId
                    ? "Edit saved address"
                    : "Add delivery address"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-500"
              >
                <X size={19} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="text-sm font-black text-slate-800">
                  Address type
                </span>

                <select
                  value={form.label}
                  onChange={(event) =>
                    updateField("label", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                >
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Full name
                </span>

                <input
                  required
                  value={form.full_name}
                  onChange={(event) =>
                    updateField("full_name", event.target.value)
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Mobile number
                </span>

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
                  maxLength={12}
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

              <label className="sm:col-span-2">
                <span className="text-sm font-black text-slate-800">
                  Full address
                </span>

                <textarea
                  required
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  placeholder="Door number, street and area"
                  className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#0F4C9C]"
                />
              </label>

              <label>
                <span className="text-sm font-black text-slate-800">
                  Landmark
                </span>

                <input
                  value={form.landmark}
                  onChange={(event) =>
                    updateField("landmark", event.target.value)
                  }
                  placeholder="Optional"
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

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(event) =>
                    updateField(
                      "is_default",
                      event.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                <span className="text-sm font-black text-slate-800">
                  Set as default address
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-2xl bg-[#0F4C9C] px-5 py-4 font-black text-white disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Address"
                  : "Save Address"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
            }
