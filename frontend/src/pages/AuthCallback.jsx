import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const destination = (role) => role === "admin" ? "/admin" : role === "manager" ? "/manager" : "/";

export default function AuthCallback() {
  const processed = useRef(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { saveAuth } = useAuth();

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const sessionId = hash.get("session_id") || query.get("session_id");
    if (!sessionId) { setError("Google session was not returned."); return; }
    api.post("/auth/google-session", { session_id: sessionId })
      .then(({ data }) => { saveAuth(data); window.history.replaceState(null, "", "/auth/callback"); navigate(destination(data.user.role), { replace: true }); })
      .catch((err) => setError(formatApiError(err)));
  }, [navigate, saveAuth]);

  return <div className="callback-page"><div className="callback-card">{error ? <><h2>Login could not be completed</h2><p>{error}</p><button className="primary-btn" onClick={() => navigate("/auth", {replace:true})}>Back to login</button></> : <><div className="spinner"/><h2>Signing you into Zanszii…</h2><p>Please wait a moment.</p></>}</div></div>;
}
