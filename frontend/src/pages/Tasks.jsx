import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, X, Check, Trash, ClipboardText, ClockCountdown, Sparkle } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { fireConfetti } from "@/lib/confetti";

export default function Tasks() {
    const { user, refreshUser } = useAuth();
    const isAdmin = user?.role === "super_admin";
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [view, setView] = useState("mine");  // mine|all (admin only)
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState({
        title: "", description: "", assigned_to: "",
        due_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        xp_reward: 25,
    });

    const load = async () => {
        const url = isAdmin && view === "all" ? "/tasks?all_users=true" : "/tasks";
        const { data } = await api.get(url);
        setItems(data);
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [view, isAdmin]);

    useEffect(() => {
        if (isAdmin) {
            api.get("/admin/users").then((r) => setUsers(r.data));
        }
    }, [isAdmin]);

    const create = async (e) => {
        e.preventDefault();
        try {
            await api.post("/tasks", { ...form, xp_reward: Number(form.xp_reward) });
            toast.success("Task assigned");
            setModal(false);
            setForm({
                title: "", description: "", assigned_to: "",
                due_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
                xp_reward: 25,
            });
            await load();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    const complete = async (id) => {
        try {
            const { data } = await api.patch(`/tasks/${id}/complete`);
            fireConfetti({ particleCount: 100 });
            toast.success(`Task complete · +${data.task.xp_reward} XP`);
            if (data.xp?.leveled_up) toast.success(`LEVEL UP! Now L${data.xp.level}`);
            await load();
            await refreshUser();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this task?")) return;
        await api.delete(`/tasks/${id}`);
        toast.success("Task removed");
        await load();
    };

    const pending = items.filter((t) => t.status === "pending");
    const done = items.filter((t) => t.status === "completed");

    return (
        <div className="space-y-6" data-testid="tasks-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Marching orders</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Tasks</h1>
                    <p className="text-zinc-400 mt-2 text-sm">
                        {isAdmin ? "Command your Spartans. Every task is XP earned." : "Complete your missions. Earn XP. Level up."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                            <button onClick={() => setView("mine")} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view==="mine"?"bg-yellow-500 text-black":"text-zinc-400"}`} data-testid="tasks-view-mine">Mine</button>
                            <button onClick={() => setView("all")} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view==="all"?"bg-yellow-500 text-black":"text-zinc-400"}`} data-testid="tasks-view-all">All</button>
                        </div>
                    )}
                    {isAdmin && (
                        <button onClick={() => setModal(true)} className="btn-gold" data-testid="assign-task-btn">
                            <Plus size={16} weight="bold" /> Assign Task
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <StatChip label="Pending" value={pending.length} chip="chip-gold" testId="tasks-stat-pending" />
                <StatChip label="Completed" value={done.length} chip="chip-emerald" testId="tasks-stat-done" />
                <StatChip label="Total XP" value={done.reduce((sum, t) => sum + (t.xp_reward || 0), 0)} chip="chip-blue" testId="tasks-stat-xp" />
            </div>

            <div className="glass p-4">
                <h3 className="font-display font-bold text-lg mb-4">Active</h3>
                <div className="space-y-2">
                    {pending.length === 0 && (
                        <div className="text-center py-10">
                            <ClipboardText size={40} weight="duotone" className="text-zinc-700 mx-auto" />
                            <div className="text-zinc-500 mt-3 text-sm">
                                {isAdmin ? "No active tasks." : "No tasks assigned. Stay ready."}
                            </div>
                        </div>
                    )}
                    {pending.map((t) => (
                        <TaskCard key={t.task_id} t={t} isAdmin={isAdmin} isOwner={t.assigned_to === user?.user_id} onComplete={() => complete(t.task_id)} onDelete={() => remove(t.task_id)} />
                    ))}
                </div>
            </div>

            {done.length > 0 && (
                <div className="glass p-4">
                    <h3 className="font-display font-bold text-lg mb-4">Recently Crushed</h3>
                    <div className="space-y-2">
                        {done.slice(0, 10).map((t) => (
                            <div key={t.task_id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 opacity-70 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Check size={16} className="text-emerald-400" />
                                    <div>
                                        <div className="text-sm font-semibold">{t.title}</div>
                                        <div className="text-[10px] text-zinc-500">
                                            {t.assignee?.name} · {new Date(t.completed_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <div className="chip-emerald"><Sparkle size={10} weight="fill" /> +{t.xp_reward} XP</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(false)}>
                        <motion.form initial={{scale:0.9}} animate={{scale:1}} onSubmit={create} onClick={(e)=>e.stopPropagation()} className="glass-strong p-6 md:p-8 w-full max-w-lg relative" data-testid="task-modal">
                            <button type="button" onClick={()=>setModal(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">Deploy the mission</div>
                            <h3 className="font-display font-black text-2xl mb-6">Assign Task</h3>
                            <div className="space-y-3">
                                <input required placeholder="Task title" value={form.title} onChange={(e)=>setForm({...form, title: e.target.value})} className="field" data-testid="task-title-input" />
                                <textarea required rows={3} placeholder="Description (what needs to be done?)" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} className="field resize-none" data-testid="task-desc-input" />
                                <select required value={form.assigned_to} onChange={(e)=>setForm({...form, assigned_to: e.target.value})} className="field" data-testid="task-assignee-select">
                                    <option value="">Assign to...</option>
                                    {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name} — {u.email}</option>)}
                                </select>
                                <div className="grid grid-cols-2 gap-3">
                                    <input required type="date" value={form.due_date} onChange={(e)=>setForm({...form, due_date: e.target.value})} className="field" data-testid="task-date-input" />
                                    <input required type="number" min="0" max="1000" placeholder="XP" value={form.xp_reward} onChange={(e)=>setForm({...form, xp_reward: e.target.value})} className="field" data-testid="task-xp-input" />
                                </div>
                            </div>
                            <button type="submit" className="btn-gold w-full mt-6" data-testid="task-submit-btn">Deploy Task</button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TaskCard({ t, isAdmin, isOwner, onComplete, onDelete }) {
    const overdue = t.status === "pending" && new Date(t.due_date) < new Date(new Date().toDateString());
    return (
        <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className={`p-4 rounded-xl bg-white/[0.02] border ${overdue ? "border-red-500/40" : "border-white/5"}`} data-testid={`task-row-${t.task_id}`}>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{t.title}</span>
                        {overdue && <span className="chip-red"><ClockCountdown size={10} weight="fill" /> Overdue</span>}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{t.description}</div>
                    <div className="text-[10px] text-zinc-500 mt-2 flex flex-wrap gap-x-4">
                        <span>Assigned to: <span className="text-white">{t.assignee?.name || "—"}</span></span>
                        <span>Due: <span className="text-white">{t.due_date}</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="chip-gold"><Sparkle size={10} weight="fill" /> +{t.xp_reward} XP</div>
                    {isOwner && t.status === "pending" && (
                        <button onClick={onComplete} className="btn-blue py-2 px-3 text-xs" data-testid={`task-complete-${t.task_id}`}>
                            <Check size={14} weight="bold" /> Complete
                        </button>
                    )}
                    {isAdmin && (
                        <button onClick={onDelete} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10">
                            <Trash size={14} />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function StatChip({ label, value, chip, testId }) {
    return (
        <div className="glass p-4" data-testid={testId}>
            <div className={chip}>{label}</div>
            <div className="font-display text-3xl font-black mt-3">{value}</div>
        </div>
    );
}
