const CACHE_NAME = "pronto-app-v1";
const urlsToCache = ["/", "/index.html", "/logo.svg", "/logowhite.svg"];

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
      return fetch(event.request);
    }),
  );
});
