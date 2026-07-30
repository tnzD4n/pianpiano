/* Contrasto e disciplina della palette «Adriatico e sabbia».
   `node tools/check-contrast.mjs` dalla radice del progetto.

   Legge le variabili da css/style.css invece di averne una copia: così non
   si può cambiare la palette e dimenticare di ricontrollarla.

   Controlla quattro cose:
     1. contrasto WCAG ≥ 4.5:1 sul testo, ≥ 3:1 su ciò che informa col bordo;
     2. che l'arancione dell'errore resti arancione e non scivoli nel rosso;
     3. che nella palette non compaia nessun rosso;
     4. che nel resto del CSS non resti nessun colore letterale.               */

import { readFileSync } from 'node:fs';

const FILE = 'css/style.css';
const css = readFileSync(FILE, 'utf8');

/* ---------- Lettura dei due blocchi ---------- */

function block(re, nome) {
  const m = css.match(re);
  if (!m) {
    console.error(`${FILE}:1  non trovo il blocco ${nome}`);
    process.exit(1);
  }
  return m;
}

const lightBlock = block(/:root\s*\{([\s\S]*?)\n\}/, ':root');
const darkBlock = block(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/, '[data-theme="dark"]');

function readVars(text) {
  const out = {};
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = readVars(lightBlock[1]);
const dark = { ...light, ...readVars(darkBlock[1]) };

/* ---------- Colore, con canale alfa ---------- */

function parse(value) {
  const v = String(value).trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1);
  m = v.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

/* I bordi sono rgba: per misurarli davvero vanno composti sul loro fondo,
   altrimenti si misura un colore che sullo schermo non esiste. */
function composite(fg, bg) {
  const a = fg[3];
  if (a >= 1) return fg;
  return [
    fg[0] * a + bg[0] * (1 - a),
    fg[1] * a + bg[1] * (1 - a),
    fg[2] * a + bg[2] * (1 - a),
    1
  ];
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg, bg) {
  const a = luminance(composite(fg, bg));
  const b = luminance(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

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

function saturation([r, g, b]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/* ---------- Le coppie ----------
   [primo piano, fondo, soglia, descrizione]                                 */

const PAIRS = [
  // Testo: 4.5:1
  ['--text', '--bg', 4.5, 'testo sul fondo della pagina'],
  ['--text', '--surface', 4.5, 'testo sulle schede'],
  ['--text', '--surface-sunk', 4.5, 'testo sui riquadri incassati'],
  ['--text', '--accent-soft', 4.5, 'testo su un elemento selezionato'],
  ['--text-muted', '--bg', 4.5, 'testo secondario sul fondo'],
  ['--text-muted', '--surface', 4.5, 'testo secondario sulle schede'],
  ['--text-muted', '--surface-sunk', 4.5, 'testo secondario sugli incassi'],

  // Accento e collegamenti
  ['--accent', '--bg', 4.5, 'collegamenti sul fondo'],
  ['--accent', '--surface', 4.5, 'collegamenti sulle schede'],
  ['--accent', '--surface-sunk', 4.5, 'collegamenti sugli incassi'],
  ['--accent-hover', '--surface', 4.5, 'collegamento sotto il puntatore'],
  ['--on-accent', '--accent', 4.5, 'testo del pulsante principale'],

  /* Esito. --ok fa da testo solo sui fondi pieni, dove passa 4.5:1;
     --warn non fa mai da testo piccolo. Su --ok-soft e --warn-soft il
     testo è sempre --text. Vedi la regola in cima a css/style.css. */
  ['--ok', '--surface', 4.5, 'testo di esito positivo sulle schede'],
  ['--ok', '--bg', 4.5, 'testo di esito positivo sul fondo'],
  ['--text', '--ok-soft', 4.5, 'testo dentro un riquadro positivo'],
  ['--text', '--warn-soft', 4.5, 'testo dentro un riquadro di errore'],

  // Ciò che informa senza essere testo piccolo: 3:1
  ['--accent', '--surface', 3, 'anello di focus sulle schede'],
  ['--accent', '--bg', 3, 'anello di focus sul fondo'],
  ['--accent', '--surface-sunk', 3, 'barra di avanzamento sul suo binario'],
  ['--ok', '--surface', 3, 'bordo di un esercizio risolto'],
  ['--ok', '--ok-soft', 3, 'segno ✓ dentro un riquadro positivo'],
  ['--warn', '--surface', 3, 'bordo e segno ✗ di una risposta sbagliata'],
  ['--warn', '--bg', 3, 'bordo di errore sul fondo']
];

/* I valori della palette sono quelli dichiarati e non si toccano: se
   qualcuno li cambia per far quadrare un contrasto, il controllo lo dice.
   Il modo giusto di sistemare un contrasto è spostare il colore su un
   altro ruolo (icona, bordo, fondo), non ritoccarne il valore. */
const PALETTE_ATTESA = {
  '--bg': '#F7F5F0',
  '--surface': '#FFFFFF',
  '--text': '#10202B',
  '--text-muted': '#5A6B76',
  '--accent': '#1E5F82',
  '--accent-soft': '#C9DEE9',
  '--ok': '#2F7A5E',
  '--warn': '#D2762F'
};

/* I bordi hairline si misurano e si stampano, ma non fanno fallire nulla:
   con l'alfa prescritta (0.12 e 0.24) 3:1 è aritmeticamente irraggiungibile.
   Sono separazioni decorative, e nessun comando del sito si riconosce dal
   solo bordo: i campi e i pulsanti hanno un fondo proprio. */
const INFORMATIVE = [
  ['--border', '--surface', 'bordo hairline delle schede'],
  ['--border-strong', '--surface', 'bordo dei controlli'],
  ['--border-strong', '--bg', 'bordo dei controlli sul fondo']
];

/* ---------- Esecuzione ---------- */

const problems = [];

function check(nome, palette) {
  console.log(`\n${nome}`);
  console.log('─'.repeat(76));
  for (const [fg, bg, min, label] of PAIRS) {
    const fv = palette[fg];
    const bv = palette[bg];
    if (fv === undefined) { problems.push(`${nome}: la variabile ${fg} non esiste`); continue; }
    if (bv === undefined) { problems.push(`${nome}: la variabile ${bg} non esiste`); continue; }
    const a = parse(fv);
    const b = parse(bv);
    if (!a || !b) { problems.push(`${nome}: non so leggere ${fv} o ${bv}`); continue; }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) problems.push(`${nome}: ${label} — ${r.toFixed(2)}:1, serve ${min}:1  (${fg} su ${bg})`);
    console.log(`${ok ? '  ' : '✗ '}${r.toFixed(2).padStart(5)}:1  (min ${String(min).padStart(3)})  ${label}`);
  }
  console.log('  · · · bordi decorativi (misurati, non vincolanti) · · ·');
  for (const [fg, bg, label] of INFORMATIVE) {
    const r = ratio(parse(palette[fg]), parse(palette[bg]));
    console.log(`  ${r.toFixed(2).padStart(5)}:1           ${label}`);
  }
}

check('TEMA CHIARO', light);
check('TEMA SCURO', dark);

/* --- I valori dichiarati sono ancora quelli --- */
console.log('\nVALORI DELLA PALETTE');
console.log('─'.repeat(76));
for (const [nome, atteso] of Object.entries(PALETTE_ATTESA)) {
  const trovato = (light[nome] || '').toUpperCase();
  const uguale = trovato === atteso.toUpperCase();
  console.log(`  ${uguale ? '  ' : '✗ '}${nome.padEnd(15)} ${trovato || '(assente)'}${uguale ? '' : `  atteso ${atteso}`}`);
  if (!uguale) {
    problems.push(`${nome} vale ${trovato || '(assente)'} ma la palette dichiara ${atteso}`);
  }
}

/* --- L'errore è arancione, e nella palette non c'è rosso --- */
console.log('\nDISCIPLINA DEL COLORE');
console.log('─'.repeat(76));

for (const [nome, palette] of [['chiaro', light], ['scuro', dark]]) {
  const h = hue(parse(palette['--warn']));
  const arancione = h >= 18 && h <= 45;
  console.log(`  ${arancione ? '  ' : '✗ '}tema ${nome}: --warn ${palette['--warn']} → tonalità ${h.toFixed(0)}° ${arancione ? '(arancione)' : '(fuori dall’arancione)'}`);
  if (!arancione) {
    problems.push(`tema ${nome}: --warn ha tonalità ${h.toFixed(0)}°: il colore dell'errore deve restare arancione (18°–45°)`);
  }

  // Nessun rosso da nessuna parte: è la regola del tono non punitivo.
  for (const [nomeVar, valore] of Object.entries(palette)) {
    if (!/^--(bg|surface|surface-sunk|text|text-muted|accent|accent-hover|accent-soft|ok|ok-soft|warn|warn-soft|border|border-strong|on-accent)$/.test(nomeVar)) continue;
    const c = parse(valore);
    if (!c) continue;
    const hh = hue(c);
    const ss = saturation(c);
    const rosso = ss > 0.25 && (hh >= 345 || hh <= 12);
    if (rosso) {
      problems.push(`tema ${nome}: ${nomeVar} ${valore} è un rosso (tonalità ${hh.toFixed(0)}°): la palette non ne prevede`);
      console.log(`✗   tema ${nome}: ${nomeVar} è un rosso`);
    }
  }
}
console.log('    nessun rosso nella palette');

/* --- Nessun colore letterale fuori dai due blocchi --- */
console.log('\nCOLORI LETTERALI FUORI DALLE VARIABILI');
console.log('─'.repeat(76));

const resto = css.replace(lightBlock[0], '').replace(darkBlock[0], '');
const letterali = [];
const NOMI = /\b(?:red|blue|green|yellow|orange|purple|pink|brown|grey|gray|black|white|cyan|magenta|teal|navy|olive|maroon|lime|aqua|silver|gold|beige|coral|crimson|indigo|ivory|khaki|lavender|salmon|tan|violet|wheat)\b/gi;

for (const m of resto.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) letterali.push(m[0]);
for (const m of resto.matchAll(/\brgba?\s*\([^)]*\)/gi)) letterali.push(m[0].replace(/\s+/g, ' '));
for (const m of resto.matchAll(/\bhsla?\s*\([^)]*\)/gi)) letterali.push(m[0].replace(/\s+/g, ' '));
for (const m of resto.matchAll(NOMI)) {
  // `white-space`, `break-word` e simili non sono colori.
  letterali.push(m[0]);
}

// I nomi di colore compaiono anche dentro parole composte: si tengono solo
// quelli che stanno davvero come valore di una proprietà di colore.
const veri = letterali.filter((v) => {
  if (/^#|^rgb|^hsl/i.test(v)) return true;
  const re = new RegExp(`(color|background|border|outline|fill|stroke)[^;:]*:\\s*[^;]*\\b${v}\\b`, 'i');
  return re.test(resto);
});

if (veri.length) {
  for (const v of [...new Set(veri)]) {
    console.log(`✗   ${v}`);
    problems.push(`css/style.css: colore letterale «${v}» fuori dai blocchi delle variabili`);
  }
} else {
  console.log('    nessuno: tutti i colori passano dalle custom properties');
}

console.log('');
if (problems.length) {
  console.error(`✗ ${problems.length} ${problems.length === 1 ? 'problema' : 'problemi'}:\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('');
  if (process.env.GITHUB_ACTIONS) {
    for (const p of problems) console.log(`::error file=css/style.css,line=1::${p}`);
  }
  process.exit(1);
}
console.log(`✓ palette a norma in entrambi i temi (${PAIRS.length} coppie per tema, nessun colore letterale).`);
