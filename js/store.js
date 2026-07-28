/* Persistenza in localStorage.
   Tutto il sito scrive e legge una sola chiave, `pianpiano.v1`,
   con uno schema versionato e un punto unico per le migrazioni future. */

import { todayISO, daysBetween } from './util.js';

const KEY = 'pianpiano.v1';
const VERSION = 1;

function emptyState() {
  return {
    version: VERSION,
    // lezioni: { "m01-l01": { opened, done: [indici], completedAt } }
    lessons: {},
    // ripasso: { "v:ciao": { id, kind, it, es, gender, lesson, box, due, right, wrong } }
    srs: {},
    streak: { current: 0, best: 0, last: null },
    updatedAt: null
  };
}

/* Le migrazioni si aggiungono qui, una per ogni salto di versione.
   Esempio per il futuro:
     if (data.version === 1) { data.qualcosa = {}; data.version = 2; } */
function migrate(data) {
  if (!data || typeof data !== 'object') return emptyState();
  const base = emptyState();
  const out = {
    ...base,
    ...data,
    lessons: { ...base.lessons, ...(data.lessons || {}) },
    srs: { ...base.srs, ...(data.srs || {}) },
    streak: { ...base.streak, ...(data.streak || {}) }
  };
  out.version = VERSION;
  return out;
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

/* ---------- Esportare, importare, azzerare ---------- */

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
    throw new Error('formato');
  }
  state = migrate(parsed);
  write();
  return state;
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
