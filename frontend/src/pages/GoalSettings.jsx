import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, Plus, X, PencilSimple, Trash, ArrowClockwise, Users, CheckCircle, Sparkle, Target } from "@phosphor-icons/react";
import { Navigate } from "react-router-dom";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";

const emptyForm = {
    title: "",
    target: 5,
    xp_reward: 100,
    period: "weekly",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
    active: true,
};

export default function GoalSettings() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [tab, setTab] = useState("weekly");
    const [modal, setModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busy, setBusy] = useState(false);

    const load = async () => {
        const { data } = await api.get("/admin/goal-templates");
        setTemplates(data);
    };
    useEffect(() => {
        if (user?.role === "super_admin") load();
    }, [user]);

    if (user && user.role !== "super_admin") {
        return <Navigate to="/goals" replace />;
    }

    const openCreate = (period) => {
        setEditing(null);
        setForm({
            ...emptyForm,
            period,
            end_date: period === "monthly"
                ? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
                : new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        });
        setModal(true);
    };

    const openEdit = (t) => {
        setEditing(t);
        setForm({
            title: t.title,
            target: t.target,
            xp_reward: t.xp_reward,
            period: t.period,
            start_date: t.start_date,
            end_date: t.end_date,
            active: t.active,
        });
        setModal(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            const payload = { ...form, target: Number(form.target), xp_reward: Number(form.xp_reward) };
            if (editing) {
                await api.patch(`/admin/goal-templates/${editing.template_id}`, payload);
                toast.success("Goal updated & pushed to all members");
            } else {
                const { data } = await api.post("/admin/goal-templates", payload);
                toast.success(`Goal created · assigned to ${data.assigned_to} spartans`);
            }
            setModal(false);
            await load();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to save goal");
        } finally { setBusy(false); }
    };

    const toggleActive = async (t) => {
        try {
            await api.patch(`/admin/goal-templates/${t.template_id}`, { active: !t.active });
            toast.success(t.active ? "Goal paused" : "Goal reactivated");
            await load();
        } catch { toast.error("Failed to toggle"); }
    };

    const resync = async (t) => {
        try {
            const { data } = await api.post(`/admin/goal-templates/${t.template_id}/resync`);
            toast.success(`Re-synced · ${data.assigned_to} new spartan(s) received it`);
            await load();
        } catch { toast.error("Re-sync failed"); }
    };

    const remove = async (t) => {
        if (!window.confirm(`Delete "${t.title}"? Open member goals will be removed (completed history preserved).`)) return;
        try {
            await api.delete(`/admin/goal-templates/${t.template_id}`);
            toast.success("Goal template deleted");
            await load();
        } catch { toast.error("Delete failed"); }
    };

    const weekly = templates.filter((t) => t.period === "weekly");
    const monthly = templates.filter((t) => t.period === "monthly");
    const activeList = tab === "weekly" ? weekly : monthly;
    const totalActive = templates.filter((t) => t.active).length;
    const totalAssigned = templates.reduce((s, t) => s + (t.assigned_count || 0), 0);
    const totalCompleted = templates.reduce((s, t) => s + (t.completed_count || 0), 0);

    return (
        <div className="space-y-8" data-testid="goal-settings-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Command config</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Goal Settings</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Push weekly & monthly targets to every Spartan on the roster. XP awarded automatically on completion.</p>
                </div>
                <button onClick={() => openCreate(tab)} className="btn-gold" data-testid="new-goal-template-btn">
                    <Plus size={18} weight="bold" /> New {tab === "weekly" ? "Weekly" : "Monthly"} Goal
                </button>
            </div>

            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Flag} label="Templates" value={templates.length} tone="gold" testId="gt-total" />
                <StatCard icon={CheckCircle} label="Active" value={totalActive} tone="emerald" testId="gt-active" />
                <StatCard icon={Users} label="Assigned" value={totalAssigned} tone="blue" testId="gt-assigned" />
                <StatCard icon={Sparkle} label="Completed" value={totalCompleted} tone="zinc" testId="gt-completed" />
            </section>

            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
                {[
                    { key: "weekly", label: "Weekly", n: weekly.length },
                    { key: "monthly", label: "Monthly", n: monthly.length },
                ].map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2 ${tab === t.key ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"}`}
                        data-testid={`gt-tab-${t.key}`}
                    >
                        {t.label} <span className="opacity-70">({t.n})</span>
                    </button>
                ))}
            </div>

            <div className="glass p-4">
                {activeList.length === 0 && (
                    <div className="text-center py-16">
                        <Flag size={48} weight="duotone" className="text-zinc-700 mx-auto" />
                        <div className="text-zinc-500 mt-4 text-sm">No {tab} goal templates yet.</div>
                        <button onClick={() => openCreate(tab)} className="btn-gold mt-4">
                            <Plus size={16} weight="bold" /> Create your first {tab} goal
                        </button>
                    </div>
                )}
                {activeList.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px]">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
                                    <th className="text-left py-2 px-3">Title</th>
                                    <th className="text-left py-2 px-3">Target</th>
                                    <th className="text-left py-2 px-3">XP Reward</th>
                                    <th className="text-left py-2 px-3">Window</th>
                                    <th className="text-left py-2 px-3 min-w-[160px]">Completion</th>
                                    <th className="text-left py-2 px-3">Status</th>
                                    <th className="text-right py-2 px-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeList.map((t) => {
                                    const pct = t.assigned_count ? Math.round((t.completed_count / t.assigned_count) * 100) : 0;
                                    return (
                                        <motion.tr key={t.template_id} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }} className="border-t border-white/5" data-testid={`gt-row-${t.template_id}`}>
                                            <td className="py-3 px-3">
                                                <div className="font-semibold">{t.title}</div>
                                                <div className="text-[10px] text-zinc-500 mt-0.5">
                                                    Assigned to <span className="text-yellow-400 font-mono">{t.assigned_count}</span> · Completed by <span className="text-emerald-400 font-mono">{t.completed_count}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <span className="chip-blue"><Target size={10} weight="fill" /> {t.target}</span>
                                            </td>
                                            <td className="py-3 px-3 font-mono text-yellow-400 text-sm">+{t.xp_reward} XP</td>
                                            <td className="py-3 px-3 text-[10px] text-zinc-400">
                                                {t.start_date}<br/>→ {t.end_date}
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2">
                                                    <ProgressBar value={pct} max={100} color="gold" />
                                                    <span className="text-xs font-mono text-zinc-400 w-10 text-right">{pct}%</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3">
                                                <button
                                                    onClick={() => toggleActive(t)}
                                                    className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md transition-colors ${t.active ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25"}`}
                                                    data-testid={`gt-toggle-${t.template_id}`}
                                                >
                                                    {t.active ? "Active" : "Inactive"}
                                                </button>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => resync(t)} className="p-1.5 rounded-lg text-yellow-400 hover:bg-yellow-500/10" title="Re-sync to new members" data-testid={`gt-resync-${t.template_id}`}>
                                                        <ArrowClockwise size={14} weight="bold" />
                                                    </button>
                                                    <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10" title="Edit" data-testid={`gt-edit-${t.template_id}`}>
                                                        <PencilSimple size={14} weight="bold" />
                                                    </button>
                                                    <button onClick={() => remove(t)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10" title="Delete" data-testid={`gt-delete-${t.template_id}`}>
                                                        <Trash size={14} weight="bold" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(false)}>
                        <motion.form
                            initial={{scale:0.9}} animate={{scale:1}}
                            onSubmit={submit}
                            onClick={(e)=>e.stopPropagation()}
                            className="glass-strong p-6 md:p-8 w-full max-w-lg relative"
                            data-testid="gt-modal"
                        >
                            <button type="button" onClick={() => setModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">{editing ? "Edit goal" : "Create goal"}</div>
                            <h3 className="font-display font-black text-2xl mb-6">{form.period === "weekly" ? "Weekly" : "Monthly"} Goal Template</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Title *</label>
                                    <input required minLength={1} value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} placeholder="e.g. Add 10 prospects" className="field" data-testid="gt-form-title" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Target *</label>
                                        <input required type="number" min={1} value={form.target} onChange={(e)=>setForm({...form, target: e.target.value})} className="field font-mono" data-testid="gt-form-target" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">XP Reward</label>
                                        <input required type="number" min={0} value={form.xp_reward} onChange={(e)=>setForm({...form, xp_reward: e.target.value})} className="field font-mono" data-testid="gt-form-xp" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Period</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {["weekly", "monthly"].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setForm({...form, period: p})}
                                                className={`p-3 rounded-xl border text-sm font-bold uppercase tracking-widest transition-all ${form.period === p ? "bg-yellow-500/10 border-yellow-500/60 text-yellow-400" : "bg-white/[0.02] border-white/10 text-zinc-500 hover:text-white"}`}
                                                data-testid={`gt-form-period-${p}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Start Date *</label>
                                        <input required type="date" value={form.start_date} onChange={(e)=>setForm({...form, start_date: e.target.value})} className="field" data-testid="gt-form-start" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">End Date *</label>
                                        <input required type="date" value={form.end_date} min={form.start_date} onChange={(e)=>setForm({...form, end_date: e.target.value})} className="field" data-testid="gt-form-end" />
                                    </div>
                                </div>
                                <label className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 cursor-pointer">
                                    <input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active: e.target.checked})} className="w-4 h-4" data-testid="gt-form-active" />
                                    <div>
                                        <div className="text-sm font-bold">Active</div>
                                        <div className="text-[10px] text-zinc-500">Inactive goals stop being assigned; existing member goals stay.</div>
                                    </div>
                                </label>
                            </div>
                            <button type="submit" disabled={busy} className="btn-gold w-full mt-6 disabled:opacity-60" data-testid="gt-form-submit">
                                <Flag size={16} weight="bold" /> {busy ? "Saving..." : editing ? "Update Goal" : "Push To All Spartans"}
                            </button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
