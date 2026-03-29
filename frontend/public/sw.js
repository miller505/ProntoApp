const CACHE_NAME = "pronto-app-v1";
const urlsToCache = ["/", "/index.html", "/logo.svg"];

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Forza al SW a activarse inmediatamente tras cambios
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim()); // Toma control de los clientes activos
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // --- SEGURIDAD Y DESARROLLO ---
  // 1. Ignorar esquemas que no sean http o https (como chrome-extension o data)
  if (!url.protocol.startsWith("http")) return;

  // 2. IGNORAR peticiones internas del servidor de desarrollo (Vite)
  // Esto evita que el SW bloquee la carga de la App en modo desarrollo (Localhost)
  if (
    url.pathname.startsWith("/@vite/") ||
    url.pathname.includes("@react-refresh") ||
    url.search.includes("t=")
  ) {
    return;
  }

  // --- REGLA IMPORTANTE ---
  // Ignorar solicitudes a la API, Socket.io o métodos que no sean GET (POST, PUT, DELETE)
  // Esto evita que el SW interfiera con la lógica de negocio y evita errores de "Failed to fetch"
  // en el SW cuando el backend está apagado (dejando que la App maneje el error limpiamente).
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/") ||
    event.request.method !== "GET"
  ) {
    return; // Salir y dejar que el navegador haga la petición normal de red
  }

  // Estrategia: Cache First, falling back to Network (solo para archivos estáticos)
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      // Manejar el error de fetch para evitar "Uncaught (in promise)" en la consola
      return fetch(event.request).catch((err) => {
        console.debug(
          "Service Worker: Fallo el fetch de red para:",
          url.pathname,
        );
      });
    }),
  );
});
