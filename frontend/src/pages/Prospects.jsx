import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, Target, MagnifyingGlass, X } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { fireConfetti } from "@/lib/confetti";
import { useAuth } from "@/context/AuthContext";

const STATUSES = [
    { key: "new", label: "New", chip: "chip-zinc" },
    { key: "contacted", label: "Contacted", chip: "chip-blue" },
    { key: "qualified", label: "Qualified", chip: "chip-gold" },
    { key: "won", label: "Won", chip: "chip-emerald" },
    { key: "lost", label: "Lost", chip: "chip-red" },
];

export default function Prospects() {
    const { refreshUser } = useAuth();
    const [items, setItems] = useState([]);
    const [q, setQ] = useState("");
    const [filter, setFilter] = useState("all");
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ name: "", contact: "", status: "new", source: "", notes: "" });

    const load = async () => {
        const { data } = await api.get("/prospects");
        setItems(data);
    };
    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/prospects", form);
            fireConfetti({ particleCount: 60 });
            toast.success("Prospect added · +5 XP");
            setModal(false);
            setForm({ name: "", contact: "", status: "new", source: "", notes: "" });
            await load();
            await refreshUser();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to add");
        }
    };

    const updateStatus = async (id, status) => {
        try {
            const { data } = await api.patch(`/prospects/${id}`, { status });
            if (status === "won") {
                fireConfetti({ particleCount: 150, spread: 90 });
                toast.success("Prospect WON! +50 XP");
            } else {
                toast.success(`Marked as ${status}`);
            }
            await load();
            await refreshUser();
        } catch (err) {
            toast.error("Update failed");
        }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this prospect?")) return;
        await api.delete(`/prospects/${id}`);
        toast.success("Prospect removed");
        await load();
    };

    const filtered = items.filter((p) => {
        if (filter !== "all" && p.status !== filter) return false;
        if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
    });

    const counts = STATUSES.reduce((acc, s) => {
        acc[s.key] = items.filter((i) => i.status === s.key).length;
        return acc;
    }, {});

    return (
        <div className="space-y-6" data-testid="prospects-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Pipeline</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Prospecting Arena</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Every contact is XP. Every close is glory.</p>
                </div>
                <button onClick={() => setModal(true)} className="btn-gold" data-testid="add-prospect-btn">
                    <Plus size={18} weight="bold" /> Add Prospect
                </button>
            </div>

            {/* Pipeline stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {STATUSES.map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setFilter(s.key === filter ? "all" : s.key)}
                        className={`glass p-4 text-left transition-all ${filter === s.key ? "ring-2 ring-yellow-500/50" : ""}`}
                        data-testid={`pipeline-filter-${s.key}`}
                    >
                        <div className={s.chip}>{s.label}</div>
                        <div className="font-display text-3xl font-black mt-3">{counts[s.key] || 0}</div>
                    </button>
                ))}
            </div>

            {/* Search + list */}
            <div className="glass p-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1">
                        <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            placeholder="Search prospects..."
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="field pl-11"
                            data-testid="prospect-search"
                        />
                    </div>
                    <button onClick={() => { setFilter("all"); setQ(""); }} className="btn-ghost text-sm">Clear</button>
                </div>

                <div className="space-y-2">
                    {filtered.length === 0 && (
                        <div className="text-center py-12">
                            <Target size={40} weight="duotone" className="text-zinc-700 mx-auto" />
                            <div className="mt-3 text-zinc-500 text-sm">No prospects match — add your first one.</div>
                        </div>
                    )}
                    {filtered.map((p) => {
                        const status = STATUSES.find((s) => s.key === p.status) || STATUSES[0];
                        return (
                            <div key={p.prospect_id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-colors" data-testid={`prospect-row-${p.prospect_id}`}>
                                <div className="flex flex-col md:flex-row md:items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-bold text-white">{p.name}</span>
                                            <span className={status.chip}>{status.label}</span>
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-1 flex flex-wrap gap-x-4">
                                            {p.contact && <span>{p.contact}</span>}
                                            {p.source && <span>via {p.source}</span>}
                                        </div>
                                        {p.notes && <div className="text-xs text-zinc-400 mt-2 italic">&ldquo;{p.notes}&rdquo;</div>}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <select
                                            value={p.status}
                                            onChange={(e) => updateStatus(p.prospect_id, e.target.value)}
                                            className="bg-[#0f0f12] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                                            data-testid={`prospect-status-${p.prospect_id}`}
                                        >
                                            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                        </select>
                                        <button onClick={() => remove(p.prospect_id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(false)}>
                        <motion.form
                            initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}}
                            onSubmit={submit}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-strong p-6 md:p-8 w-full max-w-md relative"
                            data-testid="prospect-modal"
                        >
                            <button type="button" onClick={() => setModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">New target</div>
                            <h3 className="font-display font-black text-2xl mb-6">Add Prospect</h3>
                            <div className="space-y-3">
                                <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="field" data-testid="prospect-name-input" />
                                <input placeholder="Contact (phone / email / handle)" value={form.contact} onChange={(e) => setForm({...form, contact: e.target.value})} className="field" data-testid="prospect-contact-input" />
                                <input placeholder="Source (Instagram, referral, event...)" value={form.source} onChange={(e) => setForm({...form, source: e.target.value})} className="field" />
                                <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className="field">
                                    {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                                <textarea rows={3} placeholder="Notes..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="field resize-none" />
                            </div>
                            <button type="submit" className="btn-gold w-full mt-6" data-testid="prospect-submit-btn">
                                <Plus size={18} weight="bold" /> Add · +5 XP
                            </button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
