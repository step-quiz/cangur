// ═══════════════════════════════════════════════════════════════════════
// js/grid.js — Build the 30-cell question grid (3 columns × 10 rows)
// and the dynamic keyboard reference at the bottom.
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import { getCurIdx, setQIdx } from './state.js';
import { render } from './render.js';
import { getKeyCfg, displayKey } from './keyboard.js';

export function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  // Three columns of 10 questions each. Cangur scoring depends on this
  // exact split (1a part / 2a part / 3a part) — see config.COL_RULES.
  for (let col = 0; col < 3; col++) {
    const start = col * 10;
    const colEl = document.createElement('div');
    colEl.className = 'col';
    colEl.innerHTML =
      `<div class="col-lbl">P${start + 1}–P${start + 10}</div>` +
      `<div class="cells" id="cl${col}"></div>`;
    grid.appendChild(colEl);

    const cellsWrap = document.getElementById(`cl${col}`);
    for (let r = 0; r < 10; r++) {
      const qi = start + r;
      const c = document.createElement('div');
      c.className   = 'cell';
      c.id          = `c${qi}`;
      c.dataset.v   = '';
      c.innerHTML =
        `<span class="q-n">${qi + 1}</span>` +
        `<span class="q-a" id="a${qi}">·</span>` +
        `<span class="cur"></span>`;
      c.addEventListener('click', () => {
        if (getCurIdx() >= 0) { setQIdx(qi); render(); }
      });
      cellsWrap.appendChild(c);
    }
  }
}

export function buildKbdRef() {
  const ref = document.getElementById('kbd-ref');
  const k = getKeyCfg();
  ref.innerHTML = [
    `<div class="ki"><kbd>${displayKey(k.A)}</kbd>=A</div>`,
    `<div class="ki"><kbd>${displayKey(k.B)}</kbd>=B</div>`,
    `<div class="ki"><kbd>${displayKey(k.C)}</kbd>=C</div>`,
    `<div class="ki"><kbd>${displayKey(k.D)}</kbd>=D</div>`,
    `<div class="ki"><kbd>${displayKey(k.E)}</kbd>=E</div>`,
    `<div class="ki"><kbd>${displayKey(k.blank)}</kbd>=blanc</div>`,
    `<div class="ki"><kbd>${displayKey(k.invalid)}</kbd>=inv.</div>`,
    `<div class="ki"><kbd>${displayKey(k.erase)}</kbd>=esborra←</div>`,
    `<div class="ki"><kbd>↑</kbd><kbd>↓</kbd>=casella±1</div>`,
    `<div class="ki"><kbd>←</kbd><kbd>→</kbd>=columna±1</div>`,
  ].join('');
}
