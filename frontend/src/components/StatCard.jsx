import { motion } from "framer-motion";

export default function StatCard({ icon: Icon, label, value, sublabel, tone = "gold", testId }) {
    const tones = {
        gold: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        zinc: "text-zinc-300 bg-white/5 border-white/10",
    };
    return (
        <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="glass p-5 flex items-start justify-between relative overflow-hidden"
            data-testid={testId}
        >
            <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{label}</div>
                <div className="mt-2 font-display text-3xl font-black text-white">{value}</div>
                {sublabel && <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>}
            </div>
            <div className={`p-3 rounded-xl border ${tones[tone]}`}>
                {Icon && <Icon size={24} weight="duotone" />}
            </div>
        </motion.div>
    );
}
