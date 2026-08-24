/**
 * scanner.js — Barcode-Scanner auf Basis von ZXing (rein clientseitig).
 *
 * Nutzung:
 *   Scanner.start(videoElement, onResult, onError)
 *   Scanner.stop()
 *
 * onResult(text) wird mit dem erkannten Barcode-Text aufgerufen.
 * Kamera läuft, bis Scanner.stop() aufgerufen wird oder ein Treffer kommt.
 */

const Scanner = (() => {
  let codeReader = null;
  let active = false;

  function start(videoEl, onResult, onError) {
    if (typeof ZXing === 'undefined') {
      onError && onError(new Error('Scanner-Bibliothek konnte nicht geladen werden.'));
      return;
    }

    codeReader = new ZXing.BrowserMultiFormatReader();
    active = true;

    codeReader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoEl,
        (result, err) => {
          if (!active) return;
          if (result) {
            onResult(result.getText());
          }
          // NotFoundException wird bei jedem Frame ohne Treffer geworfen — kein echter Fehler, ignorieren.
        }
      )
      .catch((err) => {
        onError && onError(err);
      });
  }

  function stop() {
    active = false;
    if (codeReader) {
      codeReader.reset();
      codeReader = null;
    }
  }

  return { start, stop };
})();
