/**
 * sw.js — cached die App-Shell, damit die App auch ohne Netz im Keller läuft.
 * Die Daten selbst liegen in IndexedDB, nicht hier — dieser Cache betrifft
 * nur die statischen Dateien (HTML/CSS/JS/Icons) und die Schrift.
 *
 * Strategie: Netz zuerst, Cache als Rückfall. Mit Netz sieht man dadurch immer
 * die neueste Version (ein Update braucht keinen zweiten Start mehr), ohne Netz
 * oder bei sehr langsamer Verbindung kommt die App aus dem Cache.
 *
 * Bei jeder Änderung an den App-Dateien die Nummer in CACHE_NAME erhöhen
 * (und in index.html bei .version nachziehen).
 */

const CACHE_NAME = 'vorratskeller-v5';
const NETWORK_TIMEOUT_MS = 3000;
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
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' umgeht den HTTP-Cache des Browsers, sonst landen
      // womöglich alte Dateien im neuen Cache (GitHub Pages cached ~10 Minuten).
      Promise.all(
        APP_SHELL.map((url) =>
          fetch(new Request(url, { cache: 'reload' })).then((res) => {
            if (!res.ok) throw new Error(url + ' → ' + res.status);
            return cache.put(url, res);
          })
        )
      )
    )
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

/** Netz mit Zeitlimit; bei Fehler oder Zeitüberschreitung kommt der Cache zum Zug. */
function networkFirst(request) {
  return new Promise((resolve) => {
    let settled = false;
    const useCache = () =>
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;
        return caches.match('./index.html');
      });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      useCache().then((res) => resolve(res || fetch(request)));
    }, NETWORK_TIMEOUT_MS);

    fetch(request, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve(res);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        useCache().then((res) => resolve(res || Response.error()));
      });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // Schrift (Urbanist): aus dem Cache anzeigen und im Hintergrund auffrischen,
  // damit sie auch im Keller ohne Netz da ist.
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const fresh = fetch(req)
            .then((res) => { cache.put(req, res.clone()); return res; })
            .catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // ZXing-CDN-Datei direkt aus dem Netz.
  if (url.includes('unpkg.com')) return;

  // Eigene App-Dateien: Netz zuerst, Cache als Rückfall.
  if (new URL(url).origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});
