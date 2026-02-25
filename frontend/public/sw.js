self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {}

  const title = payload.title || "Decrou Resi";
  const data = payload.data || {};

  const options = {
    body: payload.body || "",
    data,
    // ✅ IMPORTANT: icônes (mets de vrais chemins existants)
    icon: "/icon-192x192.png",
    //badge: "/icons/badge-72.png",

    // ✅ Sur Windows ça aide énormément
    tag: data.tag || "decrouresi",
    renotify: true,
    requireInteraction: false,
  };

  
  event.waitUntil(
  (async () => {
    // ✅ DEBUG: ping backend pour prouver que le SW a reçu le push
try {
  const url =
    "https://backend.decrouresi.com/api/v1/push/ping/?" +
    "ts=" + Date.now() +
    "&t=" + encodeURIComponent((payload && payload.title) || "") +
    "&hasData=" + encodeURIComponent(!!(event.data));

  event.waitUntil(fetch(url, { method: "GET", mode: "no-cors" }));
} catch (e) {}
    await self.registration.showNotification(title, options);

    // ✅ DEBUG: informer la page ouverte que le push est arrivé
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      client.postMessage({ type: "PUSH_RECEIVED", payload });
    }
  })()
);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
