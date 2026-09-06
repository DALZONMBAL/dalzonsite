const CACHE_NAME = "dalzon-enterprise-v1";
const OFFLINE_URL = "/offline.html";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/offline.html"
];

/* Installation */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* Activation + nettoyage des anciennes versions */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/* Gestion des requêtes */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const requestURL = new URL(event.request.url);

  /* On gère principalement les fichiers de ton propre site */
  if (requestURL.origin !== self.location.origin) return;

  /* Navigation : Internet d'abord, puis cache, puis page offline */
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });

          return response;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => {
              return cached || caches.match(OFFLINE_URL);
            });
        })
    );

    return;
  }

  /* Fichiers : cache d'abord, puis réseau */
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then(response => {
            if (
              response &&
              response.status === 200 &&
              response.type === "basic"
            ) {
              const copy = response.clone();

              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, copy);
              });
            }

            return response;
          });
      })
      .catch(() => {
        return caches.match(OFFLINE_URL);
      })
  );
});