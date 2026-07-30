/* Ripasso spaziato con il sistema di Leitner a 5 scatole.
   Gli elementi non stanno nel JSON delle lezioni: si ricavano da
   `vocab` e `phrases` quando la lezione viene aperta per la prima volta. */

import * as store from './store.js';
import { todayISO, addDays } from './util.js';

// Giorni di attesa per ciascuna scatola, dalla 1 alla 5.
export const INTERVALS = [1, 3, 7, 16, 35];
export const BOXES = INTERVALS.length;

function itemId(kind, italian) {
  return (kind === 'vocab' ? 'v:' : 'f:') + italian.trim().toLowerCase();
}

// Aggiunge alla scatola 1 tutto quello che la lezione insegna.
// Gli elementi già presenti (anche da altre lezioni) non si toccano.
export function seedFromLesson(lesson) {
  const srs = store.getSrs();
  const today = todayISO();
  let added = 0;

  const add = (kind, entry) => {
    const id = itemId(kind, entry.it);
    if (srs[id]) return;
    srs[id] = {
      id,
      kind,
      it: entry.it,
      es: entry.es,
      gender: entry.gender || null,
      note: entry.note || null,
      lesson: lesson.id,
      box: 1,
      due: today,
      // `right`/`wrong` restano per compatibilità con i backup vecchi;
      // quelli che si leggono sono `attempts` ed `errors`.
      right: 0,
      wrong: 0,
      attempts: 0,
      errors: 0
    };
    added += 1;
  };

  (lesson.vocab || []).forEach((v) => add('vocab', v));
  (lesson.phrases || []).forEach((p) => add('phrase', p));
  if (added) store.saveSrs();
  return added;
}

export function allItems() {
  return Object.values(store.getSrs());
}

export function dueItems() {
  const today = todayISO();
  return allItems()
    .filter((item) => item.due <= today)
    .sort((a, b) => (a.due === b.due ? a.box - b.box : a.due < b.due ? -1 : 1));
}

export function dueCount() {
  return dueItems().length;
}

// Risposta giusta: sale di una scatola. Sbagliata: torna alla prima.
export function grade(id, correct) {
  const srs = store.getSrs();
  const item = srs[id];
  if (!item) return null;

  // I contatori crescono sempre, anche quando la scatola torna indietro:
  // servono a sapere quali parole resistono, non a che punto del ripasso sono.
  item.attempts = (item.attempts || 0) + 1;

  if (correct) {
    item.box = Math.min(item.box + 1, BOXES);
    item.right += 1;
  } else {
    item.box = 1;
    item.wrong += 1;
    item.errors = (item.errors || 0) + 1;
  }
  item.due = addDays(todayISO(), INTERVALS[item.box - 1]);
  store.saveSrs();
  return item;
}

/* Conta il tentativo senza toccare scatola e scadenza.
   Serve alla pratica libera: se non c'è niente da ripassare, esercitarsi non
   deve spostare in avanti le date, ma sapere che quella parola è stata
   sbagliata di nuovo è un'informazione da tenere. */
export function countAttempt(id, correct) {
  const srs = store.getSrs();
  const item = srs[id];
  if (!item) return null;
  item.attempts = (item.attempts || 0) + 1;
  if (!correct) item.errors = (item.errors || 0) + 1;
  store.saveSrs();
  return item;
}

/* ---------- «Tus palabras rebeldes» ---------- */

// Sotto questa soglia complessiva una classifica non significherebbe niente:
// con quattro tentativi in croce, «100% di errori» è solo rumore.
export const REBELS_MIN_ATTEMPTS = 20;
// E una singola voce entra in classifica solo se è stata provata almeno così.
const MIN_PER_ITEM = 2;

export function totalAttempts() {
  return allItems().reduce((n, item) => n + (item.attempts || 0), 0);
}

export function errorRate(item) {
  const a = item.attempts || 0;
  return a === 0 ? 0 : (item.errors || 0) / a;
}

/* Le voci più sbagliate, ordinate per tasso d'errore.
   A parità di tasso vince chi ha sbagliato più volte in assoluto: fra due
   parole al 50%, quella con dieci errori dà più fastidio di quella con uno. */
export function rebels(limit = 10) {
  return allItems()
    .filter((item) => (item.attempts || 0) >= MIN_PER_ITEM && (item.errors || 0) > 0)
    .sort((a, b) => {
      const diff = errorRate(b) - errorRate(a);
      if (Math.abs(diff) > 1e-9) return diff;
      return (b.errors || 0) - (a.errors || 0);
    })
    .slice(0, limit);
}

// Ci sono abbastanza dati perché la classifica voglia dire qualcosa?
export function hasEnoughData() {
  return totalAttempts() >= REBELS_MIN_ATTEMPTS;
}

export function itemsByIds(ids) {
  const srs = store.getSrs();
  return ids.map((id) => srs[id]).filter(Boolean);
}

export function stats() {
  const items = allItems();
  const byBox = new Array(BOXES).fill(0);
  items.forEach((item) => { byBox[item.box - 1] += 1; });
  return { total: items.length, byBox, due: dueCount() };
}
