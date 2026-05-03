// ═══════════════════════════════════════════════════════════════════════
// js/ai-recognizer.js — Reconeixement automàtic de respostes via Claude
// o Gemini (selecció a la UI).
//
// Adaptació del mòdul homònim de comp4eso al format de la prova Cangur:
//   - 30 preguntes amb opcions A / B / C / D / E (totes abcde).
//   - Format de codi d'alumne: 3 dígits.
//   - Model A / B detectat al full (si és visible).
//
// Flux:
//   1. L'usuari selecciona model i resolució, introdueix l'API key i
//      puja el PDF.
//   2. Cada pàgina es renderitza via pdf.js → canvas → base64 JPEG.
//   3. Es crida directament l'endpoint del proveïdor escollit.
//   4. La IA retorna JSON amb id_alumne + model + respostes Q01..Q30.
//   5. _normalitzarResposta() converteix els valors crus al format intern.
//   6. Les dades es carreguen a l'estat de l'app.
// ═══════════════════════════════════════════════════════════════════════

import { Q } from './config.js';
import {
  getStuOrder,
  setStuMap, setStuModels, setStuNames, setStuOrder,
  setCurIdx, setQIdx,
  markSaved,
} from './state.js';
import { render } from './render.js';
import { hideCompletePrompt } from './student-modal.js';
import { showToast } from './ui.js';
import { sleep, esc } from './utils.js';

// ─── Endpoints ───────────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const GEMINI_API_BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Reintents ──
//
// Errors transitoris (5xx, 429, errors de xarxa): caigudes momentànies,
// solen recuperar-se. Provem 5 vegades amb backoff generós.
// Altres errors (4xx no-429, errors de parse): probablement permanents.
// Limitem a 3 intents.
const MAX_RETRIES_TRANSIENT = 5;
const MAX_RETRIES_DEFAULT   = 3;
const RETRY_BACKOFF_MS = [5000, 10000, 15000, 40000];

// ─── Models ──────────────────────────────────────────────────────────
//
// Ordre escollit segons resultats empírics del testing del corrector
// 4t ESO de competències (Gemini 2.5 Pro va donar la millor precisió a
// 288 DPI). Per al Cangur la dificultat és comparable: full OMR amb 30
// caselles A-E per pàgina.
const MODEL_CHOICES = [
  { id: 'gemini-2.5-pro',         provider: 'google',    label: 'Gemini 2.5 Pro — màxima precisió (recomanat)' },
  { id: 'claude-opus-4-7',        provider: 'anthropic', label: 'Claude Opus 4.7 — alternativa Anthropic (potent)' },
  { id: 'gemini-2.5-flash',       provider: 'google',    label: 'Gemini 2.5 Flash — equilibri qualitat/cost' },
  { id: 'claude-sonnet-4-6',      provider: 'anthropic', label: 'Claude Sonnet 4.6 — equilibri qualitat/cost' },
  { id: 'gemini-2.5-flash-lite',  provider: 'google',    label: 'Gemini 2.5 Flash-Lite — el més econòmic' },
  { id: 'claude-haiku-4-5',       provider: 'anthropic', label: 'Claude Haiku 4.5 — més ràpid i econòmic' },
];
const DEFAULT_MODEL = MODEL_CHOICES[0].id;

function _modelInfo(id) {
  return MODEL_CHOICES.find(m => m.id === id) || MODEL_CHOICES[0];
}

// ─── Resolucions per al render del PDF ──
// ≈DPI = scale × 72. 4.0 (288 DPI) detecta marques tènues amb molta
// més fiabilitat que resolucions inferiors. El cost extra és menyspreable
// (les imatges es limiten a 1800 px de costat abans d'enviar-les).
const SCALE_CHOICES = [
  { val: '4.0', label: '≈288 DPI (màxima qualitat, recomanat)' },
  { val: '3.0', label: '≈216 DPI (equilibri qualitat/cost)' },
  { val: '2.0', label: '≈144 DPI (ràpid, més econòmic)' },
];
const DEFAULT_SCALE = '4.0';

// ─── Preus (USD per 1M tokens, maig 2026) ──
const PRICING = {
  'claude-opus-4-7':       { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':     { input:  3.00, output: 15.00 },
  'claude-haiku-4-5':      { input:  1.00, output:  5.00 },
  'gemini-2.5-pro':        { input:  1.25, output: 10.00 },
  'gemini-2.5-flash':      { input:  0.30, output:  2.50 },
  'gemini-2.5-flash-lite': { input:  0.10, output:  0.40 },
};

// ─── Prompt sistema ─────────────────────────────────────────────────

const PROMPT_SISTEMA =
  'Ets un sistema OMR (Optical Mark Recognition) especialitzat en ' +
  'fulls de respostes de la prova Cangur. ' +
  'La teva única feina és llegir les marques del full i retornar JSON estricte. ' +
  'No expliquis res, no afegeixis text. Només JSON.';

// ─── Obrir / tancar modal ───────────────────────────────────────────

export function openAiRecognizer() {
  _ensureControlsPopulated();
  document.getElementById('ai-rec-log').innerHTML = '';
  document.getElementById('ai-rec-log').style.display = 'none';
  _setProgress(0);
  _setStatus('');
  document.getElementById('ai-rec-btn-start').disabled = false;
  document.getElementById('ai-rec-btn-close').disabled = false;
  document.getElementById('ai-rec-overlay').classList.remove('off');
}

export function closeAiRecognizer() {
  document.getElementById('ai-rec-overlay').classList.add('off');
}

function _ensureControlsPopulated() {
  const modelSel = document.getElementById('ai-rec-model');
  if (modelSel && modelSel.options.length === 0) {
    MODEL_CHOICES.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.id === DEFAULT_MODEL) opt.selected = true;
      modelSel.appendChild(opt);
    });
    modelSel.addEventListener('change', _updateApiKeyHint);
  }
  const scaleSel = document.getElementById('ai-rec-scale');
  if (scaleSel && scaleSel.options.length === 0) {
    SCALE_CHOICES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.val;
      opt.textContent = s.label;
      if (s.val === DEFAULT_SCALE) opt.selected = true;
      scaleSel.appendChild(opt);
    });
  }
  _updateApiKeyHint();
}

function _updateApiKeyHint() {
  const sel = document.getElementById('ai-rec-model');
  const inp = document.getElementById('ai-rec-apikey');
  const lbl = document.getElementById('ai-rec-apikey-label');
  if (!sel || !inp) return;
  const info = _modelInfo(sel.value || DEFAULT_MODEL);
  if (info.provider === 'google') {
    inp.placeholder = 'AIzaSy...';
    if (lbl) lbl.textContent = 'API Key de Google (Gemini)';
  } else {
    inp.placeholder = 'sk-ant-api03-...';
    if (lbl) lbl.textContent = "API Key d'Anthropic (Claude)";
  }
}

// ─── Botó "Iniciar reconeixement" ────────────────────────────────────

export function startAiRecognition() {
  const apiKey = document.getElementById('ai-rec-apikey').value.trim();
  if (!apiKey) {
    const sel  = document.getElementById('ai-rec-model');
    const info = _modelInfo(sel?.value || DEFAULT_MODEL);
    const which = info.provider === 'google' ? 'de Google (Gemini)' : "d'Anthropic (Claude)";
    alert(`Cal introduir una API key ${which} per continuar.`);
    return;
  }
  document.getElementById('ai-rec-pdf-file').click();
}

// ─── Processament del PDF ───────────────────────────────────────────

export async function processAiPdf(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const apiKey = document.getElementById('ai-rec-apikey').value.trim();
  const model  = document.getElementById('ai-rec-model').value || DEFAULT_MODEL;
  const scale  = parseFloat(document.getElementById('ai-rec-scale').value || DEFAULT_SCALE);

  document.getElementById('ai-rec-btn-start').disabled = true;
  document.getElementById('ai-rec-btn-close').disabled = true;

  try {
    const buf    = await file.arrayBuffer();
    const pdfDoc = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const total  = pdfDoc.numPages;

    _setStatus(`Carregant ${total} pàgina(es) (model: ${model})...`);
    _showLog();

    const results = [];

    for (let p = 1; p <= total; p++) {
      _setStatus(`Processant pàgina ${p} de ${total}...`);
      _setProgress(Math.round((p - 1) / total * 100));

      try {
        const result = await _processPage(pdfDoc, p, apiKey, model, scale);
        results.push(result);

        if (result._failed) {
          _appendLog(
            `Pàg. ${p} — <strong>ERROR D'API</strong> — ${esc(result._error)}`,
            'err'
          );
        } else {
          const valides = Object.values(result.respostes)
            .filter(v => v && v !== '?' && v !== '').length;
          _appendLog(
            `Pàg. ${p} — <strong>${esc(result.id_alumne || '(sense codi)')}</strong>` +
            ` (model ${esc(result.model || '?')})` +
            ` — ${valides}/${Q} respostes` +
            (result.comentari ? ` — <em>${esc(result.comentari.slice(0, 80))}</em>` : ''),
            'ok'
          );
        }
      } catch (err) {
        _appendLog(`Pàg. ${p} — Error: ${esc(err.message)}`, 'err');
        console.error(`Page ${p}:`, err);
      }
    }

    _setProgress(100);

    if (results.length === 0) {
      _setStatus('Cap alumne processat. Comprova la API key i el PDF.');
      document.getElementById('ai-rec-btn-start').disabled = false;
      document.getElementById('ai-rec-btn-close').disabled = false;
      return;
    }

    _setStatus(`${results.length} alumne(s) processats. Carregant dades...`);
    _loadResultsIntoApp(results);

  } catch (err) {
    _setStatus(`Error carregant el PDF: ${err.message}`);
    console.error(err);
  }

  document.getElementById('ai-rec-btn-start').disabled = false;
  document.getElementById('ai-rec-btn-close').disabled = false;
}

// ─── Processar una pàgina ───────────────────────────────────────────

async function _processPage(pdfDoc, pageNum, apiKey, model, scale) {
  const page     = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = Math.round(viewport.width);
  canvas.height  = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

  // Resize if > 1800 px (saves tokens without hurting OMR quality).
  let src = canvas;
  const MAX_DIM = 1800;
  if (Math.max(canvas.width, canvas.height) > MAX_DIM) {
    const ratio = MAX_DIM / Math.max(canvas.width, canvas.height);
    src = document.createElement('canvas');
    src.width  = Math.round(canvas.width  * ratio);
    src.height = Math.round(canvas.height * ratio);
    src.getContext('2d').drawImage(canvas, 0, 0, src.width, src.height);
  }

  const base64 = src.toDataURL('image/jpeg', 0.85).split(',')[1];
  const prompt = _buildOmrPrompt();
  const provider = _modelInfo(model).provider;
  const pixelCount = src.width * src.height;

  let lastErr = null;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const callResult = (provider === 'google')
        ? await _callGemini(apiKey, model, base64, prompt)
        : await _callAnthropic(apiKey, model, base64, prompt);

      let clean = callResult.text.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
      }

      const parsed = _validarResposta(JSON.parse(clean));
      _logPageUsage(pageNum, model, scale, src.width, src.height, pixelCount, callResult.usage, parsed);
      return parsed;

    } catch (err) {
      lastErr = err;
      const isTransient = _isTransientError(err);
      const maxAttempts = isTransient ? MAX_RETRIES_TRANSIENT : MAX_RETRIES_DEFAULT;
      if (attempt >= maxAttempts) break;
      const wait = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)];
      console.warn(`[AI] Intent ${attempt} fallat (${isTransient ? 'transitori' : 'permanent'}: ${err.message}). Esperant ${wait}ms...`);
      await sleep(wait);
    }
  }

  // All retries exhausted: return a "failed" placeholder so the caller
  // can still create a slot for this page (with all answers '?'). The
  // user will see which pages need manual review.
  const respostes = {};
  for (let i = 0; i < Q; i++) respostes[`Q${String(i + 1).padStart(2, '0')}`] = '?';
  return {
    id_alumne: '',
    model: '',
    respostes,
    comentari: `ERROR: ${lastErr?.message}`,
    _failed: true,
    _error: lastErr?.message || 'Error desconegut',
  };
}

// ─── Classificació d'errors ─────────────────────────────────────────

function _isTransientError(err) {
  const status = err?.httpStatus;
  if (typeof status === 'number') {
    if (status === 429) return true;
    if (status >= 500 && status < 600) return true;
    return false;
  }
  if (err instanceof SyntaxError) return false;
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) {
    return true;
  }
  return false;
}

// ─── Crida a Anthropic ──────────────────────────────────────────────

async function _callAnthropic(apiKey, model, base64, prompt) {
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: PROMPT_SISTEMA,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text',  text: prompt },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const e = await resp.json(); msg = e.error?.message || msg; } catch (_) {}
    const err = new Error(msg); err.httpStatus = resp.status; throw err;
  }

  const data = await resp.json();
  return {
    text: data.content.find(b => b.type === 'text')?.text || '',
    usage: {
      provider: 'anthropic',
      promptTokens:   data.usage?.input_tokens  ?? null,
      outputTokens:   data.usage?.output_tokens ?? null,
      thoughtsTokens: null,
      totalTokens:    (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

// ─── Crida a Google Gemini ──────────────────────────────────────────
//
// Gemini posa la clau a la URL i té un flag responseMimeType que força
// JSON vàlid (elimina d'arrel els ```json``` que Claude posa de vegades).

async function _callGemini(apiKey, model, base64, prompt) {
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        // 8000 és un límit generós que dóna marge al "thinking" intern de
        // Gemini 2.5 abans de generar la sortida visible.
        maxOutputTokens: 8000,
        temperature: 0,
      },
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const e = await resp.json(); msg = e.error?.message || msg; } catch (_) {}
    const err = new Error(msg); err.httpStatus = resp.status; throw err;
  }

  const data = await resp.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`Gemini ha bloquejat el prompt (raó: ${blockReason}).`);
    throw new Error('Gemini no ha retornat cap candidat.');
  }
  const fr = candidate.finishReason;
  if (fr === 'SAFETY')     throw new Error(`Gemini ha refusat per polítiques de seguretat.`);
  if (fr === 'MAX_TOKENS') throw new Error('Gemini ha retallat la resposta (MAX_TOKENS). Proveu una resolució més alta o un altre model.');
  if (fr === 'RECITATION') throw new Error('Gemini ha refusat per "RECITATION".');

  const txt = candidate.content?.parts?.find(p => p.text)?.text;
  if (!txt) throw new Error(`Gemini ha retornat una resposta sense text (finishReason=${fr}).`);

  return {
    text: txt,
    usage: {
      provider: 'google',
      promptTokens:   data.usageMetadata?.promptTokenCount     ?? null,
      outputTokens:   data.usageMetadata?.candidatesTokenCount ?? null,
      thoughtsTokens: data.usageMetadata?.thoughtsTokenCount   ?? null,
      totalTokens:    data.usageMetadata?.totalTokenCount      ?? null,
    },
  };
}

// ─── Validació de la resposta ───────────────────────────────────────

function _validarResposta(data) {
  const raw = (data.respostes && typeof data.respostes === 'object') ? data.respostes : {};
  const respostes = {};
  for (let i = 0; i < Q; i++) {
    const qid = `Q${String(i + 1).padStart(2, '0')}`;
    let v = String(raw[qid] ?? '?').trim();
    if (v === '') v = '?';
    respostes[qid] = v;
  }
  // model: prefer explicit field, fall back to scanning id_alumne for "B".
  let model = String(data.model ?? '').trim().toUpperCase();
  if (model !== 'A' && model !== 'B') model = '';
  return {
    id_alumne: String(data.id_alumne ?? '').trim(),
    model,
    respostes,
    comentari: String(data.comentari ?? '').trim(),
  };
}

// ─── Normalització a format intern ──────────────────────────────────
//
//   null  → cel·la buida (pendent revisió: '?' de la IA)
//   '_'   → blanc explícit ('—' o '!' = múltiple/invàlid)
//   'A'..'E' → resposta validada

function _normalitzarResposta(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (s === '' || s === '?') return null;
  if (s === '!') return '_';
  if (s === '—' || s === '-' || s === '_') return '_';
  const sUp = s.toUpperCase();
  return 'ABCDE'.includes(sUp) && sUp.length === 1 ? sUp : null;
}

// ─── Carregar resultats a l'estat de l'app ─────────────────────────

function _loadResultsIntoApp(results) {
  const existing = getStuOrder();
  if (existing.length > 0) {
    if (!confirm(
      `Les dades actuals (${existing.length} alumne${existing.length !== 1 ? 's' : ''}) ` +
      `seran substituïdes pels resultats del reconeixement ` +
      `(${results.length} alumne${results.length !== 1 ? 's' : ''}).\n\nContinuar?`
    )) return;
  }

  const newStuMap    = {};
  const newStuModels = {};
  const newStuNames  = {};
  const newStuOrder  = [];
  const usedCodes    = new Set();

  results.forEach((result, i) => {
    // Try to use the AI-detected code; fall back to a 3-digit sequence.
    let code = String(result.id_alumne || '').trim();
    // Keep only digits (AI might add '#' or 'codi:' prefixes).
    code = code.replace(/\D/g, '');
    if (code.length > 3) code = code.slice(-3);  // last 3 digits if longer
    if (code.length < 3 || usedCodes.has(code)) {
      // Synthetic code "1_X_Y" where X_Y is the 1-based slot, padded.
      code = String(100 + i + 1).padStart(3, '0');
      // If even that collides (very unlikely), keep bumping.
      while (usedCodes.has(code)) {
        code = String(parseInt(code, 10) + 1).padStart(3, '0');
      }
    }
    usedCodes.add(code);

    newStuOrder.push(code);
    newStuNames[code]  = '';                            // OMR doesn't read the name reliably
    newStuModels[code] = result.model || 'A';           // default to A if unknown
    newStuMap[code]    = Array(Q).fill(null).map((_, qi) => {
      const qid = `Q${String(qi + 1).padStart(2, '0')}`;
      return _normalitzarResposta(result.respostes[qid]);
    });
  });

  setStuMap(newStuMap);
  setStuModels(newStuModels);
  setStuNames(newStuNames);
  setStuOrder(newStuOrder);
  setCurIdx(0);
  const firstPending = newStuMap[newStuOrder[0]].findIndex(v => v === null);
  setQIdx(firstPending === -1 ? Q : firstPending);
  hideCompletePrompt();
  render();
  markSaved();

  closeAiRecognizer();

  // Build a clear status toast: failed pages first, then dubt count.
  const failed = results.filter(r => r._failed);
  const dubtoses = results.reduce(
    (s, r) => s + Object.values(r.respostes).filter(v => v === '?').length, 0
  );

  let msg = '';
  let urgent = false;
  if (failed.length > 0) {
    urgent = true;
    const ok = results.length - failed.length;
    msg = `⚠️ ${failed.length} full${failed.length !== 1 ? 's' : ''} ` +
          `${failed.length !== 1 ? 'han' : 'ha'} fallat per error d'API. ` +
          `Carregat${ok !== 1 ? 's' : ''} ${ok} full${ok !== 1 ? 's' : ''} OK. ` +
          `Recomanació: torna-ho a executar més tard.`;
  } else {
    msg = `✓ ${results.length} alumne${results.length !== 1 ? 's' : ''} carregats via reconeixement automàtic.`;
    if (dubtoses > 0) {
      msg += ` ⚠️ ${dubtoses} resposta${dubtoses !== 1 ? 's' : ''} pendents de revisió manual (·).`;
    }
  }
  showToast(msg, urgent ? 8000 : 4000);
}

// ─── Construcció del prompt OMR ─────────────────────────────────────

function _buildOmrPrompt() {
  const jsonKeys = Array.from({ length: Q }, (_, i) => {
    const qid = `Q${String(i + 1).padStart(2, '0')}`;
    return `    "${qid}": "a" | "b" | "c" | "d" | "e" | "—" | "?" | "!",   // pregunta ${i + 1}`;
  }).join('\n');

  return `Analitza aquest full de respostes de la prova Cangur. Extreu la resposta marcada \
per a cadascun dels ${Q} ítems (numerats de l'1 al 30). Cada ítem té cinc opcions: A, B, C, D, E.

REGLES DE LECTURA — molt importants, llegeix-les amb atenció:

1. CONCEPTE DE «MARCA»: una marca és qualsevol traç voluntari fet per l'alumne dins d'un \
quadret d'opció, **amb intensitat suficient i forma reconeixible**. Inclou X, creus, aspes, \
cercles, rotllos, ratllats, gargots, traços diagonals o qualsevol senyal clarament intencionat.

NO és una marca:
   - arrugues del paper, taques, ombres de l'escaneig, punts accidentals molt petits
   - **RASTRES D'ESBORRAT (molt important)**: si veus a un quadret un residu tènue, una taca \
sense forma definida, un traç parcialment esborrat amb molta menys intensitat que les marques \
sòlides d'altres preguntes del MATEIX full, és un esborrat. L'alumne va marcar i després va \
canviar d'opinió retirant la marca amb goma. Tracta aquell quadret com a BUIT.
   - Comparació d'intensitat: les marques vàlides que fa l'alumne en altres preguntes del mateix \
full t'han de servir de referència. Un traç significativament més tènue i sense forma clara és, \
gairebé segur, un esborrat.

2. RESPOSTA NORMAL (X dins un quadret buit): si la fila té UNA SOLA X (o aspa) clara dins d'un \
dels quadrets buits, retorna aquesta opció.

3. ANUL·LACIÓ (quadrat completament ple): un quadret COMPLETAMENT OMPLERT (pintat sòlid uniforme, \
ennegrit, ratllat amb traços paral·lels densos fins a quedar negre) significa que l'alumne ha \
ANUL·LAT aquesta opció. La nova X vàlida ha d'estar a una altra opció de la mateixa fila.

4. REANUL·LACIÓ (quadrat ple ENCERCLAT): un quadrat omplert amb un CERCLE al voltant DESFA \
l'anul·lació i recupera aquesta opció com a resposta correcta. Quadrat ple + cercle = resposta vàlida.

5. BLANC EXPLÍCIT (escriu «—»): retorna «—» quan no queda cap resposta vàlida a la fila:
   (a) Tots els quadrets completament nets (l'alumne no va respondre).
   (b) Hi ha un o més PLEs sense cercle i la resta buits: l'alumne va anul·lar i no va marcar \
res nou. NO retornis el quadrat omplert com a resposta.
   (c) Només rastres d'esborrat i res més.

6. DUBTE (escriu «?»): si hi ha alguna marca però no pots determinar amb confiança quina opció \
es marca (traç tènue, ambigüitat, escaneig borrós), retorna «?». Aquest valor significa "calen ulls humans".

7. RESPOSTA MÚLTIPLE / NO VÀLIDA (escriu «!»): si després d'aplicar les regles 3 i 4 \
encara queden marques voluntàries en MÉS D'UNA opció, retorna «!».

8. ARBRE DE DECISIÓ (segueix aquest ordre exacte):
   PAS A — Per cada quadret, classifica'l com:
     · BUIT (cap traç, o rastre tènue d'esborrat sense forma clara)
     · X (creu/aspa neta, sense fons ple, intensitat sòlida)
     · PLE (quadrat completament ennegrit, sense cercle al voltant)
     · PLE-ENCERCLAT (quadrat ennegrit amb cercle clar englobant-lo)
     · ALTRA MARCA (cercle dins quadret buit, gargot, ratlla...)
   PAS B — Compta les opcions «vàlides»:
     · X → vàlida. PLE-ENCERCLAT → vàlida. PLE simple → NO vàlida. BUIT → no compta.
   PAS C — Decideix:
     · 0 vàlides + només BUITs i/o PLEs → «—»
     · 0 vàlides + alguna ALTRA MARCA poc clara → «?»
     · Exactament 1 vàlida → la opció corresponent
     · 2 o més vàlides → «!»

9. FORMAT DE SORTIDA: minúscula 'a', 'b', 'c', 'd' o 'e' (o «—», «?», «!»).

CODI D'ALUMNE: Si veus a la part superior del full un codi numèric de 3 dígits (típicament \
començant per 1: 1xx), transcriu-lo al camp "id_alumne" com a 3 dígits (p.ex. "123"). Si hi ha \
un nom o text, ignora'l. Si no es veu cap codi clar, posa "id_alumne" com a string buit "".

MODEL: Si el full indica si és model A o model B (sovint marcat amb una creu o cercle al \
costat de la lletra a la capçalera), posa "model" amb el valor "A" o "B". Si no es pot \
determinar, deixa "model" com a string buit "".

FORMAT DE SORTIDA OBLIGATORI (JSON estricte, res més):
{
  "id_alumne": "...",
  "model": "A" | "B" | "",
  "respostes": {
${jsonKeys}
  },
  "comentari": "Notes breus sobre fulls dubtosos. Buit si tot és clar."
}

Retorna NOMÉS aquest JSON, sense \`\`\`json ni cap altre text.
Cada clau Q01..Q30 ha de tenir un valor: una lletra minúscula (a–e), o «—», «?», «!».`;
}

// ─── Helpers UI ─────────────────────────────────────────────────────

function _setStatus(text)  { document.getElementById('ai-rec-status').textContent = text; }
function _setProgress(pct) { document.getElementById('ai-rec-bar').style.width = pct + '%'; }
function _showLog()        { document.getElementById('ai-rec-log').style.display = 'block'; }
function _appendLog(html, type) {
  const log = document.getElementById('ai-rec-log');
  log.innerHTML += `<div class="ai-log-${type}">${html}</div>`;
  log.scrollTop = log.scrollHeight;
}

// ─── Log de tokens consumits per pàgina ─────────────────────────────

function _logPageUsage(pageNum, model, scale, w, h, pixelCount, usage, parsed) {
  if (!usage) return;
  const price = PRICING[model];
  let costUsd = null;
  if (price && usage.promptTokens != null && usage.outputTokens != null) {
    const inCost  = (usage.promptTokens / 1_000_000) * price.input;
    const outCost = ((usage.outputTokens + (usage.thoughtsTokens || 0)) / 1_000_000) * price.output;
    costUsd = inCost + outCost;
  }
  const costEur = costUsd != null ? costUsd * 0.93 : null;
  const respostes = parsed?.respostes || {};
  const total = Object.keys(respostes).length;
  const valides = Object.values(respostes).filter(v => v && v !== '?' && v !== '').length;

  console.groupCollapsed(
    `[AI cost] Pàg. ${pageNum} — ${model} @ scale ${scale}` +
    (costEur != null ? ` — ~${costEur.toFixed(4)} €` : '')
  );
  console.log(`Imatge enviada: ${w}×${h} px (${(pixelCount / 1_000_000).toFixed(2)} MP)`);
  console.log(`Tokens entrada: ${usage.promptTokens ?? 'n/d'}`);
  console.log(`Tokens sortida visible: ${usage.outputTokens ?? 'n/d'}`);
  if (usage.thoughtsTokens != null) {
    console.log(`Tokens "thinking" (Gemini, també facturat com a output): ${usage.thoughtsTokens}`);
  }
  console.log(`Tokens TOTAL: ${usage.totalTokens ?? 'n/d'}`);
  if (costUsd != null) {
    console.log(`Cost estimat: $${costUsd.toFixed(5)} ≈ ${costEur.toFixed(5)} €`);
    console.log(`Per a 60 fulls a aquest ritme: ~${(costEur * 60).toFixed(2)} €`);
  }
  console.log(`Respostes detectades: ${valides}/${total}`);
  console.groupEnd();
}
