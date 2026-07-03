import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch {
            setUser(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // If returning from Emergent OAuth callback, skip /me check.
        // AuthCallback will exchange the session_id first.
        if (typeof window !== "undefined" && window.location.hash?.includes("session_id=")) {
            setLoading(false);
            return;
        }
        checkAuth();
    }, [checkAuth]);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        if (data.access_token) localStorage.setItem("sgl_access_token", data.access_token);
        setUser(data.user);
        return data.user;
    };

    const register = async (payload) => {
        const { data } = await api.post("/auth/register", payload);
        if (data.access_token) localStorage.setItem("sgl_access_token", data.access_token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch (_) { /* ignore */ }
        localStorage.removeItem("sgl_access_token");
        setUser(false);
    };

    const refreshUser = async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
            return data;
        } catch { return null; }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
