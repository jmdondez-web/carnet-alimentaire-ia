const CACHE_NAME = "carnet-pwa-v4";
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/manifest.json",
  "/connaissances.json",
  "/js/app.js",
  "/js/storage.js",
  "/js/ui.js",
  "/js/voice.js",
  "/js/camera.js",
  "/js/water.js",
  "/js/medications.js",
  "/js/ia.js",
  "/js/ia-settings.js",
  "/js/ia-external.js",
  "/js/ui-settings.js",
  "/js/export.js",
  "/js/pwa.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});