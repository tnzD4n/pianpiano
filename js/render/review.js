/* Sessione di ripasso: pesca gli elementi scaduti dal sistema di Leitner
   e li presenta uno alla volta, mescolando i tipi di esercizio.
   Per il ripasso conta il primo tentativo; riprovare resta sempre possibile. */

import { el, clear, shuffle, pick, withArticle, todayISO, daysBetween } from '../util.js';
import * as srs from '../srs.js';
import * as store from '../store.js';
import * as tts from '../tts.js';
import { renderExercise, LABEL } from '../exercises/index.js';

// Quanti elementi al massimo per sessione: meglio corta e ripetuta.
const SESSION_SIZE = 20;

/* opts.mode === 'rebeldes' limita la sessione alle voci più sbagliate.
   Il resto della meccanica è identico: stessi esercizi, stesse regole di
   promozione, così ripassare «solo quelle» non è una modalità a parte da
   mantenere ma la stessa sessione con una coda diversa. */
export function render(root, ctx, opts = {}) {
  clear(root);
  const pool = srs.allItems();
  const soloRibelli = opts.mode === 'rebeldes';

  const queue = soloRibelli
    ? shuffle(srs.rebels(10))
    : shuffle(srs.dueItems()).slice(0, SESSION_SIZE);

  root.append(el('p', { class: 'page-eyebrow' },
    soloRibelli
      ? [el('a', { href: '#/rebeldes' }, 'palabras rebeldes'), ' · repaso']
      : 'repaso'));

  /* Ripasso mirato senza niente da ripassare: si torna alla lista. */
  if (soloRibelli && queue.length === 0) {
    root.append(el('section', { class: 'empty-state' },
      el('p', { class: 'empty-mark', 'aria-hidden': 'true' }, '✓'),
      el('h1', null, 'Nada que insistir'),
      el('p', { class: 'empty-lead' }, 'Ahora mismo no hay ninguna palabra que se te resista.'),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/repaso' }, 'Repaso normal'))));
    return;
  }

  /* Stato vuoto: deve sembrare una ricompensa, non una schermata rotta.
     Chi arriva qui e non trova niente ha finito il suo lavoro, e la pagina
     glielo deve dire con la faccia giusta. */
  if (queue.length === 0) {
    const inCorso = pool.length > 0;
    const prossima = inCorso ? nextDueLabel(pool) : null;

    root.append(el('section', { class: 'empty-state' },
      el('p', { class: 'empty-mark', 'aria-hidden': 'true' }, inCorso ? '✓' : '◌'),
      el('h1', null, inCorso ? 'Nada pendiente' : 'El repaso está esperando'),
      el('p', { class: 'empty-lead' }, inCorso
        ? 'Has repasado todo lo que tocaba hoy. Esto es exactamente como tiene que estar.'
        : 'Todavía no hay nada aquí, y es normal: el repaso se llena solo.'),
      inCorso
        ? el('p', { class: 'small muted' },
          `Tienes ${pool.length} ${pool.length === 1 ? 'palabra' : 'palabras y frases'} en circulación.`,
          prossima ? ` Lo siguiente vuelve ${prossima}.` : '')
        : el('p', { class: 'small muted' },
          'Abre una lección: su vocabulario y sus frases entran aquí en cuanto la abres.'),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/' }, 'Volver al inicio'))));
    return;
  }

  store.touchStreak();

  const heading = el('h1', { class: 'page-title' },
    soloRibelli ? 'Solo las rebeldes' : 'Repaso de hoy');
  const progressBar = el('div', { class: 'progress' }, el('span', { style: 'width:0%' }));
  const progressText = el('p', { class: 'small muted', style: 'margin:13px 0 26px' });
  const stage = el('div');
  root.append(heading, progressBar, progressText, stage);

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
    stage.append(el('div', { class: 'review-done' },
      el('p', { class: 'big', lang: 'it' }, 'Pian piano.'),
      el('p', null, `Repaso terminado: ${firstTry} de ${queue.length} a la primera.`),
      el('p', { class: 'small muted' }, 'Lo que has fallado vuelve mañana; lo que has acertado, más adelante.'),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/' }, 'Volver al inicio'),
        srs.dueCount() > 0 ? el('button', {
          type: 'button',
          class: 'btn',
          onclick: () => render(root, ctx, opts)
        }, 'Otra ronda') : null,
        soloRibelli ? el('a', { class: 'btn', href: '#/rebeldes' }, 'Ver la lista') : null)));
  };

  showCurrent();
}

/* «mañana», «en 3 días»: quando torna il primo elemento non ancora scaduto.
   Serve allo stato vuoto, per dire che il ripasso è vivo e non fermo. */
function nextDueLabel(pool) {
  const today = todayISO();
  const future = pool.map((i) => i.due).filter((d) => d > today).sort();
  if (!future.length) return null;
  const days = daysBetween(today, future[0]);
  if (days <= 1) return 'mañana';
  if (days < 7) return `en ${days} días`;
  if (days < 14) return 'la semana que viene';
  return `en ${Math.round(days / 7)} semanas`;
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
