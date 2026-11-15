// Este aplicativo web foi descontinuado.
// Este service worker limpa o cache e se desregistra em navegadores que ainda
// tinham a versão antiga instalada, encerrando o PWA.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (e) { /* ignora */ }
    try {
      await self.registration.unregister();
    } catch (e) { /* ignora */ }
    try {
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate("/"));
    } catch (e) { /* ignora */ }
  })());
});
