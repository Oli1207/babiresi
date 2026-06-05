// src/utils/auth.js
import { useAuthStore } from "../store/auth";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import Cookies from "js-cookie";
import Swal from "sweetalert2";
import { BASE_URL } from "./constants";

const Toast = Swal.mixin({
  toast: true,
  position: "top",
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

export const login = async (email, password) => {
  try {
    const { data, status } = await axios.post(`${BASE_URL}user/token/`, { email, password });

    if (status === 200) {
      // ✅ on passe aussi data.user pour enrichir le store
      setAuthUser(data.access, data.refresh, data.user);

      Toast.fire({
        icon: "success",
        title: "Vous êtes connecté",
      });
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error?.response?.data?.detail || "Something went wrong",
    };
  }
};

export const register = async (full_name, email, phone, password, password2) => {
  try {
    const { data } = await axios.post(`${BASE_URL}user/register/`, {
      full_name,
      email,
      phone,
      password,
      password2,
    });

    // Connexion automatique après inscription
    await login(email, password);

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error?.response?.data?.detail || "Something went wrong",
    };
  }
};

export const logout = () => {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");

  // ✅ iOS fallback remove
  localStorage.removeItem("is_logged_in");

  useAuthStore.getState().setUser(null);
};

export const setUser = async () => {
  const accessToken = Cookies.get("access_token");
  const refreshToken = Cookies.get("refresh_token");

  if (!accessToken || !refreshToken) return;

  // ✅ Hydrate TOUT DE SUITE depuis les cookies (même si access expiré) :
  // l'UI reste connectée. L'intercepteur axios rafraîchira au prochain appel.
  setAuthUser(accessToken, refreshToken);

  // ✅ Si access expiré, tente un refresh en arrière-plan.
  // En cas d'échec TRANSITOIRE (backend qui redémarre, réseau), on NE déconnecte PAS.
  if (isAccessTokenExpired(accessToken)) {
    try {
      const response = await getRefreshToken(); // { access: ... }
      if (response?.access) setAuthUser(response.access, refreshToken);
    } catch (error) {
      const status = error?.response?.status;
      // Déconnexion seulement si le refresh token est réellement invalide (401)
      if (status === 401) logout();
      // sinon : on garde la session, ce sera retenté plus tard
    }
  }
};

// ✅ CHANGE: normalisation pour garder compat user_id + champs SafeUserSerializer
export const setAuthUser = (access_token, refresh_token, userFromApi = null) => {
  // ✅ cookies longs (iOS + "rester connecté")
  Cookies.set("access_token", access_token, {
    expires: 30,
    secure: true,
    sameSite: "Lax",
  });
  Cookies.set("refresh_token", refresh_token, {
    expires: 200,
    secure: true,
    sameSite: "Lax",
  });

  // ✅ iOS fallback (UI login state)
  localStorage.setItem("is_logged_in", "1");

  let decoded = null;
  try {
    decoded = jwtDecode(access_token); // souvent contient user_id + username + email/full_name si tu les as mis
  } catch (e) {
    decoded = null;
  }

  // ✅ fusion
  const merged = {
    ...(decoded || {}),
    ...(userFromApi || {}),
  };

  // ✅ CHANGE: NORMALISATION (compat composants)
  const normalizedUser = {
    ...merged,

    // Toujours avoir les deux clés
    id: merged?.id ?? merged?.user_id ?? null,
    user_id: merged?.user_id ?? merged?.id ?? null,

    // Champs “safe”
    full_name: merged?.full_name ?? "",
    email: merged?.email ?? "",
    phone: merged?.phone ?? "",
    username: merged?.username ?? "",
  };

  useAuthStore.getState().setUser(normalizedUser);
  useAuthStore.getState().setLoading(false);
};

export const getRefreshToken = async () => {
  const refresh_token = Cookies.get("refresh_token");

  if (!refresh_token) {
    throw new Error("Missing refresh token");
  }

  // ✅ Ne PAS appeler logout() ici : laisser l'appelant décider selon le type d'erreur.
  // (un échec réseau/5xx pendant un redéploiement ne doit jamais déconnecter)
  const response = await axios.post(`${BASE_URL}user/token/refresh/`, {
    refresh: refresh_token,
  });
  return response.data; // { access: 'new_access_token' }
};

export const isAccessTokenExpired = (accessToken) => {
  try {
    const decodedToken = jwtDecode(accessToken);
    return decodedToken.exp < Date.now() / 1000;
  } catch (error) {
    return true;
  }
};