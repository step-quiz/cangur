// ═══════════════════════════════════════════════════════════════════════
// js/key-loader.js — Load and parse the Cangur answer key from .xlsx.
//
// File format expected:
//   - One or more sheets. If there's more than one, the user picks via
//     a sheet-selector overlay.
//   - First column: row label ("Primer ESO model A", "1 BAT B", etc.).
//   - Columns 2..31: the 30 answers (A/B/C/D/E or "C/D" → C).
//
// Output structure (stored in state.answerKey):
//   { '1ESO': { A: [30 answers], B: [30 answers] }, ... }
// ═══════════════════════════════════════════════════════════════════════

import { Q, LEVELS } from './config.js';
import { setAnswerKey, setAnswerKeyName } from './state.js';

// ─── Row label → level / model ──────────────────────────────────────

function parseRowLevel(name) {
  const n = String(name).toLowerCase().replace(/\s+/g, ' ').trim();
  if ((n.includes('prim') || n.includes('primer')) && n.includes('bat')) return '1BAT';
  if ((n.includes('seg')  || n.includes('segon'))  && n.includes('bat')) return '2BAT';
  if (n.startsWith('primer') || n.startsWith('prim')) return '1ESO';
  if (n.startsWith('segon')  || n.startsWith('seg'))  return '2ESO';
  if (n.startsWith('terc')   || n.startsWith('ter'))  return '3ESO';
  if (n.startsWith('quart')  || n.startsWith('qua'))  return '4ESO';
  // Fallback: support compact codes like "1ESOA" / "1ESO B" / "2BAT-B".
  for (const lv of LEVELS) {
    if (n.replace(/[\s\-_]/g, '').toUpperCase().includes(lv)) return lv;
  }
  return null;
}

function parseRowModel(name) {
  const n = String(name).toLowerCase();
  // Default to A unless the row explicitly mentions B.
  if (/\bmodel\s*b\b/.test(n) || /\bmodelb\b/.test(n) || /\bb\s*$/.test(n.trim())) return 'B';
  return 'A';
}

// ─── Sheet → key map ────────────────────────────────────────────────

function parseSheet(sheetData) {
  const key = {};
  for (const row of sheetData) {
    if (!row || !row[0]) continue;
    const label = String(row[0]).trim();
    const level = parseRowLevel(label);
    if (!level) continue;
    const model = parseRowModel(label);
    const answers = [];
    for (let i = 1; i <= Q; i++) {
      const v = row[i] ? String(row[i]).trim().toUpperCase() : '';
      // Tolerate "C/D" or "C, D" style by taking the first letter only;
      // out-of-range letters become empty strings.
      const first = v ? v[0] : '';
      answers.push('ABCDE'.includes(first) ? first : '');
    }
    if (!key[level]) key[level] = {};
    key[level][model] = answers;
  }
  return key;
}

// ─── Public entry points ────────────────────────────────────────────

export function loadKeyFile(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = window.XLSX.read(e.target.result, { type: 'array' });
      if (wb.SheetNames.length === 1) {
        applySheet(wb, wb.SheetNames[0], file.name);
      } else {
        // More than one sheet → let the user pick which one.
        const btns = document.getElementById('sheet-btns');
        btns.innerHTML = '';
        wb.SheetNames.forEach(name => {
          const b = document.createElement('button');
          b.className = 'sheet-btn';
          b.textContent = name;
          b.addEventListener('click', () => {
            applySheet(wb, name, file.name);
            document.getElementById('sheet-overlay').classList.add('off');
          });
          btns.appendChild(b);
        });
        document.getElementById('sheet-overlay').classList.remove('off');
      }
    } catch (err) {
      alert('Error llegint el fitxer: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

export function applySheet(wb, sheetName, fileName) {
  const ws   = wb.Sheets[sheetName];
  const data = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const parsed = parseSheet(data);

  if (!Object.keys(parsed).length) {
    alert("No s'han trobat files de nivell vàlides al full.\n" +
          'Cada fila ha de començar amb el nom del nivell ' +
          '(p.ex. "Primer ESO", "1 BAT B"...).');
    return;
  }

  setAnswerKey(parsed);
  setAnswerKeyName(`${fileName} › ${sheetName}`);

  // UI: badge + enable the Correct button in the dropdown.
  const badge = document.getElementById('key-badge');
  badge.textContent = `✓ ${sheetName}`;
  badge.style.display = 'inline-block';
  document.getElementById('btn-correct').disabled = false;
}
