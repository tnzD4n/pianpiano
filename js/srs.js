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
      right: 0,
      wrong: 0
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
  if (correct) {
    item.box = Math.min(item.box + 1, BOXES);
    item.right += 1;
  } else {
    item.box = 1;
    item.wrong += 1;
  }
  item.due = addDays(todayISO(), INTERVALS[item.box - 1]);
  store.saveSrs();
  return item;
}

export function stats() {
  const items = allItems();
  const byBox = new Array(BOXES).fill(0);
  items.forEach((item) => { byBox[item.box - 1] += 1; });
  return { total: items.length, byBox, due: dueCount() };
}
