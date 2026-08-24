/**
 * sw.js — cached die App-Shell, damit die App auch ohne Netz im Keller läuft.
 * Die Daten selbst liegen in IndexedDB, nicht hier — dieser Cache betrifft
 * nur die statischen Dateien (HTML/CSS/JS/Icons).
 */

const CACHE_NAME = 'vorratskeller-v1';
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
  // Netzwerk zuerst für die ZXing-CDN-Datei, sonst Cache-first für die App-Shell.
  if (event.request.url.includes('unpkg.com')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
