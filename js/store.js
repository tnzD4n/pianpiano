/* Persistenza in localStorage.
   Tutto il sito scrive e legge una sola chiave, `pianpiano.v1`,
   con uno schema versionato e un punto unico per le migrazioni future. */

import { todayISO, daysBetween } from './util.js';

const KEY = 'pianpiano.v1';
const SCHEMA_VERSION = 4;

/* Il tema è letto anche da uno script inline nel <head>, prima che questo
   modulo esista, per non far lampeggiare il bianco al caricamento. Se cambia
   la chiave o il nome del campo va cambiato anche lì: è l'unico punto del
   progetto in cui la forma dei dati è scritta in due posti. */
export const THEMES = ['auto', 'light', 'dark'];

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    // lezioni: { "m01-l01": { opened, done: [indici], completedAt } }
    lessons: {},
    // ripasso: { "v:ciao": { id, kind, it, es, gender, lesson, box, due, right, wrong } }
    srs: {},
    streak: { current: 0, best: 0, last: null },
    // copia di sicurezza: quando è stata scaricata l'ultima volta,
    // e a quante lezioni completate risaliva.
    backup: { lastAt: null, lessonsAt: 0 },
    // 'auto' segue prefers-color-scheme; 'light' e 'dark' lo forzano.
    theme: 'auto',
    updatedAt: null
  };
}

/* Le migrazioni si aggiungono qui, una per ogni salto di versione.
   Regola: non si perde mai niente: si aggiunge quello che manca e si
   lascia in pace tutto il resto. */
function migrate(data) {
  if (!data || typeof data !== 'object') return emptyState();

  const out = { ...data };

  // v1 -> v2: nasce il blocco `backup`, e il numero di versione cambia
  // nome da `version` a `schemaVersion` per allinearsi a course.json.
  if (!out.schemaVersion) {
    out.schemaVersion = 1;
  }
  if (out.schemaVersion === 1) {
    if (!out.backup) out.backup = { lastAt: null, lessonsAt: 0 };
    out.schemaVersion = 2;
  }

  /* v2 -> v3: ogni voce del ripasso guadagna `attempts` ed `errors`, i due
     contatori su cui si regge la schermata delle «palabras rebeldes».
     Non si parte da zero: `right` e `wrong` esistono dalla prima versione e
     contengono esattamente la stessa storia, quindi si travasano. Azzerare
     avrebbe voluto dire buttare mesi di statistiche già raccolte. */
  if (out.schemaVersion === 2) {
    const srs = out.srs || {};
    for (const item of Object.values(srs)) {
      if (!item || typeof item !== 'object') continue;
      const right = Number(item.right) || 0;
      const wrong = Number(item.wrong) || 0;
      if (typeof item.attempts !== 'number') item.attempts = right + wrong;
      if (typeof item.errors !== 'number') item.errors = wrong;
    }
    out.schemaVersion = 3;
  }

  // v3 -> v4: la scelta del tema. Chi arriva da prima parte da 'auto',
  // che è come si comportava il sito quando il tema non era scegliibile.
  if (out.schemaVersion === 3) {
    if (!THEMES.includes(out.theme)) out.theme = 'auto';
    out.schemaVersion = 4;
  }

  delete out.version;

  // Rete di sicurezza: qualunque campo nuovo dello stato vuoto che ancora
  // non esistesse viene aggiunto senza toccare quelli già presenti.
  const base = emptyState();
  return {
    ...base,
    ...out,
    lessons: { ...base.lessons, ...(out.lessons || {}) },
    srs: { ...base.srs, ...(out.srs || {}) },
    streak: { ...base.streak, ...(out.streak || {}) },
    backup: { ...base.backup, ...(out.backup || {}) },
    schemaVersion: SCHEMA_VERSION
  };
}

let state = read();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyState();
  } catch (err) {
    // Modalità privata, quota piena o dati corrotti: si riparte puliti.
    return emptyState();
  }
}

function write() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    /* Se non si può scrivere, la sessione continua comunque in memoria. */
  }
}

/* ---------- Lezioni ---------- */

export function getLesson(id) {
  return state.lessons[id] || null;
}

export function lessonStatus(id) {
  const rec = state.lessons[id];
  if (!rec) return 'no-iniciada';
  if (rec.completedAt) return 'completada';
  return 'en-curso';
}

export const STATUS_LABEL = {
  'no-iniciada': 'No iniciada',
  'en-curso': 'En curso',
  'completada': 'Completada'
};

// Registra la prima apertura di una lezione e aggiorna la serie di giorni.
export function openLesson(id) {
  if (!state.lessons[id]) {
    state.lessons[id] = { opened: todayISO(), done: [], completedAt: null };
  }
  touchStreak();
  write();
  return state.lessons[id];
}

export function markExerciseDone(lessonId, index) {
  const rec = state.lessons[lessonId] || openLesson(lessonId);
  if (!rec.done.includes(index)) {
    rec.done.push(index);
    rec.done.sort((a, b) => a - b);
    write();
  }
}

// `required` è l'elenco degli indici che contano per il completamento.
export function refreshCompletion(lessonId, required) {
  const rec = state.lessons[lessonId];
  if (!rec) return false;
  const complete = required.length > 0 && required.every((i) => rec.done.includes(i));
  const was = Boolean(rec.completedAt);
  if (complete && !was) rec.completedAt = todayISO();
  if (!complete && was) rec.completedAt = null;
  if (complete !== was) write();
  return complete;
}

/* ---------- Avanzamento ---------- */

export function moduleProgress(module) {
  const total = module.lessons.length;
  const done = module.lessons.filter((l) => lessonStatus(l.id) === 'completada').length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function globalProgress(course) {
  let total = 0;
  let done = 0;
  for (const module of course.modules) {
    const p = moduleProgress(module);
    total += p.total;
    done += p.done;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/* ---------- Serie di giorni consecutivi ---------- */

export function touchStreak() {
  const today = todayISO();
  const s = state.streak;
  if (s.last === today) return s;
  if (s.last && daysBetween(s.last, today) === 1) s.current += 1;
  else s.current = 1;
  s.last = today;
  if (s.current > s.best) s.best = s.current;
  return s;
}

// La serie è viva solo se si è studiato oggi o ieri.
export function currentStreak() {
  const s = state.streak;
  if (!s.last) return 0;
  const gap = daysBetween(s.last, todayISO());
  return gap <= 1 ? s.current : 0;
}

/* ---------- Ripasso spaziato (i dati; la logica sta in srs.js) ---------- */

export function getSrs() {
  return state.srs;
}

export function saveSrs() {
  write();
}

/* ---------- Tema ---------- */

export function getTheme() {
  return THEMES.includes(state.theme) ? state.theme : 'auto';
}

export function setTheme(theme) {
  state.theme = THEMES.includes(theme) ? theme : 'auto';
  write();
  applyTheme(state.theme);
  return state.theme;
}

/* Scrive `data-theme` sull'elemento <html>. Con 'auto' l'attributo si
   toglie del tutto, così torna a decidere la media query del CSS. */
export function applyTheme(theme) {
  const root = document.documentElement;
  const scelta = THEMES.includes(theme) ? theme : 'auto';
  // 'auto' si risolve qui in un valore concreto, esattamente come fa lo
  // script inline nel <head>: al CSS arrivano solo 'light' o 'dark'.
  const risolto = scelta === 'auto' ? systemTheme() : scelta;
  if (risolto === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
  syncThemeColor();
}

export function systemTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* La barra di stato del telefono deve seguire il tema, altrimenti in scuro
   resta una striscia chiara sopra la pagina. Il colore si legge dalla
   variabile CSS già applicata: nessun colore scritto due volte. */
function syncThemeColor() {
  const meta = document.getElementById('theme-color');
  if (!meta) return;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (bg) meta.setAttribute('content', bg);
}

/* Con il tema su 'auto' il sistema può cambiare da solo (di sera, o con
   la modalità automatica): la barra di stato deve seguirlo. */
if (typeof window !== 'undefined' && window.matchMedia) {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (getTheme() === 'auto') applyTheme('auto'); };
  if (query.addEventListener) query.addEventListener('change', onChange);
}

/* ---------- Copia di sicurezza ---------- */

// Quante lezioni risultano completate in questo momento.
export function completedCount() {
  return Object.values(state.lessons).filter((rec) => rec && rec.completedAt).length;
}

export function backupInfo() {
  const last = state.backup.lastAt;
  return {
    lastAt: last,
    daysAgo: last ? daysBetween(last, todayISO()) : null,
    lessonsSince: completedCount() - (state.backup.lessonsAt || 0)
  };
}

export function markBackupDone() {
  state.backup = { lastAt: todayISO(), lessonsAt: completedCount() };
  write();
  return state.backup;
}

/* Va proposta una copia? Ogni 5 lezioni completate dall'ultima, oppure
   dopo due settimane. Si propone e basta: non blocca mai niente. */
export function shouldOfferBackup() {
  const info = backupInfo();
  if (completedCount() === 0) return false;
  if (info.lastAt === null) return completedCount() >= 5;
  return info.lessonsSince >= 5 || info.daysAgo >= 14;
}

/* ---------- Esportare, importare, azzerare ---------- */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function isEmpty() {
  return Object.keys(state.lessons).length === 0 && Object.keys(state.srs).length === 0;
}

/* Controlla che il file sia davvero un progresso di Pian piano prima di
   toccare quello che c'è già. Restituisce lo stato ripulito, senza salvarlo:
   decidere fra unire e sostituire tocca a chi chiama. */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('El archivo no tiene la forma esperada.');
  }
  // I file vecchi hanno `version`, i nuovi `schemaVersion`.
  const v = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : parsed.version;
  if (typeof v !== 'number') {
    throw new Error('Al archivo le falta el número de versión: no parece un progreso de Pian piano.');
  }
  if (v > SCHEMA_VERSION) {
    throw new Error('El archivo viene de una versión más nueva de Pian piano. Actualiza la página e inténtalo otra vez.');
  }
  const plainObject = (x) => x === undefined || (x && typeof x === 'object' && !Array.isArray(x));
  if (!plainObject(parsed.lessons) || !plainObject(parsed.srs) || !plainObject(parsed.streak)) {
    throw new Error('El archivo está dañado: las lecciones o el repaso no tienen la forma esperada.');
  }

  const incoming = migrate(parsed);
  return {
    state: incoming,
    lessons: Object.keys(incoming.lessons).length,
    items: Object.keys(incoming.srs).length,
    completed: Object.values(incoming.lessons).filter((r) => r && r.completedAt).length
  };
}

// Sostituisce tutto con quello che arriva dal file.
export function replaceWith(incoming) {
  state = migrate(incoming);
  write();
  return state;
}

/* Unisce due progressi tenendo sempre il migliore dei due:
   la lezione più avanti, la scatola di ripasso più alta, la serie più lunga.
   Così importare per sbaglio non fa mai perdere terreno. */
export function mergeWith(incoming) {
  const other = migrate(incoming);

  for (const [id, their] of Object.entries(other.lessons)) {
    const mine = state.lessons[id];
    if (!mine) {
      state.lessons[id] = their;
      continue;
    }
    const done = new Set([...(mine.done || []), ...(their.done || [])]);
    state.lessons[id] = {
      opened: [mine.opened, their.opened].filter(Boolean).sort()[0] || null,
      done: [...done].sort((a, b) => a - b),
      completedAt: mine.completedAt || their.completedAt || null
    };
  }

  for (const [id, their] of Object.entries(other.srs)) {
    const mine = state.srs[id];
    if (!mine) {
      state.srs[id] = their;
      continue;
    }
    // Scatola più alta: si tiene il ripasso più avanzato dei due.
    state.srs[id] = their.box > mine.box ? { ...mine, ...their } : mine;
    state.srs[id].right = Math.max(mine.right || 0, their.right || 0);
    state.srs[id].wrong = Math.max(mine.wrong || 0, their.wrong || 0);
  }

  const s = state.streak;
  const t = other.streak || {};
  s.best = Math.max(s.best || 0, t.best || 0);
  if (t.last && (!s.last || t.last > s.last)) {
    s.last = t.last;
    s.current = t.current || 0;
  }

  if (other.backup && other.backup.lastAt && (!state.backup.lastAt || other.backup.lastAt > state.backup.lastAt)) {
    state.backup = { ...other.backup };
  }

  write();
  return state;
}

// Compatibilità: sostituisce, come faceva prima.
export function importJSON(text) {
  return replaceWith(parseBackup(text).state);
}

export function resetAll() {
  state = emptyState();
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    /* niente da fare */
  }
  return state;
}
