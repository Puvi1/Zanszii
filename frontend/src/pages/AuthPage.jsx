import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Boxes, Eye, EyeOff, LockKeyhole, Mail, Phone, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

function destination(role) { return role === "admin" ? "/admin" : role === "manager" ? "/manager" : "/"; }

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const update = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setError(""); setSubmitting(true);
    try {
      const user = mode === "login"
        ? await login({ email: form.email.trim(), password: form.password })
        : await register({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, password: form.password });
      navigate(location.state?.from || destination(user.role), { replace: true });
    } catch (err) { setError(formatApiError(err)); } finally { setSubmitting(false); }
  };

  const googleLogin = () => {
    const redirect = `${window.location.origin}/auth/callback`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  return <div className="auth-page">
    <section className="auth-hero"><div className="hero-overlay"/><div className="hero-content"><div className="hero-logo"><Boxes/> Zanszii</div><h1>Simple orders.<br/>Smarter delivery.</h1><p>Manage products, customers, orders and deliveries from one reliable platform.</p><div className="hero-points"><span>✓ Easy ordering</span><span>✓ Live delivery workflow</span><span>✓ Admin reports</span></div></div></section>
    <section className="auth-panel"><div className="auth-card"><div className="auth-mobile-brand"><Boxes/> Zanszii</div><h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2><p>{mode === "login" ? "Sign in to continue to Zanszii." : "Register as a Zanszii customer."}</p>
      <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => {setMode("login");setError("");}}>Login</button><button className={mode === "register" ? "active" : ""} onClick={() => {setMode("register");setError("");}}>Register</button></div>
      <form onSubmit={submit}>
        {mode === "register" && <><label>Full name<div className="input-wrap"><User/><input name="name" value={form.name} onChange={update} required placeholder="Your full name"/></div></label><label>Phone number<div className="input-wrap"><Phone/><input name="phone" value={form.phone} onChange={update} placeholder="10-digit mobile number" inputMode="tel"/></div></label></>}
        <label>Email address<div className="input-wrap"><Mail/><input type="email" name="email" value={form.email} onChange={update} required placeholder="you@example.com" autoComplete="email"/></div></label>
        <label>Password<div className="input-wrap"><LockKeyhole/><input type={showPassword ? "text" : "password"} name="password" value={form.password} onChange={update} minLength={8} required placeholder="Minimum 8 characters" autoComplete={mode === "login" ? "current-password" : "new-password"}/><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-btn" disabled={submitting}>{submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <div className="divider"><span>or</span></div><button className="google-btn" onClick={googleLogin}><span className="google-g">G</span> Continue with Google</button>
    </div></section>
  </div>;
}
