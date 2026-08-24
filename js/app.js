/**
 * app.js — verbindet UI, db.js (IndexedDB) und scanner.js.
 */

const listEl = document.getElementById('list');
const subtitleEl = document.getElementById('subtitle');

// IDs der aktuell aufgeklappten Artikel — bleibt über render()-Aufrufe hinweg erhalten,
// damit ein Artikel nach +/- nicht wieder zuklappt.
const expandedIds = new Set();

// --- Rendering ---------------------------------------------------------

async function render() {
  const items = await VorratsDB.getAll();
  const sorted = sortItems(items);

  if (sorted.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Noch keine Artikel im Keller.<br>Leg mit "+ Artikel hinzufügen" den ersten an.</div>`;
  } else {
    listEl.innerHTML = sorted.map(renderTag).join('');
  }

  const lowCount = sorted.filter(isLow).length;
  subtitleEl.innerHTML = sorted.length + ' Artikel' +
    (lowCount > 0 ? ` · <strong>${lowCount} knapp</strong>` : '');

  attachListeners(sorted);
}

/** Knappe Artikel zuerst (als Gruppe), innerhalb der Gruppen alphabetisch. */
function sortItems(items) {
  return [...items].sort((a, b) => {
    const lowDiff = (isLow(a) ? 0 : 1) - (isLow(b) ? 0 : 1);
    if (lowDiff !== 0) return lowDiff;
    return a.name.localeCompare(b.name, 'de');
  });
}

function isLow(item) {
  return item.min > 0 && item.qty <= item.min;
}

function renderTag(item) {
  const low = isLow(item);
  const expanded = expandedIds.has(item.id);
  const pct = item.min > 0 ? Math.min(100, Math.round((item.qty / (item.min * 2)) * 100)) : 100;

  return `
    <div class="tag ${low ? 'low' : ''} ${expanded ? 'expanded' : ''}" data-id="${item.id}">
      <div class="tag-header" data-action="toggle">
        <div class="header-left">
          <span class="chevron">▸</span>
          <span class="name">${escapeHtml(item.name)}</span>
        </div>
        <div class="header-right">
          ${low ? '<span class="low-dot">⚠</span>' : ''}
          <span class="qty-compact">${item.qty} ${escapeHtml(item.unit)}</span>
        </div>
      </div>
      <div class="tag-body">
        <div class="tag-meta">
          <span>${item.min > 0 ? 'min. ' + item.min + ' ' + escapeHtml(item.unit) : 'kein Mindestbestand'}</span>
          <div class="tag-meta-actions">
            <button class="icon-btn" data-action="edit" aria-label="Bearbeiten">✎</button>
            <button class="icon-btn" data-action="delete" aria-label="Löschen">✕</button>
          </div>
        </div>
        <div class="tag-controls">
          <button class="stepper minus" data-action="minus">−</button>
          <div class="qty-wrap">
            <div class="qty-row">
              <span class="qty">${item.qty}</span>
              <span class="qty-label">${escapeHtml(item.unit)}</span>
            </div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            ${low ? '<div class="low-flag">⚠ Nachkaufen</div>' : ''}
          </div>
          <button class="stepper plus" data-action="plus">+</button>
        </div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function attachListeners(items) {
  listEl.querySelectorAll('.tag').forEach((tagEl) => {
    const id = Number(tagEl.dataset.id);
    const item = items.find((it) => it.id === id);

    tagEl.querySelector('[data-action="toggle"]').addEventListener('click', () => {
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
      } else {
        expandedIds.add(id);
      }
      render();
    });
    tagEl.querySelector('[data-action="minus"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await VorratsDB.changeQty(id, -1);
      render();
    });
    tagEl.querySelector('[data-action="plus"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await VorratsDB.changeQty(id, 1);
      render();
    });
    tagEl.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      askDelete(item);
    });
    tagEl.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditForm(item);
    });
  });
}

// --- Sheet: Artikel hinzufügen / bearbeiten -----------------------------

const addForm = document.getElementById('addForm');
const addFormTitle = document.getElementById('addFormTitle');
const newName = document.getElementById('newName');
const newQty = document.getElementById('newQty');
const newUnit = document.getElementById('newUnit');
const newMin = document.getElementById('newMin');
const newBarcode = document.getElementById('newBarcode');
const editId = document.getElementById('editId');

function openAddForm(prefill = {}) {
  addFormTitle.textContent = 'Neuer Artikel';
  editId.value = '';
  newName.value = prefill.name || '';
  newQty.value = prefill.qty ?? '';
  newUnit.value = prefill.unit || '';
  newMin.value = prefill.min ?? '';
  newBarcode.value = prefill.barcode || '';
  addForm.classList.add('open');
  newName.focus();
}

function openEditForm(item) {
  addFormTitle.textContent = 'Artikel bearbeiten';
  editId.value = item.id;
  newName.value = item.name;
  newQty.value = item.qty;
  newUnit.value = item.unit;
  newMin.value = item.min;
  newBarcode.value = item.barcode || '';
  addForm.classList.add('open');
}

function closeAddForm() {
  addForm.classList.remove('open');
}

document.getElementById('btnAdd').addEventListener('click', () => openAddForm());
document.getElementById('btnCancelAdd').addEventListener('click', closeAddForm);

document.getElementById('btnSaveItem').addEventListener('click', async () => {
  const name = newName.value.trim();
  if (!name) { newName.focus(); return; }

  const payload = {
    name,
    qty: parseInt(newQty.value) || 0,
    unit: newUnit.value.trim() || 'Stück',
    min: parseInt(newMin.value) || 0,
    barcode: newBarcode.value || null,
  };

  if (editId.value) {
    await VorratsDB.update(Number(editId.value), payload);
  } else {
    await VorratsDB.add(payload);
  }

  closeAddForm();
  render();
});

// --- Sheet: Löschen bestätigen ------------------------------------------

const deleteForm = document.getElementById('deleteForm');
const delName = document.getElementById('delName');
let pendingDeleteId = null;

function askDelete(item) {
  pendingDeleteId = item.id;
  delName.textContent = item.name;
  deleteForm.classList.add('open');
}
function closeDeleteForm() {
  deleteForm.classList.remove('open');
  pendingDeleteId = null;
}

document.getElementById('btnCancelDelete').addEventListener('click', closeDeleteForm);
document.getElementById('btnConfirmDelete').addEventListener('click', async () => {
  if (pendingDeleteId !== null) {
    await VorratsDB.remove(pendingDeleteId);
  }
  closeDeleteForm();
  render();
});

// --- Sheet: Barcode scannen ----------------------------------------------

const scanForm = document.getElementById('scanForm');
const scanVideo = document.getElementById('scanVideo');
const scanStatus = document.getElementById('scanStatus');

function openScanForm() {
  scanForm.classList.add('open');
  scanStatus.textContent = 'Kamera wird gestartet …';
  Scanner.start(
    scanVideo,
    async (text) => {
      Scanner.stop();
      closeScanForm();
      const existing = await VorratsDB.findByBarcode(text);
      if (existing) {
        // Bekannter Artikel: direkt Bestand bearbeiten
        openEditForm(existing);
      } else {
        // Unbekannter Barcode: neuer Artikel, Barcode vorbelegt
        openAddForm({ barcode: text });
      }
    },
    (err) => {
      scanStatus.textContent = 'Kamera nicht verfügbar: ' + err.message;
    }
  );
}

function closeScanForm() {
  Scanner.stop();
  scanForm.classList.remove('open');
}

document.getElementById('btnScan').addEventListener('click', openScanForm);
document.getElementById('btnCancelScan').addEventListener('click', closeScanForm);

// --- Start -----------------------------------------------------------------

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline-Unterstützung ist optional — App funktioniert auch ohne Service Worker.
    });
  });
}
