// src/utils/auth.js
import { useAuthStore } from '../store/auth';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";
import Cookies from 'js-cookie';
import Swal from 'sweetalert2';
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
    const { data, status } = await axios.post(
      `${BASE_URL}user/token/`,
      { email, password }
    );

    if (status === 200) {
      // ✅ on passe aussi data.user pour enrichir le store
      setAuthUser(data.access, data.refresh, data.user);

      Toast.fire({
        icon: 'success',
        title: "Vous êtes connecté",
      });
    }

    return { data, error: null };
  } catch (error) {
    
    return {
      data: null,
      error: error?.response?.data?.detail || 'Something went wrong',
    };
  }
};

export const register = async (full_name, email, phone, password, password2) => {
  try {
    const { data } = await axios.post(
      `${BASE_URL}user/register/`,
      {
        full_name,
        email,
        phone,
        password,
        password2,
      }
    );

    // Connexion automatique après inscription
    await login(email, password);

    Toast.fire({
      icon: 'success',
      title: "Bienvenue chez Découverte !",
    });

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error?.response?.data?.detail || 'Something went wrong',
    };
  }
};

export const logout = () => {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
  useAuthStore.getState().setUser(null);
};

export const setUser = async () => {
  const accessToken = Cookies.get("access_token");
  const refreshToken = Cookies.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return;
  }

  if (isAccessTokenExpired(accessToken)) {
    try {
      const response = await getRefreshToken();
      // on ne reçoit que { access }, donc pas de userFromApi ici
      setAuthUser(response.access, refreshToken);
    } catch (error) {
      console.error("Failed to refresh token:", error);
    }
  } else {
    setAuthUser(accessToken, refreshToken);
  }
};

// ✅ fusion token décodé + user renvoyé par l'API (SafeUserSerializer)
export const setAuthUser = (access_token, refresh_token, userFromApi = null) => {
  Cookies.set('access_token', access_token, {
    expires: 1,
    secure: false,
  });
  Cookies.set('refresh_token', refresh_token, {
    expires: 7,
    secure: false,
  });

  let decoded = null;
  try {
    decoded = jwtDecode(access_token);
  } catch (e) {
    console.error("Error decoding token", e);
  }

  const finalUser = {
    ...(decoded || {}),
    ...(userFromApi || {}),
  };

  if (finalUser) {
    useAuthStore.getState().setUser(finalUser);
  }
  useAuthStore.getState().setLoading(false);
};

export const getRefreshToken = async () => {
  const refresh_token = Cookies.get("refresh_token");

  if (!refresh_token) {
    logout();
    console.error("Missing refresh token");
    throw new Error("Missing refresh token");
  }

  try {
    const response = await axios.post(
      `${BASE_URL}user/token/refresh/`,
      { refresh: refresh_token }
    );
    return response.data; // { access: 'new_access_token' }
  } catch (error) {
    logout();
    console.error("Error refreshing token:", error);
    throw error;
  }
};

export const isAccessTokenExpired = (accessToken) => {
  try {
    const decodedToken = jwtDecode(accessToken);
    return decodedToken.exp < Date.now() / 1000;
  } catch (error) {
    
    return true;
  }
};
