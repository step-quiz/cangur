// ═══════════════════════════════════════════════════════════════════════
// js/pdf-viewer.js — PDF viewer wrapper around pdf.js (loaded as a
// global from CDN). Runtime state is kept in state.js so it can be
// accessed from navigation/student-modal without circular imports.
// ═══════════════════════════════════════════════════════════════════════

import {
  getPdfDoc, setPdfDoc,
  getPdfTotalPages, setPdfTotalPages,
  getPdfCurrentPage, setPdfCurrentPage,
  getPdfRenderTask, setPdfRenderTask,
  getPdfResizeTimer, setPdfResizeTimer,
  getCurIdx, getStuOrder,
} from './state.js';

const pdfjsLib = window.pdfjsLib;

export function initPdfWorker() {
  if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
}

// Forward-declared by setter: openModal lives in student-modal.js.
let _openModal = () => {};
export function setOpenModalFn(fn) { _openModal = fn; }

/** "Sense PDF" path: just dismiss the prompt and open the student modal. */
export function skipPdf() {
  document.getElementById('pdf-prompt-overlay').classList.add('off');
  _openModal();
}

export async function loadPdfFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  try {
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    setPdfDoc(doc);
    setPdfTotalPages(doc.numPages);
    document.body.classList.add('has-pdf');
    document.getElementById('pdf-bar-name').textContent = file.name;
    document.getElementById('pdf-prompt-overlay').classList.add('off');

    const curIdx = getCurIdx();
    const stuOrder = getStuOrder();
    const initialPage = curIdx >= 0
      ? Math.min(curIdx + 1, getPdfTotalPages())
      : Math.min(stuOrder.length + 1, getPdfTotalPages());
    await renderPdfPage(initialPage);

    // If no student exists yet and the new-student modal isn't showing,
    // open it now so the user has somewhere to type the first code.
    const stuOpen = !document.getElementById('stu-overlay').classList.contains('off');
    if (!stuOpen && curIdx < 0) _openModal();
  } catch (err) {
    alert('Error carregant el PDF: ' + err.message);
  }
}

export async function renderPdfPage(pageNum) {
  const pdfDoc = getPdfDoc();
  const total  = getPdfTotalPages();
  if (!pdfDoc || pageNum < 1 || pageNum > total) return;

  // Cancel any in-flight render to avoid race conditions.
  const prev = getPdfRenderTask();
  if (prev) { try { prev.cancel(); } catch (_) {} setPdfRenderTask(null); }

  try {
    const page   = await pdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas');
    const ctx    = canvas.getContext('2d');
    const pane   = document.getElementById('pdf-pane');

    // Available width: pane minus wrap padding (6×2) and border (1×2) = 16.
    const availW = Math.max(100, pane.clientWidth - 16);
    const v1     = page.getViewport({ scale: 1 });
    const dpr    = window.devicePixelRatio || 1;
    // Render at 2× the fit-width scale, then size via CSS for crispness.
    const fitScale = availW / v1.width;
    const viewport = page.getViewport({ scale: fitScale * Math.min(2, dpr + 1) });

    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.width  = availW + 'px';
    canvas.style.height = Math.round(availW * v1.height / v1.width) + 'px';

    const task = page.render({ canvasContext: ctx, viewport });
    setPdfRenderTask(task);
    await task.promise;
    setPdfRenderTask(null);
    setPdfCurrentPage(pageNum);
    pane.scrollTop = 0;
    document.getElementById('pdf-bar-page').textContent = `Pàg. ${pageNum} / ${total}`;
  } catch (err) {
    if (err && err.name === 'RenderingCancelledException') return;
    console.error('PDF render error:', err);
  }
}

/** Sync the PDF pane to the page corresponding to the active student. */
export function syncPdfToCurrent() {
  if (!getPdfDoc() || getCurIdx() < 0) return;
  const target = Math.min(getCurIdx() + 1, getPdfTotalPages());
  if (target !== getPdfCurrentPage()) renderPdfPage(target);
}

/** Sync to the page that the *next* (about-to-be-created) student would correspond to. */
export function syncPdfToNextSlot() {
  if (!getPdfDoc()) return;
  const target = Math.min(getStuOrder().length + 1, getPdfTotalPages());
  if (target !== getPdfCurrentPage()) renderPdfPage(target);
}

/** Re-render on viewport resize (debounced). */
export function initPdfResizeListener() {
  window.addEventListener('resize', () => {
    if (!getPdfDoc() || getPdfCurrentPage() < 1) return;
    clearTimeout(getPdfResizeTimer());
    setPdfResizeTimer(setTimeout(() => renderPdfPage(getPdfCurrentPage()), 150));
  });
}
