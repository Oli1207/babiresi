// src/views/plugin/UserData.jsx
import Cookie from "js-cookie";
import { jwtDecode } from "jwt-decode";

export default function UserData() {
  const access = Cookie.get("access_token");
  const refresh = Cookie.get("refresh_token");

  if (!access || !refresh) return null;

  try {
    // ✅ on décode access (infos user + exp)
    return jwtDecode(access);
  } catch (e) {
    console.error("Invalid access token:", e);
    return null;
  }
}
