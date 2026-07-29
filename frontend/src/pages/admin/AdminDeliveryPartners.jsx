import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bike,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  ClipboardList,
  Edit3,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  phone: "",
  avatar_url: "",
  vehicle_type: "Bike",
  vehicle_number: "",
  license_number: "",
  availability_status: "available",
  active: true,
};

const availabilityStyles = {
  available: "bg-emerald-100 text-emerald-700",
  busy: "bg-amber-100 text-amber-700",
  offline: "bg-slate-200 text-slate-600",
};

const orderStatusStyles = {
  placed: "bg-slate-100 text-slate-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-violet-100 text-violet-700",
  assigned: "bg-amber-100 text-amber-700",
  out_for_delivery: "bg-orange-100 text-orange-700",
  delivered: "bg-emerald-100 text-emerald-700",
  delivery_failed: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
};

function getErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong"
  );
}

function formatLabel(value = "") {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function DeliveryPartnerModal({
  open,
  editingPartner,
  form,
  setForm,
  saving,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Delivery Management
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {editingPartner
                ? "Edit Delivery Partner"
                : "Add Delivery Partner"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Full Name
              </span>

              <input
                required
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Enter partner name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Phone Number
              </span>

              <input
                required
                name="phone"
                value={form.phone}
                onChange={updateField}
                maxLength={10}
                inputMode="numeric"
                placeholder="10-digit mobile number"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Email Address
              </span>

              <input
                required
                type="email"
                name="email"
                value={form.email}
                onChange={updateField}
                disabled={Boolean(editingPartner)}
                placeholder="partner@example.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none disabled:bg-slate-100 focus:border-orange-500"
              />
            </label>

            {!editingPartner && (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Login Password
                </span>

                <input
                  required
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={updateField}
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
                />
              </label>
            )}

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Vehicle Type
              </span>

              <select
                name="vehicle_type"
                value={form.vehicle_type}
                onChange={updateField}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
              >
                <option value="Bike">Bike</option>
                <option value="Scooter">Scooter</option>
                <option value="Cycle">Cycle</option>
                <option value="Car">Car</option>
                <option value="Van">Van</option>
                <option value="Auto">Auto</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Vehicle Number
              </span>

              <input
                required
                name="vehicle_number"
                value={form.vehicle_number}
                onChange={updateField}
                placeholder="TN 10 AB 1234"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-orange-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                License Number
              </span>

              <input
                required
                name="license_number"
                value={form.license_number}
                onChange={updateField}
                placeholder="Driving license number"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-orange-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Profile Image URL
              </span>

              <input
                name="avatar_url"
                value={form.avatar_url}
                onChange={updateField}
                placeholder="Optional image URL"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
              />
            </label>

            {editingPartner && (
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Availability
                </span>

                <select
                  name="availability_status"
                  value={form.availability_status}
                  onChange={updateField}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
                >
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </label>
            )}
          </div>

          {editingPartner && (
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={updateField}
                className="h-5 w-5 accent-orange-500"
              />

              <span>
                <span className="block font-semibold text-slate-800">
                  Active Account
                </span>

                <span className="text-sm text-slate-500">
                  Inactive partners cannot receive new orders.
                </span>
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 border-t pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}

              {editingPartner ? "Save Changes" : "Add Partner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignOrderModal({
  open,
  partner,
  orders,
  selectedOrderId,
  setSelectedOrderId,
  assigning,
  onClose,
  onAssign,
}) {
  if (!open || !partner) return null;

  const assignableOrders = orders.filter(
    (order) =>
      !["delivered", "cancelled"].includes(order.status) &&
      order.delivery_partner_id !== partner.user_id
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-600">
              Order Assignment
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Assign Order to {partner.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Select Order
            </span>

            <div className="relative">
              <select
                value={selectedOrderId}
                onChange={(event) => setSelectedOrderId(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-300 px-4 py-3 pr-10 outline-none focus:border-orange-500"
              >
                <option value="">Choose an order</option>

                {assignableOrders.map((order) => (
                  <option key={order.order_id} value={order.order_id}>
                    {order.order_number || order.order_id} —{" "}
                    {order.customer_name} — ₹{Number(order.total || 0).toFixed(2)}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={18}
                className="pointer-events-none absolute right-4 top-4 text-slate-500"
              />
            </div>
          </label>

          {!assignableOrders.length && (
            <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              No assignable orders are currently available.
            </div>
          )}

          <div className="flex justify-end gap-3 border-t pt-5">
            <button
              onClick={onClose}
              disabled={assigning}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold"
            >
              Cancel
            </button>

            <button
              onClick={onAssign}
              disabled={!selectedOrderId || assigning}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {assigning && <Loader2 size={18} className="animate-spin" />}
              Assign Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [message, setMessage] = useState(null);

  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedOrderId, setSelectedOrderId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);

    try {
      const [partnerResponse, orderResponse] = await Promise.all([
        api.get("/admin/delivery-partners"),
        api.get("/admin/orders"),
      ]);

      setPartners(partnerResponse.data?.delivery_partners || []);
      setOrders(Array.isArray(orderResponse.data) ? orderResponse.data : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPartners = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return partners.filter((partner) => {
      const matchesSearch =
        !normalizedSearch ||
        partner.name?.toLowerCase().includes(normalizedSearch) ||
        partner.email?.toLowerCase().includes(normalizedSearch) ||
        partner.phone?.includes(normalizedSearch) ||
        partner.vehicle_number?.toLowerCase().includes(normalizedSearch);

      const matchesAvailability =
        availabilityFilter === "all" ||
        partner.availability_status === availabilityFilter;

      const matchesActive =
        activeFilter === "all" ||
        String(partner.active) === activeFilter;

      return matchesSearch && matchesAvailability && matchesActive;
    });
  }, [partners, search, availabilityFilter, activeFilter]);

  const statistics = useMemo(() => {
    return {
      total: partners.length,
      available: partners.filter(
        (partner) =>
          partner.active && partner.availability_status === "available"
      ).length,
      activeDeliveries: partners.reduce(
        (sum, partner) => sum + Number(partner.assigned_orders || 0),
        0
      ),
      completed: partners.reduce(
        (sum, partner) => sum + Number(partner.completed_deliveries || 0),
        0
      ),
    };
  }, [partners]);

  const openCreateModal = () => {
    setEditingPartner(null);
    setForm(EMPTY_FORM);
    setPartnerModalOpen(true);
  };

  const openEditModal = (partner) => {
    setEditingPartner(partner);

    setForm({
      name: partner.name || "",
      email: partner.email || "",
      password: "",
      phone: partner.phone || "",
      avatar_url: partner.avatar_url || "",
      vehicle_type: partner.vehicle_type || "Bike",
      vehicle_number: partner.vehicle_number || "",
      license_number: partner.license_number || "",
      availability_status: partner.availability_status || "available",
      active: partner.active !== false,
    });

    setPartnerModalOpen(true);
  };

  const submitPartner = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (editingPartner) {
        await api.patch(
          `/admin/delivery-partners/${editingPartner.user_id}`,
          {
            name: form.name.trim(),
            phone: form.phone.trim(),
            avatar_url: form.avatar_url.trim() || null,
            vehicle_type: form.vehicle_type,
            vehicle_number: form.vehicle_number.trim().toUpperCase(),
            license_number: form.license_number.trim().toUpperCase(),
            availability_status: form.availability_status,
            active: form.active,
          }
        );

        setMessage({
          type: "success",
          text: "Delivery partner updated successfully.",
        });
      } else {
        await api.post("/admin/delivery-partners", {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          avatar_url: form.avatar_url.trim() || null,
          vehicle_type: form.vehicle_type,
          vehicle_number: form.vehicle_number.trim().toUpperCase(),
          license_number: form.license_number.trim().toUpperCase(),
        });

        setMessage({
          type: "success",
          text: "Delivery partner created successfully.",
        });
      }

      setPartnerModalOpen(false);
      setEditingPartner(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePartner = async (partner) => {
    const confirmed = window.confirm(
      `Delete ${partner.name}? Active orders must be reassigned before deletion.`
    );

    if (!confirmed) return;

    try {
      await api.delete(`/admin/delivery-partners/${partner.user_id}`);

      setMessage({
        type: "success",
        text: "Delivery partner deleted successfully.",
      });

      await loadData();
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error),
      });
    }
  };

  const openAssignModal = (partner) => {
    setSelectedPartner(partner);
    setSelectedOrderId("");
    setAssignModalOpen(true);
  };

  const assignOrder = async () => {
    if (!selectedOrderId || !selectedPartner) return;

    setAssigning(true);

    try {
      await api.patch(
        `/admin/orders/${selectedOrderId}/assign-delivery-partner`,
        {
          delivery_partner_id: selectedPartner.user_id,
        }
      );

      setMessage({
        type: "success",
        text: `Order assigned to ${selectedPartner.name}.`,
      });

      setAssignModalOpen(false);
      setSelectedPartner(null);
      setSelectedOrderId("");
      await loadData();
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error),
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-950 p-6 text-white md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-400">
              Zanszii Operations
            </p>

            <h1 className="mt-2 text-3xl font-bold">
              Delivery Partner Management
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Add delivery partners, manage availability, and assign specific
              orders.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 font-semibold hover:bg-slate-800"
            >
              <RefreshCw
                size={18}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold hover:bg-orange-600"
            >
              <Plus size={19} />
              Add Partner
            </button>
          </div>
        </header>

        {message && (
          <div
            className={`rounded-2xl px-5 py-4 font-medium ${
              message.type === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Total Partners",
              value: statistics.total,
              icon: Users,
            },
            {
              label: "Available",
              value: statistics.available,
              icon: UserCheck,
            },
            {
              label: "Active Deliveries",
              value: statistics.activeDeliveries,
              icon: Truck,
            },
            {
              label: "Completed Deliveries",
              value: statistics.completed,
              icon: PackageCheck,
            },
          ].map(({ label, value, icon: Icon }) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {value}
                  </p>
                </div>

                <div className="rounded-2xl bg-orange-50 p-3 text-orange-600">
                  <Icon size={24} />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_190px_170px]">
            <div className="relative">
              <Search
                size={19}
                className="absolute left-4 top-3.5 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, phone or vehicle number"
                className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-orange-500"
              />
            </div>

            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
            >
              <option value="all">All Availability</option>
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>

            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-orange-500"
            >
              <option value="all">All Accounts</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 size={34} className="animate-spin text-orange-500" />
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <CircleOff size={42} className="text-slate-300" />
              <h3 className="mt-4 text-xl font-bold text-slate-800">
                No delivery partners found
              </h3>
              <p className="mt-2 text-slate-500">
                Add your first delivery partner or change the filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">Partner</th>
                    <th className="px-5 py-4">Vehicle</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Deliveries</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredPartners.map((partner) => (
                    <tr key={partner.user_id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          {partner.avatar_url ? (
                            <img
                              src={partner.avatar_url}
                              alt={partner.name}
                              className="h-12 w-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-700">
                              {partner.name?.charAt(0)?.toUpperCase()}
                            </div>
                          )}

                          <div>
                            <p className="font-bold text-slate-900">
                              {partner.name}
                            </p>

                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <Phone size={12} />
                              {partner.phone || "No phone"}
                            </p>

                            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <Mail size={12} />
                              {partner.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <p className="flex items-center gap-2 font-semibold text-slate-800">
                          <Bike size={17} className="text-orange-500" />
                          {partner.vehicle_type || "Vehicle"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {partner.vehicle_number || "Not provided"}
                        </p>
                      </td>

                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                            availabilityStyles[
                              partner.availability_status || "offline"
                            ]
                          }`}
                        >
                          {formatLabel(
                            partner.availability_status || "offline"
                          )}
                        </span>

                        {!partner.active && (
                          <p className="mt-2 text-xs font-semibold text-red-600">
                            Account inactive
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <div className="space-y-1 text-sm">
                          <p className="text-slate-700">
                            Active:{" "}
                            <strong>{partner.assigned_orders || 0}</strong>
                          </p>
                          <p className="text-emerald-700">
                            Completed:{" "}
                            <strong>
                              {partner.completed_deliveries || 0}
                            </strong>
                          </p>
                          <p className="text-red-600">
                            Failed:{" "}
                            <strong>{partner.failed_deliveries || 0}</strong>
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openAssignModal(partner)}
                            disabled={!partner.active}
                            title="Assign order"
                            className="rounded-xl bg-orange-50 p-2.5 text-orange-600 hover:bg-orange-100 disabled:opacity-40"
                          >
                            <ClipboardList size={18} />
                          </button>

                          <button
                            onClick={() => openEditModal(partner)}
                            title="Edit partner"
                            className="rounded-xl bg-blue-50 p-2.5 text-blue-600 hover:bg-blue-100"
                          >
                            <Edit3 size={18} />
                          </button>

                          <button
                            onClick={() => deletePartner(partner)}
                            title="Delete partner"
                            className="rounded-xl bg-red-50 p-2.5 text-red-600 hover:bg-red-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Recently Assigned Orders
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {orders
                  .filter((order) => order.delivery_partner_id)
                  .slice(0, 10)
                  .map((order) => (
                    <tr key={order.order_id}>
                      <td className="px-4 py-4 font-semibold">
                        {order.order_number || order.order_id}
                      </td>

                      <td className="px-4 py-4">
                        <p>{order.customer_name}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                          <MapPin size={12} />
                          {order.city}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        {order.delivery_partner_name || "Not assigned"}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            orderStatusStyles[order.status] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {formatLabel(order.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 font-semibold">
                        ₹{Number(order.total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}

                {!orders.some((order) => order.delivery_partner_id) && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No orders have been assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <DeliveryPartnerModal
        open={partnerModalOpen}
        editingPartner={editingPartner}
        form={form}
        setForm={setForm}
        saving={saving}
        onClose={() => setPartnerModalOpen(false)}
        onSubmit={submitPartner}
      />

      <AssignOrderModal
        open={assignModalOpen}
        partner={selectedPartner}
        orders={orders}
        selectedOrderId={selectedOrderId}
        setSelectedOrderId={setSelectedOrderId}
        assigning={assigning}
        onClose={() => setAssignModalOpen(false)}
        onAssign={assignOrder}
      />
    </div>
  );
}
