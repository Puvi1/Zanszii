import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, XCircle, MinusCircle, Lock, CaretLeft, CaretRight, Calendar, LockOpen } from "@phosphor-icons/react";
import { motion } from "framer-motion";

const STATUSES = [
    { key: "present", label: "Present", color: "emerald", icon: CheckCircle },
    { key: "absent", label: "Absent", color: "red", icon: XCircle },
    { key: "na", label: "N/A", color: "zinc", icon: MinusCircle },
];

function toISODate(d) { return d.toISOString().slice(0, 10); }

export default function WeeklyAttendance() {
    const [weekOf, setWeekOf] = useState(() => toISODate(new Date()));
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(null);

    const load = async (w) => {
        const { data } = await api.get(`/event-attendance/week?week_of=${w}`);
        setData(data);
    };
    useEffect(() => { load(weekOf); }, [weekOf]);

    const navWeek = (delta) => {
        const d = new Date(weekOf);
        d.setDate(d.getDate() + delta * 7);
        setWeekOf(toISODate(d));
    };

    const mark = async (occ, status) => {
        if (occ.locked) {
            toast.error("Attendance locked (past 8 AM IST)");
            return;
        }
        setBusy(occ.event_id + occ.event_date);
        try {
            await api.post("/event-attendance/mark", {
                event_id: occ.event_id, event_date: occ.event_date, status,
            });
            toast.success(`Marked ${status.toUpperCase()}`);
            await load(weekOf);
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed");
        } finally {
            setBusy(null);
        }
    };

    if (!data) return <div className="text-zinc-500 text-sm">Loading week...</div>;

    return (
        <div className="space-y-6" data-testid="weekly-attendance-page">
            <div>
                <div className="heading-eyebrow">Weekly Ritual</div>
                <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Weekly Attendance</h1>
                <p className="text-zinc-400 mt-2 text-sm">Show up, mark it, own your discipline. Locks at 8:00 AM IST daily.</p>
            </div>

            <div className="glass p-4 flex items-center justify-between">
                <button onClick={() => navWeek(-1)} className="btn-ghost" data-testid="week-prev-btn">
                    <CaretLeft size={16} /> Previous
                </button>
                <div className="text-center">
                    <div className="heading-eyebrow">Week</div>
                    <div className="font-display font-bold text-sm mt-1" data-testid="week-range">
                        {data.week_start} → {data.week_end}
                    </div>
                </div>
                <button onClick={() => navWeek(1)} className="btn-ghost" data-testid="week-next-btn">
                    Next <CaretRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.occurrences.map((occ) => (
                    <EventCard
                        key={occ.event_id + occ.event_date}
                        occ={occ}
                        busy={busy === occ.event_id + occ.event_date}
                        onMark={(status) => mark(occ, status)}
                    />
                ))}
            </div>

            <div className="glass p-4 text-xs text-zinc-500 flex items-center gap-2">
                <Lock size={14} weight="duotone" className="text-yellow-500" />
                Auto-lock: attendance for each event closes at <span className="text-yellow-400 font-bold">8:00 AM IST</span> on the event day.
            </div>
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
