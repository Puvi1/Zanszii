import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Trophy, Fire, Sparkle, TrendUp, Users, Crown, ChartLineUp } from "@phosphor-icons/react";
import ProgressBar from "@/components/ProgressBar";
import { motion } from "framer-motion";

export default function TeamLeague() {
    const { user } = useAuth();
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get("/team-league").then((r) => setData(r.data)).catch(() => toast.error("Failed to load"));
    }, []);

    if (!data) return <div className="text-zinc-500 text-sm">Loading league...</div>;
    const myTeam = user?.team;

    return (
        <div className="space-y-6" data-testid="team-league-page">
            <div>
                <div className="heading-eyebrow">The gauntlet</div>
                <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Team League</h1>
                <p className="text-zinc-400 mt-2 text-sm">Rankings, XP, attendance, streaks — only the disciplined climb.</p>
            </div>

            <div className="glass p-5">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkle size={16} weight="fill" className="text-yellow-400" />
                    <span className="heading-eyebrow">Attendance → Bonus XP</span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {data.attendance_xp_table.map((r) => (
                        <div key={r.threshold_pct} className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                            <div className="text-xs text-zinc-500 uppercase tracking-widest">≥{r.threshold_pct}%</div>
                            <div className="font-display font-black text-xl text-yellow-400 mt-1">+{r.xp_reward}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                {data.teams.map((t) => (
                    <TeamRow key={t.team_id} t={t} isMine={t.name === myTeam} />
                ))}
                {data.teams.length === 0 && (
                    <div className="glass p-8 text-center text-zinc-500 text-sm">
                        No teams have members yet.
                    </div>
                )}
            </div>
        </div>
    );
}

function TeamRow({ t, isMine }) {
    const rankColors = t.rank === 1 ? "bg-yellow-500 text-black" :
        t.rank === 2 ? "bg-zinc-300 text-black" :
        t.rank === 3 ? "bg-amber-700 text-white" : "bg-white/5 text-zinc-400";
    return (
        <motion.div
            whileHover={{ y: -3 }}
            className={`glass p-5 md:p-6 relative overflow-hidden ${isMine ? "ring-2 ring-yellow-500/50" : ""}`}
            data-testid={`league-row-${t.team_id}`}
        >
            {t.rank === 1 && <div className="absolute -top-16 -right-16 w-40 h-40 bg-yellow-500/10 rounded-full blur-3xl" />}
            <div className="relative flex flex-col md:flex-row md:items-center gap-4">
                <div className={`w-14 h-14 grid place-items-center rounded-2xl font-mono font-black text-2xl ${rankColors}`}>
                    {t.rank === 1 ? <Crown size={26} weight="fill" /> : t.rank}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display font-black text-xl">Team {t.name}</h3>
                        {isMine && <span className="chip-blue">Your team</span>}
                        {t.attendance_bonus_xp > 0 && (
                            <span className="chip-emerald"><Sparkle size={10} weight="fill" /> +{t.attendance_bonus_xp} bonus</span>
                        )}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="flex items-center gap-1"><Users size={10} /> {t.members}</span>
                        <span className="flex items-center gap-1"><Fire size={10} weight="fill" className="text-yellow-500" /> Best {t.streak}</span>
                        <span className="flex items-center gap-1"><TrendUp size={10} /> Wk {t.weekly_xp} XP</span>
                        <span className="flex items-center gap-1"><ChartLineUp size={10} /> Mo {t.monthly_xp} XP</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
                    <Metric label="Weekly Attn" value={`${t.weekly_attendance_pct}%`} pct={t.weekly_attendance_pct} color="blue" />
                    <Metric label="Monthly Attn" value={`${t.monthly_attendance_pct}%`} pct={t.monthly_attendance_pct} color="gold" />
                </div>
                <div className="text-right md:min-w-[100px]">
                    <div className="font-display font-black text-2xl text-yellow-400 leading-none">{t.xp.toLocaleString()}</div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Total XP</div>
                </div>
            </div>
        </motion.div>
    );
}

function Metric({ label, value, pct, color }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
                <span className="text-xs font-mono font-bold text-white">{value}</span>
            </div>
            <ProgressBar value={pct} max={100} color={color} />
        </div>
    );
}
