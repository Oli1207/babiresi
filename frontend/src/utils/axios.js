// src/utils/axios.js
import axios from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { BASE_URL } from "./constants"; // http://127.0.0.1:8000/api/v1/ :contentReference[oaicite:5]{index=5}

const apiInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 1000000,
  headers: { Accept: "application/json" },
});

function isTokenExpired(token) {
  try {
    const { exp } = jwtDecode(token);
    return exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = Cookies.get("refresh_token");
  if (!refresh) throw new Error("No refresh token");

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}user/token/refresh/`, { refresh })
      .then(({ data }) => {
        const access = data?.access;
        if (!access) throw new Error("No access in refresh response");
        Cookies.set("access_token", access, { expires: 1, secure: false });
        return access;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiInstance.interceptors.request.use(async (config) => {
  // ✅ FormData: ne pas forcer Content-Type
  if (config.data instanceof FormData) {
    if (config.headers?.["Content-Type"]) delete config.headers["Content-Type"];
  } else {
    if (!config.headers?.["Content-Type"]) config.headers["Content-Type"] = "application/json";
  }

  const token = Cookies.get("access_token");

  // ✅ fallback: si token existe, force toujours Authorization (même si l'interceptor précédent a buggé)
  if (token && !config.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // ✅ si pas de token => requête publique
  if (!token) return config;

  // ✅ si token expiré -> refresh AVANT d'envoyer
  if (isTokenExpired(token)) {
    const newAccess = await refreshAccessToken();
    config.headers.Authorization = `Bearer ${newAccess}`;
  }

  return config;
});

apiInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error || {};
    if (!response || !config) return Promise.reject(error);

    if (response.status === 401 && !config._retry) {
      config._retry = true;
      try {
        const newAccess = await refreshAccessToken();
        config.headers = { ...(config.headers || {}), Authorization: `Bearer ${newAccess}` };
        return apiInstance(config);
      } catch (e) {
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        window.location.href = "/login";
        return Promise.reject(e);
      }
    }

    return Promise.reject(error);
  }
);

export default apiInstance;
