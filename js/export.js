// ═══════════════════════════════════════════════════════════════════════
// js/export.js — Export raw answers and corrected results to .xlsx,
//                and import previously-saved answers from .xlsx.
//
// Two export outputs:
//   exportRespostes(): one row per student × 30 columns (no scoring)
//   dlResultsXLSX():   level-prefixed file with column scores + total
//
// Import:
//   importRespostes(input): restores a session saved by exportRespostes()
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getStuMap, getStuModels, getStuNames, getStuOrder, getLastResults,
  setStuMap, setStuModels, setStuNames, setStuOrder,
  setCurIdx, setQIdx, markSaved,
} from './state.js';
import { render } from './render.js';

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

  // ── Full _meta ocult (permet reimportar de forma robusta) ──
  const wsMeta = wb.addWorksheet('_meta');
  wsMeta.state = 'veryHidden';
  wsMeta.addRow(['FORMAT',  'cangur-v1']);
  wsMeta.addRow(['Q',       Q]);
  wsMeta.addRow(['LABELS',  Array.from({ length: Q }, (_, i) => `P${i + 1}`).join(',')]);
  wsMeta.addRow(['TYPES',   Array(Q).fill('abcde').join(',')]);

  // ── Full de respostes visible ──
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
  markSaved();
}

// ─── Import respostes desades ────────────────────────────────────────
//
// Llegeix un fitxer .xlsx exportat prèviament per exportRespostes() i
// restaura l'estat de l'aplicació (alumnes, codis, models i respostes).

export async function importRespostes(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  try {
    const buf = await file.arrayBuffer();
    const wb2 = new window.ExcelJS.Workbook();
    await wb2.xlsx.load(buf);

    const ws2 = wb2.getWorksheet('Respostes');
    if (!ws2) {
      alert('No s\'ha trobat el full "Respostes" al fitxer.\nAssegura\'t que és un fitxer exportat per l\'aplicació Cangur.');
      return;
    }

    // ── Llegir capçalera per mapear columnes ──
    const hdrRow = ws2.getRow(1);
    let codiCol  = -1;
    let nomCol   = -1;
    let modelCol = -1;
    const pCols  = {};   // colNum → qi (0-based)

    hdrRow.eachCell((cell, colNum) => {
      const v = String(cell.value || '').trim();
      if      (v === 'Codi')         codiCol  = colNum;
      else if (v === 'Nom')          nomCol   = colNum;
      else if (v === 'Model')        modelCol = colNum;
      else if (/^P\d+$/.test(v)) {
        const qi = parseInt(v.slice(1), 10) - 1;
        if (qi >= 0 && qi < Q) pCols[colNum] = qi;
      }
    });

    // Fallback per si la capçalera no té els noms esperats
    if (codiCol === -1 && nomCol === -1 && Object.keys(pCols).length === 0) {
      alert('No s\'ha reconegut el format del fitxer.\nAssegura\'t que és un fitxer exportat per l\'aplicació Cangur.');
      return;
    }
    if (codiCol  === -1) codiCol  = 1;
    if (nomCol   === -1) nomCol   = 2;
    if (modelCol === -1) modelCol = 3;
    if (Object.keys(pCols).length === 0) {
      for (let qi = 0; qi < Q; qi++) pCols[4 + qi] = qi;
    }

    // ── Llegir files de dades ──
    const newStuMap    = {};
    const newStuNames  = {};
    const newStuModels = {};
    const newStuOrder  = [];

    ws2.eachRow((row, rowNum) => {
      if (rowNum === 1) return;   // capçalera
      const rawCodi = String(row.getCell(codiCol).value  || '').trim();
      const rawNom  = String(row.getCell(nomCol).value   || '').trim();
      if (!rawCodi && !rawNom) return;   // fila buida

      const code  = rawCodi || String(newStuOrder.length + 1).padStart(3, '0');
      const model = String(row.getCell(modelCol).value || '').trim().toUpperCase();

      newStuOrder.push(code);
      newStuNames[code]  = rawNom;
      newStuModels[code] = (model === 'A' || model === 'B') ? model : '';

      const answers = Array(Q).fill(null);
      Object.entries(pCols).forEach(([colNum, qi]) => {
        const raw = String(row.getCell(parseInt(colNum)).value ?? '').trim().toUpperCase();
        if (!raw) return;
        if (raw === '—' || raw === '-') { answers[qi] = '_'; return; }
        if (['A', 'B', 'C', 'D', 'E', '_'].includes(raw)) { answers[qi] = raw; return; }
        // Qualsevol altre valor es tracta com sense resposta
      });
      newStuMap[code] = answers;
    });

    if (!newStuOrder.length) {
      alert('No s\'ha trobat cap alumne al fitxer.');
      return;
    }

    // ── Confirmar si hi ha dades actuals ──
    const stuOrder = getStuOrder();
    if (stuOrder.length > 0) {
      if (!confirm(
        `Les dades actuals (${stuOrder.length} alumne${stuOrder.length !== 1 ? 's' : ''}) seran substituïdes ` +
        `per les del fitxer (${newStuOrder.length} alumne${newStuOrder.length !== 1 ? 's' : ''}).\nContinuar?`
      )) return;
    }

    // ── Aplicar nou estat ──
    setStuMap(newStuMap);
    setStuNames(newStuNames);
    setStuModels(newStuModels);
    setStuOrder(newStuOrder);
    setCurIdx(0);
    const firstUnanswered = newStuMap[newStuOrder[0]].findIndex(v => v === null);
    setQIdx(firstUnanswered === -1 ? Q : firstUnanswered);
    render();
    markSaved();
    alert(`✓ ${newStuOrder.length} alumne${newStuOrder.length !== 1 ? 's' : ''} carregats correctament.`);

  } catch (err) {
    console.error(err);
    alert('Error llegint el fitxer: ' + err.message);
  }
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
