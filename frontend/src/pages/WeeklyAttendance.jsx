import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, XCircle, MinusCircle, Lock, CaretLeft, CaretRight, Calendar, LockOpen, Users, User } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/Avatar";

const STATUSES = [
    { key: "present", label: "Present", color: "emerald", icon: CheckCircle },
    { key: "absent", label: "Absent", color: "red", icon: XCircle },
    { key: "na", label: "N/A", color: "zinc", icon: MinusCircle },
];

function toISODate(d) { return d.toISOString().slice(0, 10); }

export default function WeeklyAttendance() {
    const { user } = useAuth();
    const canManage = user?.role === "super_admin" || user?.role === "team_leader";
    const [weekOf, setWeekOf] = useState(() => toISODate(new Date()));
    const [mode, setMode] = useState("me");   // "me" | "team"
    const [data, setData] = useState(null);
    const [teamData, setTeamData] = useState(null);
    const [busy, setBusy] = useState(null);
    const [sessionForm, setSessionForm] = useState({
    name: "",
    weekday: 0,
    is_believer: false,
});

    const load = async (w) => {
        const { data } = await api.get(`/event-attendance/week?week_of=${w}`);
        setData(data);
        if (canManage) {
            try {
                const { data: td } = await api.get(`/event-attendance/team-week?week_of=${w}`);
                setTeamData(td);
            } catch { /* silent */ }
        }
    };
    useEffect(() => { load(weekOf); }, [weekOf]);

    const navWeek = (delta) => {
        const d = new Date(weekOf);
        d.setDate(d.getDate() + delta * 7);
        setWeekOf(toISODate(d));
    };

    const markSelf = async (occ, status) => {
        if (occ.locked) { toast.error("Attendance locked"); return; }
        setBusy(occ.event_id + occ.event_date);
        try {
            await api.post("/event-attendance/mark", { event_id: occ.event_id, event_date: occ.event_date, status });
            toast.success(`Marked ${status.toUpperCase()}`);
            await load(weekOf);
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(null); }
    };

    const markFor = async (userId, eventId, eventDate, status) => {
        setBusy(userId + eventId + eventDate + status);
        try {
            await api.post("/event-attendance/mark-for-member", {
                user_id: userId, event_id: eventId, event_date: eventDate, status,
            });
            toast.success(`${status.toUpperCase()} recorded`);
            await load(weekOf);
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
        finally { setBusy(null); }
    };
    const createSession = async (e) => {
    e.preventDefault();

    if (!sessionForm.name.trim()) {
        toast.error("Session name is required");
        return;
    }

    try {
        await api.post("/weekly-events", {
            name: sessionForm.name,
            weekday: Number(sessionForm.weekday),
            is_believer: sessionForm.is_believer,
            active: true,
        });

        toast.success("Weekly session added");

        setSessionForm({
            name: "",
            weekday: 0,
            is_believer: false,
        });

        load();
    } catch (err) {
        toast.error("Failed to create session");
    }
};

    if (!data) return <div className="text-zinc-500 text-sm">Loading week...</div>;

    return (
        <div className="space-y-6" data-testid="weekly-attendance-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Weekly Ritual</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Weekly Attendance</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Monday & Thursday lock at 8 AM · Saturday stays open until 10 PM.</p>
                </div>
                {canManage && (
                    <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 self-start">
                        <button onClick={() => setMode("me")} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 ${mode === "me" ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"}`} data-testid="attn-mode-me"><User size={14} weight="fill" /> Me</button>
                        <button onClick={() => setMode("team")} className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest inline-flex items-center gap-2 ${mode === "team" ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"}`} data-testid="attn-mode-team"><Users size={14} weight="fill" /> Team</button>
                    </div>
                )}
            </div>

            <div className="glass p-4 flex items-center justify-between">
                <button onClick={() => navWeek(-1)} className="btn-ghost" data-testid="week-prev-btn"><CaretLeft size={16} /> Previous</button>
                <div className="text-center">
                    <div className="heading-eyebrow">Week</div>
                    <div className="font-display font-bold text-sm mt-1" data-testid="week-range">{data.week_start} → {data.week_end}</div>
                </div>
                <button onClick={() => navWeek(1)} className="btn-ghost" data-testid="week-next-btn">Next <CaretRight size={16} /></button>
            </div>

            {mode === "me" && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.occurrences.length === 0 && <div className="col-span-full text-center text-zinc-500 text-sm py-8">No attendance sessions open right now. Meetings appear on their scheduled day.</div>}
                        {data.occurrences.map((occ) => (
                            <EventCard
                                key={occ.event_id + occ.event_date}
                                occ={occ}
                                busy={busy === occ.event_id + occ.event_date}
                                onMark={(s) => markSelf(occ, s)}
                            />
                        ))}
                    </div>
                    <div className="glass p-4 text-xs text-zinc-500 flex items-center gap-2">
                        <Lock size={14} weight="duotone" className="text-yellow-500" />
                        Saturday Spartans Team Meeting: locks at <span className="text-yellow-400 font-bold">22:00 IST</span>. Mon & Thu: <span className="text-yellow-400 font-bold">08:00 IST</span>.
                    </div>
                </>
            )}

            {mode === "team" && teamData && (
                <TeamGrid data={teamData} onMark={markFor} busyKey={busy} />
            )}
        </div>
    );
}

function TeamGrid({ data, onMark, busyKey }) {
    const { occurrences, grid } = data;
    return (
        <div className="glass p-3 md:p-4 overflow-x-auto" data-testid="team-attendance-grid">
            <table className="w-full min-w-[720px]">
                <thead>
                    <tr>
                        <th className="text-left py-2 px-2 text-[10px] uppercase tracking-widest text-zinc-500">Member</th>
                        {occurrences.map((o) => (
                            <th key={o.event_id} className="text-center py-2 px-2">
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500">{o.weekday_name}</div>
                                <div className="text-xs font-bold mt-0.5">{o.name.split("(")[0].trim()}</div>
                                <div className="text-[9px] text-zinc-500 flex items-center justify-center gap-1 mt-0.5">
                                    {o.is_locked ? <><Lock size={10} className="text-red-400" /> Locked</> : <><LockOpen size={10} className="text-emerald-400" /> Open · {o.lock_hour}:00</>}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {grid.map((row) => (
                        <tr key={row.user_id} className="border-t border-white/5" data-testid={`team-attn-row-${row.user_id}`}>
                            <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                    <Avatar user={row} size={28} />
                                    <div>
                                        <div className="text-sm font-semibold">{row.name}</div>
                                        <div className="text-[10px] text-zinc-500">{row.team || "-"}</div>
                                    </div>
                                </div>
                            </td>
                            {occurrences.map((o) => {
                                const mk = row.marks[o.event_id] || {};
                                const current = mk.status;
                                return (
                                    <td key={o.event_id} className="py-2 px-1 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {STATUSES.map((s) => {
                                                const active = current === s.key;
                                                const key = row.user_id + o.event_id + o.event_date + s.key;
                                                const clr = s.color === "emerald" ? (active ? "bg-emerald-500 text-black" : "bg-white/5 text-emerald-400") :
                                                    s.color === "red" ? (active ? "bg-red-500 text-white" : "bg-white/5 text-red-400") :
                                                    (active ? "bg-zinc-400 text-black" : "bg-white/5 text-zinc-400");
                                                return (
                                                    <button
                                                        key={s.key}
                                                        disabled={busyKey === key || o.is_locked}
                                                        onClick={() => onMark(row.user_id, o.event_id, o.event_date, s.key)}
                                                        className={`w-8 h-8 rounded-lg grid place-items-center transition-all ${clr} hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed`}
                                                        title={s.label}
                                                        data-testid={`team-mark-${row.user_id}-${o.event_id}-${s.key}`}
                                                    >
                                                        <s.icon size={14} weight="fill" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    {grid.length === 0 && (
                        <tr><td colSpan={1 + occurrences.length} className="py-8 text-center text-zinc-500 text-sm">No members in your scope.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function EventCard({ occ, busy, onMark }) {
    const active = STATUSES.find((s) => s.key === occ.status);
    const bg = active?.key === "present" ? "border-emerald-500/40 bg-emerald-500/5" :
        active?.key === "absent" ? "border-red-500/40 bg-red-500/5" :
        active?.key === "na" ? "border-zinc-500/30 bg-zinc-500/5" :
        occ.locked ? "border-white/5 bg-white/[0.02] opacity-70" : "border-yellow-500/20 bg-white/[0.02]";
    return (
        <motion.div
            whileHover={{ y: occ.locked ? 0 : -3 }}
            className={`p-5 rounded-2xl border transition-all ${bg}`}
            data-testid={`event-card-${occ.event_id}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{occ.weekday_name}</div>
                    <h3 className="font-display font-bold text-lg mt-1">{occ.name}</h3>
                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                        <Calendar size={12} weight="duotone" /> {occ.event_date}
                        {occ.is_believer && <span className="chip-gold ml-2" style={{ padding: "2px 6px", fontSize: "9px" }}>Believer</span>}
                    </div>
                </div>
                {occ.locked ? (
                    <div className="chip-zinc"><Lock size={10} weight="fill" /> Locked</div>
                ) : (
                    <div className="chip-emerald"><LockOpen size={10} weight="fill" /> Open</div>
                )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
                {STATUSES.map((s) => {
                    const isActive = occ.status === s.key;
                    const colors = {
                        emerald: isActive ? "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "bg-white/5 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10",
                        red: isActive ? "bg-red-500 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "bg-white/5 text-red-400 border-red-500/20 hover:bg-red-500/10",
                        zinc: isActive ? "bg-zinc-400 text-black border-zinc-400" : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10",
                    };
                    return (
                        <button
                            key={s.key}
                            disabled={occ.locked || busy}
                            onClick={() => onMark(s.key)}
                            className={`p-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all ${colors[s.color]} disabled:opacity-50 disabled:cursor-not-allowed`}
                            data-testid={`event-mark-${occ.event_id}-${s.key}`}
                        >
                            <s.icon size={16} weight="fill" className="inline mr-1" />
                            {s.label}
                        </button>
                    );
                })}
            </div>

            {occ.marked_at && !occ.locked && (
                <div className="text-[10px] text-zinc-500 mt-3 text-center">
                    Marked {new Date(occ.marked_at).toLocaleString()}
                </div>
            )}
        </motion.div>
    );
}
