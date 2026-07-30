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

  /* Il conteggio delle coppie è una regione «polite»: chi usa il lettore di
     schermo sente «2 de 6 parejas» a ogni accoppiata giusta, altrimenti una
     coppia trovata non produce nessun annuncio e resta un fatto solo visivo. */
  const tally = el('p', { class: 'match-tally', role: 'status', 'aria-live': 'polite' });
  const updateTally = () => {
    tally.textContent = found === 0
      ? ''
      : `${found} de ${pairs.length} ${pairs.length === 1 ? 'pareja' : 'parejas'}`;
  };

  const clearFeedback = () => clear(box);

  const setSelected = (button, on) => {
    button.classList.toggle('selected', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  };

  const tryMatch = (button) => {
    if (button.classList.contains('done')) return;
    const side = button.dataset.side;

    if (!selected) {
      selected = button;
      setSelected(button, true);
      return;
    }
    if (selected === button) {
      setSelected(button, false);
      selected = null;
      return;
    }
    if (selected.dataset.side === side) {
      setSelected(selected, false);
      selected = button;
      setSelected(button, true);
      return;
    }

    const ok = selected.dataset.pair === button.dataset.pair;
    if (ok) {
      setSelected(selected, false);
      [selected, button].forEach((b) => {
        b.classList.add('done');
        b.disabled = true;
        b.removeAttribute('aria-pressed');
      });
      selected = null;
      found += 1;
      clearFeedback();
      updateTally();
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
      setSelected(selected, false);
      selected = null;
      onAnswer(false);
    }
  };

  const makeButton = (text, index, side) => el('button', {
    type: 'button',
    class: 'match-btn',
    'data-pair': index,
    'data-side': side,
    // Il pulsante è a due stati: premuto = scelto. Senza questo, la
    // selezione esiste solo come colore e come segno grafico.
    'aria-pressed': 'false',
    lang: side === 'it' ? 'it' : 'es',
    onclick(event) { tryMatch(event.currentTarget); }
  }, text);

  shuffle(pairs.map((p, i) => [p[0], i])).forEach(([text, i]) => left.append(makeButton(text, i, 'it')));
  shuffle(pairs.map((p, i) => [p[1], i])).forEach(([text, i]) => right.append(makeButton(text, i, 'es')));

  return el('div', { class: 'ex-body' },
    el('p', { class: 'ex-prompt' }, data.prompt || 'Une cada palabra italiana con su traducción.'),
    el('div', { class: 'match-grid' }, left, right),
    tally,
    box
  );
}
