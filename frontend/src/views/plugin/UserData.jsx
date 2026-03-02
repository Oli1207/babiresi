// src/views/plugin/UserData.jsx
import Cookie from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { useAuthStore } from "../../store/auth"; // ✅ CHANGE: on lit le store

export default function UserData() {
  // ✅ CHANGE: priorité au store (ne dépend pas de cookies iOS)
  const storeUser = useAuthStore((s) => s.user);
  if (storeUser) return storeUser;

  // ✅ CHANGE: fallback iOS (UI state)
  const isLoggedIn = localStorage.getItem("is_logged_in") === "1";
  if (!isLoggedIn) return null;

  // ✅ fallback: si cookies lisibles, on décode
  const access = Cookie.get("access_token");
  if (!access) return null;

  try {
    const decoded = jwtDecode(access);

    // ✅ NORMALIZE: user_id/id toujours dispo
    return {
      ...decoded,
      id: decoded?.id ?? decoded?.user_id ?? null,
      user_id: decoded?.user_id ?? decoded?.id ?? null,
      full_name: decoded?.full_name ?? "",
      email: decoded?.email ?? "",
      phone: decoded?.phone ?? "",
      username: decoded?.username ?? "",
    };
  } catch (e) {
    return null;
  }
}

// // src/views/plugin/UserData.jsx
// import Cookie from "js-cookie";
// import { jwtDecode } from "jwt-decode";

// export default function UserData() {
//   const access = Cookie.get("access_token");
//   const refresh = Cookie.get("refresh_token");

//   if (!access || !refresh) return null;

//   try {
//     // ✅ on décode access (infos user + exp)
//     return jwtDecode(access);
//   } catch (e) {

//     return null;
//   }
// }
