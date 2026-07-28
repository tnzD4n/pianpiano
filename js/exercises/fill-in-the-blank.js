/* Completare la frase: nel `prompt` il buco è scritto con `___`.
   `answer` è l'elenco delle forme accettate per quel buco. */

import { el, feedbackBox, showFeedback, checkAnswer, onEnter } from '../util.js';
import * as tts from '../tts.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const input = el('input', {
    type: 'text',
    class: 'ex-input blank-input',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    'aria-label': 'Escribe la palabra que falta'
  });

  const check = () => {
    const result = checkAnswer(input.value, data.answer);
    showFeedback(box, {
      correct: result.correct,
      accentWarning: result.accentWarning,
      given: input.value,
      expected: result.expected,
      explain: data.explain
    });
    if (result.correct) input.value = result.expected;
    onAnswer(result.correct);
  };

  onEnter(input, check);

  // Il testo si spezza sul buco: prima ___, campo, dopo ___.
  const [before, after = ''] = String(data.prompt).split('___');
  const prompt = el('p', { class: 'ex-prompt' }, before, input, after);

  const actions = el('div', { class: 'ex-actions' },
    el('button', { type: 'button', class: 'btn primary', onclick: check }, 'Comprobar')
  );
  if (data.audio && tts.available()) actions.append(tts.audioControls(data.audio));

  return el('div', { class: 'ex-body' }, prompt, actions, box);
}
