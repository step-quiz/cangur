// ═══════════════════════════════════════════════════════════════════════
// js/utils.js — Shared utility helpers.
// ═══════════════════════════════════════════════════════════════════════

/** Escapes a string for safe insertion into HTML attribute values or content. */
export function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Promise-based sleep. */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Format a number Catalan-style: integers without decimals, others with comma. */
export function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}
