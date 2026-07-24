import axios from "axios";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "https://zanszii.onrender.com").replace(/\/$/, "");

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("zanszii_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      localStorage.removeItem("zanszii_access_token");
      window.dispatchEvent(new Event("zanszii:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export function formatApiError(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail ?? error?.message ?? error;
  if (Array.isArray(detail)) return detail.map((item) => item.msg || String(item)).join(", ");
  return typeof detail === "string" ? detail : fallback;
}
