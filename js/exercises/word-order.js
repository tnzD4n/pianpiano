/* Rimettere in ordine la frase.
   Le parole si aggiungono e si tolgono cliccandole (o con Invio da tastiera):
   niente trascinamento obbligatorio, così funziona anche senza mouse. */

import { el, shuffle, clear, feedbackBox, showFeedback, checkAnswer } from '../util.js';
import * as tts from '../tts.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const answerRow = el('div', { class: 'wo-answer' });
  const pool = el('div', { class: 'wo-pool' });
  const placeholder = el('span', { class: 'wo-empty' }, 'Toca las palabras en el orden correcto.');

  const words = data.words.map((word, index) => ({ word, index }));
  const placed = [];

  const refresh = () => {
    clear(answerRow);
    clear(pool);
    if (placed.length === 0) answerRow.append(placeholder);
    placed.forEach((item) => {
      answerRow.append(el('button', {
        type: 'button',
        class: 'chip placed',
        'aria-label': `Quitar ${item.word}`,
        onclick: () => {
          placed.splice(placed.indexOf(item), 1);
          refresh();
        }
      }, item.word));
    });
    words.filter((item) => !placed.includes(item)).forEach((item) => {
      pool.append(el('button', {
        type: 'button',
        class: 'chip',
        'aria-label': `Añadir ${item.word}`,
        onclick: () => {
          placed.push(item);
          refresh();
        }
      }, item.word));
    });
  };

  const check = () => {
    const given = placed.map((item) => item.word).join(' ');
    const result = checkAnswer(given, [data.answer]);
    showFeedback(box, {
      correct: result.correct,
      accentWarning: result.accentWarning,
      given,
      expected: data.answer,
      explain: data.explain
    });
    onAnswer(result.correct);
  };

  const actions = el('div', { class: 'ex-actions' },
    el('button', { type: 'button', class: 'btn primary', onclick: check }, 'Comprobar'),
    el('button', {
      type: 'button',
      class: 'btn',
      onclick: () => { placed.length = 0; clear(box); refresh(); }
    }, 'Borrar')
  );
  if (tts.available()) actions.append(tts.audioControls(data.answer));

  // Mescoliamo finché l'ordine iniziale non è già quello giusto.
  const original = words.map((w) => w.word).join(' ');
  let mixed = shuffle(words);
  for (let i = 0; i < 8 && mixed.map((w) => w.word).join(' ') === original; i++) mixed = shuffle(words);
  words.length = 0;
  words.push(...mixed);

  refresh();

  return el('div', { class: 'ex-body' },
    el('p', { class: 'ex-prompt' }, data.prompt || 'Ordena las palabras para formar la frase.'),
    answerRow,
    pool,
    actions,
    box
  );
}
