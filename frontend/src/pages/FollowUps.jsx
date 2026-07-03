import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Check, Trash, Phone, X, ClockCountdown } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { fireConfetti } from "@/lib/confetti";
import { useAuth } from "@/context/AuthContext";

function urgencyOf(dueDate, status) {
    if (status === "done") return { chip: "chip-emerald", label: "Done" };
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(dueDate);
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) return { chip: "chip-red", label: "Overdue" };
    if (diff === 0) return { chip: "chip-gold", label: "Today" };
    if (diff <= 2) return { chip: "chip-blue", label: "Soon" };
    return { chip: "chip-zinc", label: "Upcoming" };
}

export default function FollowUps() {
    const { refreshUser } = useAuth();
    const [items, setItems] = useState([]);
    const [modal, setModal] = useState(false);
    const [prospects, setProspects] = useState([]);
    const [form, setForm] = useState({ title: "", due_date: new Date().toISOString().slice(0, 10), prospect_id: "", notes: "" });

    const load = async () => {
        const { data } = await api.get("/followups");
        setItems(data);
        const { data: p } = await api.get("/prospects");
        setProspects(p);
    };
    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form };
            if (!payload.prospect_id) delete payload.prospect_id;
            await api.post("/followups", payload);
            toast.success("Follow-up scheduled");
            setModal(false);
            setForm({ title: "", due_date: new Date().toISOString().slice(0, 10), prospect_id: "", notes: "" });
            await load();
        } catch (err) {
            toast.error("Failed to add");
        }
    };

    const markDone = async (id) => {
        await api.patch(`/followups/${id}`, { status: "done" });
        fireConfetti({ particleCount: 80 });
        toast.success("Crushed it. +8 XP");
        await load();
        await refreshUser();
    };
    const remove = async (id) => {
        await api.delete(`/followups/${id}`);
        toast.success("Removed");
        await load();
    };

    const pending = items.filter((f) => f.status !== "done");
    const done = items.filter((f) => f.status === "done").slice(0, 20);

    return (
        <div className="space-y-6" data-testid="followups-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Persistence</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Follow-Up Tracker</h1>
                    <p className="text-zinc-400 mt-2 text-sm">The fortune is in the follow-up.</p>
                </div>
                <button onClick={() => setModal(true)} className="btn-gold" data-testid="add-followup-btn">
                    <Plus size={18} weight="bold" /> Schedule Follow-Up
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="glass p-4">
                    <div className="chip-gold">Pending</div>
                    <div className="font-display text-3xl font-black mt-3">{pending.length}</div>
                </div>
                <div className="glass p-4">
                    <div className="chip-red">Overdue</div>
                    <div className="font-display text-3xl font-black mt-3">
                        {pending.filter((f) => urgencyOf(f.due_date, f.status).label === "Overdue").length}
                    </div>
                </div>
                <div className="glass p-4">
                    <div className="chip-emerald">Completed</div>
                    <div className="font-display text-3xl font-black mt-3">{items.filter((f) => f.status === "done").length}</div>
                </div>
            </div>

            <div className="glass p-4">
                <h3 className="font-display font-bold text-lg mb-4">Active</h3>
                <div className="space-y-2">
                    {pending.length === 0 && (
                        <div className="text-center py-10">
                            <Phone size={40} weight="duotone" className="text-zinc-700 mx-auto" />
                            <div className="text-zinc-500 mt-3 text-sm">No follow-ups scheduled.</div>
                        </div>
                    )}
                    {pending.map((f) => {
                        const u = urgencyOf(f.due_date, f.status);
                        return (
                            <div key={f.followup_id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5" data-testid={`followup-row-${f.followup_id}`}>
                                <div className="flex flex-col md:flex-row md:items-center gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-bold">{f.title}</span>
                                            <span className={u.chip}><ClockCountdown size={10} weight="fill" /> {u.label}</span>
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-1">Due {f.due_date}</div>
                                        {f.notes && <div className="text-xs text-zinc-400 mt-1 italic">&ldquo;{f.notes}&rdquo;</div>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => markDone(f.followup_id)} className="btn-blue py-2 px-3 text-xs" data-testid={`followup-done-${f.followup_id}`}>
                                            <Check size={14} weight="bold" /> Done
                                        </button>
                                        <button onClick={() => remove(f.followup_id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                                            <Trash size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {done.length > 0 && (
                <div className="glass p-4">
                    <h3 className="font-display font-bold text-lg mb-4">Recently Crushed</h3>
                    <div className="space-y-2">
                        {done.map((f) => (
                            <div key={f.followup_id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 opacity-70">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Check size={16} className="text-emerald-400" />
                                        <span className="text-sm">{f.title}</span>
                                    </div>
                                    <span className="text-xs text-zinc-500">{f.due_date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(false)}>
                        <motion.form initial={{scale:0.9}} animate={{scale:1}} onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-strong p-6 md:p-8 w-full max-w-md relative" data-testid="followup-modal">
                            <button type="button" onClick={() => setModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">Next move</div>
                            <h3 className="font-display font-black text-2xl mb-6">Schedule Follow-Up</h3>
                            <div className="space-y-3">
                                <input required placeholder="Task (e.g. Call Sarah re: offer)" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="field" data-testid="followup-title-input" />
                                <input required type="date" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} className="field" data-testid="followup-date-input" />
                                <select value={form.prospect_id} onChange={(e) => setForm({...form, prospect_id: e.target.value})} className="field">
                                    <option value="">Link prospect (optional)</option>
                                    {prospects.map((p) => <option key={p.prospect_id} value={p.prospect_id}>{p.name}</option>)}
                                </select>
                                <textarea rows={3} placeholder="Notes..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="field resize-none" />
                            </div>
                            <button type="submit" className="btn-gold w-full mt-6" data-testid="followup-submit-btn">
                                <Plus size={18} weight="bold" /> Schedule
                            </button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
