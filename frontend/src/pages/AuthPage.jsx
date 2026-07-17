import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";
import { motion } from "framer-motion";
import {
  GoogleLogo,
  Envelope,
  LockKey,
  User as UserIcon,
  ArrowRight,
  Package,
  ShoppingCartSimple,
  Truck,
  ShieldCheck,
  Phone,
  IdentificationCard,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { toast } from "sonner";

// Do not hardcode redirect URLs. This keeps Google authentication working.
function googleLogin() {
  const redirectUrl = `${window.location.origin}/auth/callback`;

  window.location.href =
    `https://auth.emergentagent.com/?redirect=${encodeURIComponent(
      redirectUrl
    )}`;
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nexusId, setNexusId] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const resetMessages = () => {
    setError("");
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    resetMessages();
  };

  const validateRegistration = () => {
    if (!name.trim()) {
      return "Please enter your full name.";
    }

    if (!/^\d{10}$/.test(phone.trim())) {
      return "Mobile number must contain exactly 10 digits.";
    }

    if (nexusId.trim().length < 3) {
      return "Customer or business ID must contain at least 3 characters.";
    }

    if (password.length < 6) {
      return "Password must contain at least 6 characters.";
    }

    return "";
  };

  const submit = async (event) => {
    event.preventDefault();

    setError("");

    if (mode === "register") {
      const validationError = validateRegistration();

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "login") {
        await login(email.trim(), password);

        toast.success("Welcome back to Zanszii!");
        navigate(from, { replace: true });
      } else {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          nexus_id: nexusId.trim(),
        });

        toast.success("Your Zanszii account has been created!");
        navigate("/", { replace: true });
      }
    } catch (requestError) {
      const message = formatApiError(requestError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F9FF] lg:grid lg:grid-cols-2">
      {/* Left Branding Section */}
      <section className="relative hidden lg:flex overflow-hidden bg-[#062B5F] px-14 py-12 text-white">
        <div className="absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#0F4C9C]/70 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#F4B400]/20 blur-3xl" />

          <div className="absolute right-0 top-0 h-full w-1/2 bg-gradient-to-bl from-[#0F4C9C]/60 to-transparent" />
        </div>

        <div className="relative z-10 flex w-full flex-col justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F4B400] text-[#062B5F] shadow-xl shadow-yellow-500/20">
              <span className="text-3xl font-black">Z</span>
            </div>

            <div>
              <h1 className="text-3xl font-black tracking-tight">ZANSZII</h1>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#F4B400]">
                Cleaning Solutions
              </p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-xl"
          >
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.35em] text-[#F4B400]">
              Simple ordering. Reliable delivery.
            </p>

            <h2 className="text-5xl font-black leading-[1.08]">
              Cleaning products,
              <span className="block text-[#F4B400]">
                delivered with care.
              </span>
            </h2>

            <p className="mt-6 max-w-lg text-base leading-7 text-blue-100">
              Browse quality cleaning products, place your order and track
              every delivery from one simple application.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4">
              <FeatureCard
                icon={Package}
                title="Products"
                description="Browse products"
              />

              <FeatureCard
                icon={ShoppingCartSimple}
                title="Easy Orders"
                description="Order quickly"
              />

              <FeatureCard
                icon={Truck}
                title="Delivery"
                description="Track status"
              />
            </div>
          </motion.div>

          <p className="text-xs uppercase tracking-[0.25em] text-blue-200/70">
            © Zanszii Cleaning Solutions
          </p>
        </div>
      </section>

      {/* Login and Registration Section */}
      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-14">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#0F4C9C] text-white shadow-lg">
              <span className="text-2xl font-black">Z</span>
            </div>

            <div>
              <div className="text-2xl font-black text-[#062B5F]">
                ZANSZII
              </div>

              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#F4B400]">
                Cleaning Solutions
              </div>
            </div>
          </div>

          <div className="mb-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#0F4C9C]">
              {mode === "login" ? "Account Login" : "Create Account"}
            </p>

            <h2 className="text-3xl font-black tracking-tight text-[#062B5F]">
              {mode === "login"
                ? "Welcome back"
                : "Join Zanszii"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {mode === "login"
                ? "Sign in to manage your products, orders and deliveries."
                : "Create a customer account and start ordering cleaning products."}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-blue-50 p-1">
            <button
              type="button"
              onClick={() => changeMode("login")}
              className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                mode === "login"
                  ? "bg-white text-[#0F4C9C] shadow-sm"
                  : "text-slate-500 hover:text-[#0F4C9C]"
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => changeMode("register")}
              className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                mode === "register"
                  ? "bg-white text-[#0F4C9C] shadow-sm"
                  : "text-slate-500 hover:text-[#0F4C9C]"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <InputField
                  icon={UserIcon}
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  required
                />

                <InputField
                  icon={Phone}
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                />

                <InputField
                  icon={IdentificationCard}
                  type="text"
                  placeholder="Customer or business ID"
                  value={nexusId}
                  onChange={(event) => setNexusId(event.target.value)}
                  autoComplete="off"
                  required
                />
              </>
            )}

            <InputField
              icon={Envelope}
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />

            <div className="relative">
              <InputField
                icon={LockKey}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                minLength={6}
                required
                hasRightButton
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-[#0F4C9C]"
                aria-label={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                {showPassword ? (
                  <EyeSlash size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#0F4C9C] px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-[#0B3D7D] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>
                {submitting
                  ? "Please wait..."
                  : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </span>

              {!submitting && <ArrowRight size={20} weight="bold" />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              or
            </span>

            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={googleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-semibold text-slate-700 shadow-sm transition hover:border-[#0F4C9C] hover:bg-blue-50"
          >
            <GoogleLogo size={22} weight="bold" />
            Continue with Google
          </button>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <ShieldCheck
              size={22}
              weight="duotone"
              className="mt-0.5 shrink-0 text-[#0F4C9C]"
            />

            <p className="text-xs leading-5 text-slate-600">
              Your account details are securely used to manage orders,
              delivery updates and customer support.
            </p>
          </div>

          <p className="mt-7 text-center text-sm text-slate-500">
            {mode === "login"
              ? "New to Zanszii?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={() =>
                changeMode(mode === "login" ? "register" : "login")
              }
              className="ml-2 font-bold text-[#0F4C9C] hover:underline"
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        </motion.div>
      </section>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <Icon size={25} weight="duotone" className="text-[#F4B400]" />

      <p className="mt-3 text-sm font-bold text-white">{title}</p>

      <p className="mt-1 text-xs text-blue-200">{description}</p>
    </div>
  );
}

function InputField({
  icon: Icon,
  hasRightButton = false,
  ...inputProps
}) {
  return (
    <div className="relative">
      <Icon
        size={20}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
      />

      <input
        {...inputProps}
        className={`w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 text-sm text-[#0F172A] outline-none transition placeholder:text-slate-400 focus:border-[#0F4C9C] focus:ring-4 focus:ring-blue-100 ${
          hasRightButton ? "pr-12" : "pr-4"
        }`}
      />
    </div>
  );
          }
