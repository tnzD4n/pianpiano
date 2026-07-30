/* Completare la frase: nel `prompt` il buco è scritto con `___`.
   `answer` è l'elenco delle forme accettate per quel buco. */

import { el, feedbackBox, showFeedback, checkAnswer, onEnter, answerInput } from '../util.js';
import * as tts from '../tts.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const { input, bar, label } = answerInput({
    className: 'blank-input',
    label: 'Escribe la palabra que falta'
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
    if (result.correct) input.value = result.expected;
    onAnswer(result.correct);
  };

  onEnter(input, check);

  // Il testo si spezza sul buco: prima ___, campo, dopo ___.
  // L'etichetta nascosta viaggia insieme al campo, dentro la frase.
  const [before, after = ''] = String(data.prompt).split('___');
  const prompt = el('p', { class: 'ex-prompt' }, before, label, input, after);

  const actions = el('div', { class: 'ex-actions' },
    el('button', { type: 'button', class: 'btn primary', onclick: check }, 'Comprobar')
  );
  if (data.audio && tts.available()) actions.append(tts.audioControls(data.audio));

  // Qui il campo sta dentro la frase: la barra non può stargli sopra senza
  // spezzare il testo, quindi si mette subito sotto, sempre a portata di pollice.
  return el('div', { class: 'ex-body' }, prompt, bar, actions, box);
}
