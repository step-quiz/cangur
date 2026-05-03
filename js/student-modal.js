// ═══════════════════════════════════════════════════════════════════════
// js/student-modal.js — New-student modal (3-digit code + name + model
// A/B), inline rename, and the "alumne complet" prompt.
//
// The Cangur exam uses a 3-digit student code (typically starting with
// "1": e.g. 123) plus a model letter (A or B) which determines the
// answer key during scoring. The model is mandatory.
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getStuMap, getStuModels, getStuNames, getStuOrder, setStuOrder,
  getCurIdx, setCurIdx, setQIdx,
  setStuCompletePrompt,
  markUnsaved, markSaved,
} from './state.js';
import { render } from './render.js';
import { syncPdfToCurrent, syncPdfToNextSlot } from './pdf-viewer.js';

let pendingModel = null;

// ─── Completion prompt show/hide ──────────────────────────────────────

export function showCompletePrompt() {
  setStuCompletePrompt(true);
  document.getElementById('done-prompt').classList.remove('off');
}
export function hideCompletePrompt() {
  setStuCompletePrompt(false);
  document.getElementById('done-prompt').classList.add('off');
}

// ─── Inline rename of the active student (via header click) ──────────

export function editNameInline() {
  const curIdx = getCurIdx();
  if (curIdx < 0) return;
  const code = getStuOrder()[curIdx];
  const stuNames = getStuNames();
  const el = document.getElementById('hdr-name');
  const cur = stuNames[code] || '';
  const inp = document.createElement('input');
  inp.type        = 'text';
  inp.value       = cur;
  inp.placeholder = code;
  inp.style.cssText = `
    font: inherit; font-size: 1.4rem; font-weight: 600;
    color: var(--accent); background: transparent;
    border: none; border-bottom: 2px solid var(--accent);
    outline: none; text-align: center;
    width: ${Math.max(120, cur.length * 18)}px; max-width: 30vw;
  `;
  el.textContent = '';
  el.appendChild(inp);
  inp.focus();
  inp.select();

  let cancelled = false;
  const finalize = () => {
    if (cancelled) {
      el.textContent = stuNames[code] || '';
      return;
    }
    stuNames[code] = inp.value.trim();
    el.textContent = stuNames[code];
    markUnsaved();
  };

  inp.addEventListener('blur', finalize);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelled = true; inp.blur(); }
  });
}

// ─── Open / close / confirm student modal ─────────────────────────────

function updatePrev() {
  const h = document.getElementById('d-hund').value || '_';
  const t = document.getElementById('d0').value || '_';
  const u = document.getElementById('d1').value || '_';
  document.getElementById('m-prev').textContent = `${h} ${t} ${u}`;
}

export function setModel(m) {
  pendingModel = m;
  document.getElementById('mA').classList.toggle('selected', m === 'A');
  document.getElementById('mB').classList.toggle('selected', m === 'B');
  document.getElementById('m-err').classList.remove('on');
}

export function openModal() {
  hideCompletePrompt();
  document.getElementById('d-hund').value = '1';
  document.getElementById('d0').value = '';
  document.getElementById('d1').value = '';
  document.getElementById('d-name').value = '';
  pendingModel = null;
  document.getElementById('mA').classList.remove('selected');
  document.getElementById('mB').classList.remove('selected');
  document.getElementById('m-err').classList.remove('on');
  updatePrev();
  document.getElementById('stu-overlay').classList.remove('off');
  setTimeout(() => document.getElementById('d0').focus(), 40);
  syncPdfToNextSlot();
}

export function closeModal() {
  document.getElementById('stu-overlay').classList.add('off');
}

export function confirmStudent() {
  const h = document.getElementById('d-hund').value.trim();
  const t = document.getElementById('d0').value.trim();
  const u = document.getElementById('d1').value.trim();

  // All three digits required.
  if (!/^\d$/.test(h) || !/^\d$/.test(t) || !/^\d$/.test(u)) {
    const focusId = !/^\d$/.test(h) ? 'd-hund' : !/^\d$/.test(t) ? 'd0' : 'd1';
    document.getElementById(focusId).focus();
    return;
  }
  // Model is mandatory: scoring depends on it.
  if (!pendingModel) {
    document.getElementById('m-err').classList.add('on');
    return;
  }

  const code = `${h}${t}${u}`;
  const stuMap    = getStuMap();
  const stuModels = getStuModels();
  const stuNames  = getStuNames();
  const stuOrder  = getStuOrder();

  if (!stuMap[code]) {
    stuMap[code] = Array(Q).fill(null);
    stuOrder.push(code);
  }
  stuModels[code] = pendingModel;
  stuNames[code]  = document.getElementById('d-name').value.trim();

  setCurIdx(stuOrder.indexOf(code));
  let qIdx = stuMap[code].findIndex(v => v === null);
  if (qIdx === -1) qIdx = Q;
  setQIdx(qIdx);

  markUnsaved();
  closeModal();
  render();
  syncPdfToCurrent();
}

// ─── Clear all data ──────────────────────────────────────────────────

export function clearAllData() {
  if (!confirm(
    'Segur que vols esborrar TOTES les dades?\n' +
    'Tots els alumnes i les seves respostes seran eliminats.'
  )) return;

  const stuMap    = getStuMap();
  const stuModels = getStuModels();
  const stuNames  = getStuNames();
  const stuOrder  = getStuOrder();
  Object.keys(stuMap).forEach(k => delete stuMap[k]);
  Object.keys(stuModels).forEach(k => delete stuModels[k]);
  Object.keys(stuNames).forEach(k => delete stuNames[k]);
  stuOrder.length = 0;

  setCurIdx(-1);
  setQIdx(0);
  hideCompletePrompt();
  markSaved();
  render();
  openModal();
}

// ─── Modal listeners ─────────────────────────────────────────────────
//
// Three-step focus dance:
//   d-hund (centena, default 1) → d0 (desenes) → d1 (unitats) → d-name → model
// Backspace on an empty digit jumps backwards. Enter/→ advances; ← retreats.
// Once on the name field, Enter selects model A and the user can switch
// to B via arrows / Tab / pressing 'b'. Final Enter confirms.

export function initStudentModalListeners() {
  // Hundreds digit
  const hund = document.getElementById('d-hund');
  hund.addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '').slice(-1);
    updatePrev();
    if (this.value) document.getElementById('d0').focus();
  });
  hund.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' || e.key === 'ArrowRight') {
      e.preventDefault(); document.getElementById('d0').focus();
    }
  });

  // Tens (d0) and units (d1)
  ['d0', 'd1'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      el.value = el.value.replace(/\D/g, '').slice(-1);
      updatePrev();
      if (el.value) {
        document.getElementById(i === 0 ? 'd1' : 'd-name').focus();
      }
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      if (e.key === 'Backspace' && !el.value) {
        e.preventDefault();
        document.getElementById(i === 1 ? 'd0' : 'd-hund').focus();
      }
      if (e.key === 'Enter' || (e.key === 'ArrowRight' && el.value)) {
        e.preventDefault();
        document.getElementById(i === 0 ? 'd1' : 'd-name').focus();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById(i === 1 ? 'd0' : 'd-hund').focus();
      }
    });
  });

  // Select-all on focus, so a click + new digit replaces the existing
  // value (otherwise maxlength=1 blocks the keystroke).
  ['d-hund', 'd0', 'd1'].forEach(id => {
    document.getElementById(id).addEventListener('focus', function () {
      setTimeout(() => this.select(), 0);
    });
  });

  // Name field
  document.getElementById('d-name').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Backspace' && !this.value) {
      e.preventDefault();
      document.getElementById('d1').focus();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      setModel('A');
      document.getElementById('mA').focus();
    }
  });

  // Model step: triggered when focus is on mA / mB or anywhere else inside
  // the modal that isn't a typed input. Listens at document level.
  document.addEventListener('keydown', e => {
    const stuOpen = !document.getElementById('stu-overlay').classList.contains('off');
    if (!stuOpen) return;
    const active = document.activeElement.id;
    // Let the digit / name fields handle their own keys.
    if (['d-hund', 'd0', 'd1', 'd-name'].includes(active)) return;

    const k = e.key.toLowerCase();
    const toggle = () => {
      const next = pendingModel === 'B' ? 'A' : 'B';
      setModel(next);
      document.getElementById('m' + next).focus();
    };
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Tab') {
      e.preventDefault(); toggle();
    } else if (k === 'b') {
      e.preventDefault(); setModel('B'); document.getElementById('mB').focus();
    } else if (k === 'a' || e.key === ' ') {
      e.preventDefault(); setModel('A'); document.getElementById('mA').focus();
    } else if (e.key === 'Enter') {
      e.preventDefault(); confirmStudent();
    } else if (e.key === 'Escape') {
      closeModal();
    }
  });
}
