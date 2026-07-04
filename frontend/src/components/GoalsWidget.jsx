import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Flag, TrendUp, Sparkle, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import ProgressBar from "@/components/ProgressBar";
import { fireBigConfetti } from "@/lib/confetti";
import { motion } from "framer-motion";

export default function GoalsWidget() {
    const [goals, setGoals] = useState([]);
    const [busyId, setBusyId] = useState(null);

    const load = async () => {
        try {
            const { data } = await api.get("/goals");
            setGoals(data);
        } catch { /* silent */ }
    };
    useEffect(() => { load(); }, []);

    const bump = async (goal, delta) => {
        setBusyId(goal.goal_id);
        try {
            const { data } = await api.patch(`/goals/${goal.goal_id}/progress`, { delta });
            if (data.goal?.status === "completed" && goal.status !== "completed") {
                fireBigConfetti();
                toast.success(`+${data.goal.xp_reward} XP · goal crushed!`);
            }
            await load();
        } catch { toast.error("Failed to update"); }
        finally { setBusyId(null); }
    };

    const active = goals.filter((g) => g.status === "active");
    const completed = goals.filter((g) => g.status === "completed");
    const weekly = active.filter((g) => g.period === "weekly");
    const monthly = active.filter((g) => g.period === "monthly");

    if (goals.length === 0) {
        return (
            <div className="glass p-5" data-testid="dashboard-goals-empty">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="heading-eyebrow">Goals</div>
                        <h3 className="font-display font-bold text-lg mt-1">No active goals yet</h3>
                        <p className="text-zinc-500 text-xs mt-1">HQ will push weekly &amp; monthly targets. They&apos;ll appear here automatically.</p>
                    </div>
                    <Flag size={26} weight="duotone" className="text-yellow-400" />
                </div>
            </div>
        );
    }

    return (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="dashboard-goals-widget">
            <GoalColumn label="This Week" goals={weekly} icon={TrendUp} onBump={bump} busyId={busyId} testId="dashboard-goals-weekly" />
            <GoalColumn label="This Month" goals={monthly} icon={Sparkle} onBump={bump} busyId={busyId} testId="dashboard-goals-monthly" />
            {completed.length > 0 && (
                <div className="lg:col-span-2 glass p-4 flex items-center gap-3" data-testid="dashboard-goals-completed">
                    <CheckCircle size={22} weight="fill" className="text-emerald-400" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">
                            {completed.length} goal{completed.length > 1 ? "s" : ""} conquered · +{completed.reduce((s, g) => s + (g.xp_reward || 0), 0)} XP earned
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
                            {completed.slice(0, 3).map((g) => g.title).join(" · ")}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

function GoalColumn({ label, goals, icon: Icon, onBump, busyId, testId }) {
    return (
        <div className="glass p-5" data-testid={testId}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="heading-eyebrow">{label}</div>
                    <h3 className="font-display font-bold text-lg mt-1 flex items-center gap-2">
                        <Icon size={18} weight="duotone" className="text-yellow-400" />
                        {goals.length} active
                    </h3>
                </div>
            </div>
            {goals.length === 0 && (
                <div className="text-xs text-zinc-500 py-6 text-center">No active {label.toLowerCase()} goal yet.</div>
            )}
            <div className="space-y-3">
                {goals.map((g) => {
                    const pct = Math.round((g.progress / g.target) * 100);
                    const busy = busyId === g.goal_id;
                    return (
                        <motion.div key={g.goal_id} whileHover={{ x: 2 }} className="p-3 rounded-xl bg-white/[0.02] border border-white/5" data-testid={`goal-row-${g.goal_id}`}>
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate flex items-center gap-2">
                                        {g.title}
                                        {g.assigned_by_admin && <span className="chip-gold text-[9px] px-1.5 py-0.5">HQ</span>}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">+{g.xp_reward} XP on completion · ends {g.period_end || "—"}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        disabled={busy || g.progress <= 0}
                                        onClick={() => onBump(g, -1)}
                                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 grid place-items-center text-zinc-400 disabled:opacity-40"
                                        data-testid={`goal-decr-${g.goal_id}`}
                                    >-</button>
                                    <div className="font-mono font-bold text-white text-xs w-14 text-center" data-testid={`goal-progress-${g.goal_id}`}>
                                        {g.progress}/{g.target}
                                    </div>
                                    <button
                                        disabled={busy}
                                        onClick={() => onBump(g, 1)}
                                        className="w-7 h-7 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black grid place-items-center font-bold disabled:opacity-40"
                                        data-testid={`goal-incr-${g.goal_id}`}
                                    >+</button>
                                </div>
                            </div>
                            <ProgressBar value={g.progress} max={g.target} color="gold" />
                            <div className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                                <ArrowRight size={10} /> {pct}% to target
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
