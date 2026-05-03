// ═══════════════════════════════════════════════════════════════════════
// js/export.js — Export raw answers and corrected results to .xlsx.
//
// Two outputs:
//   exportRespostes(): one row per student × 30 columns (no scoring)
//   dlResultsXLSX():   level-prefixed file with column scores + total
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getStuMap, getStuModels, getStuNames, getStuOrder, getLastResults,
} from './state.js';

// ─── Cosmetic constants for the spreadsheets ──
//
// Empirical calibration for Google Sheets: width:14.5 ≈ 100 px, which
// fits comfortably both for the "Codi" / "Nom" columns and the answer
// columns at half-width.
const W_FULL = 14.5;
const W_HALF = W_FULL / 2;
const WHITE  = 'FFFFFFFF';
const GREY   = 'FFF2F2F2';

// ─── Export raw answers ─────────────────────────────────────────────

export async function exportRespostes() {
  const stuOrder = getStuOrder();
  if (!stuOrder.length) {
    alert('No hi ha cap alumne introduït.');
    return;
  }

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet('Respostes');

  ws.columns = [
    { width: W_FULL },                                  // Codi
    { width: W_FULL },                                  // Nom
    { width: 8 },                                       // Model
    ...Array.from({ length: Q }, () => ({ width: W_HALF })),
  ];
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const headers = ['Codi', 'Nom', 'Model', ...Array.from({ length: Q }, (_, i) => `P${i + 1}`)];
  const hdr = ws.addRow(headers);
  hdr.font = { bold: true };
  hdr.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
    cell.alignment = { horizontal: 'left' };
  });

  const stuMap    = getStuMap();
  const stuModels = getStuModels();
  const stuNames  = getStuNames();

  stuOrder.forEach((code, i) => {
    const answers = stuMap[code].map(v => v === null ? '' : v === '_' ? '—' : v);
    const row = ws.addRow([code, stuNames[code] || '', stuModels[code] || '', ...answers]);
    const bg  = i % 2 === 0 ? WHITE : GREY;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { horizontal: 'left' };
    });
  });

  await downloadWorkbook(wb, 'respostes.xlsx');
}

// ─── Export corrected results ───────────────────────────────────────

export async function dlResultsXLSX() {
  const last = getLastResults();
  if (!last) return;
  const { level, rows } = last;

  const wb = new window.ExcelJS.Workbook();
  const ws = wb.addWorksheet(level);

  ws.columns = [
    { key: 'codi',  width: W_FULL },
    { key: 'nom',   width: W_FULL },
    { key: 'model', width: 8 },
    { key: 'col1',  width: W_FULL },
    { key: 'col2',  width: W_FULL },
    { key: 'col3',  width: W_FULL },
    { key: 'total', width: W_FULL },
  ];
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  const hdr = ws.addRow(['Codi', 'Nom', 'Model', '1a part', '2a part', '3a part', 'Total']);
  hdr.font = { bold: true };
  hdr.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: WHITE } };
    cell.alignment = { horizontal: 'left' };
  });

  rows.forEach((r, i) => {
    const row = ws.addRow([r.code, r.name, r.model, r.col1, r.col2, r.col3, r.total]);
    const bg  = i % 2 === 0 ? WHITE : GREY;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { horizontal: 'left' };
    });
  });

  await downloadWorkbook(wb, `cangur_${level}.xlsx`);
}

// ─── Helper ──

async function downloadWorkbook(wb, filename) {
  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
