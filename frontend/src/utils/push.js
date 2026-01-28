import apiInstance from "./axios";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * ✅ Appelle ça après login (ou au montage app) si user connecté
 * @param {string} vapidPublicKey - ta clé publique VAPID (settings.VAPID_PUBLIC_KEY)
 */
export async function ensurePushSubscription(vapidPublicKey) {
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.register("/sw.js");

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const json = sub.toJSON();

  await apiInstance.post("push/subscribe/", {
    endpoint: json.endpoint,
    keys: json.keys,
    user_agent: navigator.userAgent,
  });

  return true;
}
