import axios from "axios";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  "https://zanszii.onrender.com";

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

// Attach access token to every authenticated request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(
      "sgl_access_token"
    );

    if (token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export function formatApiError(detail) {
  if (detail == null) {
    return "Something went wrong. Please try again.";
  }

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (
          item &&
          typeof item.msg === "string"
        ) {
          return item.msg;
        }

        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join(" ");
  }

  if (
    detail &&
    typeof detail.msg === "string"
  ) {
    return detail.msg;
  }

  return String(detail);
}
