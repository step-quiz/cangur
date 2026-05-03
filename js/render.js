// ═══════════════════════════════════════════════════════════════════════
// js/render.js — Pure render of the answer grid from current state.
//
// All access to mutable state goes through state.js getters; this
// module never writes state itself.
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getCurIdx, getQIdx,
  getStuOrder, getStuNames, getStuMap, getStuModels,
} from './state.js';

/** Display string for an answer value. '_' → '—', null → '·', else as-is. */
export function valDisplay(val) {
  if (val === '_') return '—';
  if (val === null) return '·';
  return val;
}

export function render() {
  const stuOrder  = getStuOrder();
  const stuNames  = getStuNames();
  const stuMap    = getStuMap();
  const stuModels = getStuModels();
  const curIdx    = getCurIdx();
  const qIdx      = getQIdx();

  const code    = curIdx >= 0 ? stuOrder[curIdx] : null;
  const answers = code ? stuMap[code] : null;

  document.getElementById('stu-code').textContent = code || '—';
  document.getElementById('hdr-name').textContent = code ? (stuNames[code] || '') : '';

  for (let qi = 0; qi < Q; qi++) {
    const cell  = document.getElementById(`c${qi}`);
    const ansEl = document.getElementById(`a${qi}`);
    if (!cell || !ansEl) continue;
    const val = answers ? answers[qi] : null;
    cell.className = 'cell';
    cell.dataset.v = '';
    ansEl.className = 'q-a';

    if (qi === qIdx && curIdx >= 0 && qIdx < Q) {
      cell.classList.add('active');
      if (val !== null) {
        // Show the existing value with a muted "preview" colour so the
        // user can see what's there and decide whether to overwrite.
        ansEl.textContent = valDisplay(val);
        ansEl.classList.add('preview');
      } else {
        ansEl.textContent = '';
      }
    } else if (val !== null) {
      cell.classList.add('filled');
      cell.dataset.v = val;
      ansEl.textContent = valDisplay(val);
    } else {
      ansEl.textContent = '·';
    }
  }

  const filled = answers ? answers.filter(v => v !== null).length : 0;
  document.getElementById('done-b').style.display = filled === Q ? 'inline-block' : 'none';

  const modelStr = code && stuModels[code] ? `· Model ${stuModels[code]}` : '';
  document.getElementById('nav-st').textContent =
    code ? `Alumne ${code} ${modelStr}  ·  ${filled}/${Q}` : '—';

  document.getElementById('prog').style.width = answers ? `${(filled / Q) * 100}%` : '0%';
}
