import apiInstance from "./axios";

// ✅ helper: base64 -> Uint8Array (PushManager exige ça)
function urlBase64ToUint8Array(base64String) {
  // ✅ AJOUT: guard pour éviter ton bug "reading length of undefined"
  if (!base64String || typeof base64String !== "string") {
    throw new Error("VAPID public key is missing/invalid (base64String).");
  }

  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ✅ AJOUT: fetch VAPID public key depuis backend
async function fetchVapidPublicKey() {
  const { data } = await apiInstance.get("push/vapid-public-key/");
  return data?.public_key || "";
}

/**
 * ✅ Appelle ça après login (ou au montage app) si user connecté
 * - Si la clé VAPID n'est pas fournie, on la récupère via l'API
 */
export async function ensurePushSubscription(vapidPublicKey = "") {
  // ✅ Push web: il faut Notification + serviceWorker + PushManager
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) {
    // ✅ iOS Safari: souvent pas dispo si pas PWA installée / iOS < 16.4
    return false;
  }

  // ✅ 1) Permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  // ✅ 2) En prod, VITE env peut être vide => on récupère depuis backend
  let key = vapidPublicKey;
  if (!key) key = await fetchVapidPublicKey();

  if (!key) {
    console.error("❌ VAPID public key empty. Check backend settings.VAPID_PUBLIC_KEY");
    return false;
  }

  // ✅ 3) Toujours réutiliser un SW déjà prêt si possible
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  // ✅ 4) Subscription
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }

  // ✅ 5) Save en DB
  const json = sub.toJSON();

  await apiInstance.post("push/subscribe/", {
    endpoint: json.endpoint,
    keys: json.keys,
    user_agent: navigator.userAgent,
  });

  return true;
}
