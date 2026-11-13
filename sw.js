const CACHE_NAME = "carnet-pwa-v32";
const urlsToCache = [
  "/", "/index.html", "/settings.html", "/style.css", "/manifest.json", "/connaissances.json",
  "/js/app.js", "/js/storage.js", "/js/ui.js", "/js/voice.js", "/js/camera.js", "/js/water.js",
  "/js/medications.js", "/js/ia.js", "/js/ia-settings.js", "/js/ia-external.js", "/js/ui-settings.js",
  "/js/export.js", "/js/settings.js", "/js/navigation.js", "/js/dashboard.js", "/js/consent.js",
  "/js/meal-modes.js", "/js/pwa.js", "/print.html", "/js/print.js", "/tendances.html", "/js/trends.js", "/about.html"
];

// Ressources dynamiques : le réseau prime TOUJOURS, le cache n'est qu'un secours hors ligne.
// version.txt : l'option cache:"no-store" côté page est ignorée quand le SW intercepte,
// c'est donc ici que le badge de version devient fiable.
const NETWORK_FIRST = ["/api/", "/version.txt", "/manifest.json"];

function isNetworkFirst(request) {
  const url = new URL(request.url);
  // Navigations (pages HTML) : réseau d'abord pour servir la dernière version déployée
  if (request.mode === "navigate") return true;
  return NETWORK_FIRST.some(p => url.pathname === p || url.pathname.startsWith(p));
}

self.addEventListener("install", event => {
  // {cache:'reload'} : le precache contourne le cache HTTP du navigateur.
  // Sans cela, l'heuristique du navigateur peut livrer des fichiers périmés
  // au moment du precache → versions mélangées en cache.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(urlsToCache.map(url =>
        fetch(url, { cache: "reload" }).then(r => {
          if (!r.ok) throw new Error("precache " + url + " : " + r.status);
          return cache.put(url, r);
        })
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  // Purge des anciens caches : sans cela, une version antérieure du SW peut continuer
  // à servir des fichiers périmés depuis un cache obsolète.
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  // Requêtes non-GET (API POST, uploads) et origines externes : jamais de cache.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. Dynamique et navigations : réseau d'abord, cache en secours uniquement.
  //    {cache:'reload'} : jamais servi depuis le cache HTTP du navigateur.
  if (isNetworkFirst(request)) {
    event.respondWith(
      fetch(request, { cache: "reload" })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then(cached => cached || (request.mode === "navigate" ? caches.match("/index.html") : Response.error()))
        )
    );
    return;
  }

  // 2. Assets statiques : cache d'abord (chargement instantané), revalidation en arrière-plan
  //    pour que la prochaine ouverture serve la dernière version (stale-while-revalidate).
  event.respondWith(
    caches.match(request).then(cached => {
      const update = fetch(request, { cache: "reload" })
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => null);
      return cached || update.then(response => response || Response.error());
    })
  );
});
