// ═══════════════════════════════════════════════════════════════════════
// js/scoring.js — Scoring algorithm, "Correct" modal flow, results table.
//
// Cangur scoring rules (oficial), per block of 10 questions:
//   Q1–10:  base 7.5,  +3   correct, −0.75  wrong
//   Q11–20: base 10,   +4   correct, −1     wrong
//   Q21–30: base 12.5, +5   correct, −1.25  wrong
// Blanks ('_') and invalids ('?') score 0.
// ═══════════════════════════════════════════════════════════════════════

import { Q, LEVELS, COL_RULES } from './config.js';
import {
  getStuMap, getStuModels, getStuNames, getStuOrder,
  getAnswerKey, getSelectedLevel, setSelectedLevel,
  getLastResults, setLastResults,
} from './state.js';
import { esc, fmt } from './utils.js';

// ─── Per-student scoring ─────────────────────────────────────────────

export function scoreStudent(answers, key) {
  let totCorrect = 0, totWrong = 0, totBlank = 0, totInvalid = 0;
  const colScores = COL_RULES.map(col => {
    let correct = 0, wrong = 0, blank = 0, invalid = 0;
    for (let i = col.start; i < col.end; i++) {
      const a = answers[i];
      if (a === null || a === undefined || a === '_') blank++;
      else if (a === '?')                              invalid++;
      else if (a === key[i])                           correct++;
      else                                              wrong++;
    }
    totCorrect += correct;
    totWrong   += wrong;
    totBlank   += blank;
    totInvalid += invalid;
    return col.base + correct * col.pts - wrong * col.pen;
  });
  return {
    col1: colScores[0], col2: colScores[1], col3: colScores[2],
    total: colScores[0] + colScores[1] + colScores[2],
    correct: totCorrect, wrong: totWrong, blank: totBlank, invalid: totInvalid,
  };
}

// ─── Correct modal: level selector + Correct button ──────────────────

export function openCorrect() {
  setSelectedLevel(null);
  buildLevelBtns();
  document.getElementById('correct-overlay').classList.remove('off');
}

export function selectLevel(lv) {
  setSelectedLevel(lv);
  buildLevelBtns();
}

function buildLevelBtns() {
  const answerKey = getAnswerKey();
  const sel       = getSelectedLevel();
  const container = document.getElementById('level-btns');

  container.innerHTML = '';
  LEVELS.forEach(lv => {
    const available = answerKey && answerKey[lv];
    const btn = document.createElement('button');
    btn.className = 'level-btn' + (sel === lv ? ' active' : '');
    btn.textContent = lv;
    if (!available) {
      btn.disabled = true;
      btn.title = 'No hi ha clau per aquest nivell';
    } else {
      btn.addEventListener('click', () => selectLevel(lv));
    }
    container.appendChild(btn);
  });
  updateCorrectInfo();
}

function updateCorrectInfo() {
  const el  = document.getElementById('correct-info');
  const btn = document.getElementById('btn-do-correct');
  const sel = getSelectedLevel();
  const answerKey = getAnswerKey();
  const stuCount  = getStuOrder().length;

  if (!sel || !answerKey || !answerKey[sel]) {
    el.textContent = 'Selecciona un nivell per continuar';
    btn.disabled = true;
    return;
  }
  const models = Object.keys(answerKey[sel]);
  el.textContent = `Nivell ${sel} · Models disponibles: ${models.join(', ')}` +
                   ` · ${stuCount} alumne${stuCount !== 1 ? 's' : ''} introduïts`;
  btn.disabled = stuCount === 0;
}

// ─── Run correction & open results modal ─────────────────────────────

export function doCorrect() {
  const sel = getSelectedLevel();
  const answerKey = getAnswerKey();
  if (!sel || !answerKey || !answerKey[sel]) return;

  document.getElementById('correct-overlay').classList.add('off');

  const levelKey = answerKey[sel];
  const stuMap    = getStuMap();
  const stuModels = getStuModels();
  const stuNames  = getStuNames();
  const stuOrder  = getStuOrder();

  const rows = [];
  for (const code of stuOrder) {
    const model = stuModels[code] || 'A';
    // Fallback chain: requested model → A → first available.
    const key = levelKey[model] || levelKey['A'] || Object.values(levelKey)[0];
    const s = scoreStudent(stuMap[code], key);
    rows.push({ code, name: stuNames[code] || '', model, ...s });
  }
  // Sort descending by total: highest score first.
  rows.sort((a, b) => b.total - a.total);

  setLastResults({ level: sel, rows });
  renderResults(getLastResults());
  document.getElementById('results-overlay').classList.remove('off');
}

// ─── Results table render ────────────────────────────────────────────

export function renderResults({ level, rows }) {
  const n   = rows.length;
  const avg = n ? rows.reduce((s, r) => s + r.total, 0) / n : 0;

  document.getElementById('res-title').textContent = `Resultats · ${level}`;
  document.getElementById('res-summary').textContent =
    `${n} alumnes · Mitjana: ${fmt(avg)} pts`;

  const thead = `<thead><tr>
    <th>#</th><th>Codi</th><th>Nom</th><th>Mod.</th>
    <th>1a part</th><th>2a part</th><th>3a part</th><th>Total</th>
    <th title="Encerts">✓</th><th title="Errors">✗</th><th title="Blancs">—</th>
  </tr></thead>`;

  const tbody = '<tbody>' + rows.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${esc(r.code)}</td>
    <td>${esc(r.name)}</td>
    <td>${esc(r.model)}</td>
    <td class="score">${fmt(r.col1)}</td>
    <td class="score">${fmt(r.col2)}</td>
    <td class="score">${fmt(r.col3)}</td>
    <td class="score" style="font-size:.72rem">${fmt(r.total)}</td>
    <td class="ok">${r.correct}</td>
    <td class="err">${r.wrong}</td>
    <td class="blnk">${r.blank}</td>
  </tr>`).join('') + '</tbody>';

  document.getElementById('res-table').innerHTML = thead + tbody;
}
