// ═══════════════════════════════════════════════════════════════════════
// js/key-editor.js — Manual entry of Cangur answer keys.
//
// Flow:
//   Step 1 (pick): choose level (1ESO…2BAT) + model (A or B).
//   Step 2 (enter): type 30 answers with the configured keyboard,
//                   exactly like student entry.
//   Confirm: merges the new key into the existing answerKey (other
//            levels/models already loaded are preserved).
//   Export:  writes an XLSX with ALL currently loaded keys, in the
//            same format as the official file, so it can be reloaded
//            later with the normal file loader.
// ═══════════════════════════════════════════════════════════════════════

import { Q, LEVELS } from './config.js';
import { getAnswerKey, setAnswerKey } from './state.js';
import { getKeyCfg, normalizeKey, displayKey } from './keyboard.js';
import { updateKeyBadge } from './key-loader.js';

// ─── Level display labels (compatible with key-loader's parseRowLevel) ──

const LEVEL_LABELS = {
  '1ESO': 'Primer ESO',
  '2ESO': 'Segon ESO',
  '3ESO': 'Tercer ESO',
  '4ESO': 'Quart ESO',
  '1BAT': 'Primer Batxillerat',
  '2BAT': 'Segon Batxillerat',
};

// ─── Module-private state ────────────────────────────────────────────

let _level = null;   // selected level string, e.g. '2ESO'
let _model = null;   // selected model 'A' | 'B'
let _draft = null;   // Array(Q) of answer strings | null
let _qIdx  = 0;      // current cursor position (0-based)
let _open  = false;  // whether the overlay is visible

export function isKeyEditorOpen() { return _open; }

// ─── Open / close ────────────────────────────────────────────────────

export function openKeyEditor() {
  _level = null;
  _model = null;
  _draft = null;
  _qIdx  = 0;
  _showStep('pick');
  _buildPickStep();
  document.getElementById('key-editor-overlay').classList.remove('off');
  _open = true;
}

export function closeKeyEditor() {
  document.getElementById('key-editor-overlay').classList.add('off');
  _open = false;
}

function _showStep(name) {
  document.getElementById('ke-step-pick').style.display  = (name === 'pick')  ? '' : 'none';
  document.getElementById('ke-step-enter').style.display = (name === 'enter') ? '' : 'none';
}

// ─── Step 1: level + model picker ───────────────────────────────────

function _buildPickStep() {
  const answerKey = getAnswerKey() || {};
  const container = document.getElementById('ke-level-btns');
  container.innerHTML = '';

  LEVELS.forEach(lv => {
    const btn = document.createElement('button');
    const alreadyHas = answerKey[lv];
    btn.className  = 'level-btn' + (_level === lv ? ' active' : '');
    btn.textContent = lv;
    // Show a subtle indicator if this level already has a key loaded.
    btn.title = alreadyHas
      ? `Ja hi ha clau per ${lv} (models: ${Object.keys(alreadyHas).join(', ')}). Es sobreescriurà.`
      : '';
    btn.addEventListener('click', () => {
      _level = lv;
      _buildPickStep();
    });
    container.appendChild(btn);
  });

  // Model buttons
  ['A', 'B'].forEach(m => {
    const btn = document.getElementById(`ke-m${m}`);
    if (!btn) return;
    btn.classList.toggle('active', _model === m);
  });

  _updateStartBtn();
}

function _updateStartBtn() {
  document.getElementById('ke-btn-start').disabled = !(_level && _model);
}

// ─── Step 2: answer entry ────────────────────────────────────────────

function _startEntry() {
  _draft = Array(Q).fill(null);
  _qIdx  = 0;
  document.getElementById('ke-enter-title').textContent =
    `Clau · ${_level} · Model ${_model}`;
  _buildEntryGrid();
  _renderEntry();
  _updateKbdHint();
  _showStep('enter');
}

function _buildEntryGrid() {
  const grid = document.getElementById('ke-grid');
  grid.innerHTML = '';

  for (let col = 0; col < 3; col++) {
    const start = col * 10;
    const colEl = document.createElement('div');
    colEl.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px';

    const lbl = document.createElement('div');
    lbl.style.cssText =
      'font-size:.5rem;color:var(--muted);text-align:center;' +
      'font-weight:700;letter-spacing:.06em;margin-bottom:3px;text-transform:uppercase';
    lbl.textContent = `P${start + 1}–P${start + 10}`;
    colEl.appendChild(lbl);

    for (let r = 0; r < 10; r++) {
      const qi = start + r;
      const c  = document.createElement('div');
      c.className = 'cell';
      c.id        = `kec${qi}`;
      c.dataset.v = '';
      c.innerHTML =
        `<span class="q-n">${qi + 1}</span>` +
        `<span class="q-a" id="kea${qi}">·</span>` +
        `<span class="cur"></span>`;
      c.addEventListener('click', () => { _qIdx = qi; _renderEntry(); });
      colEl.appendChild(c);
    }

    grid.appendChild(colEl);
  }
}

function _renderEntry() {
  for (let qi = 0; qi < Q; qi++) {
    const cell  = document.getElementById(`kec${qi}`);
    const ansEl = document.getElementById(`kea${qi}`);
    if (!cell || !ansEl) continue;

    const val     = _draft[qi];
    cell.className = 'cell';
    cell.dataset.v = '';
    ansEl.className = 'q-a';
    ansEl.dataset.val = '';

    if (qi === _qIdx) {
      cell.classList.add('active');
      if (val !== null) {
        ansEl.textContent  = val === '_' ? '—' : val;
        ansEl.dataset.val  = val;
        ansEl.classList.add('preview');
      } else {
        ansEl.textContent = '';
      }
    } else if (val !== null) {
      cell.classList.add('filled');
      cell.dataset.v    = val;
      ansEl.textContent = val === '_' ? '—' : val;
      ansEl.dataset.val = val;
    } else {
      ansEl.textContent = '·';
    }
  }

  const filled = _draft.filter(v => v !== null).length;
  document.getElementById('ke-prog').style.width    = `${(filled / Q) * 100}%`;
  document.getElementById('ke-filled').textContent  = `${filled} / ${Q}`;
  document.getElementById('ke-btn-confirm').disabled = (filled < Q);
}

function _updateKbdHint() {
  const k = getKeyCfg();
  const d = key => displayKey(key);
  document.getElementById('ke-kbd-hint').textContent =
    `${d(k.A)}=A  ${d(k.B)}=B  ${d(k.C)}=C  ${d(k.D)}=D  ${d(k.E)}=E` +
    `  ${d(k.blank)}=blanc  ${d(k.erase)}=esborra`;
}

function _goBack() {
  if (!_draft) return;
  if (_qIdx > 0) {
    _draft[_qIdx] = null;
    _qIdx--;
    _draft[_qIdx] = null;
  } else {
    _draft[0] = null;
  }
  _renderEntry();
}

// ─── Confirm: merge into state + offer export ────────────────────────

function _confirm() {
  const filled = _draft ? _draft.filter(v => v !== null).length : 0;
  if (filled < Q) return;

  // Deep-merge: keep all existing levels/models, only overwrite _level/_model.
  const existing  = getAnswerKey() || {};
  const merged    = { ...existing };
  if (!merged[_level]) merged[_level] = {};
  merged[_level]  = { ...merged[_level] };
  merged[_level][_model] = _draft.map(v => v === '_' ? '' : (v || ''));

  setAnswerKey(merged);
  updateKeyBadge();
  document.getElementById('btn-correct').disabled = false;

  closeKeyEditor();

  if (confirm(
    `✓ Clau ${_level} Model ${_model} desada.\n\n` +
    `Voleu exportar totes les claus carregades a un fitxer XLSX\n` +
    `per poder-les recuperar en una sessió futura?`
  )) {
    exportKeyXlsx();
  }
}

// ─── XLSX export ─────────────────────────────────────────────────────
//
// Writes ALL currently loaded keys (any level, any model) in the same
// row format as the official Cangur key file, so key-loader.js can
// reload it transparently.

export async function exportKeyXlsx() {
  const answerKey = getAnswerKey();
  if (!answerKey || !Object.keys(answerKey).length) {
    alert('No hi ha cap clau carregada per exportar.');
    return;
  }

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Clau Cangur');

  ws.columns = [
    { width: 28 },
    ...Array.from({ length: Q }, () => ({ width: 4 })),
  ];

  // Header row
  const hdrRow = ws.addRow(['', ...Array.from({ length: Q }, (_, i) => `P${i + 1}`)]);
  hdrRow.font = { bold: true };
  hdrRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF5' } };
    cell.alignment = { horizontal: 'center' };
  });
  hdrRow.getCell(1).value = '';
  hdrRow.getCell(1).alignment = { horizontal: 'left' };
  ws.getRow(1).height = 14;

  const WHITE = 'FFFFFFFF', GREY = 'FFF4F4F4';
  let rowI = 0;

  for (const lv of LEVELS) {
    if (!answerKey[lv]) continue;
    for (const model of ['A', 'B']) {
      if (!answerKey[lv][model]) continue;
      const label   = `${LEVEL_LABELS[lv]} model ${model}`;
      const answers = answerKey[lv][model];
      const row     = ws.addRow([label, ...answers.map(v => v || '')]);
      const bg      = rowI % 2 === 0 ? WHITE : GREY;
      row.eachCell({ includeEmpty: true }, cell => {
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.alignment = { horizontal: 'center' };
        cell.font      = { size: 9 };
      });
      row.getCell(1).alignment = { horizontal: 'left' };
      row.getCell(1).font      = { bold: true, size: 9 };
      rowI++;
    }
  }

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'clau_cangur.xlsx'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Keyboard handler ────────────────────────────────────────────────

export function initKeyEditorKeyboard() {
  document.addEventListener('keydown', e => {
    if (!_open) return;
    // Only intercept keystrokes when on the answer-entry step.
    if (document.getElementById('ke-step-enter').style.display === 'none') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeKeyEditor();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _qIdx = Math.max(_qIdx - 1, 0);
      _renderEntry();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _qIdx = Math.min(_qIdx + 1, Q - 1);
      _renderEntry();
      return;
    }

    const k  = getKeyCfg();
    const lk = normalizeKey(e);

    if (lk === k.erase) {
      e.preventDefault();
      _goBack();
      return;
    }

    const answerMap = {
      [k.A]: 'A', [k.B]: 'B', [k.C]: 'C', [k.D]: 'D', [k.E]: 'E',
      [k.blank]: '_',
    };
    const val = answerMap[lk];
    if (val !== undefined) {
      e.preventDefault();
      _draft[_qIdx] = val;
      if (_qIdx < Q - 1) _qIdx++;
      _renderEntry();
    }
  });
}

// ─── DOM listeners (wired from init.js) ─────────────────────────────

export function initKeyEditorListeners() {
  // Step 1 — model buttons
  document.getElementById('ke-mA').addEventListener('click', () => {
    _model = 'A'; _buildPickStep();
  });
  document.getElementById('ke-mB').addEventListener('click', () => {
    _model = 'B'; _buildPickStep();
  });
  document.getElementById('ke-btn-cancel-pick').addEventListener('click', closeKeyEditor);
  document.getElementById('ke-btn-start').addEventListener('click', _startEntry);

  // Step 2 — entry controls
  document.getElementById('ke-btn-back').addEventListener('click', () => {
    _showStep('pick');
    _buildPickStep();
  });
  document.getElementById('ke-btn-erase').addEventListener('click', _goBack);
  document.getElementById('ke-btn-confirm').addEventListener('click', _confirm);
}
