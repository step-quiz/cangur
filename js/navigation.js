// ═══════════════════════════════════════════════════════════════════════
// js/navigation.js — Inter-student and inter-cell navigation.
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getCurIdx, setCurIdx, getQIdx, setQIdx,
  getStuMap, getStuOrder, markUnsaved,
} from './state.js';
import { render } from './render.js';
import { syncPdfToCurrent } from './pdf-viewer.js';
import { hideCompletePrompt, openModal } from './student-modal.js';

export function prevStu() {
  hideCompletePrompt();
  const curIdx = getCurIdx();
  if (curIdx > 0) {
    const newIdx = curIdx - 1;
    setCurIdx(newIdx);
    const code = getStuOrder()[newIdx];
    let qIdx = getStuMap()[code].findIndex(v => v === null);
    if (qIdx === -1) qIdx = Q;  // all answered → park cursor at end
    setQIdx(qIdx);
    render();
    syncPdfToCurrent();
  }
}

export function nextStu() {
  hideCompletePrompt();
  const curIdx = getCurIdx();
  const stuOrder = getStuOrder();
  if (curIdx < stuOrder.length - 1) {
    const newIdx = curIdx + 1;
    setCurIdx(newIdx);
    const code = stuOrder[newIdx];
    let qIdx = getStuMap()[code].findIndex(v => v === null);
    if (qIdx === -1) qIdx = Q;
    setQIdx(qIdx);
    render();
    syncPdfToCurrent();
  } else {
    // Past the last student → open the new-student modal.
    openModal();
  }
}

// ─── Cell navigation within the current student ──
// Up/Down → ±1 within column; Left/Right → jump to same row in
// previous/next column (matches the visual 3 × 10 grid layout).
export function moveCell(dir) {
  const curIdx = getCurIdx();
  if (curIdx < 0) return;
  hideCompletePrompt();
  let qIdx = getQIdx();
  const cur = qIdx >= Q ? Q - 1 : qIdx;  // when parked past end, start from last

  if (dir === 'up')    qIdx = Math.max(cur - 1, 0);
  if (dir === 'down')  qIdx = Math.min(cur + 1, Q - 1);
  if (dir === 'left')  qIdx = Math.max(cur - 10, cur % 10);
  if (dir === 'right') qIdx = Math.min(cur + 10, 20 + (cur % 10));

  setQIdx(qIdx);
  render();
}

// ─── Erase one step backwards (configurable key) ──
export function goBack() {
  const curIdx = getCurIdx();
  if (curIdx < 0) return;
  hideCompletePrompt();
  const stuOrder = getStuOrder();
  const stuMap   = getStuMap();
  let qIdx = getQIdx();

  if (qIdx >= Q) {
    // Parked past the end after completion: just move back into the
    // last cell without erasing.
    setQIdx(Q - 1);
    render();
    return;
  }
  if (qIdx > 0) {
    qIdx--;
    setQIdx(qIdx);
    stuMap[stuOrder[curIdx]][qIdx] = null;
    markUnsaved();
  } else if (curIdx > 0) {
    // At Q1 of the current student: hop to last cell of the previous one.
    const newCur = curIdx - 1;
    setCurIdx(newCur);
    qIdx = Q - 1;
    setQIdx(qIdx);
    stuMap[stuOrder[newCur]][qIdx] = null;
    markUnsaved();
  }
  render();
}
