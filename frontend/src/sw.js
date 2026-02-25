/// <reference lib="webworker" />
/* eslint-disable no-undef */

// ===============================
// Workbox (injectManifest)
// ===============================
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { createHandlerBoundToURL } from "workbox-precaching";

self.skipWaiting();
clientsClaim();

// Injecté automatiquement au build
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// SPA fallback (React Router)
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

// ===============================
// ✅ PUSH HANDLER
// ===============================
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    // si payload pas JSON
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch (err) {
      payload = {};
    }
  }

  const title = payload.title || "Decrou Resi";
  const data = payload.data || {};

  const options = {
    body: payload.body || "",
    data,
    icon: "/icon-192x192.png",
    badge: "/icon-72x72.png",
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(
    (async () => {
      // ✅ 1) Ping backend (GET no-cors) pour prouver que le SW a reçu le push
      try {
        const url =
          "https://backend.decrouresi.com/api/v1/push/ping/?" +
          "ts=" +
          Date.now() +
          "&t=" +
          encodeURIComponent(title) +
          "&hasData=" +
          encodeURIComponent(!!event.data);

        await fetch(url, { method: "GET", mode: "no-cors" });
      } catch (e) {
        // ignore
      }

      // ✅ 2) Affiche la notification
      await self.registration.showNotification(title, options);

      // ✅ 3) Informe les pages ouvertes (debug)
      try {
        const clientList = await clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          client.postMessage({ type: "PUSH_RECEIVED", payload });
        }
      } catch (e) {
        // ignore
      }
    })()
  );
});

// ===============================
// ✅ CLICK HANDLER
// ===============================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clientList = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Si une fenêtre existe, focus + navigate
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }

      // Sinon ouvrir nouvelle fenêtre
      if (clients.openWindow) return clients.openWindow(url);
    })()
  );
});