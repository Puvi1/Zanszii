import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Sword } from "@phosphor-icons/react";

export default function AuthCallback() {
    const hasProcessed = useRef(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();

    useEffect(() => {
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const hash = window.location.hash || "";
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const sessionId = params.get("session_id");
        if (!sessionId) {
            navigate("/auth", { replace: true });
            return;
        }
        (async () => {
            try {
                const { data } = await api.post("/auth/google-session", { session_id: sessionId });
                setUser(data.user);
                // Clear hash and navigate to dashboard
                window.history.replaceState(null, "", window.location.pathname);
                navigate("/", { replace: true, state: { user: data.user } });
            } catch (err) {
                navigate("/auth", { replace: true });
            }
        })();
    }, [navigate, setUser]);

    return (
        <div className="min-h-screen bg-[#050507] grid place-items-center">
            <div className="flex flex-col items-center gap-4" data-testid="auth-callback-loading">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500 text-black grid place-items-center shadow-[0_0_30px_rgba(234,179,8,0.6)] animate-pulse">
                    <Sword size={32} weight="fill" />
                </div>
                <div className="text-zinc-500 text-sm tracking-widest uppercase">Establishing Session</div>
            </div>
        </div>
    );
}
