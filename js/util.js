/* Utilità condivise: creazione di elementi, date, mini-markdown,
   articoli italiani, normalizzazione e confronto delle risposte,
   più i due mattoncini di riscontro usati da tutti gli esercizi. */

import { alignChars, geminationDiff, geminationMessage } from './diff.js';

/* ---------- DOM ---------- */

// el('div', {class:'x', onclick:fn, html:'<b>…</b>'}, figli…)
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
  }
  for (const child of children.flat(3)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Mescolamento di Fisher-Yates su una copia dell'array.
export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/* ---------- Date (sempre in fuso orario locale, formato AAAA-MM-GG) ---------- */

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function daysBetween(isoA, isoB) {
  const [ya, ma, da] = isoA.split('-').map(Number);
  const [yb, mb, db] = isoB.split('-').map(Number);
  const a = Date.UTC(ya, ma - 1, da);
  const b = Date.UTC(yb, mb - 1, db);
  return Math.round((b - a) / 86400000);
}

/* ---------- Mini-markdown: **grassetto**, *corsivo*, `codice` ---------- */

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function mdInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

// Un paragrafo per ogni riga vuota.
export function mdBlock(text) {
  return String(text)
    .split(/\n{2,}/)
    .map((chunk) => el('p', { html: mdInline(chunk.trim()) }));
}

/* ---------- Articoli determinativi italiani ---------- */

const VOWEL = /^[aeiouàèéìòóù]/i;
// lo / gli: s impura, z, x, y, ps, pn, gn, i semiconsonantica
const LO = /^(z|x|y|ps|pn|gn|s[bcdfglmnpqrstvz]|i[aeou])/i;

export function definiteArticle(word, gender) {
  if (!gender) return '';
  const w = String(word).trim();
  if (gender === 'f') return VOWEL.test(w) ? "l'" : 'la';
  if (VOWEL.test(w)) return "l'";
  return LO.test(w) ? 'lo' : 'il';
}

export function pluralArticle(word, gender) {
  if (!gender) return '';
  const w = String(word).trim();
  if (gender === 'f') return 'le';
  return VOWEL.test(w) || LO.test(w) ? 'gli' : 'i';
}

// «l'» si attacca alla parola, «il / la / lo» prendono uno spazio.
export function withArticle(word, gender) {
  const art = definiteArticle(word, gender);
  if (!art) return String(word);
  return art.endsWith("'") ? art + word : art + ' ' + word;
}

export function withPluralArticle(word, gender) {
  const art = pluralArticle(word, gender);
  return art ? art + ' ' + word : String(word);
}

/* ---------- Confronto delle risposte ---------- */

// Spazi normalizzati, apostrofi tipografici uniformati, punteggiatura finale
// ignorata. Anche le virgole si ignorano: in un dettato non si sentono, e
// bocciare per una virgola sarebbe punitivo. Le maiuscole restano: le toglie
// `normalizeAnswer`. Il confronto lettera per lettera usa invece questa, così
// mostra il testo com'è stato scritto senza inventare errori di punteggiatura.
export function normalizeShape(text) {
  return String(text)
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[“”«»"]/g, '')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+([.:!?])/g, '$1')
    .replace(/^[¿¡]+/, '')
    .trim()
    .replace(/[.!?…:]+$/, '')
    .trim();
}

// Gli accenti restano: li controlliamo subito dopo.
export function normalizeAnswer(text) {
  return normalizeShape(text).toLowerCase();
}

export function stripAccents(text) {
  // I segni diacritici combinanti (U+0300..U+036F) si staccano dalla lettera con NFD.
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Restituisce { correct, accentWarning, expected }.
// Se la risposta è giusta a meno degli accenti la accettiamo, ma segnaliamo.
export function checkAnswer(given, answers) {
  const list = (Array.isArray(answers) ? answers : [answers]).filter(Boolean);
  const g = normalizeAnswer(given);
  for (const a of list) {
    if (normalizeAnswer(a) === g) return { correct: true, accentWarning: false, expected: a };
  }
  const flat = stripAccents(g);
  for (const a of list) {
    if (stripAccents(normalizeAnswer(a)) === flat) return { correct: true, accentWarning: true, expected: a };
  }
  return { correct: false, accentWarning: false, expected: list[0] || '' };
}

/* ---------- Campi di risposta in italiano ---------- */

/* Le vocali accentate dell'italiano. Servono sia `è` sia `é`:
   «è» (verbo essere) e «perché» si scrivono con accenti opposti, e
   confonderli è l'errore classico di chi arriva dallo spagnolo. */
export const ACCENT_CHARS = ['à', 'è', 'é', 'ì', 'ò', 'ù'];

// Scorciatoie da tastiera fisica: Alt+vocale, con Maiusc per «é».
// Si usa `code` e non `key` perché su macOS Alt produce caratteri morti.
const ALT_KEYS = {
  KeyA: ['à', 'à'],
  KeyE: ['è', 'é'],
  KeyI: ['ì', 'ì'],
  KeyO: ['ò', 'ò'],
  KeyU: ['ù', 'ù']
};

export function insertAtCursor(input, text) {
  const start = input.selectionStart == null ? input.value.length : input.selectionStart;
  const end = input.selectionEnd == null ? start : input.selectionEnd;
  input.setRangeText(text, start, end, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // Sul telefono il focus non si deve perdere, altrimenti la tastiera si chiude.
  input.focus();
}

/* La barra è pensata per il telefono, dove le vocali accentate italiane
   stanno sotto una pressione prolungata e la tastiera spagnola propone
   prima le sue. In DOM sta *dopo* il campo (così il tabulatore arriva
   prima al campo), e la CSS la porta sopra. */
export function accentBar(input) {
  const bar = el('div', {
    class: 'accent-bar',
    role: 'group',
    'aria-label': 'Vocales acentuadas italianas'
  });
  ACCENT_CHARS.forEach((ch) => {
    bar.append(el('button', {
      type: 'button',
      class: 'accent-key',
      lang: 'it',
      'aria-label': `Insertar ${ch}`,
      // Senza questo il campo perde il focus e la tastiera virtuale si chiude.
      onmousedown: (event) => event.preventDefault(),
      onclick: () => insertAtCursor(input, ch)
    }, ch));
  });
  return bar;
}

function bindAltKeys(input) {
  input.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) return;
    const pair = ALT_KEYS[event.code];
    if (!pair) return;
    event.preventDefault();
    insertAtCursor(input, pair[event.shiftKey ? 1 : 0]);
  });
}

/* Campo di risposta in italiano.
   Gli attributi non sono decorativi: senza di loro la tastiera spagnola di
   iOS riscrive le parole italiane mentre si digita («sono» diventa «son»)
   e gli esercizi diventano ingiocabili.

   opts: { className, placeholder, label, inline }
   Restituisce { input, bar, field }:
     - `field` è il blocco pronto (barra sopra, campo sotto);
     - `bar` e `input` sono esposti per chi deve piazzarli a mano
       (il completamento della frase ha il campo dentro il testo). */
let fieldCount = 0;

export function answerInput(opts = {}) {
  // Una <label> vera, non un `aria-label`: la etichetta è associata al campo
  // anche per chi ingrandisce, per chi usa la voce e per chi ci clicca sopra.
  // Nascosta agli occhi perché la domanda è già scritta sopra.
  fieldCount += 1;
  const id = `answer-${fieldCount}`;
  const label = el('label', { class: 'sr-only', for: id },
    opts.label || 'Tu respuesta en italiano');

  const input = el('input', {
    id,
    type: 'text',
    class: 'ex-input' + (opts.className ? ' ' + opts.className : ''),
    lang: 'it',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder: opts.placeholder || null
  });

  bindAltKeys(input);

  // La tastiera virtuale copre la metà bassa dello schermo: al focus
  // portiamo il campo al centro, dopo che la tastiera è comparsa.
  input.addEventListener('focus', () => {
    setTimeout(() => {
      input.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    }, 250);
  });

  const bar = accentBar(input);
  const field = el('div', { class: 'answer-field' }, label, input, bar);
  return { input, bar, label, field };
}

function scrollBehavior() {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? 'auto' : 'smooth';
}

/* ---------- Riscontro comune a tutti gli esercizi ---------- */

export function feedbackBox() {
  return el('div', { class: 'ex-feedback', role: 'status', 'aria-live': 'polite' });
}

/* Confronto lettera per lettera.
   Restituisce il blocco DOM, oppure null se le due forme sono così lontane
   che allinearle produrrebbe solo rumore (risposta vuota, o parola diversa). */
function diffBlock(given, expected) {
  // Stessa normalizzazione della correzione: se una virgola o il punto
  // interrogativo finale non contano per l'esito, non devono comparire
  // qui come errori. Le maiuscole restano visibili ma non pesano.
  const a = normalizeShape(given);
  const b = normalizeShape(expected);
  if (!a || !b) return null;

  const { ops, distance } = alignChars(a, b);
  if (distance > Math.max(3, Math.ceil(b.length * 0.5))) return null;

  const mine = el('span', { class: 'diff-text', lang: 'it' });
  const good = el('span', { class: 'diff-text it-plain', lang: 'it' });
  // Uno spazio evidenziato deve restare visibile: diventa uno spazio unificatore.
  const visible = (ch) => (ch === ' ' ? ' ' : ch);

  ops.forEach((op) => {
    if (op.op === 'equal') {
      mine.append(document.createTextNode(op.a));
      good.append(document.createTextNode(op.b));
    } else if (op.op === 'sub') {
      mine.append(el('span', { class: 'd-extra', text: visible(op.a) }));
      good.append(el('span', { class: 'd-missing', text: visible(op.b) }));
    } else if (op.op === 'extra') {
      mine.append(el('span', { class: 'd-extra', text: visible(op.a) }));
    } else {
      good.append(el('span', { class: 'd-missing', text: visible(op.b) }));
    }
  });

  return el('div', { class: 'fb-diff' },
    el('div', { class: 'diff-row', 'aria-hidden': 'true' },
      el('span', { class: 'diff-label' }, 'Tu respuesta'), mine),
    el('div', { class: 'diff-row', 'aria-hidden': 'true' },
      el('span', { class: 'diff-label' }, 'Forma correcta'), good),
    // Le lettere sciolte in tanti <span> si leggono male ad alta voce:
    // per il lettore di schermo ripetiamo le due frasi intere.
    el('p', { class: 'sr-only' }, `Tu respuesta: ${a}. Forma correcta: ${b}.`)
  );
}

// opts: { correct, accentWarning, given, expected, explain, diff }
export function showFeedback(box, opts) {
  clear(box);
  if (opts.correct) {
    box.append(el('p', { class: 'fb ok', text: '✓ ¡Correcto!' }));
    if (opts.accentWarning) {
      // Confondere «è» ed «é» è l'errore classico: dirle «falta el acento»
      // quando l'accento c'è ma è girato non le spiega niente.
      const scritto = String(opts.given || '');
      const haAccento = stripAccents(scritto) !== scritto;
      box.append(el('p', {
        class: 'fb warn',
        text: haAccento
          ? `Casi: el acento va al revés. Se escribe «${opts.expected}»`
          : `Casi: falta el acento. Se escribe «${opts.expected}»`
      }));
    }
  } else {
    box.append(el('p', { class: 'fb bad', text: '✗ Todavía no.' }));

    // `diff` lo attivano solo gli esercizi in cui si scrive: nella scelta
    // multipla le due opzioni sono parole diverse e allinearle non dice nulla.
    const block = opts.diff ? diffBlock(opts.given || '', opts.expected || '') : null;
    if (block) {
      box.append(block);
      const gem = geminationDiff(normalizeAnswer(opts.given), normalizeAnswer(opts.expected));
      if (gem) {
        box.append(el('p', { class: 'fb-double', html: '⚑ ' + mdInline(geminationMessage(gem)) }));
      }
    } else {
      const compare = el('div', { class: 'fb-compare' });
      if (opts.given && opts.given.trim()) {
        compare.append(el('span', { class: 'given', text: `Tu respuesta: ${opts.given}` }));
      }
      compare.append(el('span', { class: 'expected', text: `Forma correcta: ${opts.expected}` }));
      box.append(compare);
    }
  }
  if (opts.explain) box.append(el('p', { class: 'fb-explain', html: mdInline(opts.explain) }));
  if (!opts.correct) box.append(el('p', { class: 'fb-hint', text: 'Puedes volver a intentarlo ahora mismo.' }));
}

// Invio conferma: scorciatoia comune ai campi di testo.
export function onEnter(input, handler) {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handler();
    }
  });
}
