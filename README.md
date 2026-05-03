# Corrector Cangur

Corrector per a la prova **Cangur** (30 preguntes, 5 opcions A–E, models A/B), amb tres funcionalitats principals:

1. **Reconeixement automàtic de respostes (OMR)** via crides directes a la API d'Anthropic (Claude) o de Google (Gemini), des del navegador.
2. **Introducció manual** de les respostes amb un teclat ràpid totalment configurable.
3. **Correcció automàtica** un cop carregada la clau de respostes (.xlsx amb una fila per nivell × model).

## Estructura

```
cangur_corrector/
├── index.html              ← shell HTML
├── README.md               ← aquest fitxer
├── styles/                 ← 4 fulls d'estil
│   ├── tokens.css          (variables + reset)
│   ├── animations.css      (@keyframes)
│   ├── layout.css          (header, grid, panes)
│   └── components.css      (buttons, modals, cells, ...)
└── js/                     ← 13 mòduls (entry point: init.js)
    ├── config.js           ← constants (Q=30, COL_RULES, DEFAULT_KEYS, ...)
    ├── state.js            ← single source of truth de l'estat mutable
    ├── utils.js            ← helpers (esc, sleep, fmt)
    ├── render.js           ← sync DOM des de l'estat
    ├── grid.js             ← construcció de la graella 3×10 + kbd ref
    ├── keyboard.js         ← config de tecles + modal de configuració
    ├── main-keyboard.js    ← handler global d'entrada de respostes
    ├── navigation.js       ← prev/next alumne, navegació entre cel·les
    ├── student-modal.js    ← modal codi+nom+model A/B + rename inline
    ├── pdf-viewer.js       ← wrapper de pdf.js
    ├── key-loader.js       ← lectura de la clau (.xlsx amb nivells)
    ├── scoring.js          ← càlcul Cangur + modal correct + taula resultats
    ├── export.js           ← exportació .xlsx (respostes + resultats)
    ├── ui.js               ← toast, dropdowns, ESC, beforeunload
    ├── ai-recognizer.js    ← reconeixement automàtic via Claude/Gemini
    └── init.js             ← bootstrap — wire DOM + esdeveniments
```

## Desplegament

Els ES modules requereixen un servidor HTTP real (`file://` no funciona). Per desenvolupament local:

```bash
cd cangur_corrector
python3 -m http.server 8000
```

Després obre <http://localhost:8000/>.

Per a producció, es pot publicar com a estàtic (GitHub Pages, Netlify, Vercel, etc.).

## Format del fitxer de clau (.xlsx)

Una fila per cada combinació de nivell × model. Primer columna: nom del nivell (admet "Primer ESO model A", "1 BAT B", "Quart ESO", etc.). Columnes 2–31: les 30 respostes (A/B/C/D/E; "C/D" → C). Si el llibre té més d'un full, es demana quin usar.

Nivells suportats: 1ESO, 2ESO, 3ESO, 4ESO, 1BAT, 2BAT.

## Puntuació oficial Cangur

| Bloc      | Base | Encert | Error  |
| --------- | ---- | ------ | ------ |
| 1a (P1–10)  | 7,5  | +3     | −0,75  |
| 2a (P11–20) | 10   | +4     | −1     |
| 3a (P21–30) | 12,5 | +5     | −1,25  |

Blanc i invàlid (?) computen 0 (ni penalitzen ni sumen).

## API Keys per al reconeixement automàtic

L'aplicació crida directament les APIs de Claude i Gemini des del navegador. La clau s'introdueix a la modal del reconeixement i **no es desa enlloc** (només viu en memòria mentre la pestanya és oberta).

Models suportats (per ordre de precisió empírica testada):

- `gemini-2.5-pro` (recomanat)
- `claude-opus-4-7`
- `gemini-2.5-flash` / `claude-sonnet-4-6`
- `gemini-2.5-flash-lite` / `claude-haiku-4-5`
