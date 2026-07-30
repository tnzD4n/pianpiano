/* Traduzione dallo spagnolo all'italiano.
   `answer` raccoglie tutte le versioni accettabili. */

import { el, feedbackBox, showFeedback, checkAnswer, onEnter, answerInput } from '../util.js';
import * as tts from '../tts.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const { input, field } = answerInput({
    placeholder: 'Escríbelo en italiano…',
    label: 'Tu traducción al italiano'
  });

  const actions = el('div', { class: 'ex-actions' },
    el('button', { type: 'button', class: 'btn primary', onclick: () => check() }, 'Comprobar')
  );

  function check() {
    const result = checkAnswer(input.value, data.answer);
    showFeedback(box, {
      correct: result.correct,
      accentWarning: result.accentWarning,
      given: input.value,
      expected: result.expected,
      explain: data.explain,
      diff: true
    });
    // Una volta risolto, si può riascoltare la forma corretta.
    if (result.correct && tts.available() && !actions.querySelector('.audio')) {
      actions.append(tts.audioControls(result.expected));
    }
    onAnswer(result.correct);
  }

  onEnter(input, check);

  return el('div', { class: 'ex-body' },
    el('p', { class: 'ex-prompt' }, data.prompt),
    field,
    actions,
    box
  );
}
