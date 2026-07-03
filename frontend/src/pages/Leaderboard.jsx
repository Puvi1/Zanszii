import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Trophy, Crown, Medal, Users, Fire, ShieldStar } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export default function Leaderboard() {
    const { user } = useAuth();
    const [scope, setScope] = useState("weekly");
    const [rows, setRows] = useState([]);
    const [teamRows, setTeamRows] = useState([]);
    const [view, setView] = useState("individual");

    const load = async () => {
        if (view === "individual") {
            const { data } = await api.get(`/leaderboard?scope=${scope}`);
            setRows(data);
        } else {
            const { data } = await api.get("/leaderboard/teams");
            setTeamRows(data);
        }
    };
    useEffect(() => { load(); }, [scope, view]);

    const top3 = rows.slice(0, 3);
    const rest = rows.slice(3);

    return (
        <div className="space-y-6" data-testid="leaderboard-page">
            <div>
                <div className="heading-eyebrow">Rank #{rows.findIndex((r) => r.user_id === user?.user_id) + 1 || "?"}</div>
                <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Leaderboard</h1>
                <p className="text-zinc-400 mt-2 text-sm">Only the disciplined climb.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                    {["individual", "team"].map((v) => (
                        <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${view===v ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"}`} data-testid={`leaderboard-view-${v}`}>
                            {v === "individual" ? "Warriors" : "Teams"}
                        </button>
                    ))}
                </div>
                {view === "individual" && (
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                        {["weekly", "monthly", "all"].map((s) => (
                            <button key={s} onClick={() => setScope(s)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${scope===s ? "bg-blue-500 text-white" : "text-zinc-400 hover:text-white"}`} data-testid={`leaderboard-scope-${s}`}>
                                {s === "all" ? "All-Time" : s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {view === "individual" ? (
                <>
                    {/* Podium */}
                    {top3.length >= 3 && (
                        <div className="grid grid-cols-3 gap-4 items-end">
                            <PodiumCard rank={2} row={top3[1]} height="pt-12" iconColor="text-zinc-300" borderColor="border-zinc-400" glow="rgba(212,212,216,0.4)" />
                            <PodiumCard rank={1} row={top3[0]} height="pt-6" iconColor="text-yellow-400" borderColor="border-yellow-500" glow="rgba(234,179,8,0.6)" isFirst />
                            <PodiumCard rank={3} row={top3[2]} height="pt-16" iconColor="text-amber-500" borderColor="border-amber-700" glow="rgba(180,83,9,0.4)" />
                        </div>
                    )}

                    {/* Rest of list */}
                    <div className="glass p-4">
                        {rows.length === 0 && <div className="text-center text-zinc-500 py-10 text-sm">No XP earned in this scope yet.</div>}
                        <div className="space-y-2">
                            {rest.map((r) => (
                                <motion.div
                                    key={r.user_id}
                                    whileHover={{ x: 4 }}
                                    className={`p-4 rounded-xl flex items-center gap-4 border transition-all ${r.user_id === user?.user_id ? "bg-yellow-500/10 border-yellow-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/5"}`}
                                    data-testid={`leaderboard-row-${r.user_id}`}
                                >
                                    <div className="w-10 h-10 grid place-items-center rounded-lg bg-white/5 font-mono font-bold text-zinc-400">
                                        {r.rank}
                                    </div>
                                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-bold text-black">
                                        {r.name?.[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold truncate">{r.name}</div>
                                        <div className="flex items-center gap-3 mt-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                                            <span>{r.team}</span>
                                            <span className="text-yellow-500">LVL {r.level}</span>
                                            <span className="flex items-center gap-1"><Fire size={10} weight="fill" className="text-yellow-500" /> {r.streak_current}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-yellow-400 font-mono font-black text-lg">{r.xp.toLocaleString()}</div>
                                        <div className="text-[10px] uppercase tracking-widest text-zinc-600">XP</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamRows.map((t) => (
                        <div key={t.team} className="glass p-6" data-testid={`team-row-${t.team}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl grid place-items-center font-mono font-black text-xl ${
                                        t.rank === 1 ? "bg-yellow-500 text-black" : t.rank === 2 ? "bg-zinc-300 text-black" : t.rank === 3 ? "bg-amber-700 text-white" : "bg-white/5 text-zinc-400"
                                    }`}>
                                        {t.rank}
                                    </div>
                                    <div>
                                        <div className="font-display font-black text-xl">Team {t.team}</div>
                                        <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                                            <Users size={10} /> {t.members} members
                                        </div>
                                    </div>
                                </div>
                                <Trophy size={30} weight="duotone" className="text-yellow-500/70" />
                            </div>
                            <div className="mt-4 flex items-baseline justify-between">
                                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Total XP</span>
                                <span className="font-mono text-2xl font-black text-yellow-400">{t.xp.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PodiumCard({ rank, row, iconColor, borderColor, glow, isFirst }) {
    if (!row) return <div />;
    const Icon = rank === 1 ? Crown : Medal;
    return (
        <div className={`glass p-4 border-2 ${borderColor} text-center relative`}
             style={{ boxShadow: `0 0 30px ${glow}` }}
             data-testid={`podium-${rank}`}
        >
            <Icon size={rank === 1 ? 40 : 32} weight="fill" className={`${iconColor} mx-auto mb-2 ${isFirst ? "float-slow" : ""}`} />
            <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-display font-black text-xl text-black`}>
                {row.name?.[0]}
            </div>
            <div className="mt-3 font-bold text-sm truncate">{row.name}</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{row.team}</div>
            <div className="mt-2 font-mono font-black text-yellow-400 text-lg">{row.xp.toLocaleString()}</div>
            <div className="mt-1 chip-gold mx-auto"><ShieldStar size={10} weight="fill" /> LVL {row.level}</div>
        </div>
    );
}
