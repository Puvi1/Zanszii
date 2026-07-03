import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Fire, Target, Trophy, Crown, TrendUp, ChartBar } from "@phosphor-icons/react";
import StatCard from "@/components/StatCard";
import ProgressBar from "@/components/ProgressBar";
import { motion } from "framer-motion";

export default function MyTeam() {
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get("/reports/team").then((r) => setData(r.data)).catch(() => {});
    }, []);

    if (!data) return <div className="text-zinc-500 text-sm">Loading your team...</div>;

    const { team, totals, members } = data;
    const topMember = members[0];

    return (
        <div className="space-y-8" data-testid="my-team-page">
            <section className="glass-strong p-6 md:p-10 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-display font-black text-black text-6xl md:text-7xl shadow-[0_0_50px_rgba(234,179,8,0.4)]">
                        {team.name[0]}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <div className="heading-eyebrow">Your Squad</div>
                        <h1 className="font-display font-black text-4xl md:text-5xl tracking-tighter mt-1">
                            Team {team.name}
                        </h1>
                        <div className="mt-3 flex items-center gap-3 flex-wrap justify-center md:justify-start">
                            <span className="chip-gold"><Crown size={12} weight="fill" /> You Command</span>
                            <span className="chip-blue"><Users size={12} weight="fill" /> {totals.members} Warriors</span>
                            <span className="chip-emerald"><Fire size={12} weight="fill" /> {totals.active_today} Active Today</span>
                        </div>
                        {topMember && (
                            <div className="mt-4 text-sm text-zinc-400">
                                Top warrior: <span className="text-yellow-400 font-bold">{topMember.name}</span> · LVL {topMember.level} · {topMember.xp.toLocaleString()} XP
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={Users} label="Members" value={totals.members} tone="gold" testId="team-stat-members" />
                <StatCard icon={Target} label="Prospects" value={totals.prospects} sublabel={`${totals.won} closed`} tone="blue" testId="team-stat-prospects" />
                <StatCard icon={Trophy} label="Wins" value={totals.won} sublabel={`${totals.conversion_rate}% conv.`} tone="emerald" testId="team-stat-wins" />
                <StatCard icon={Fire} label="Check-ins" value={totals.checkins} tone="gold" testId="team-stat-checkins" />
                <StatCard icon={ChartBar} label="Follow-ups" value={totals.followups_done} sublabel="completed" tone="blue" testId="team-stat-followups" />
                <StatCard icon={TrendUp} label="Team XP" value={totals.xp.toLocaleString()} tone="zinc" testId="team-stat-xp" />
            </section>

            <section className="glass p-4 md:p-6">
                <div className="mb-4">
                    <div className="heading-eyebrow">Member performance</div>
                    <h3 className="font-display font-bold text-xl mt-1">Squad Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
                                <th className="text-left py-2 px-3">Warrior</th>
                                <th className="text-left py-2 px-3">Level</th>
                                <th className="text-left py-2 px-3">XP</th>
                                <th className="text-left py-2 px-3">Streak</th>
                                <th className="text-left py-2 px-3">Prospects</th>
                                <th className="text-left py-2 px-3">Wins</th>
                                <th className="text-left py-2 px-3">Follow-Ups</th>
                                <th className="text-left py-2 px-3">Events</th>
                                <th className="text-left py-2 px-3 w-40">XP Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {members.map((m) => (
                                <motion.tr key={m.user_id} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }} className="border-t border-white/5" data-testid={`team-member-${m.user_id}`}>
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-bold text-black text-xs">
                                                {m.name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold flex items-center gap-2">
                                                    {m.name}
                                                    {m.role === "team_leader" && <Crown size={12} weight="fill" className="text-yellow-400" />}
                                                </div>
                                                <div className="text-[10px] text-zinc-500">{m.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3"><span className="chip-gold">LVL {m.level}</span></td>
                                    <td className="py-3 px-3 font-mono text-yellow-400 text-sm">{m.xp.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-sm">{m.streak_current}🔥</td>
                                    <td className="py-3 px-3 text-sm">{m.prospects}</td>
                                    <td className="py-3 px-3 text-sm text-emerald-400 font-bold">{m.won}</td>
                                    <td className="py-3 px-3 text-sm">{m.followups_done}</td>
                                    <td className="py-3 px-3 text-sm">{m.attendance}</td>
                                    <td className="py-3 px-3">
                                        <ProgressBar value={m.xp} max={Math.max(1, totals.xp)} color="gold" />
                                    </td>
                                </motion.tr>
                            ))}
                            {members.length === 0 && (
                                <tr><td colSpan={9} className="py-8 text-center text-zinc-500 text-sm">No members yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
