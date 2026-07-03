import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { fireBigConfetti, fireConfetti } from "@/lib/confetti";
import {
    Gift, ForkKnife, FilmSlate, UsersThree, Ticket, Plus, X, Trash, PencilSimple,
    Sparkle, CheckCircle, ClockCountdown, Coins,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
    { key: "dinner", label: "Dinner", icon: ForkKnife, color: "from-orange-500/20 to-red-500/20 border-orange-500/30" },
    { key: "movie", label: "Movie", icon: FilmSlate, color: "from-purple-500/20 to-pink-500/20 border-purple-500/30" },
    { key: "outing", label: "Outing", icon: UsersThree, color: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30" },
    { key: "voucher", label: "Voucher", icon: Ticket, color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30" },
    { key: "other", label: "Other", icon: Gift, color: "from-blue-500/20 to-indigo-500/20 border-blue-500/30" },
];

const catBy = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[4];

export default function Rewards() {
    const { user, refreshUser } = useAuth();
    const isAdmin = user?.role === "super_admin";
    const [items, setItems] = useState([]);
    const [redemptions, setRedemptions] = useState([]);
    const [tab, setTab] = useState("store");  // store | history
    const [modal, setModal] = useState(null);  // {mode:'create'|'edit', reward?}
    const [form, setForm] = useState({ name: "", description: "", cost_xp: 500, category: "voucher" });

    const load = async () => {
        const [r, red] = await Promise.all([
            api.get("/rewards"),
            api.get(isAdmin && tab === "manage" ? "/redemptions?all_users=true" : "/redemptions"),
        ]);
        setItems(r.data);
        setRedemptions(red.data);
    };
    useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab, isAdmin]);

    const openCreate = () => { setForm({ name: "", description: "", cost_xp: 500, category: "voucher" }); setModal({ mode: "create" }); };
    const openEdit = (r) => { setForm({ name: r.name, description: r.description || "", cost_xp: r.cost_xp, category: r.category }); setModal({ mode: "edit", reward: r }); };

    const create = async (e) => {
        e.preventDefault();
        try {
            if (modal.mode === "create") {
                await api.post("/rewards", { ...form, cost_xp: Number(form.cost_xp) });
                toast.success("Reward added");
            } else {
                await api.patch(`/rewards/${modal.reward.reward_id}`, { ...form, cost_xp: Number(form.cost_xp) });
                toast.success("Reward updated");
            }
            setModal(null);
            await load();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    const remove = async (id) => {
        if (!window.confirm("Delete this reward?")) return;
        await api.delete(`/rewards/${id}`);
        toast.success("Reward removed");
        await load();
    };

    const redeem = async (r) => {
        if (!window.confirm(`Redeem "${r.name}" for ${r.cost_xp} XP?`)) return;
        try {
            const { data } = await api.post(`/rewards/${r.reward_id}/redeem`);
            fireBigConfetti();
            toast.success(`Redeemed! ${data.new_xp} XP remaining.`);
            await refreshUser();
            await load();
        } catch (err) { toast.error(err.response?.data?.detail || "Redeem failed"); }
    };

    const fulfill = async (id) => {
        try {
            await api.patch(`/redemptions/${id}/fulfill`);
            toast.success("Marked fulfilled");
            await load();
        } catch { toast.error("Failed"); }
    };

    return (
        <div className="space-y-6" data-testid="rewards-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Spoils of war</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Reward Store</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Convert grind into glory. Redeem XP for real perks.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="glass px-4 py-2 flex items-center gap-2">
                        <Coins size={16} weight="fill" className="text-yellow-400" />
                        <span className="text-[10px] uppercase tracking-widest text-zinc-500">Your XP</span>
                        <span className="font-display font-black text-lg text-yellow-400" data-testid="my-xp-balance">{(user?.xp || 0).toLocaleString()}</span>
                    </div>
                    {isAdmin && (
                        <button onClick={openCreate} className="btn-gold" data-testid="add-reward-btn">
                            <Plus size={16} weight="bold" /> Add Reward
                        </button>
                    )}
                </div>
            </div>

            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
                <TabBtn active={tab === "store"} onClick={() => setTab("store")} testId="rewards-tab-store">Store</TabBtn>
                <TabBtn active={tab === "history"} onClick={() => setTab("history")} testId="rewards-tab-history">My Redemptions</TabBtn>
                {isAdmin && <TabBtn active={tab === "manage"} onClick={() => setTab("manage")} testId="rewards-tab-manage">All Redemptions</TabBtn>}
            </div>

            {tab === "store" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((r) => (
                        <RewardCard key={r.reward_id} reward={r} userXp={user?.xp || 0} onRedeem={() => redeem(r)} isAdmin={isAdmin} onEdit={() => openEdit(r)} onDelete={() => remove(r.reward_id)} />
                    ))}
                    {items.length === 0 && <div className="col-span-full text-center py-16 glass"><Gift size={40} weight="duotone" className="text-zinc-700 mx-auto" /><div className="mt-3 text-zinc-500 text-sm">No rewards yet.</div></div>}
                </div>
            )}

            {tab === "history" && <RedemptionList items={redemptions.filter((r) => r.user_id === user?.user_id)} isAdmin={false} />}
            {tab === "manage" && isAdmin && <RedemptionList items={redemptions} isAdmin={true} onFulfill={fulfill} />}

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(null)}>
                        <motion.form initial={{scale:0.9}} animate={{scale:1}} onSubmit={create} onClick={(e)=>e.stopPropagation()} className="glass-strong p-6 md:p-8 w-full max-w-md relative" data-testid="reward-modal">
                            <button type="button" onClick={()=>setModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            <div className="heading-eyebrow mb-2">{modal.mode === "create" ? "Add to arsenal" : "Edit reward"}</div>
                            <h3 className="font-display font-black text-2xl mb-6">{modal.mode === "create" ? "Add Reward" : "Edit Reward"}</h3>
                            <div className="space-y-3">
                                <input required placeholder="Reward name" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="field" data-testid="reward-name-input" />
                                <textarea rows={3} placeholder="Description" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} className="field resize-none" />
                                <div className="grid grid-cols-2 gap-3">
                                    <select value={form.category} onChange={(e)=>setForm({...form, category: e.target.value})} className="field" data-testid="reward-category-select">
                                        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                    </select>
                                    <input required type="number" min="1" placeholder="XP Cost" value={form.cost_xp} onChange={(e)=>setForm({...form, cost_xp: e.target.value})} className="field" data-testid="reward-xp-input" />
                                </div>
                            </div>
                            <button type="submit" className="btn-gold w-full mt-6" data-testid="reward-submit-btn">
                                {modal.mode === "create" ? "Add Reward" : "Save"}
                            </button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TabBtn({ active, onClick, children, testId }) {
    return <button onClick={onClick} data-testid={testId} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${active ? "bg-yellow-500 text-black" : "text-zinc-400 hover:text-white"}`}>{children}</button>;
}

function RewardCard({ reward, userXp, onRedeem, isAdmin, onEdit, onDelete }) {
    const cat = catBy(reward.category);
    const canAfford = userXp >= reward.cost_xp;
    return (
        <motion.div
            whileHover={{ y: -4 }}
            className={`p-6 rounded-2xl bg-gradient-to-br ${cat.color} border relative overflow-hidden group`}
            data-testid={`reward-card-${reward.reward_id}`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-black/40 backdrop-blur grid place-items-center">
                    <cat.icon size={26} weight="duotone" className="text-white" />
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={onEdit} className="p-1.5 rounded-lg text-zinc-300 hover:text-yellow-400 hover:bg-white/10"><PencilSimple size={14} /></button>
                        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"><Trash size={14} /></button>
                    </div>
                )}
            </div>
            <h3 className="font-display font-bold text-lg">{reward.name}</h3>
            {reward.description && <p className="text-xs text-zinc-300 mt-1 line-clamp-2">{reward.description}</p>}
            <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <Sparkle size={14} weight="fill" className="text-yellow-400" />
                    <span className="font-display font-black text-xl text-yellow-400">{reward.cost_xp.toLocaleString()}</span>
                    <span className="text-[10px] uppercase tracking-widest text-zinc-400">XP</span>
                </div>
                <button
                    onClick={onRedeem}
                    disabled={!canAfford}
                    className={canAfford ? "btn-gold py-2 px-3 text-xs" : "btn-glass py-2 px-3 text-xs opacity-50 cursor-not-allowed"}
                    data-testid={`redeem-${reward.reward_id}`}
                >
                    {canAfford ? "Redeem" : `Need ${(reward.cost_xp - userXp).toLocaleString()} more`}
                </button>
            </div>
        </motion.div>
    );
}

function RedemptionList({ items, isAdmin, onFulfill }) {
    if (items.length === 0) {
        return <div className="glass p-10 text-center text-zinc-500 text-sm">No redemptions yet.</div>;
    }
    return (
        <div className="space-y-2">
            {items.map((r) => (
                <div key={r.redemption_id} className="glass p-4 flex items-center gap-4" data-testid={`redemption-${r.redemption_id}`}>
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                        <Gift size={20} weight="duotone" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold">{r.reward_name}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5 flex flex-wrap gap-x-3">
                            {isAdmin && <span>by {r.user_name}</span>}
                            <span>{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <div className="chip-gold"><Sparkle size={10} weight="fill" /> -{r.cost_xp} XP</div>
                        {r.status === "fulfilled" ? (
                            <div className="chip-emerald"><CheckCircle size={10} weight="fill" /> Fulfilled</div>
                        ) : (
                            <div className="chip-blue"><ClockCountdown size={10} weight="fill" /> Pending</div>
                        )}
                    </div>
                    {isAdmin && r.status !== "fulfilled" && (
                        <button onClick={() => onFulfill(r.redemption_id)} className="btn-blue py-2 px-3 text-xs" data-testid={`fulfill-${r.redemption_id}`}>
                            <CheckCircle size={12} /> Fulfill
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
