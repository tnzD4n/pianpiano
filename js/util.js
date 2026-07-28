/* Utilità condivise: creazione di elementi, date, mini-markdown,
   articoli italiani, normalizzazione e confronto delle risposte,
   più i due mattoncini di riscontro usati da tutti gli esercizi. */

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

// Minuscole, spazi normalizzati, apostrofi tipografici uniformati,
// punteggiatura finale ignorata. Anche le virgole si ignorano: in un dettato
// non si sentono, e bocciare per una virgola sarebbe punitivo.
// Gli accenti invece restano: li controlliamo subito dopo.
export function normalizeAnswer(text) {
  return String(text)
    .toLowerCase()
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

/* ---------- Riscontro comune a tutti gli esercizi ---------- */

export function feedbackBox() {
  return el('div', { class: 'ex-feedback', role: 'status', 'aria-live': 'polite' });
}

// opts: { correct, accentWarning, given, expected, explain }
export function showFeedback(box, opts) {
  clear(box);
  if (opts.correct) {
    box.append(el('p', { class: 'fb ok', text: '✓ ¡Correcto!' }));
    if (opts.accentWarning) {
      box.append(el('p', {
        class: 'fb warn',
        text: `Cuidado con los acentos: se escribe «${opts.expected}»`
      }));
    }
  } else {
    box.append(el('p', { class: 'fb bad', text: '✗ Todavía no.' }));
    const compare = el('div', { class: 'fb-compare' });
    if (opts.given && opts.given.trim()) {
      compare.append(el('span', { class: 'given', text: `Tu respuesta: ${opts.given}` }));
    }
    compare.append(el('span', { class: 'expected', text: `Forma correcta: ${opts.expected}` }));
    box.append(compare);
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
