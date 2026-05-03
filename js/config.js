// ═══════════════════════════════════════════════════════════════════════
// js/config.js — Compile-time constants for the Cangur corrector.
//
// All "magic numbers" live here so they can be tweaked in one place
// without grepping the codebase.
// ═══════════════════════════════════════════════════════════════════════

// Number of questions in the Cangur exam (fixed).
export const Q = 30;

// Available educational levels. The XLSX answer-key file may contain
// rows for any subset of these; the level selector enables only those
// found in the loaded file.
export const LEVELS = ['1ESO', '2ESO', '3ESO', '4ESO', '1BAT', '2BAT'];

// ─── Cangur scoring rules (oficial) ──
// Three blocks of 10 questions each, with different point values:
//   Q1–10:  base 7.5,  +3   correct, −0.75  wrong
//   Q11–20: base 10,   +4   correct, −1     wrong
//   Q21–30: base 12.5, +5   correct, −1.25  wrong
// Blanks score 0 (neither penalty nor reward); same for invalid (?).
export const COL_RULES = [
  { start: 0,  end: 10, base: 7.5,  pts: 3, pen: 0.75 },
  { start: 10, end: 20, base: 10,   pts: 4, pen: 1    },
  { start: 20, end: 30, base: 12.5, pts: 5, pen: 1.25 },
];

// ─── Default keyboard mapping for answer entry ──
// Mnemonic: home-row (a, s, d, f) for A–D, plus h for E (next to f);
// u and l on the right side for "blank" and "invalid" (so neither
// touches the answer cluster), x for erase.
export const DEFAULT_KEYS = {
  A: 'a', B: 's', C: 'd', D: 'f', E: 'h',
  blank: 'u', invalid: 'l', erase: 'x',
};

// Settings UI metadata for each remappable action.
export const ACTION_META = [
  { id: 'A',       label: 'Resposta A',   hint: 'lletra de resposta' },
  { id: 'B',       label: 'Resposta B',   hint: 'lletra de resposta' },
  { id: 'C',       label: 'Resposta C',   hint: 'lletra de resposta' },
  { id: 'D',       label: 'Resposta D',   hint: 'lletra de resposta' },
  { id: 'E',       label: 'Resposta E',   hint: 'lletra de resposta' },
  { id: 'blank',   label: 'En blanc',     hint: 'sense resposta'     },
  { id: 'invalid', label: 'Invàlid',      hint: 'resposta il·legible' },
  { id: 'erase',   label: 'Esborra ←',    hint: 'esborra l\'anterior' },
];

// Keys that cannot be remapped (reserved for navigation, browser, etc.).
export const FORBIDDEN_KEYS = new Set([
  'Enter', 'Tab', 'Escape',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Backspace', 'Delete',
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
  'Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'AltGraph',
]);

// localStorage key for persisted keyboard configuration.
export const KEY_CFG_STORAGE = 'cangur-keys-v1';
