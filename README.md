# Vorratskeller

Private PWA zur Bestandsverwaltung von Verbrauchsartikeln im Keller (Klopapier, Waschmittel etc.).
Läuft komplett lokal im Browser — keine Server, keine Anmeldung, keine Cloud-Synchronisation.

## Funktionen

- Artikel anlegen, bearbeiten, löschen (mit Bestätigung)
- Bestand per Tap (+/−) direkt anpassen
- Mindestbestand pro Artikel, "knapp"-Warnung bei Unterschreitung
- Barcode scannen (Kamera) zum schnellen Anlegen oder Wiederfinden eines Artikels
- Installierbar als App auf dem Homescreen (PWA), funktioniert offline

## Technik

| Bereich          | Lösung                                  |
|-------------------|------------------------------------------|
| Speicherung       | IndexedDB (siehe `js/db.js`)             |
| Barcode-Scan      | [ZXing](https://github.com/zxing-js/library) über CDN |
| Offline-Support   | Service Worker (`sw.js`), cached App-Shell |
| Hosting           | GitHub Pages (statisch, kein Backend nötig) |

## Projektstruktur

```
index.html          Grundgerüst + Sheets (Hinzufügen/Löschen/Scannen)
css/styles.css       gesamtes Styling
js/db.js             IndexedDB-Zugriffsschicht (Datenmodell)
js/scanner.js         Kamera-/Barcode-Logik (ZXing-Wrapper)
js/app.js             UI-Logik, verbindet db.js + scanner.js
manifest.json         PWA-Manifest
sw.js                 Service Worker fürs Offline-Caching
icons/                App-Icons (192px, 512px)
```

## Lokal testen

Da der Service Worker und die Kamera (`getUserMedia`) einen sicheren Kontext brauchen,
reicht ein einfaches Doppelklicken auf `index.html` nicht — ein lokaler Server ist nötig:

```bash
cd vorratskeller
python3 -m http.server 8000
```

Dann im Browser `http://localhost:8000` öffnen. Für den Kamerazugriff auf dem Handy
im gleichen WLAN ist zusätzlich HTTPS nötig (z. B. via `ngrok`) — oder direkt über die
später live geschaltete GitHub-Pages-URL testen, die läuft automatisch über HTTPS.

## Deploy auf GitHub Pages

1. Neues **öffentliches** Repo auf GitHub anlegen, z. B. `vorratskeller`
2. Diese Dateien pushen:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<dein-user>/vorratskeller.git
   git push -u origin main
   ```
3. Im Repo unter **Settings → Pages** als Quelle den `main`-Branch (Root) wählen
4. App ist danach unter `https://<dein-user>.github.io/vorratskeller/` erreichbar
5. Auf dem Handy die URL öffnen → über den Browser "Zum Homescreen hinzufügen"

## Datenmodell

Store `items` (IndexedDB):

| Feld        | Typ      | Beschreibung                              |
|-------------|----------|--------------------------------------------|
| `id`        | number   | Primärschlüssel, auto-increment            |
| `name`      | string   | Artikelname                                |
| `qty`       | number   | aktueller Bestand                          |
| `unit`      | string   | Einheit (Rollen, Flaschen, Stück ...)      |
| `min`       | number   | Mindestbestand, ab dem "knapp" markiert wird |
| `barcode`   | string?  | EAN aus dem Scanner, `null` wenn manuell   |
| `createdAt` | number   | Unix-Timestamp (ms)                        |
| `updatedAt` | number   | Unix-Timestamp (ms)                        |

## Bekannte Einschränkungen

- Keine Synchronisation zwischen mehreren Geräten (bewusst, siehe Architekturentscheidung: reine Einzelnutzer-App)
- Kamerazugriff erfordert HTTPS oder `localhost`
