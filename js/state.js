// ═══════════════════════════════════════════════════════════════════════
// js/state.js — Single source of truth for mutable application state.
//
// Other modules read state via getters and mutate via setters; never
// re-export the `let`-bound values directly (they would be read-only at
// the import site).
//
// The student-keyed maps use the 3-digit code (e.g. "123") as key.
// stuOrder is the canonical order of insertion / display.
// ═══════════════════════════════════════════════════════════════════════

// ── Module-private state ──
let _stuMap            = {};   // code → answers[Q]      ('A'..'E', '_', '?', null)
let _stuModels         = {};   // code → 'A' | 'B'
let _stuNames          = {};   // code → display name
let _stuOrder          = [];   // string[]               — insertion order

let _curIdx            = -1;
let _qIdx              = 0;
let _stuCompletePrompt = false;

let _answerKey         = null; // { '4ESO': { A:[...30], B:[...30] }, ... } | null
let _answerKeyName     = '';   // human-readable source label (file › sheet)
let _selectedLevel     = null; // string from LEVELS, picked in the Correct modal
let _lastResults       = null;
let _unsavedChanges    = false;

// PDF runtime state (transient, not persisted).
let _pdfDoc          = null;
let _pdfTotalPages   = 0;
let _pdfCurrentPage  = 0;
let _pdfRenderTask   = null;
let _pdfResizeTimer  = null;

// ── Getters ──
export const getStuMap            = () => _stuMap;
export const getStuModels         = () => _stuModels;
export const getStuNames          = () => _stuNames;
export const getStuOrder          = () => _stuOrder;
export const getCurIdx            = () => _curIdx;
export const getQIdx              = () => _qIdx;
export const isStuCompletePrompt  = () => _stuCompletePrompt;

export const getAnswerKey         = () => _answerKey;
export const getAnswerKeyName     = () => _answerKeyName;
export const getSelectedLevel     = () => _selectedLevel;
export const getLastResults       = () => _lastResults;
export const isUnsaved            = () => _unsavedChanges;

export const getPdfDoc            = () => _pdfDoc;
export const getPdfTotalPages     = () => _pdfTotalPages;
export const getPdfCurrentPage    = () => _pdfCurrentPage;
export const getPdfRenderTask     = () => _pdfRenderTask;
export const getPdfResizeTimer    = () => _pdfResizeTimer;

// ── Setters ──
export const setStuMap            = v => { _stuMap = v; };
export const setStuModels         = v => { _stuModels = v; };
export const setStuNames          = v => { _stuNames = v; };
export const setStuOrder          = v => { _stuOrder = v; };
export const setCurIdx            = v => { _curIdx = v; };
export const setQIdx              = v => { _qIdx = v; };
export const setStuCompletePrompt = v => { _stuCompletePrompt = v; };

export const setAnswerKey         = v => { _answerKey = v; };
export const setAnswerKeyName     = v => { _answerKeyName = v; };
export const setSelectedLevel     = v => { _selectedLevel = v; };
export const setLastResults       = v => { _lastResults = v; };

export const setPdfDoc            = v => { _pdfDoc = v; };
export const setPdfTotalPages     = v => { _pdfTotalPages = v; };
export const setPdfCurrentPage    = v => { _pdfCurrentPage = v; };
export const setPdfRenderTask     = v => { _pdfRenderTask = v; };
export const setPdfResizeTimer    = v => { _pdfResizeTimer = v; };

export function markUnsaved() { _unsavedChanges = true; }
export function markSaved()   { _unsavedChanges = false; }

// ── Granular setter for an individual answer cell ──
// Direct mutation of the array returned by getStuMap() also works, but
// going through this setter keeps the "mutate via setters" contract.
export function setStudentAnswer(code, qIdx, value) {
  if (_stuMap[code]) _stuMap[code][qIdx] = value;
}
