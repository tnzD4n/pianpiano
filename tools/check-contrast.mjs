/* Contrasto della palette, tema chiaro e tema scuro.
   `node tools/check-contrast.mjs` dalla radice del progetto.

   Legge le variabili da css/style.css invece di avere una copia dei colori:
   così non si può cambiare la palette e dimenticare di ricontrollarla.
   Il tema scuro è quello che si sbaglia sempre, perché si guarda meno.

   Soglie WCAG 2.1: 4.5:1 per il testo normale, 3:1 per il testo grande
   (da 1.5rem in su, in grassetto) e per i bordi che portano informazione. */

import { readFileSync } from 'node:fs';

const css = readFileSync('css/style.css', 'utf8');

/* ---------- Lettura delle variabili ---------- */

function readVars(block) {
  const out = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

// Primo :root { ... } del file = tema chiaro.
const lightBlock = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!lightBlock) {
  console.error('css/style.css:1  non trovo il blocco :root');
  process.exit(1);
}

// Il blocco dentro @media (prefers-color-scheme: dark).
const darkMedia = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/);
if (!darkMedia) {
  console.error('css/style.css:1  non trovo il tema scuro');
  process.exit(1);
}

const light = readVars(lightBlock[1]);
const dark = { ...light, ...readVars(darkMedia[1]) };

/* ---------- Colore ---------- */

function parse(value) {
  const v = String(value).trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    return [...m[1]].map((c) => parseInt(c + c, 16));
  }
  m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [parts[0], parts[1], parts[2]];
  }
  return null;
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- Le coppie da controllare ----------
   [primo piano, fondo, soglia, descrizione]
   Il primo piano può essere una variabile o un colore letterale. */

const PAIRS = [
  // Testo di lettura
  ['--text', '--bg', 4.5, 'testo sul fondo della pagina'],
  ['--text', '--surface', 4.5, 'testo sulle schede'],
  ['--text', '--surface-2', 4.5, 'testo sui riquadri interni'],
  ['--muted', '--bg', 4.5, 'testo secondario sul fondo'],
  ['--muted', '--surface', 4.5, 'testo secondario sulle schede'],
  ['--muted', '--surface-2', 4.5, 'testo secondario sui riquadri interni'],

  // Collegamenti e accento
  ['--accent-ink', '--surface', 4.5, 'collegamenti sulle schede'],
  ['--accent-ink', '--bg', 4.5, 'collegamenti sul fondo'],
  ['--accent-ink', '--accent-soft', 4.5, 'accento sul suo fondo tenue'],
  ['--accent-on', '--accent', 4.5, 'testo del pulsante principale'],

  // Riscontro: giusto, sbagliato, attenzione
  ['--ok', '--surface', 4.5, 'esito positivo sulle schede'],
  ['--ok', '--ok-soft', 4.5, 'esito positivo sul suo fondo'],
  ['--bad', '--surface', 4.5, 'esito negativo sulle schede'],
  ['--bad', '--bad-soft', 4.5, 'esito negativo sul suo fondo'],
  ['--warn', '--surface', 4.5, 'avviso sulle schede'],
  ['--warn', '--warn-soft', 4.5, 'avviso sul suo fondo'],
  ['--danger', '--surface', 4.5, 'azione distruttiva sulle schede'],

  // Bordi che portano informazione: 3:1 basta (non sono testo)
  ['--line', '--surface', 1.4, 'bordo delle schede (deve essere percepibile)'],
  ['--accent', '--surface', 3, 'bordo di un campo attivo'],
  ['--ok', '--surface', 3, 'bordo di un esercizio risolto'],
  ['--bad', '--surface', 3, 'bordo di una risposta sbagliata']
];

/* ---------- Esecuzione ---------- */

const problems = [];

function check(themeName, palette) {
  console.log(`\n${themeName}`);
  console.log('─'.repeat(74));
  for (const [fg, bg, min, label] of PAIRS) {
    const fgValue = fg.startsWith('--') ? palette[fg] : fg;
    const bgValue = bg.startsWith('--') ? palette[bg] : bg;

    if (fgValue === undefined) { problems.push(`${themeName}: la variabile ${fg} non esiste`); continue; }
    if (bgValue === undefined) { problems.push(`${themeName}: la variabile ${bg} non esiste`); continue; }

    const a = parse(fgValue);
    const b = parse(bgValue);
    if (!a || !b) { problems.push(`${themeName}: non so leggere ${fgValue} o ${bgValue}`); continue; }

    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) {
      problems.push(`${themeName}: ${label} — ${r.toFixed(2)}:1, serve ${min}:1  (${fg} ${fgValue} su ${bg} ${bgValue})`);
    }
    const flag = ok ? '  ' : '✗ ';
    console.log(`${flag}${r.toFixed(2).padStart(5)}:1  (min ${String(min).padStart(3)})  ${label}`);
  }
}

check('TEMA CHIARO', light);
check('TEMA SCURO', dark);

/* --- L'errore non deve essere un rosso d'allarme --- */
// Un rosso puro ha tonalità vicina a 0°; l'arancione sta fra 20° e 45°.
function hue([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

console.log('\nTONALITÀ DEL COLORE DI ERRORE');
console.log('─'.repeat(74));
for (const [name, palette] of [['chiaro', light], ['scuro', dark]]) {
  const h = hue(parse(palette['--bad']));
  const arancione = h >= 18 && h <= 50;
  console.log(`  ${arancione ? '  ' : '✗ '}tema ${name}: ${palette['--bad']} → tonalità ${h.toFixed(0)}° ${arancione ? '(arancione)' : '(fuori dall’arancione 18°–50°)'}`);
  if (!arancione) {
    problems.push(`tema ${name}: --bad ${palette['--bad']} ha tonalità ${h.toFixed(0)}°: per un tono non punitivo serve un arancione (18°–50°), non un rosso`);
  }
}

console.log('');
if (problems.length) {
  console.error(`✗ ${problems.length} ${problems.length === 1 ? 'problema' : 'problemi'} di contrasto:\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('');
  if (process.env.GITHUB_ACTIONS) {
    for (const p of problems) console.log(`::error file=css/style.css,line=1::${p}`);
  }
  process.exit(1);
}
console.log(`✓ contrasto a norma in entrambi i temi (${PAIRS.length} coppie per tema).`);
