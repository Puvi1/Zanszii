import { motion } from "framer-motion";

export default function XPBar({ current, next, level, xp, size = "md" }) {
    const pct = Math.max(0, Math.min(100, ((xp - current) / Math.max(1, next - current)) * 100));
    const height = size === "sm" ? "h-2.5" : size === "lg" ? "h-5" : "h-4";
    return (
        <div className="w-full" data-testid="xp-bar">
            <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="chip-gold" data-testid="xp-level-chip">LVL {level}</span>
                    <span className="text-xs uppercase tracking-[0.25em] text-zinc-500">Rank Progress</span>
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                    <span className="text-white font-bold" data-testid="xp-current">{xp.toLocaleString()}</span>
                    <span className="mx-1 text-zinc-600">/</span>
                    <span data-testid="xp-next">{next.toLocaleString()} XP</span>
                </div>
            </div>
            <div className={`w-full ${height} rounded-full bg-zinc-900/80 overflow-hidden border border-white/5 shadow-inner relative`}>
                <motion.div
                    className={`${height} xp-bar-inner rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}
