// ═══════════════════════════════════════════════════════════════════════
// js/main-keyboard.js — Top-level keyboard handler for answer entry.
//
// Active only when no modal is open and no editable input has focus.
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getCurIdx, getQIdx, setQIdx,
  getStuOrder, setStudentAnswer,
  isStuCompletePrompt, markUnsaved,
} from './state.js';
import { render } from './render.js';
import { getKeyCfg, normalizeKey } from './keyboard.js';
import { moveCell, goBack, nextStu } from './navigation.js';
import { hideCompletePrompt, showCompletePrompt } from './student-modal.js';

export function initMainKeyboard() {
  document.addEventListener('keydown', e => {
    // ── Bail out when any modal is on screen ──
    const anyModalOpen =
      !document.getElementById('stu-overlay').classList.contains('off')         ||
      !document.getElementById('cfg-overlay').classList.contains('off')         ||
      !document.getElementById('pdf-prompt-overlay').classList.contains('off')  ||
      !document.getElementById('correct-overlay').classList.contains('off')     ||
      !document.getElementById('results-overlay').classList.contains('off')     ||
      !document.getElementById('sheet-overlay').classList.contains('off')       ||
      !document.getElementById('ai-rec-overlay').classList.contains('off');

    if (anyModalOpen) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    // ── Completion prompt: any key advances; ESC stays editing ──
    if (isStuCompletePrompt()) {
      e.preventDefault();
      hideCompletePrompt();
      if (e.key === 'Escape') {
        // Keep cursor on the current student, but parked at last cell
        // so subsequent arrow-keys don't immediately wrap.
        setQIdx(Q - 1);
        render();
      } else {
        nextStu();
      }
      return;
    }

    // ── Arrow keys: move cell selection ──
    if (e.key === 'ArrowUp')    { e.preventDefault(); moveCell('up');    return; }
    if (e.key === 'ArrowDown')  { e.preventDefault(); moveCell('down');  return; }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); moveCell('left');  return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); moveCell('right'); return; }

    // ── Configurable answer keys ──
    const keyCfg = getKeyCfg();
    const lk = normalizeKey(e);

    if (lk === keyCfg.erase) { e.preventDefault(); goBack(); return; }

    const answerMap = {
      [keyCfg.A]: 'A',  [keyCfg.B]: 'B',  [keyCfg.C]: 'C',
      [keyCfg.D]: 'D',  [keyCfg.E]: 'E',
      [keyCfg.blank]:   '_',
      [keyCfg.invalid]: '?',
    };

    const val = answerMap[lk];
    const curIdx = getCurIdx();
    if (val !== undefined && curIdx >= 0) {
      e.preventDefault();
      const stuOrder = getStuOrder();
      const qIdx = getQIdx();
      setStudentAnswer(stuOrder[curIdx], qIdx, val);
      markUnsaved();
      if (qIdx < Q - 1) {
        setQIdx(qIdx + 1);
        render();
      } else {
        // Last cell → all done. Park cursor past the end so every cell
        // displays its committed value (no preview overlay), then show
        // the "alumne complet" prompt.
        setQIdx(Q);
        render();
        showCompletePrompt();
      }
    }
  });
}
