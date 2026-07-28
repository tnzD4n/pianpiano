/* Abbinamento parola ↔ traduzione.
   `pairs` è un elenco di coppie [italiano, spagnolo].
   Si clicca (o si preme Invio) su una parola a sinistra e poi sulla sua
   traduzione a destra. L'esercizio è superato quando tutte le coppie
   sono state trovate. */

import { el, shuffle, clear, feedbackBox, showFeedback } from '../util.js';

export function render(data, onAnswer) {
  const box = feedbackBox();
  const pairs = data.pairs || [];
  const left = el('div', { class: 'match-col it' });
  const right = el('div', { class: 'match-col es' });

  let selected = null;
  let found = 0;

  const clearFeedback = () => clear(box);

  const tryMatch = (button) => {
    if (button.classList.contains('done')) return;
    const side = button.dataset.side;

    if (!selected) {
      selected = button;
      button.classList.add('selected');
      return;
    }
    if (selected === button) {
      button.classList.remove('selected');
      selected = null;
      return;
    }
    if (selected.dataset.side === side) {
      selected.classList.remove('selected');
      selected = button;
      button.classList.add('selected');
      return;
    }

    const ok = selected.dataset.pair === button.dataset.pair;
    if (ok) {
      selected.classList.remove('selected');
      selected.classList.add('done');
      button.classList.add('done');
      selected.disabled = true;
      button.disabled = true;
      selected = null;
      found += 1;
      clearFeedback();
      if (found === pairs.length) {
        showFeedback(box, { correct: true, explain: data.explain });
        onAnswer(true);
      }
    } else {
      const wrongPair = pairs[Number(selected.dataset.pair)];
      const partner = selected.dataset.side === 'it' ? wrongPair[1] : wrongPair[0];
      button.classList.add('shake');
      setTimeout(() => button.classList.remove('shake'), 400);
      showFeedback(box, {
        correct: false,
        given: `${selected.textContent} + ${button.textContent}`,
        expected: `${selected.textContent} + ${partner}`
      });
      selected.classList.remove('selected');
      selected = null;
      onAnswer(false);
    }
  };

  const makeButton = (text, index, side) => el('button', {
    type: 'button',
    class: 'match-btn',
    'data-pair': index,
    'data-side': side,
    onclick(event) { tryMatch(event.currentTarget); }
  }, text);

  shuffle(pairs.map((p, i) => [p[0], i])).forEach(([text, i]) => left.append(makeButton(text, i, 'it')));
  shuffle(pairs.map((p, i) => [p[1], i])).forEach(([text, i]) => right.append(makeButton(text, i, 'es')));

  return el('div', { class: 'ex-body' },
    el('p', { class: 'ex-prompt' }, data.prompt || 'Une cada palabra italiana con su traducción.'),
    el('div', { class: 'match-grid' }, left, right),
    box
  );
}
