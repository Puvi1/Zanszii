import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Plus, Trash, Users, X, Crown, PencilSimple, ShieldCheck } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "@/components/Avatar";

export default function Teams() {
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]);
    const [modal, setModal] = useState(null); // {mode: 'create'|'edit'|'assign', team?}
    const [form, setForm] = useState({ name: "", leader_id: "" });
    const [assign, setAssign] = useState({ user_id: "", is_leader: false });

    const load = async () => {
        const [t, u] = await Promise.all([api.get("/teams"), api.get("/admin/users")]);
        setTeams(t.data);
        setUsers(u.data);
    };
    useEffect(() => { load(); }, []);

    const openCreate = () => { setForm({ name: "", leader_id: "" }); setModal({ mode: "create" }); };
    const openEdit = (team) => { setForm({ name: team.name, leader_id: team.leader_id || "" }); setModal({ mode: "edit", team }); };
    const openAssign = (team) => { setAssign({ user_id: "", is_leader: false }); setModal({ mode: "assign", team }); };

    const submitCreate = async (e) => {
        e.preventDefault();
        try {
            const payload = { name: form.name };
            if (form.leader_id) payload.leader_id = form.leader_id;
            await api.post("/teams", payload);
            toast.success("Team created");
            setModal(null);
            await load();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            const payload = { name: form.name };
            payload.leader_id = form.leader_id || null;
            await api.patch(`/teams/${modal.team.team_id}`, payload);
            toast.success("Team updated");
            setModal(null);
            await load();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    const submitAssign = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/teams/${modal.team.team_id}/assign`, assign);
            toast.success("Member assigned");
            setModal(null);
            await load();
        } catch (err) { toast.error(err.response?.data?.detail || "Failed"); }
    };

    const removeTeam = async (team) => {
        if (!window.confirm(`Delete team ${team.name}? All members will be unassigned.`)) return;
        await api.delete(`/teams/${team.team_id}`);
        toast.success("Team deleted");
        await load();
    };

    const removeMember = async (team_id, user_id) => {
        if (!window.confirm("Remove this member from the team?")) return;
        await api.delete(`/teams/${team_id}/members/${user_id}`);
        toast.success("Member removed");
        await load();
    };

    return (
        <div className="space-y-6" data-testid="teams-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Command Structure</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Teams</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Forge divisions. Crown leaders. Assign warriors.</p>
                </div>
                <button onClick={openCreate} className="btn-gold" data-testid="create-team-btn">
                    <Plus size={18} weight="bold" /> New Team
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((t) => (
                    <TeamCard
                        key={t.team_id}
                        team={t}
                        users={users}
                        onEdit={() => openEdit(t)}
                        onAssign={() => openAssign(t)}
                        onRemove={() => removeTeam(t)}
                        onRemoveMember={(uid) => removeMember(t.team_id, uid)}
                    />
                ))}
                {teams.length === 0 && <div className="text-zinc-500 text-sm md:col-span-2">No teams yet. Create your first division.</div>}
            </div>

            <AnimatePresence>
                {modal && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-4" onClick={() => setModal(null)}>
                        <motion.form
                            initial={{scale:0.9}} animate={{scale:1}}
                            onSubmit={modal.mode === "create" ? submitCreate : modal.mode === "edit" ? submitEdit : submitAssign}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-strong p-6 md:p-8 w-full max-w-md relative"
                            data-testid={`team-modal-${modal.mode}`}
                        >
                            <button type="button" onClick={() => setModal(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20} /></button>
                            {modal.mode === "create" && (
                                <>
                                    <div className="heading-eyebrow mb-2">Forge new division</div>
                                    <h3 className="font-display font-black text-2xl mb-6">Create Team</h3>
                                    <div className="space-y-3">
                                        <input required placeholder="Team name (e.g. Titans)" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="field" data-testid="team-name-input" />
                                        <select value={form.leader_id} onChange={(e)=>setForm({...form, leader_id:e.target.value})} className="field">
                                            <option value="">Assign leader (optional)</option>
                                            {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name} — {u.email}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="btn-gold w-full mt-6" data-testid="team-submit-btn">Forge Team</button>
                                </>
                            )}
                            {modal.mode === "edit" && (
                                <>
                                    <div className="heading-eyebrow mb-2">Rewrite history</div>
                                    <h3 className="font-display font-black text-2xl mb-6">Edit {modal.team.name}</h3>
                                    <div className="space-y-3">
                                        <input required placeholder="Team name" value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="field" />
                                        <select value={form.leader_id} onChange={(e)=>setForm({...form, leader_id:e.target.value})} className="field">
                                            <option value="">No leader</option>
                                            {users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name} — {u.email}</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" className="btn-gold w-full mt-6">Save Changes</button>
                                </>
                            )}
                            {modal.mode === "assign" && (
                                <>
                                    <div className="heading-eyebrow mb-2">Reinforce ranks</div>
                                    <h3 className="font-display font-black text-2xl mb-6">Add to {modal.team.name}</h3>
                                    <div className="space-y-3">
                                        <select required value={assign.user_id} onChange={(e)=>setAssign({...assign, user_id: e.target.value})} className="field" data-testid="assign-user-select">
                                            <option value="">Select member...</option>
                                            {users.filter((u) => u.team_id !== modal.team.team_id).map((u) => (
                                                <option key={u.user_id} value={u.user_id}>{u.name} — {u.email} ({u.team || "Unassigned"})</option>
                                            ))}
                                        </select>
                                        <label className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                                            <input type="checkbox" checked={assign.is_leader} onChange={(e)=>setAssign({...assign, is_leader:e.target.checked})} className="w-4 h-4" data-testid="assign-leader-toggle" />
                                            <span className="text-sm">Make team leader (replaces current)</span>
                                        </label>
                                    </div>
                                    <button type="submit" className="btn-gold w-full mt-6" data-testid="assign-submit-btn">Assign</button>
                                </>
                            )}
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function TeamCard({ team, users, onEdit, onAssign, onRemove, onRemoveMember }) {
    const members = users.filter((u) => u.team_id === team.team_id);
    return (
        <div className="glass p-6 relative overflow-hidden" data-testid={`team-card-${team.team_id}`}>
            <div className="absolute -top-16 -right-16 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl" />
            <div className="relative">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-blue-500 grid place-items-center font-display font-black text-black text-xl">
                                {team.name[0]}
                            </div>
                            <div>
                                <h4 className="font-display font-black text-xl">Team {team.name}</h4>
                                <div className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                                    <Users size={10} /> {team.member_count} members
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onEdit} className="p-2 rounded-lg text-zinc-400 hover:text-yellow-400 hover:bg-white/5" data-testid={`edit-team-${team.team_id}`}><PencilSimple size={16} /></button>
                        <button onClick={onRemove} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10" data-testid={`delete-team-${team.team_id}`}><Trash size={16} /></button>
                    </div>
                </div>

                {team.leader && (
                    <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
                        <Crown size={20} weight="fill" className="text-yellow-400" />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] uppercase tracking-widest text-yellow-500/80">Team Leader</div>
                            <div className="text-sm font-bold truncate">{team.leader.name}</div>
                        </div>
                    </div>
                )}
                {!team.leader && (
                    <div className="mb-4 p-3 rounded-xl bg-white/[0.02] border border-white/10 border-dashed text-center">
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">No leader assigned</div>
                    </div>
                )}

                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                    {members.map((m) => (
                        <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 text-sm">
                            <Avatar user={m} size={28} />
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold truncate">{m.name}</div>
                                <div className="text-[10px] text-zinc-500">{m.role.replace("_", " ")}</div>
                            </div>
                            {m.user_id === team.leader_id ? (
                                <ShieldCheck size={16} weight="fill" className="text-yellow-400" />
                            ) : (
                                <button onClick={() => onRemoveMember(m.user_id)} className="p-1 text-zinc-500 hover:text-red-400">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                    {members.length === 0 && <div className="text-zinc-500 text-xs italic p-2">No members yet</div>}
                </div>

                <button onClick={onAssign} className="btn-glass w-full mt-4 py-2 text-sm" data-testid={`assign-member-${team.team_id}`}>
                    <Plus size={14} /> Add Member
                </button>
            </div>
        </div>
    );
}
