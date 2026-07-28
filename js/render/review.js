/* Sessione di ripasso: pesca gli elementi scaduti dal sistema di Leitner
   e li presenta uno alla volta, mescolando i tipi di esercizio.
   Per il ripasso conta il primo tentativo; riprovare resta sempre possibile. */

import { el, clear, shuffle, pick, withArticle } from '../util.js';
import * as srs from '../srs.js';
import * as store from '../store.js';
import * as tts from '../tts.js';
import { renderExercise, LABEL } from '../exercises/index.js';

// Quanti elementi al massimo per sessione: meglio corta e ripetuta.
const SESSION_SIZE = 20;

export function render(root, ctx) {
  clear(root);
  const pool = srs.allItems();
  const queue = shuffle(srs.dueItems()).slice(0, SESSION_SIZE);

  root.append(el('p', { class: 'breadcrumb' }, el('a', { href: '#/' }, 'Inicio'), ' › Repaso'));

  if (queue.length === 0) {
    root.append(el('div', { class: 'card notice' },
      el('h2', null, 'Nada que repasar hoy'),
      el('p', null, pool.length
        ? 'Has repasado todo lo que tocaba. Vuelve mañana o abre una lección nueva.'
        : 'El repaso se llena solo: abre una lección y su vocabulario y sus frases entrarán aquí.'),
      el('div', { class: 'btn-row' }, el('a', { class: 'btn primary', href: '#/' }, 'Volver al inicio'))));
    return;
  }

  store.touchStreak();

  const heading = el('h1', null, 'Repaso de hoy');
  const progressText = el('p', { class: 'small muted' });
  const progressBar = el('div', { class: 'progress' }, el('span', { style: 'width:0%' }));
  const stage = el('div');
  root.append(heading, progressText, progressBar, stage);

  let position = 0;
  let firstTry = 0;

  const showCurrent = () => {
    clear(stage);
    if (position >= queue.length) return finish();

    const item = queue[position];
    const data = buildExercise(item, pool);
    let answered = false;

    progressText.textContent = `Elemento ${position + 1} de ${queue.length}`;
    progressBar.firstChild.style.width = `${Math.round((position / queue.length) * 100)}%`;

    const card = el('article', { class: 'exercise' });
    card.append(el('div', { class: 'ex-head' },
      el('span', null, LABEL[data.type] || data.type),
      el('span', { class: 'review-kind' }, item.kind === 'vocab' ? 'Palabra' : 'Frase')));

    const nextRow = el('div', { class: 'ex-actions' });

    const body = renderExercise(data, (correct) => {
      if (!answered) {
        answered = true;
        if (correct) firstTry += 1;
        srs.grade(item.id, correct);
        ctx.refreshBadge();
        const next = el('button', {
          type: 'button',
          class: 'btn primary',
          onclick: () => { position += 1; showCurrent(); }
        }, position + 1 < queue.length ? 'Siguiente →' : 'Terminar');
        nextRow.append(next);
        next.focus();
      }
    });

    card.append(body, nextRow);
    stage.append(card);
  };

  const finish = () => {
    progressText.textContent = '';
    progressBar.firstChild.style.width = '100%';
    clear(stage);
    stage.append(el('div', { class: 'card review-done' },
      el('p', { class: 'big' }, 'Pian piano.'),
      el('p', null, `Repaso terminado: ${firstTry} de ${queue.length} a la primera.`),
      el('p', { class: 'small muted' }, 'Lo que has fallado vuelve mañana; lo que has acertado, más adelante.'),
      el('div', { class: 'btn-row', style: 'justify-content:center' },
        el('a', { class: 'btn primary', href: '#/' }, 'Volver al inicio'),
        srs.dueCount() > 0 ? el('button', {
          type: 'button',
          class: 'btn',
          onclick: () => render(root, ctx)
        }, 'Otra ronda') : null)));
  };

  showCurrent();
}

/* Costruisce al volo un esercizio a partire da un elemento del ripasso. */
function buildExercise(item, pool) {
  const answers = [item.it];
  if (item.kind === 'vocab' && item.gender) answers.push(withArticle(item.it, item.gender));

  const others = pool.filter((p) => p.id !== item.id && p.kind === item.kind);
  const words = item.it.trim().split(/\s+/);

  const types = ['translation'];
  if (others.length >= 3) types.push('multiple-choice');
  if (words.length >= 3) types.push('word-order');
  if (tts.available()) types.push('listening');

  const type = pick(types);

  if (type === 'multiple-choice') {
    const distractors = shuffle(others).slice(0, 3).map((p) => p.it);
    const options = shuffle([item.it, ...distractors]);
    return {
      type,
      prompt: `¿Cómo se dice «${item.es}» en italiano?`,
      options,
      answer: options.indexOf(item.it),
      explain: item.note || undefined
    };
  }

  if (type === 'word-order') {
    return { type, words, answer: item.it, prompt: `Ordena las palabras: «${item.es}»` };
  }

  if (type === 'listening') {
    return { type, audio: item.it, answer: answers, explain: `Significa: ${item.es}` };
  }

  return {
    type: 'translation',
    prompt: `«${item.es}»`,
    answer: answers,
    explain: item.note || undefined
  };
}
