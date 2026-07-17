import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

const TOKEN_KEY = "sgl_access_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const saveToken = useCallback((token) => {
    if (!token) {
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);
  }, []);

  const removeToken = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    const { data } = await api.get("/auth/me");
    setUser(data);
    return data;
  }, []);

  const checkAuth = useCallback(async () => {
    setLoading(true);

    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setUser(false);
      setLoading(false);
      return null;
    }

    try {
      return await fetchCurrentUser();
    } catch {
      removeToken();
      setUser(false);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentUser, removeToken]);

  useEffect(() => {
    const isOAuthCallback =
      typeof window !== "undefined" &&
      window.location.hash?.includes("session_id=");

    if (isOAuthCallback) {
      setLoading(false);
      return;
    }

    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
      });

      const token =
        data?.access_token ||
        data?.token ||
        data?.accessToken;

      if (!token) {
        throw new Error(
          "Login succeeded, but no access token was returned."
        );
      }

      saveToken(token);

      if (data?.user) {
        setUser(data.user);
        return data.user;
      }

      return await fetchCurrentUser();
    } catch (error) {
      removeToken();
      setUser(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);

    try {
      const { data } = await api.post(
        "/auth/register",
        payload
      );

      const token =
        data?.access_token ||
        data?.token ||
        data?.accessToken;

      if (!token) {
        throw new Error(
          "Registration succeeded, but no access token was returned."
        );
      }

      saveToken(token);

      if (data?.user) {
        setUser(data.user);
        return data.user;
      }

      return await fetchCurrentUser();
    } catch (error) {
      removeToken();
      setUser(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local logout must still continue.
    } finally {
      removeToken();
      setUser(false);
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setUser(false);
      return null;
    }

    try {
      return await fetchCurrentUser();
    } catch {
      removeToken();
      setUser(false);
      return null;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
    checkAuth,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
