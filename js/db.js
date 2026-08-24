/**
 * db.js — IndexedDB-Zugriffsschicht für Vorratskeller.
 *
 * Datenmodell (Store "items"):
 *   id        number   — Primärschlüssel, auto-increment
 *   name      string   — Artikelname
 *   qty       number   — aktueller Bestand
 *   unit      string   — Einheit (Rollen, Flaschen, Stück ...)
 *   min       number   — Mindestbestand, ab dem als "knapp" markiert wird
 *   barcode   string?  — EAN aus dem Scanner, null wenn manuell angelegt
 *   createdAt number   — Unix-Timestamp (ms)
 *   updatedAt number   — Unix-Timestamp (ms)
 *
 * Alles läuft rein lokal im Browser, kein Server, keine Synchronisation.
 */

const DB_NAME = 'vorratskeller';
const DB_VERSION = 1;
const STORE = 'items';

let dbInstance = null;

function openDb() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('barcode', 'barcode', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };

    req.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    req.onerror = (event) => reject(event.target.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = (event) => reject(event.target.error);
  });
}

const VorratsDB = {
  /** Alle Artikel laden, alphabetisch sortiert. */
  async getAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        resolve(items);
      };
      req.onerror = (event) => reject(event.target.error);
    });
  },

  /** Einen Artikel per Barcode finden (für Scan-Workflow). */
  async findByBarcode(barcode) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const index = tx.objectStore(STORE).index('barcode');
      const req = index.get(barcode);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (event) => reject(event.target.error);
    });
  },

  /** Neuen Artikel anlegen. Gibt die neue id zurück. */
  async add(item) {
    const now = Date.now();
    const record = {
      name: item.name,
      qty: item.qty ?? 0,
      unit: item.unit || 'Stück',
      min: item.min ?? 0,
      barcode: item.barcode || null,
      createdAt: now,
      updatedAt: now,
    };
    return withStore('readwrite', (store) => store.add(record));
  },

  /** Bestehenden Artikel vollständig aktualisieren (z. B. nach Bearbeiten-Formular). */
  async update(id, changes) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error('Artikel nicht gefunden: ' + id));
        const updated = { ...existing, ...changes, updatedAt: Date.now() };
        store.put(updated);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  },

  /** Menge um delta ändern (z. B. +1 / -1), nie unter 0. */
  async changeQty(id, delta) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error('Artikel nicht gefunden: ' + id));
        existing.qty = Math.max(0, existing.qty + delta);
        existing.updatedAt = Date.now();
        store.put(existing);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event.target.error);
    });
  },

  /** Artikel löschen. */
  async remove(id) {
    return withStore('readwrite', (store) => store.delete(id));
  },
};
