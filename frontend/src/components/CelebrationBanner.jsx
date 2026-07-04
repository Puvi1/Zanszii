import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, HeartStraight, X, Sparkle } from "@phosphor-icons/react";
import { fireBigConfetti } from "@/lib/confetti";
import Avatar from "./Avatar";

const DISMISSED_KEY = "sgl_celeb_dismissed";

export default function CelebrationBanner() {
    const [data, setData] = useState(null);
    const [visible, setVisible] = useState(false);
    const today = new Date().toISOString().slice(0, 10);

    useEffect(() => {
        api.get("/celebrations/today")
            .then((r) => {
                setData(r.data);
                const dismissed = localStorage.getItem(DISMISSED_KEY);
                const anyCeleb = r.data.birthdays.length > 0 || r.data.anniversaries.length > 0;
                if (anyCeleb && dismissed !== today) {
                    setVisible(true);
                    setTimeout(() => fireBigConfetti(), 400);
                }
            })
            .catch(() => {});
    }, [today]);

    const close = () => {
        localStorage.setItem(DISMISSED_KEY, today);
        setVisible(false);
    };

    if (!visible || !data) return null;
    const { birthdays, anniversaries } = data;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-strong p-5 md:p-6 relative overflow-hidden border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-blue-500/5 to-yellow-500/10"
                data-testid="celebration-banner"
            >
                <div className="absolute -top-16 -right-16 w-40 h-40 bg-yellow-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
                <button onClick={close} className="absolute top-3 right-3 p-2 text-zinc-400 hover:text-white" data-testid="celebration-close">
                    <X size={16} />
                </button>
                <div className="relative">
                    <div className="heading-eyebrow flex items-center gap-2">
                        <Sparkle size={12} weight="fill" className="text-yellow-400" />
                        Celebrations today
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {birthdays.length > 0 && (
                            <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30" data-testid="celeb-birthdays">
                                <div className="flex items-center gap-3 mb-3">
                                    <Cake size={26} weight="fill" className="text-yellow-400" />
                                    <div>
                                        <div className="font-display font-black text-lg">Happy Birthday!</div>
                                        <div className="text-[10px] uppercase tracking-widest text-yellow-500/80">{birthdays.length} Spartan{birthdays.length > 1 ? "s" : ""}</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {birthdays.map((u) => (
                                        <div key={u.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                            <Avatar user={u} size={24} />
                                            <span className="text-sm font-semibold">{u.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {anniversaries.length > 0 && (
                            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30" data-testid="celeb-anniversaries">
                                <div className="flex items-center gap-3 mb-3">
                                    <HeartStraight size={26} weight="fill" className="text-red-400" />
                                    <div>
                                        <div className="font-display font-black text-lg">Happy Anniversary!</div>
                                        <div className="text-[10px] uppercase tracking-widest text-blue-400/80">{anniversaries.length} couple{anniversaries.length > 1 ? "s" : ""}</div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {anniversaries.map((u) => (
                                        <div key={u.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                            <Avatar user={u} size={24} />
                                            <span className="text-sm font-semibold">{u.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
