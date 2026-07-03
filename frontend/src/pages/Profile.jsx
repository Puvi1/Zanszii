import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import XPBar from "@/components/XPBar";
import ProgressBar from "@/components/ProgressBar";
import { ShieldStar, Sword, Trophy, Fire, LockKey, Sparkle, PencilSimple, Check, X } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { fireBigConfetti } from "@/lib/confetti";

export default function Profile() {
    const { user, refreshUser } = useAuth();
    const [badges, setBadges] = useState([]);
    const [stats, setStats] = useState(null);
    const [completion, setCompletion] = useState(null);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ phone: "", bio: "", avatar_url: "" });

    const loadCompletion = async () => {
        const { data } = await api.get("/profile/completion");
        setCompletion(data);
    };

    useEffect(() => {
        api.get("/badges").then((r) => setBadges(r.data));
        api.get("/dashboard/stats").then((r) => setStats(r.data));
        loadCompletion();
    }, []);

    useEffect(() => {
        if (user) {
            setForm({ phone: user.phone || "", bio: user.bio || "", avatar_url: user.avatar_url || "" });
        }
    }, [user]);

    const saveProfile = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.patch("/profile", form);
            if (data.xp) {
                fireBigConfetti();
                toast.success("Profile complete! +50 XP");
            } else {
                toast.success("Profile updated");
            }
            setEditing(false);
            await refreshUser();
            await loadCompletion();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    if (!user || !stats) return <div className="text-zinc-500 text-sm">Loading...</div>;

    const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
    const unlocked = badges.filter((b) => b.unlocked);
    const missingLabels = { avatar_url: "Avatar", team_id: "Team", phone: "Phone", bio: "Bio" };
    const locked = badges.filter((b) => !b.unlocked);

    const circumference = 2 * Math.PI * 88;
    const pctVal = (((stats.xp - stats.current_level_xp) / Math.max(1, stats.next_level_xp - stats.current_level_xp)) * 100) || 0;
    const offset = circumference - (pctVal / 100) * circumference;

    return (
        <div className="space-y-8" data-testid="profile-page">
            <section className="glass-strong p-6 md:p-10 relative overflow-hidden">
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-yellow-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="relative flex flex-col md:flex-row items-center md:items-start gap-8">
                    {/* Avatar with XP ring */}
                    <div className="relative w-52 h-52">
                        <svg className="absolute inset-0 -rotate-90" width="208" height="208" viewBox="0 0 208 208">
                            <circle cx="104" cy="104" r="88" stroke="rgba(255,255,255,0.08)" strokeWidth="12" fill="none" />
                            <motion.circle
                                cx="104" cy="104" r="88" fill="none"
                                stroke="url(#xp-grad)" strokeWidth="12" strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: offset }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                            <defs>
                                <linearGradient id="xp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#EAB308" />
                                    <stop offset="100%" stopColor="#3B82F6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-display font-black text-6xl text-black">
                            {user.picture ? (
                                <img src={user.picture} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : initials}
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 chip-gold shadow-lg">
                            <ShieldStar size={12} weight="fill" /> LVL {stats.level}
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="heading-eyebrow">{user.role?.replace("_", " ")}</div>
                        <h1 className="font-display font-black text-3xl md:text-5xl tracking-tighter mt-1" data-testid="profile-name">
                            {user.name}
                        </h1>
                        <div className="text-zinc-500 mt-2">{user.email}</div>
                        <div className="mt-3 chip-blue inline-flex">Team {user.team || "Unassigned"}</div>

                        <div className="mt-6 max-w-md mx-auto md:mx-0">
                            <XPBar xp={stats.xp} current={stats.current_level_xp} next={stats.next_level_xp} level={stats.level} />
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-6 max-w-md mx-auto md:mx-0">
                            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                                <Fire size={22} weight="duotone" className="text-yellow-400 mx-auto" />
                                <div className="font-display font-black text-2xl mt-1">{stats.streak_current}</div>
                                <div className="text-[9px] uppercase tracking-widest text-zinc-500">Streak</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                                <Trophy size={22} weight="duotone" className="text-blue-400 mx-auto" />
                                <div className="font-display font-black text-2xl mt-1">{stats.prospects_won}</div>
                                <div className="text-[9px] uppercase tracking-widest text-zinc-500">Wins</div>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-white/5 border border-white/5">
                                <ShieldStar size={22} weight="duotone" className="text-emerald-400 mx-auto" />
                                <div className="font-display font-black text-2xl mt-1">{unlocked.length}</div>
                                <div className="text-[9px] uppercase tracking-widest text-zinc-500">Badges</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Profile Completion */}
            {completion && (
                <section className="glass p-6" data-testid="profile-completion">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                            <div className="heading-eyebrow">Profile completion</div>
                            <h3 className="font-display font-bold text-xl mt-1">
                                {completion.pct}% complete
                                {completion.completion_xp_awarded && <span className="chip-emerald ml-2"><Sparkle size={10} weight="fill" /> +50 XP earned</span>}
                            </h3>
                        </div>
                        {!editing ? (
                            <button onClick={() => setEditing(true)} className="btn-gold py-2 px-4 text-sm" data-testid="edit-profile-btn">
                                <PencilSimple size={14} weight="bold" /> Edit Profile
                            </button>
                        ) : (
                            <button onClick={() => setEditing(false)} className="btn-ghost text-sm" data-testid="cancel-edit-btn">
                                <X size={14} /> Cancel
                            </button>
                        )}
                    </div>
                    <ProgressBar value={completion.pct} max={100} color="gold" testId="completion-progress" />

                    {editing ? (
                        <form onSubmit={saveProfile} className="mt-6 space-y-3">
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Avatar URL</label>
                                <input type="url" placeholder="https://..." value={form.avatar_url} onChange={(e)=>setForm({...form, avatar_url: e.target.value})} className="field" data-testid="profile-avatar-input" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Phone</label>
                                <input type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} className="field" data-testid="profile-phone-input" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Bio</label>
                                <textarea rows={3} placeholder="Your story, your mission..." value={form.bio} onChange={(e)=>setForm({...form, bio: e.target.value})} className="field resize-none" data-testid="profile-bio-input" />
                            </div>
                            <button type="submit" className="btn-gold w-full mt-2" data-testid="save-profile-btn">
                                <Check size={16} weight="bold" /> Save
                                {!completion.completion_xp_awarded && completion.pct < 100 && <span className="ml-1 text-xs opacity-80">· complete for +50 XP</span>}
                            </button>
                        </form>
                    ) : completion.missing.length > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {completion.missing.map((m) => (
                                <span key={m} className="chip-zinc" data-testid={`missing-${m}`}>Missing: {missingLabels[m] || m}</span>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-4 text-sm text-emerald-400 flex items-center gap-2">
                            <Check size={14} weight="bold" /> All fields filled. You're a full Spartan.
                        </div>
                    )}
                </section>
            )}

            {/* Badges */}
            <section>
                <div className="mb-4">
                    <div className="heading-eyebrow">Trophy Hall</div>
                    <h3 className="font-display font-black text-2xl mt-1">Badge Collection</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {badges.map((b) => (
                        <BadgeCard key={b.key} badge={b} />
                    ))}
                </div>
            </section>
        </div>
    );
}

function BadgeCard({ badge }) {
    const tierColors = {
        bronze: { bg: "from-amber-700/20 to-transparent", border: "border-amber-700/40", icon: "text-amber-500" },
        silver: { bg: "from-zinc-300/10 to-transparent", border: "border-zinc-400/40", icon: "text-zinc-300" },
        gold: { bg: "from-yellow-500/20 to-transparent", border: "border-yellow-500/50", icon: "text-yellow-400" },
    };
    const t = tierColors[badge.tier] || tierColors.bronze;
    const unlocked = badge.unlocked;

    return (
        <motion.div
            whileHover={unlocked ? { y: -4 } : undefined}
            className={`p-5 rounded-2xl bg-gradient-to-br ${t.bg} border ${unlocked ? t.border : "border-white/5 opacity-40"} text-center relative overflow-hidden`}
            data-testid={`badge-${badge.key}`}
        >
            {unlocked ? (
                <Sparkle size={16} weight="fill" className="absolute top-2 right-2 text-yellow-400" />
            ) : (
                <LockKey size={14} weight="fill" className="absolute top-2 right-2 text-zinc-600" />
            )}
            <div className={`w-16 h-16 mx-auto rounded-full grid place-items-center mb-3 ${unlocked ? "bg-white/5 border border-white/10" : "bg-zinc-900 border border-zinc-800"}`}>
                <Sword size={30} weight={unlocked ? "duotone" : "regular"} className={unlocked ? t.icon : "text-zinc-700"} />
            </div>
            <div className={`font-display font-bold text-sm ${unlocked ? "text-white" : "text-zinc-500"}`}>{badge.name}</div>
            <div className={`text-[10px] mt-1 leading-tight ${unlocked ? "text-zinc-400" : "text-zinc-600"}`}>{badge.description}</div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-yellow-500/80">+{badge.xp_reward} XP</div>
        </motion.div>
    );
}
