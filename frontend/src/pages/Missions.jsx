import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { fireConfetti, fireBigConfetti } from "@/lib/confetti";
import { motion, AnimatePresence } from "framer-motion";
import {
    Plus, MapPin, Camera, X, Crosshair, Phone, ArrowSquareOut, User as UserIcon,
    Sparkle, ChatCircleText, Trash, CheckCircle,
} from "@phosphor-icons/react";

const STATUS = [
    { key: "new", label: "New", chip: "chip-blue" },
    { key: "followup", label: "Follow-up", chip: "chip-gold" },
    { key: "converted", label: "Converted", chip: "chip-emerald" },
];

// Client-side image compression: JPEG, max 1200px long edge, quality 0.72
async function compressImage(file, maxDim = 1200, quality = 0.72) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxDim) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else if (height > maxDim) {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function Missions() {
    const { refreshUser } = useAuth();
    const [items, setItems] = useState([]);
    const [modal, setModal] = useState(false);
    const [filter, setFilter] = useState("all");
    const [selected, setSelected] = useState(null);

    const load = async () => {
        const { data } = await api.get("/missions");
        setItems(data);
    };
    useEffect(() => { load(); }, []);

    const remove = async (id) => {
        if (!window.confirm("Delete this mission?")) return;
        await api.delete(`/missions/${id}`);
        toast.success("Mission removed");
        await load();
    };

    const updateStatus = async (id, status) => {
        try {
            await api.patch(`/missions/${id}`, { status });
            if (status === "converted") {
                fireBigConfetti();
                toast.success("Prospect CONVERTED! +40 XP");
            } else {
                toast.success(`Status → ${status}`);
            }
            await load();
            await refreshUser();
        } catch { toast.error("Update failed"); }
    };

    const filtered = items.filter((m) => filter === "all" || m.status === filter);
    const stats = STATUS.reduce((acc, s) => ({ ...acc, [s.key]: items.filter((m) => m.status === s.key).length }), {});

    return (
        <div className="space-y-6" data-testid="missions-page">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <div className="heading-eyebrow">Field ops</div>
                    <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter mt-1">Daily Missions</h1>
                    <p className="text-zinc-400 mt-2 text-sm">Log every prospect meeting with GPS proof. Field intelligence = fortune.</p>
                </div>
                <button onClick={() => setModal(true)} className="btn-gold" data-testid="add-mission-btn">
                    <Plus size={18} weight="bold" /> Log Mission
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <FilterCard label="All" value={items.length} active={filter === "all"} onClick={() => setFilter("all")} tone="zinc" testId="mission-filter-all" />
                {STATUS.map((s) => (
                    <FilterCard key={s.key} label={s.label} value={stats[s.key] || 0} active={filter === s.key} onClick={() => setFilter(s.key)} chip={s.chip} testId={`mission-filter-${s.key}`} />
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.length === 0 && (
                    <div className="col-span-full text-center py-16 glass">
                        <Crosshair size={44} weight="duotone" className="text-zinc-700 mx-auto" />
                        <div className="mt-3 text-zinc-500 text-sm">No missions logged yet. Start your first field op.</div>
                    </div>
                )}
                {filtered.map((m) => (
                    <MissionCard
                        key={m.mission_id}
                        m={m}
                        onOpen={() => setSelected(m)}
                        onDelete={() => remove(m.mission_id)}
                        onStatus={(s) => updateStatus(m.mission_id, s)}
                    />
                ))}
            </div>

            <AnimatePresence>
                {modal && <MissionModal onClose={() => setModal(false)} onCreated={async () => { setModal(false); await load(); await refreshUser(); }} />}
                {selected && <MissionDetailModal m={selected} onClose={() => setSelected(null)} />}
            </AnimatePresence>
        </div>
    );
}

function FilterCard({ label, value, active, onClick, chip = "chip-zinc", testId }) {
    return (
        <button onClick={onClick} className={`glass p-4 text-left transition-all ${active ? "ring-2 ring-yellow-500/50" : ""}`} data-testid={testId}>
            <div className={chip}>{label}</div>
            <div className="font-display text-3xl font-black mt-3">{value}</div>
        </button>
    );
}

function MissionCard({ m, onOpen, onDelete, onStatus }) {
    const status = STATUS.find((s) => s.key === m.status) || STATUS[0];
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="glass overflow-hidden group"
            data-testid={`mission-card-${m.mission_id}`}
        >
            <div
                className="relative h-40 bg-zinc-900 cursor-pointer overflow-hidden"
                onClick={onOpen}
            >
                {m.photo_data ? (
                    <img src={m.photo_data} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="w-full h-full grid place-items-center">
                        <div className="text-center">
                            <Camera size={32} weight="duotone" className="text-zinc-700 mx-auto" />
                            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mt-2">No photo</div>
                        </div>
                    </div>
                )}
                <div className="absolute top-3 left-3">
                    <span className={status.chip}>{status.label}</span>
                </div>
                {m.google_maps_url && (
                    <div className="absolute top-3 right-3 chip-blue">
                        <MapPin size={10} weight="fill" /> GPS
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-3 pt-8">
                    <div className="flex items-center gap-2">
                        <UserIcon size={14} className="text-yellow-400" />
                        <span className="font-display font-bold truncate">{m.prospect_name}</span>
                    </div>
                </div>
            </div>
            <div className="p-4 space-y-2">
                {m.mobile_number && (
                    <a href={`tel:${m.mobile_number}`} className="flex items-center gap-2 text-sm text-zinc-300 hover:text-yellow-400">
                        <Phone size={14} weight="duotone" />
                        <span className="font-mono">{m.mobile_number}</span>
                    </a>
                )}
                {m.notes && (
                    <div className="flex items-start gap-2 text-xs text-zinc-400">
                        <ChatCircleText size={14} weight="duotone" className="mt-0.5 shrink-0 text-zinc-500" />
                        <span className="line-clamp-2 italic">&ldquo;{m.notes}&rdquo;</span>
                    </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    {m.google_maps_url ? (
                        <a
                            href={m.google_maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-ghost text-xs py-1 px-2"
                            data-testid={`mission-map-${m.mission_id}`}
                        >
                            <MapPin size={12} weight="fill" /> Map <ArrowSquareOut size={10} />
                        </a>
                    ) : (
                        <span className="text-[10px] uppercase tracking-widest text-zinc-600">No location</span>
                    )}
                    <div className="flex items-center gap-1">
                        <select
                            value={m.status}
                            onChange={(e) => onStatus(e.target.value)}
                            className="bg-[#0f0f12] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`mission-status-${m.mission_id}`}
                        >
                            {STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10">
                            <Trash size={14} />
                        </button>
                    </div>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                    {new Date(m.created_at).toLocaleString()}
                </div>
            </div>
        </motion.div>
    );
}

function MissionModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ prospect_name: "", mobile_number: "", notes: "", status: "new" });
    const [gps, setGps] = useState(null); // {lat,lng,accuracy}
    const [gpsBusy, setGpsBusy] = useState(false);
    const [gpsError, setGpsError] = useState("");
    const [photo, setPhoto] = useState(null); // data URL
    const [photoBusy, setPhotoBusy] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const fileRef = useRef(null);

    const captureGps = () => {
        setGpsError(""); setGpsBusy(true);
        if (!("geolocation" in navigator)) {
            setGpsError("GPS not supported on this device");
            setGpsBusy(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                setGpsBusy(false);
            },
            (err) => {
                setGpsError(err.message || "Location permission denied");
                setGpsBusy(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
        );
    };

    useEffect(() => { captureGps(); }, []);

    const onPhoto = async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setPhotoBusy(true);
        try {
            const compressed = await compressImage(f);
            setPhoto(compressed);
        } catch { toast.error("Failed to process photo"); }
        finally { setPhotoBusy(false); }
    };

    const submit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                prospect_name: form.prospect_name.trim(),
                mobile_number: form.mobile_number.trim() || null,
                notes: form.notes.trim() || null,
                status: form.status,
                lat: gps?.lat, lng: gps?.lng, accuracy: gps?.accuracy,
                photo_data: photo,
            };
            const { data } = await api.post("/missions", payload);
            fireConfetti({ particleCount: 100 });
            const xpAmount = data.xp?.xp ? "+40" : "+10";
            toast.success(`Mission logged · ${form.status === "converted" ? "+40" : "+10"} XP`);
            if (data.xp?.leveled_up) {
                setTimeout(() => {
                    fireConfetti({ particleCount: 200, spread: 100 });
                    toast.success(`LEVEL UP! You are now level ${data.xp.level}`);
                }, 400);
            }
            onCreated();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to log mission");
        } finally { setSubmitting(false); }
    };

    return (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm grid place-items-end sm:place-items-center p-0 sm:p-4" onClick={onClose}>
            <motion.form
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="glass-strong w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-6 md:p-8 relative"
                data-testid="mission-modal"
            >
                <button type="button" onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-2">
                    <X size={20} />
                </button>
                <div className="heading-eyebrow mb-2">New field op</div>
                <h3 className="font-display font-black text-2xl mb-6">Log Mission</h3>

                {/* Photo section */}
                <div className="mb-4">
                    <label className="block text-[10px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Photo Evidence</label>
                    {photo ? (
                        <div className="relative rounded-2xl overflow-hidden border border-yellow-500/30">
                            <img src={photo} alt="preview" className="w-full h-48 object-cover" />
                            <button type="button" onClick={() => setPhoto(null)} className="absolute top-2 right-2 p-2 rounded-full bg-black/70 text-white">
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={photoBusy}
                            className="w-full h-48 rounded-2xl border-2 border-dashed border-white/10 hover:border-yellow-500/40 hover:bg-yellow-500/5 grid place-items-center transition-all"
                            data-testid="mission-photo-btn"
                        >
                            {photoBusy ? (
                                <div className="text-yellow-400 text-sm">Processing...</div>
                            ) : (
                                <div className="text-center">
                                    <Camera size={32} weight="duotone" className="text-yellow-500 mx-auto" />
                                    <div className="mt-2 text-sm font-semibold text-zinc-300">Take Photo</div>
                                    <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Camera / Gallery</div>
                                </div>
                            )}
                        </button>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={onPhoto}
                        className="hidden"
                        data-testid="mission-photo-input"
                    />
                </div>

                {/* GPS section */}
                <div className="mb-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <MapPin size={16} weight="fill" className="text-blue-400" />
                            <span className="text-xs uppercase tracking-widest text-blue-400 font-bold">Live GPS</span>
                        </div>
                        <button type="button" onClick={captureGps} disabled={gpsBusy} className="btn-ghost text-xs py-1 px-2" data-testid="mission-gps-refresh">
                            <Crosshair size={12} /> {gpsBusy ? "Locating..." : "Refresh"}
                        </button>
                    </div>
                    {gps ? (
                        <div>
                            <div className="font-mono text-xs text-zinc-300" data-testid="mission-gps-coords">
                                {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                            </div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                Accuracy: ±{Math.round(gps.accuracy)}m
                                {" · "}
                                <a href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                                    View on map <ArrowSquareOut size={10} />
                                </a>
                            </div>
                        </div>
                    ) : gpsError ? (
                        <div className="text-xs text-red-400">{gpsError}</div>
                    ) : (
                        <div className="text-xs text-zinc-400">Acquiring location...</div>
                    )}
                </div>

                <div className="space-y-3">
                    <input required placeholder="Prospect name" value={form.prospect_name} onChange={(e) => setForm({...form, prospect_name: e.target.value})} className="field" data-testid="mission-name-input" />
                    <input type="tel" placeholder="Mobile number (e.g. +91 98765 43210)" value={form.mobile_number} onChange={(e) => setForm({...form, mobile_number: e.target.value})} className="field" data-testid="mission-mobile-input" />
                    <textarea rows={3} placeholder="Notes — what did you discuss? Pain points? Next steps?" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="field resize-none" data-testid="mission-notes-input" />
                    <div className="grid grid-cols-3 gap-2">
                        {STATUS.map((s) => (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => setForm({...form, status: s.key})}
                                className={`p-3 rounded-xl border transition-all font-bold text-xs uppercase tracking-widest ${
                                    form.status === s.key
                                        ? "bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                                        : "bg-white/5 text-zinc-400 border-white/10 hover:border-white/20"
                                }`}
                                data-testid={`mission-status-btn-${s.key}`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button type="submit" disabled={submitting} className="btn-gold w-full mt-6 py-4" data-testid="mission-submit-btn">
                    {submitting ? "Submitting..." : (
                        <>
                            <Sparkle size={18} weight="fill" />
                            Log Mission · {form.status === "converted" ? "+40" : "+10"} XP
                        </>
                    )}
                </button>
            </motion.form>
        </motion.div>
    );
}

function MissionDetailModal({ m, onClose }) {
    const status = STATUS.find((s) => s.key === m.status) || STATUS[0];
    return (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
            <motion.div
                initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-strong w-full max-w-md relative rounded-2xl overflow-hidden"
                data-testid="mission-detail-modal"
            >
                <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/70 text-white">
                    <X size={18} />
                </button>
                {m.photo_data && (
                    <img src={m.photo_data} alt="" className="w-full h-72 object-cover" />
                )}
                <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="heading-eyebrow">Mission Log</div>
                            <h3 className="font-display font-black text-2xl mt-1">{m.prospect_name}</h3>
                        </div>
                        <span className={status.chip}><CheckCircle size={10} weight="fill" /> {status.label}</span>
                    </div>
                    {m.mobile_number && (
                        <a href={`tel:${m.mobile_number}`} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10">
                            <Phone size={18} weight="duotone" className="text-yellow-400" />
                            <span className="font-mono text-sm">{m.mobile_number}</span>
                        </a>
                    )}
                    {m.notes && (
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Notes</div>
                            <div className="text-sm italic text-zinc-300">&ldquo;{m.notes}&rdquo;</div>
                        </div>
                    )}
                    {m.google_maps_url && (
                        <a href={m.google_maps_url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20">
                            <div className="flex items-center gap-3">
                                <MapPin size={18} weight="duotone" className="text-blue-400" />
                                <div>
                                    <div className="text-xs font-mono">{m.lat?.toFixed(5)}, {m.lng?.toFixed(5)}</div>
                                    {m.accuracy && <div className="text-[10px] text-zinc-500">±{Math.round(m.accuracy)}m accuracy</div>}
                                </div>
                            </div>
                            <ArrowSquareOut size={16} className="text-blue-400" />
                        </a>
                    )}
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600 text-center pt-2">
                        Logged {new Date(m.created_at).toLocaleString()}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
