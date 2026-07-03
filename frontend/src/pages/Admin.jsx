import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, Trophy, Target, Fire, ChartLine, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StatCard from "@/components/StatCard";

const ROLES = ["member", "team_leader", "super_admin"];

export default function Admin() {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [users, setUsers] = useState([]);
    const canPromote = user?.role === "super_admin";

    const load = async () => {
        const [a, u] = await Promise.all([
            api.get("/admin/analytics"),
            api.get("/admin/users"),
        ]);
        setAnalytics(a.data);
        setUsers(u.data);
    };
    useEffect(() => { load(); }, []);

    const changeRole = async (uid, role) => {
        try {
            await api.patch(`/admin/users/${uid}/role`, { role });
            toast.success("Role updated");
            await load();
        } catch { toast.error("Permission denied"); }
    };

    if (!analytics) return <div className="text-zinc-500 text-sm">Loading command center...</div>;

    return (
        <div className="space-y-8" data-testid="admin-page">
            <div>
                <div className="heading-eyebrow">Command center</div>
                <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Admin Panel</h1>
                <p className="text-zinc-400 mt-2 text-sm">Direct the league. Verify the metrics. Crown new leaders.</p>
            </div>

            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard icon={Users} label="Members" value={analytics.total_users} tone="gold" testId="admin-stat-users" />
                <StatCard icon={Target} label="Prospects" value={analytics.total_prospects} tone="blue" testId="admin-stat-prospects" />
                <StatCard icon={Trophy} label="Deals Won" value={analytics.total_won} sublabel={`${analytics.conversion_rate}% conv.`} tone="emerald" testId="admin-stat-won" />
                <StatCard icon={Fire} label="Check-ins" value={analytics.total_checkins} tone="gold" testId="admin-stat-checkins" />
                <StatCard icon={Sparkle} label="Active Today" value={analytics.active_today} tone="blue" testId="admin-stat-active" />
                <StatCard icon={ChartLine} label="Weekly XP" value={analytics.weekly_xp} tone="zinc" testId="admin-stat-weekly-xp" />
            </section>

            <section className="glass p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <div className="heading-eyebrow">Roster</div>
                        <h3 className="font-display font-bold text-xl mt-1">All Spartans</h3>
                    </div>
                    <div className="text-xs text-zinc-500">{users.length} members</div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
                                <th className="text-left py-2 px-3">Spartan</th>
                                <th className="text-left py-2 px-3">Team</th>
                                <th className="text-left py-2 px-3">Level</th>
                                <th className="text-left py-2 px-3">XP</th>
                                <th className="text-left py-2 px-3">Streak</th>
                                <th className="text-left py-2 px-3">Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <motion.tr key={u.user_id} whileHover={{ backgroundColor: "rgba(255,255,255,0.03)" }} className="border-t border-white/5" data-testid={`admin-user-row-${u.user_id}`}>
                                    <td className="py-3 px-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-bold text-black text-xs">
                                                {u.name?.[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold">{u.name}</div>
                                                <div className="text-[10px] text-zinc-500">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-3 text-sm text-zinc-400">{u.team || "-"}</td>
                                    <td className="py-3 px-3"><span className="chip-gold">LVL {u.level}</span></td>
                                    <td className="py-3 px-3 font-mono text-yellow-400 text-sm">{(u.xp || 0).toLocaleString()}</td>
                                    <td className="py-3 px-3"><span className="text-sm flex items-center gap-1"><Fire size={12} weight="fill" className="text-yellow-500" /> {u.streak_current || 0}</span></td>
                                    <td className="py-3 px-3">
                                        {canPromote ? (
                                            <select
                                                value={u.role}
                                                onChange={(e) => changeRole(u.user_id, e.target.value)}
                                                className="bg-[#0f0f12] border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                                                data-testid={`admin-role-${u.user_id}`}
                                            >
                                                {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                                            </select>
                                        ) : (
                                            <span className="chip-zinc">{u.role.replace("_", " ")}</span>
                                        )}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
