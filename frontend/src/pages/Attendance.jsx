import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Calendar, X, GraduationCap, Users, VideoCamera, Phone } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { fireConfetti } from "@/lib/confetti";
import { useAuth } from "@/context/AuthContext";

const TYPES = [
    { key: "meeting", label: "Meeting", icon: Users },
    { key: "training", label: "Training", icon: GraduationCap },
    { key: "webinar", label: "Webinar", icon: VideoCamera },
    { key: "call", label: "Call", icon: Phone },
];

export default function Attendance() {
    const { refreshUser } = useAuth();
    const [items, setItems] = useState([]);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({ event_name: "", event_date: new Date().toISOString().slice(0, 10), event_type: "meeting", notes: "" });

    const load = async () => {
        const { data } = await api.get("/attendance");
        setItems(data);
    };
    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/attendance", form);
            fireConfetti({ particleCount: 100 });
            toast.success("Attendance logged · +15 XP");
            setModal(false);
            setForm({ event_name: "", event_date: new Date().toISOString().slice(0, 10), event_type: "meeting", notes: "" });
            await load();
            await refreshUser();
        } catch (err) {
            toast.error("Failed to log");
        }
    };

    const byType = TYPES.map((t) => ({ ...t, count: items.filter((i) => i.event_type === t.key).length }));

    return (
        <div className="space-y-6" data-testid="attendance-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Show up. Level up.</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Attendance</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Every event you attend forges the network.</p>
                </div>
                <button onClick={() => setModal(true)} className="btn-gold" data-testid="add-attendance-btn">
                    <Plus size={18} weight="bold" /> Log Attendance
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {byType.map((t) => (
                    <div key={t.key} className="glass p-4">
                        <div className="flex items-center justify-between">
                            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                                <t.icon size={20} weight="duotone" />
                            </div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500">{t.label}</div>
                        </div>
                        <div className="font-display text-3xl font-black mt-3">{t.count}</div>
                    </div>
                ))}
            </div>

            <div className="glass p-4">
                <h3 className="font-display font-bold text-lg mb-4">Timeline</h3>
                <div className="space-y-2">
                    {items.length === 0 && (
                        <div className="text-center py-10">
                            <Calendar size={40} weight="duotone" className="text-zinc-700 mx-auto" />
                            <div className="text-zinc-500 mt-3 text-sm">No events logged yet.</div>
                        </div>
                    )}
                    {items.map((a) => {
                        const type = TYPES.find((t) => t.key === a.event_type) || TYPES[0];
                        return (
                            <div key={a.attendance_id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center gap-4" data-testid={`attendance-row-${a.attendance_id}`}>
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                                    <type.icon size={20} weight="duotone" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold">{a.event_name}</div>
                                    <div className="text-xs text-zinc-500 mt-1">{a.event_date} · {type.label}</div>
                                    {a.notes && <div className="text-xs text-zinc-400 mt-1 italic">&ldquo;{a.notes}&rdquo;</div>}
                                </div>
                                <div className="chip-gold">+{a.xp_earned} XP</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(false)}>
                        <motion.form initial={{scale:0.9}} animate={{scale:1}} onSubmit={submit} onClick={(e) => e.stopPropagation()} className="glass-strong p-6 md:p-8 w-full max-w-md relative" data-testid="attendance-modal">
                            <button type="button" onClick={() => setModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">Presence = Power</div>
                            <h3 className="font-display font-black text-2xl mb-6">Log Attendance</h3>
                            <div className="space-y-3">
                                <input required placeholder="Event name" value={form.event_name} onChange={(e) => setForm({...form, event_name: e.target.value})} className="field" data-testid="attendance-name-input" />
                                <input required type="date" value={form.event_date} onChange={(e) => setForm({...form, event_date: e.target.value})} className="field" data-testid="attendance-date-input" />
                                <select value={form.event_type} onChange={(e) => setForm({...form, event_type: e.target.value})} className="field">
                                    {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                                </select>
                                <textarea rows={3} placeholder="Notes..." value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="field resize-none" />
                            </div>
                            <button type="submit" className="btn-gold w-full mt-6" data-testid="attendance-submit-btn">
                                <Plus size={18} weight="bold" /> Log · +15 XP
                            </button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
