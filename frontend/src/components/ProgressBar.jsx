import { motion } from "framer-motion";

export default function ProgressBar({ value = 0, max = 100, color = "gold", testId }) {
    const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
    const styles = {
        gold: "bg-gradient-to-r from-yellow-500 to-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.5)]",
        blue: "bg-gradient-to-r from-blue-500 to-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]",
        emerald: "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    };
    return (
        <div className="w-full h-2.5 bg-zinc-900/80 rounded-full overflow-hidden border border-white/5" data-testid={testId}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className={`h-full rounded-full ${styles[color]}`}
            />
        </div>
    );
}
