/* Scelta multipla: `options` è un elenco di stringhe, `answer` è l'indice
   dell'opzione giusta. L'ordine è quello scritto nel JSON, non si mescola. */

import { el, feedbackBox, showFeedback } from '../util.js';
import * as tts from '../tts.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const list = el('ul', { class: 'options' });
  const buttons = [];

  const choose = (index) => {
    const correct = index === data.answer;
    buttons.forEach((b, i) => {
      b.classList.toggle('is-ok', correct ? i === index : i === data.answer);
      b.classList.toggle('is-bad', !correct && i === index);
    });
    showFeedback(box, {
      correct,
      given: data.options[index],
      expected: data.options[data.answer],
      explain: data.explain
    });
    onAnswer(correct);
  };

  data.options.forEach((option, index) => {
    const button = el('button', {
      type: 'button',
      class: 'option',
      onclick: () => choose(index)
    }, option);
    buttons.push(button);
    list.append(el('li', null, button));
  });

  const wrap = el('div', { class: 'ex-body' });
  const prompt = el('p', { class: 'ex-prompt' }, data.prompt);
  if (data.audio && tts.available()) prompt.append(' ', tts.audioControls(data.audio));
  wrap.append(prompt, list, box);
  return wrap;
}
