import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Sword } from "@phosphor-icons/react";

export default function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading || user === null) {
        return (
            <div className="min-h-screen bg-[#050507] grid place-items-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-yellow-500 text-black grid place-items-center shadow-[0_0_30px_rgba(234,179,8,0.6)] animate-pulse">
                        <Sword size={32} weight="fill" />
                    </div>
                    <div className="text-zinc-500 text-sm tracking-widest uppercase">Loading Battle Station</div>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace state={{ from: location }} />;
    }

    if (roles && !roles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return children;
}
