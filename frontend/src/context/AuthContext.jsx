import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("zanszii_access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("zanszii_access_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const handleUnauthorized = () => {
      localStorage.removeItem("zanszii_access_token");
      setUser(null);
    };
    window.addEventListener("zanszii:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("zanszii:unauthorized", handleUnauthorized);
  }, [loadUser]);

  const saveAuth = useCallback((payload) => {
    if (!payload?.access_token || !payload?.user) throw new Error("Invalid login response");
    localStorage.setItem("zanszii_access_token", payload.access_token);
    setUser(payload.user);
  }, []);

  const login = useCallback(async (credentials) => {
    const { data } = await api.post("/auth/login", credentials);
    saveAuth(data);
    return data.user;
  }, [saveAuth]);

  const register = useCallback(async (details) => {
    const { data } = await api.post("/auth/register", details);
    saveAuth(data);
    return data.user;
  }, [saveAuth]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* local logout still succeeds */ }
    localStorage.removeItem("zanszii_access_token");
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, loading, login, register, logout, loadUser, saveAuth }), [user, loading, login, register, logout, loadUser, saveAuth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
