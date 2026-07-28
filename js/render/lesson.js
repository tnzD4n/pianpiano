/* Pagina di una lezione: vocabolario, frasi, grammatica, «ojo» ed esercizi.
   Il JSON della lezione è l'unica fonte: qui non c'è nessun contenuto. */

import { el, clear, mdBlock, mdInline, withArticle, withPluralArticle } from '../util.js';
import * as store from '../store.js';
import * as srs from '../srs.js';
import * as tts from '../tts.js';
import { renderExercise, isUsable, LABEL } from '../exercises/index.js';

export async function render(root, ctx, lessonId) {
  clear(root);
  const entry = ctx.findLesson(lessonId);

  if (!entry) {
    notFound(root, 'Esa lección no existe.');
    return;
  }

  root.append(el('p', { class: 'loading' }, 'Cargando la lección…'));

  let lesson;
  try {
    const response = await fetch(entry.lesson.file, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    lesson = await response.json();
  } catch (err) {
    clear(root);
    root.append(el('p', { class: 'breadcrumb' },
      el('a', { href: '#/' }, 'Inicio'), ' › ',
      el('a', { href: `#/modulo/${entry.module.id}` }, entry.module.title)));
    root.append(el('div', { class: 'card notice' },
      el('h2', null, entry.lesson.title),
      el('p', null, 'Esta lección todavía no está disponible. Vuelve dentro de unos días.')));
    return;
  }

  clear(root);

  // Prima apertura: la lezione entra in corso e il suo materiale nel ripasso.
  store.openLesson(lesson.id);
  srs.seedFromLesson(lesson);
  ctx.refreshBadge();

  root.append(
    el('p', { class: 'breadcrumb' },
      el('a', { href: '#/' }, 'Inicio'), ' › ',
      el('a', { href: `#/modulo/${entry.module.id}` }, entry.module.title)),
    el('h1', null, lesson.title),
    lesson.goal ? el('p', { class: 'muted' }, lesson.goal) : null
  );

  if (lesson.vocab && lesson.vocab.length) root.append(vocabSection(lesson.vocab));
  if (lesson.phrases && lesson.phrases.length) root.append(phraseSection(lesson.phrases));
  if (lesson.grammar && lesson.grammar.length) root.append(grammarSection(lesson.grammar));
  if (lesson.ojo && lesson.ojo.length) root.append(ojoSection(lesson.ojo));
  if (lesson.exercises && lesson.exercises.length) root.append(exerciseSection(lesson, ctx, entry));

  root.append(lessonNav(ctx, entry));
}

function notFound(root, text) {
  root.append(el('div', { class: 'card notice' },
    el('h2', null, 'No encontrado'),
    el('p', null, text, ' ', el('a', { href: '#/' }, 'Volver al inicio.'))));
}

/* ---------- Vocabolario ---------- */

function vocabSection(vocab) {
  const list = el('ul', { class: 'vocab-list' });
  vocab.forEach((item) => {
    const italian = withArticle(item.it, item.gender);
    const line = el('li', null,
      el('span', { class: 'it' }, italian),
      tts.available() ? tts.audioControls(item.it, italian) : null,
      el('span', { class: 'sep' }, '·'),
      el('span', { class: 'es' }, item.es)
    );
    if (item.plural) {
      line.append(el('span', { class: 'vocab-plural' }, `(pl. ${withPluralArticle(item.plural, item.gender)})`));
    }
    if (item.note) line.append(el('span', { class: 'vocab-note', html: mdInline(item.note) }));
    list.append(line);
  });
  return el('section', { class: 'card' }, el('h2', null, 'Vocabulario'), list);
}

/* ---------- Frasi ---------- */

function phraseSection(phrases) {
  const list = el('ul', { class: 'phrase-list' });
  phrases.forEach((item) => {
    const line = el('li', null,
      el('span', { class: 'it' }, item.it),
      tts.available() ? tts.audioControls(item.it) : null,
      el('span', { class: 'es' }, item.es)
    );
    if (item.note) line.append(el('span', { class: 'phrase-note', html: mdInline(item.note) }));
    list.append(line);
  });
  return el('section', { class: 'card' }, el('h2', null, 'Frases útiles'), list);
}

/* ---------- Grammatica ---------- */

function grammarSection(blocks) {
  const section = el('section', { class: 'card grammar' }, el('h2', null, 'Gramática'));
  blocks.forEach((block) => {
    section.append(el('h3', null, block.heading));
    if (block.body) section.append(...mdBlock(block.body));
    if (block.table) section.append(renderTable(block.table));
  });
  return section;
}

function renderTable(table) {
  const head = el('tr');
  (table.headers || []).forEach((h) => head.append(el('th', null, h)));
  const body = el('tbody');
  (table.rows || []).forEach((row) => {
    const tr = el('tr');
    row.forEach((cell) => tr.append(el('td', { html: mdInline(cell) })));
    body.append(tr);
  });
  return el('div', { class: 'table-wrap' }, el('table', null, el('thead', null, head), body));
}

/* ---------- ¡Ojo! ---------- */

function ojoSection(blocks) {
  const wrap = el('div');
  blocks.forEach((block) => {
    wrap.append(el('section', { class: 'card ojo' },
      el('h3', null, block.title),
      ...mdBlock(block.body)));
  });
  return wrap;
}

/* ---------- Esercizi ---------- */

function exerciseSection(lesson, ctx, entry) {
  // Gli esercizi non utilizzabili (l'ascolto senza voce italiana) spariscono
  // e non contano per il completamento.
  const usable = lesson.exercises
    .map((data, index) => ({ data, index }))
    .filter(({ data }) => isUsable(data.type));

  const required = usable.map((x) => x.index);
  const section = el('section');
  section.append(el('div', { class: 'section-title' },
    el('h2', null, 'Ejercicios'),
    el('span', { class: 'count' })));

  const counter = section.querySelector('.count');
  const banner = el('div');

  const updateCounter = () => {
    const rec = store.getLesson(lesson.id);
    const done = required.filter((i) => rec && rec.done.includes(i)).length;
    counter.textContent = `${done} de ${required.length} correctos`;
    const complete = store.refreshCompletion(lesson.id, required);
    clear(banner);
    if (complete) {
      banner.append(el('div', { class: 'card notice' },
        el('h2', null, '¡Lección completada!'),
        el('p', null, 'Ya has acertado todos los ejercicios. El vocabulario y las frases están en el repaso: vuelve mañana para consolidarlos.'),
        el('div', { class: 'btn-row' },
          el('a', { class: 'btn primary', href: '#/repaso' }, 'Ir al repaso'),
          nextLink(ctx, entry, 'btn'))));
    }
  };

  usable.forEach(({ data, index }, position) => {
    const card = el('article', { class: 'exercise' });
    const state = el('span', { class: 'ex-state' });
    card.append(el('div', { class: 'ex-head' },
      el('span', null, `Ejercicio ${position + 1} de ${usable.length} · ${LABEL[data.type] || data.type}`),
      state));

    const rec = store.getLesson(lesson.id);
    if (rec && rec.done.includes(index)) {
      card.classList.add('solved');
      state.textContent = '✓ resuelto';
    }

    const body = renderExercise(data, (correct) => {
      if (correct) {
        store.markExerciseDone(lesson.id, index);
        card.classList.add('solved');
        state.textContent = '✓ resuelto';
      }
      updateCounter();
    });

    if (body) {
      card.append(body);
      section.append(card);
    }
  });

  section.append(banner);
  updateCounter();
  return section;
}

/* ---------- Navigazione fra lezioni ---------- */

function nextLink(ctx, entry, className) {
  const next = ctx.nextLesson(entry.lesson.id);
  if (!next) return null;
  return el('a', { class: className, href: `#/lezione/${next.id}` }, 'Siguiente lección →');
}

function lessonNav(ctx, entry) {
  const prev = ctx.prevLesson(entry.lesson.id);
  const next = ctx.nextLesson(entry.lesson.id);
  const nav = el('div', { class: 'btn-row', style: 'margin-top:1.5rem' });
  if (prev) nav.append(el('a', { class: 'btn', href: `#/lezione/${prev.id}` }, '← ' + prev.title));
  if (next) nav.append(el('a', { class: 'btn', href: `#/lezione/${next.id}` }, next.title + ' →'));
  nav.append(el('a', { class: 'btn', href: `#/modulo/${entry.module.id}` }, 'Volver al módulo'));
  return nav;
}
