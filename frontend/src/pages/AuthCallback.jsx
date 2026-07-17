import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle,
  CircleNotch,
  WarningCircle,
} from "@phosphor-icons/react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TOKEN_KEY = "sgl_access_token";

function getSessionId() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  const hashParams = new URLSearchParams(
    hash.replace(/^#/, "")
  );

  const searchParams = new URLSearchParams(search);

  return (
    hashParams.get("session_id") ||
    searchParams.get("session_id") ||
    null
  );
}

function getAccessToken(data) {
  return (
    data?.access_token ||
    data?.token ||
    data?.accessToken ||
    null
  );
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  const {
    setUser,
    refreshUser,
  } = useAuth();

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState(
    "Connecting your Google account..."
  );

  useEffect(() => {
    if (hasProcessed.current) {
      return;
    }

    hasProcessed.current = true;

    const processGoogleLogin = async () => {
      const sessionId = getSessionId();

      if (!sessionId) {
        setStatus("error");
        setMessage(
          "Google login session was not found. Please try again."
        );

        setTimeout(() => {
          navigate("/auth", {
            replace: true,
          });
        }, 1800);

        return;
      }

      try {
        setStatus("loading");
        setMessage(
          "Verifying your Google account..."
        );

        const { data } = await api.post(
          "/auth/google-session",
          {
            session_id: sessionId,
          }
        );

        const token = getAccessToken(data);

        if (token) {
          localStorage.setItem(TOKEN_KEY, token);
        }

        let authenticatedUser = data?.user || null;

        if (!authenticatedUser && token) {
          authenticatedUser = await refreshUser();
        }

        if (!authenticatedUser) {
          try {
            const response = await api.get("/auth/me");
            authenticatedUser = response.data;
          } catch {
            authenticatedUser = null;
          }
        }

        if (!authenticatedUser) {
          throw new Error(
            "Google login completed, but the user session could not be loaded."
          );
        }

        setUser(authenticatedUser);

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );

        setStatus("success");
        setMessage(
          "Login successful. Opening your dashboard..."
        );

        setTimeout(() => {
          navigate("/", {
            replace: true,
          });
        }, 700);
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        setUser(false);

        const backendMessage =
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message;

        setStatus("error");
        setMessage(
          formatApiError(
            backendMessage ||
              "Google login failed. Please try again."
          )
        );

        setTimeout(() => {
          navigate("/auth", {
            replace: true,
          });
        }, 2500);
      }
    };

    processGoogleLogin();
  }, [navigate, refreshUser, setUser]);

  return (
    <div className="min-h-screen bg-[#F5F9FF] px-5 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div
          className="w-full rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-xl"
          data-testid="auth-callback-page"
        >
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[#062B5F] shadow-lg">
            {status === "loading" && (
              <CircleNotch
                size={40}
                weight="bold"
                className="animate-spin text-[#F4B400]"
              />
            )}

            {status === "success" && (
              <CheckCircle
                size={42}
                weight="fill"
                className="text-emerald-400"
              />
            )}

            {status === "error" && (
              <WarningCircle
                size={42}
                weight="fill"
                className="text-red-400"
              />
            )}
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-[#0F4C9C]">
            Zanszii Account
          </p>

          <h1 className="mt-3 text-2xl font-black text-[#062B5F]">
            {status === "loading" &&
              "Establishing session"}

            {status === "success" &&
              "Welcome to Zanszii"}

            {status === "error" &&
              "Login could not be completed"}
          </h1>

          <p
            className={`mt-3 text-sm leading-6 ${
              status === "error"
                ? "text-red-600"
                : "text-slate-500"
            }`}
          >
            {message}
          </p>

          {status === "error" && (
            <button
              type="button"
              onClick={() =>
                navigate("/auth", {
                  replace: true,
                })
              }
              className="mt-6 w-full rounded-xl bg-[#0F4C9C] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0B3D7D]"
            >
              Return to Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
