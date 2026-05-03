// ═══════════════════════════════════════════════════════════════════════
// js/ui.js — Generic UI helpers: toast, dropdowns, global ESC handler,
// beforeunload guard.
// ═══════════════════════════════════════════════════════════════════════

import { isUnsaved } from './state.js';

let _closeSettings = () => {};
export function setCloseSettingsFn(fn) { _closeSettings = fn; }

// ─── Toast ──
let _toastTimer = null;
export function showToast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ─── Dropdowns ──
export function toggleDropdown(id) {
  document.querySelectorAll('.dropdown').forEach(d => {
    if (d.id !== id) d.classList.remove('open');
  });
  document.getElementById(id).classList.toggle('open');
}

export function closeDropdowns() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
}

// ─── Init ──
export function initUiListeners() {
  // Click outside any dropdown closes them all.
  document.addEventListener('click', e => {
    if (!e.target.closest('.dropdown')) closeDropdowns();
  });

  // Warn on accidental tab close when there's unsaved data.
  window.addEventListener('beforeunload', e => {
    if (isUnsaved()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Global ESC handler (capture phase) closes the topmost overlay.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;

    if (document.querySelector('.dropdown.open')) {
      e.preventDefault(); closeDropdowns(); return;
    }

    // Order matters: close the one most likely to be on top first.
    const overlayChain = [
      'ai-rec-overlay',
      'sheet-overlay',
      'results-overlay',
      'correct-overlay',
      'cfg-overlay',
      'pdf-prompt-overlay',
    ];
    for (const id of overlayChain) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('off')) {
        e.preventDefault();
        if (id === 'cfg-overlay') _closeSettings();
        else el.classList.add('off');
        return;
      }
    }
    // (stu-overlay has its own handler in student-modal.js)
  }, true);
}
