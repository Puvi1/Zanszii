import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Fire, Plus, X, Check, Trophy } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import ProgressBar from "@/components/ProgressBar";

const GOAL_TYPES = [
    { key: "checkins", label: "Check-ins" },
    { key: "prospects", label: "Prospects Added" },
    { key: "followups", label: "Follow-Ups Completed" },
    { key: "attendance", label: "Events Attended" },
    { key: "xp", label: "XP Earned" },
];

export default function Challenges() {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [modal, setModal] = useState(false);
    const [scope, setScope] = useState("all");
    const canCreate = user && (user.role === "super_admin" || user.role === "team_leader");
    const [form, setForm] = useState({
        title: "", description: "", type: "weekly", goal_type: "checkins", goal: 5,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        xp_reward: 150,
    });

    const load = async () => {
        const { data } = await api.get("/challenges");
        setItems(data);
    };
    useEffect(() => { load(); }, []);

    const join = async (id) => {
        try {
            await api.post(`/challenges/${id}/join`);
            toast.success("Joined the mission!");
            await load();
        } catch { toast.error("Failed to join"); }
    };

    const create = async (e) => {
        e.preventDefault();
        try {
            await api.post("/challenges", { ...form, goal: Number(form.goal), xp_reward: Number(form.xp_reward) });
            toast.success("Challenge created");
            setModal(false);
            await load();
        } catch (err) {
            toast.error("Failed to create");
        }
    };

    const filtered = items.filter((c) => scope === "all" || c.type === scope);

    return (
        <div className="space-y-6" data-testid="challenges-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Missions</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Challenges</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Test your resolve. Earn glory.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                        {["all", "weekly", "monthly"].map((s) => (
                            <button
                                key={s}
                                onClick={() => setScope(s)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                                    scope === s ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"
                                }`}
                                data-testid={`challenge-scope-${s}`}
                            >{s}</button>
                        ))}
                    </div>
                    {canCreate && (
                        <button onClick={() => setModal(true)} className="btn-gold" data-testid="create-challenge-btn">
                            <Plus size={16} weight="bold" /> New
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.length === 0 && <div className="text-zinc-500 text-sm md:col-span-2">No active challenges.</div>}
                {filtered.map((c) => {
                    const pct = Math.min(100, ((c.progress || 0) / c.goal) * 100);
                    return (
                        <div key={c.challenge_id} className="glass p-6 relative overflow-hidden" data-testid={`challenge-${c.challenge_id}`}>
                            <div className="absolute -top-16 -right-16 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl" />
                            <div className="relative">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className={c.type === "monthly" ? "chip-blue" : "chip-gold"}>{c.type}</div>
                                        <h4 className="font-display font-bold text-xl mt-3">{c.title}</h4>
                                    </div>
                                    {c.completed ? <Trophy size={30} weight="fill" className="text-yellow-500" /> : <Fire size={30} weight="duotone" className="text-yellow-500/60" />}
                                </div>
                                <p className="text-sm text-zinc-400 mb-4">{c.description}</p>
                                <div className="mb-2 flex items-center justify-between text-xs">
                                    <span className="text-zinc-500 uppercase tracking-widest">Target</span>
                                    <span className="font-mono font-bold">{c.progress || 0}/{c.goal} {c.goal_type}</span>
                                </div>
                                <ProgressBar value={c.progress || 0} max={c.goal} color={c.type === "monthly" ? "blue" : "gold"} testId={`challenge-progress-${c.challenge_id}`} />
                                <div className="mt-4 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">Reward</div>
                                        <div className="text-yellow-400 font-bold text-lg">+{c.xp_reward} XP</div>
                                    </div>
                                    {c.completed ? (
                                        <div className="chip-emerald"><Check size={12} weight="bold" /> Complete</div>
                                    ) : c.joined ? (
                                        <div className="chip-blue">Joined</div>
                                    ) : (
                                        <button onClick={() => join(c.challenge_id)} className="btn-gold py-2 px-4 text-sm" data-testid={`challenge-join-${c.challenge_id}`}>
                                            Accept
                                        </button>
                                    )}
                                </div>
                                <div className="mt-2 text-[10px] text-zinc-500 tracking-widest uppercase">
                                    {c.start_date} → {c.end_date}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(false)}>
                        <motion.form initial={{scale:0.9}} animate={{scale:1}} onSubmit={create} onClick={(e)=>e.stopPropagation()} className="glass-strong p-6 md:p-8 w-full max-w-lg relative">
                            <button type="button" onClick={() => setModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">Command it</div>
                            <h3 className="font-display font-black text-2xl mb-6">Create Challenge</h3>
                            <div className="space-y-3">
                                <input required placeholder="Title" value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} className="field" />
                                <textarea required rows={3} placeholder="Description" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} className="field resize-none" />
                                <div className="grid grid-cols-2 gap-3">
                                    <select value={form.type} onChange={(e)=>setForm({...form, type: e.target.value})} className="field">
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                    <select value={form.goal_type} onChange={(e)=>setForm({...form, goal_type: e.target.value})} className="field">
                                        {GOAL_TYPES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                                    </select>
                                    <input required type="number" min="1" placeholder="Goal" value={form.goal} onChange={(e)=>setForm({...form, goal: e.target.value})} className="field" />
                                    <input required type="number" min="10" placeholder="XP Reward" value={form.xp_reward} onChange={(e)=>setForm({...form, xp_reward: e.target.value})} className="field" />
                                    <input required type="date" value={form.start_date} onChange={(e)=>setForm({...form, start_date: e.target.value})} className="field" />
                                    <input required type="date" value={form.end_date} onChange={(e)=>setForm({...form, end_date: e.target.value})} className="field" />
                                </div>
                            </div>
                            <button type="submit" className="btn-gold w-full mt-6">Launch Challenge</button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
