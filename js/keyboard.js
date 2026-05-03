// ═══════════════════════════════════════════════════════════════════════
// js/keyboard.js — Keyboard configuration store and settings UI.
//
// Owns the keyCfg map (which key triggers which answer action) plus
// its persistence (localStorage) and the settings overlay UI.
// ═══════════════════════════════════════════════════════════════════════

import {
  DEFAULT_KEYS, ACTION_META, FORBIDDEN_KEYS, KEY_CFG_STORAGE,
} from './config.js';

let keyCfg       = { ...DEFAULT_KEYS };
let keyCfgDraft  = {};
let cfgActiveRow = 0;

// Hook back to grid.buildKbdRef so the keyboard reference at the bottom
// of the screen is updated whenever the configuration changes. Wired
// from init.js to avoid a circular import.
let _onKeyCfgChanged = () => {};
export function setOnKeyCfgChanged(fn) { _onKeyCfgChanged = fn; }

export function getKeyCfg() { return keyCfg; }

export function loadKeyCfg() {
  try {
    const s = localStorage.getItem(KEY_CFG_STORAGE);
    if (s) Object.assign(keyCfg, JSON.parse(s));
  } catch (_) { /* ignore corrupt storage */ }
}

function saveKeyCfg() {
  try { localStorage.setItem(KEY_CFG_STORAGE, JSON.stringify(keyCfg)); } catch (_) {}
}

export function displayKey(k) {
  if (!k)        return '?';
  if (k === ' ') return 'Esp';
  if (k === ',' || k === '.') return k;
  return k.toUpperCase();
}

export function normalizeKey(e) {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

// ─── Conflict detection ──
// All eight actions share the same keystroke namespace; any two with
// the same key conflict.
function getConflictingActions(cfg) {
  cfg = cfg || keyCfgDraft;
  const conflicting = new Set();
  const count = {};
  for (const a of ACTION_META) {
    const k = cfg[a.id];
    if (!k) continue;
    (count[k] = count[k] || []).push(a.id);
  }
  for (const ids of Object.values(count)) {
    if (ids.length > 1) ids.forEach(id => conflicting.add(id));
  }
  return conflicting;
}

// ─── Open / close ──

export function openSettings() {
  keyCfgDraft = { ...keyCfg };
  cfgActiveRow = 0;
  renderCfgTable();
  document.getElementById('cfg-overlay').classList.remove('off');
}

export function closeSettings() {
  // Discard draft on close.
  document.getElementById('cfg-overlay').classList.add('off');
}

export function saveCfgSettings() {
  if (getConflictingActions(keyCfgDraft).size > 0) return;
  if (ACTION_META.some(a => !keyCfgDraft[a.id]))   return;
  keyCfg = { ...keyCfgDraft };
  saveKeyCfg();
  _onKeyCfgChanged();
  closeSettings();
}

export function resetKeys() {
  keyCfgDraft = { ...DEFAULT_KEYS };
  renderCfgTable();
}

// ─── Render the settings table ──

function renderCfgTable() {
  const conflicts = getConflictingActions(keyCfgDraft);
  const table = document.getElementById('cfg-table');

  const headerHtml = `
    <div class="cfg-row-hdr">
      <span>Tecla</span><span>Acció</span>
    </div>`;

  const rowsHtml = ACTION_META.map((a, i) => {
    const k = keyCfgDraft[a.id];
    const isActive    = i === cfgActiveRow;
    const hasConflict = conflicts.has(a.id);
    const classes = ['cfg-row2',
      isActive    ? 'cfg-active'   : '',
      hasConflict ? 'cfg-conflict' : '',
    ].filter(Boolean).join(' ');

    const badge = isActive
      ? `<span>${k ? displayKey(k) : ''}</span><span class="cfg-blink">|</span>`
      : `<span>${k ? displayKey(k) : '?'}</span>`;

    return `<div class="${classes}" data-row="${i}">
      <div class="cfg-key-cell"><div class="cfg-keybadge">${badge}</div></div>
      <div class="cfg-act-cell">${a.label}</div>
    </div>`;
  }).join('');

  table.innerHTML = headerHtml + rowsHtml;

  // Wire row clicks (no inline `onclick=`).
  table.querySelectorAll('.cfg-row2').forEach(rowEl => {
    rowEl.addEventListener('click', () => {
      cfgActiveRow = parseInt(rowEl.dataset.row, 10) || 0;
      renderCfgTable();
    });
  });

  const msg     = document.getElementById('cfg-conflict-msg');
  const saveBtn = document.getElementById('btn-save-cfg');
  const empty   = ACTION_META.filter(a => !keyCfgDraft[a.id]);

  if (conflicts.size > 0) {
    const names = ACTION_META.filter(a => conflicts.has(a.id)).map(a => a.label);
    msg.textContent = `⚠ Conflicte de tecles: ${names.join(', ')}`;
    msg.classList.add('on');
    if (saveBtn) saveBtn.disabled = true;
  } else if (empty.length > 0) {
    msg.textContent = `⚠ Tecles sense assignar: ${empty.map(a => a.label).join(', ')}`;
    msg.classList.add('on');
    if (saveBtn) saveBtn.disabled = true;
  } else {
    msg.classList.remove('on');
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ─── Settings keyboard handler ──

export function initSettingsKeyHandler() {
  document.addEventListener('keydown', e => {
    const cfgOpen = !document.getElementById('cfg-overlay').classList.contains('off');
    if (!cfgOpen) return;
    if (e.key === 'Escape') return; // global handler closes
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'ArrowDown') {
      cfgActiveRow = Math.min(cfgActiveRow + 1, ACTION_META.length - 1);
      renderCfgTable(); return;
    }
    if (e.key === 'ArrowUp') {
      cfgActiveRow = Math.max(cfgActiveRow - 1, 0);
      renderCfgTable(); return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      keyCfgDraft[ACTION_META[cfgActiveRow].id] = null;
      renderCfgTable(); return;
    }

    if (FORBIDDEN_KEYS.has(e.key)) return;

    keyCfgDraft[ACTION_META[cfgActiveRow].id] = normalizeKey(e);
    cfgActiveRow = Math.min(cfgActiveRow + 1, ACTION_META.length - 1);
    renderCfgTable();
  }, true); // capture phase, runs before main handlers
}
