// ═══════════════════════════════════════════════════════════════════════
// js/init.js — Application bootstrap.
//
// Responsibilities:
//   1. Load persisted keyboard config.
//   2. Wire setter-injection callbacks to break circular module imports.
//   3. Initialise PDF worker, build the grid, render initial state.
//   4. Attach DOM event handlers (replacing what would otherwise be
//      inline `on*=` HTML attributes).
//   5. Show the initial PDF prompt overlay.
//
// This is the single entry point loaded as a module by index.html.
// ═══════════════════════════════════════════════════════════════════════

import {
  loadKeyCfg, openSettings, saveCfgSettings, resetKeys,
  initSettingsKeyHandler, closeSettings, setOnKeyCfgChanged,
} from './keyboard.js';
import { buildGrid, buildKbdRef } from './grid.js';
import { render } from './render.js';
import {
  initPdfWorker, initPdfResizeListener, setOpenModalFn,
  loadPdfFile, skipPdf,
} from './pdf-viewer.js';
import {
  openModal, confirmStudent, clearAllData, editNameInline,
  initStudentModalListeners, setModel,
} from './student-modal.js';
import { prevStu, nextStu } from './navigation.js';
import { loadKeyFile } from './key-loader.js';
import { openCorrect, doCorrect } from './scoring.js';
import { exportRespostes, dlResultsXLSX } from './export.js';
import {
  initUiListeners, toggleDropdown, closeDropdowns, setCloseSettingsFn,
} from './ui.js';
import { initMainKeyboard } from './main-keyboard.js';
import {
  openAiRecognizer, startAiRecognition, processAiPdf,
} from './ai-recognizer.js';

// ─── 1. Setter-injection callbacks ────────────────────────────────────
setOpenModalFn(openModal);
setCloseSettingsFn(closeSettings);
setOnKeyCfgChanged(buildKbdRef);  // settings save → refresh keyboard reference

// ─── 2. Initial setup ─────────────────────────────────────────────────
loadKeyCfg();
initPdfWorker();
buildGrid();
buildKbdRef();
render();

// ─── 3. Module-owned listeners ────────────────────────────────────────
initSettingsKeyHandler();
initStudentModalListeners();
initPdfResizeListener();
initUiListeners();
initMainKeyboard();

// ─── 4. DOM event handlers ────────────────────────────────────────────
function on(id, evt, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}

// Header buttons
on('btn-prev-stu', 'click', prevStu);
on('btn-next-stu', 'click', nextStu);  // navigates forward; opens modal at end
on('hdr-name',     'click', editNameInline);

// Dropdown triggers
on('dd-accions-trigger', 'click', () => toggleDropdown('dd-accions'));
on('dd-cfg-trigger',     'click', () => toggleDropdown('dd-cfg'));

// Dropdown items — Accions
on('dd-key-loader',    'click', () => { closeDropdowns(); document.getElementById('key-file').click(); });
on('btn-correct',      'click', () => { closeDropdowns(); openCorrect(); });
on('dd-ai-recognizer', 'click', () => { closeDropdowns(); openAiRecognizer(); });
on('dd-export-xlsx',   'click', () => { closeDropdowns(); exportRespostes(); });
on('dd-load-pdf',      'click', () => { closeDropdowns(); document.getElementById('pdf-file').click(); });

// Dropdown items — Configuració
on('dd-settings',   'click', () => { closeDropdowns(); openSettings(); });
on('dd-clear-data', 'click', () => { closeDropdowns(); clearAllData(); });

// File inputs (hidden)
on('key-file',        'change', e => loadKeyFile(e.target));
on('pdf-file',        'change', e => loadPdfFile(e.target));
on('ai-rec-pdf-file', 'change', e => processAiPdf(e.target));

// Initial PDF prompt
on('btn-skip-pdf',  'click', skipPdf);
on('btn-load-pdf-from-prompt', 'click', () => document.getElementById('pdf-file').click());

// Student modal
on('btn-confirm-student', 'click', confirmStudent);
on('mA', 'click', () => setModel('A'));
on('mB', 'click', () => setModel('B'));

// Settings modal
on('btn-save-cfg',   'click', saveCfgSettings);
on('btn-reset-keys', 'click', resetKeys);
on('btn-close-cfg',  'click', closeSettings);

// Sheet selector cancel
on('btn-cancel-sheet', 'click', () => document.getElementById('sheet-overlay').classList.add('off'));

// Correct modal
on('btn-do-correct',     'click', doCorrect);
on('btn-close-correct',  'click', () => document.getElementById('correct-overlay').classList.add('off'));

// Results modal
on('btn-close-results',   'click', () => document.getElementById('results-overlay').classList.add('off'));
on('btn-dl-results-xlsx', 'click', dlResultsXLSX);

// AI recognizer
on('ai-rec-btn-start',  'click', startAiRecognition);
on('ai-rec-btn-close',  'click', () => document.getElementById('ai-rec-overlay').classList.add('off'));
on('ai-rec-toggle-key', 'click', () => {
  const inp = document.getElementById('ai-rec-apikey');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

// ─── 5. Show initial PDF prompt ───────────────────────────────────────
document.getElementById('pdf-prompt-overlay').classList.remove('off');
