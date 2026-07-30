/* Dettato: il sintetizzatore legge `audio`, l'utente scrive quello che sente.
   Senza voce italiana l'esercizio non viene nemmeno creato (vedi index.js). */

import { el, feedbackBox, showFeedback, checkAnswer, onEnter, answerInput } from '../util.js';
import * as tts from '../tts.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const { input, field } = answerInput({
    placeholder: 'Escribe lo que oyes…',
    label: 'Escribe lo que oyes'
  });

  const check = () => {
    const result = checkAnswer(input.value, data.answer);
    showFeedback(box, {
      correct: result.correct,
      accentWarning: result.accentWarning,
      given: input.value,
      expected: result.expected,
      explain: data.explain,
      diff: true
    });
    onAnswer(result.correct);
  };

  onEnter(input, check);

  const controls = el('div', { class: 'ex-actions' },
    el('button', {
      type: 'button',
      class: 'btn',
      onclick: () => tts.speak(data.audio, 1)
    }, '🔊 Escuchar'),
    el('button', {
      type: 'button',
      class: 'btn',
      onclick: () => tts.speak(data.audio, 0.7)
    }, '🐢 Despacio')
  );

  return el('div', { class: 'ex-body' },
    el('p', { class: 'ex-prompt' }, data.prompt || 'Escucha y escribe la frase en italiano.'),
    controls,
    field,
    el('div', { class: 'ex-actions' },
      el('button', { type: 'button', class: 'btn primary', onclick: check }, 'Comprobar')
    ),
    box
  );
}
