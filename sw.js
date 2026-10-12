/**
 * sw.js — cached die App-Shell, damit die App auch ohne Netz im Keller läuft.
 * Die Daten selbst liegen in IndexedDB, nicht hier — dieser Cache betrifft
 * nur die statischen Dateien (HTML/CSS/JS/Icons).
 */

const CACHE_NAME = 'vorratskeller-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/scanner.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Schrift (Urbanist): aus dem Cache anzeigen und im Hintergrund auffrischen,
  // damit sie auch im Keller ohne Netz da ist.
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fresh = fetch(event.request)
            .then((res) => { cache.put(event.request, res.clone()); return res; })
            .catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // ZXing-CDN-Datei direkt aus dem Netz, sonst Cache-first für die App-Shell.
  if (url.includes('unpkg.com')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
