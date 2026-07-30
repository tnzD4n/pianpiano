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
      el('h1', null, entry.lesson.title),
      el('p', null, 'Esta lección todavía no está disponible. Vuelve dentro de unos días.')));
    return;
  }

  clear(root);

  // Prima apertura: la lezione entra in corso e il suo materiale nel ripasso.
  store.openLesson(lesson.id);
  srs.seedFromLesson(lesson);
  ctx.refreshBadge();

  // La barra del modulo resta appiccicata in alto per tutta la lezione:
  // sapere quanto manca è metà della motivazione.
  const moduleBar = modulePane(entry.module);

  root.append(
    el('p', { class: 'breadcrumb' },
      el('a', { href: '#/' }, 'Inicio'), ' › ',
      el('a', { href: `#/modulo/${entry.module.id}` }, entry.module.title)),
    moduleBar,
    el('h1', null, lesson.title),
    lesson.goal ? el('p', { class: 'muted lesson-goal' }, lesson.goal) : null
  );

  if (lesson.vocab && lesson.vocab.length) root.append(vocabSection(lesson.vocab));
  if (lesson.phrases && lesson.phrases.length) root.append(phraseSection(lesson.phrases));
  if (lesson.grammar && lesson.grammar.length) root.append(grammarSection(lesson.grammar));
  if (lesson.ojo && lesson.ojo.length) root.append(ojoSection(lesson.ojo));
  if (lesson.exercises && lesson.exercises.length) {
    root.append(exerciseSection(lesson, ctx, entry, () => refreshModulePane(moduleBar, entry.module)));
  }

  root.append(lessonNav(ctx, entry));
}

/* ---------- Barra del modulo, sempre in vista ---------- */

function modulePane(module) {
  const pane = el('div', { class: 'module-pane' });
  refreshModulePane(pane, module);
  return pane;
}

function refreshModulePane(pane, module) {
  const p = store.moduleProgress(module);
  clear(pane);
  pane.append(
    el('div', { class: 'mp-head' },
      el('span', { class: 'mp-title' }, module.title),
      el('span', { class: 'mp-count' }, `${p.done} de ${p.total}`)),
    el('div', {
      class: 'progress',
      role: 'progressbar',
      'aria-valuenow': String(p.percent),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `Progreso del módulo: ${p.done} de ${p.total} lecciones`
    }, el('span', { style: `width:${p.percent}%` }))
  );
}

function notFound(root, text) {
  root.append(el('div', { class: 'card notice' },
    el('h1', null, 'No encontrado'),
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

/* Ogni «¡Ojo!» è una sezione a sé, allo stesso livello di Vocabulario e
   Gramática: quindi h2, non h3. La gerarchia dei titoli è come si naviga
   una pagina con il lettore di schermo. */
function ojoSection(blocks) {
  const wrap = el('div');
  blocks.forEach((block) => {
    wrap.append(el('section', { class: 'card ojo' },
      el('h2', null, block.title),
      ...mdBlock(block.body)));
  });
  return wrap;
}

/* ---------- Esercizi ---------- */

/* Schermata di fine lezione: che cosa ha imparato, non solo «bravo».
   Rivedere le parole appena studiate elencate insieme è il primo ripasso. */
function lessonSummary(lesson, ctx, entry, firstTry, total) {
  const vocab = lesson.vocab || [];
  const phrases = lesson.phrases || [];
  const grammar = lesson.grammar || [];

  const conta = [];
  if (vocab.length) conta.push(`${vocab.length} ${vocab.length === 1 ? 'palabra nueva' : 'palabras nuevas'}`);
  if (phrases.length) conta.push(`${phrases.length} ${phrases.length === 1 ? 'frase' : 'frases'}`);
  if (grammar.length) conta.push(`${grammar.length} ${grammar.length === 1 ? 'punto de gramática' : 'puntos de gramática'}`);

  const card = el('section', { class: 'card lesson-done' },
    el('p', { class: 'done-mark', 'aria-hidden': 'true' }, '✓'),
    el('h2', null, 'Lección terminada'),
    el('p', { class: 'done-lead' }, conta.length
      ? `Te llevas ${conta.join(', ').replace(/, ([^,]*)$/, ' y $1')}.`
      : 'Has terminado todos los ejercicios.')
  );

  if (total > 0) {
    card.append(el('p', { class: 'small muted' },
      `Ejercicios acertados a la primera: ${firstTry} de ${total}.`,
      firstTry < total ? ' Los demás también cuentan: lo que se repite se queda.' : ''));
  }

  // Le parole della lezione, in italiano e in spagnolo, in una riga per una.
  if (vocab.length) {
    const list = el('ul', { class: 'done-words' });
    vocab.forEach((v) => {
      list.append(el('li', null,
        el('span', { class: 'it', lang: 'it' }, withArticle(v.it, v.gender)),
        el('span', { class: 'sep', 'aria-hidden': 'true' }, '·'),
        el('span', { class: 'es' }, v.es)));
    });
    card.append(el('details', { class: 'done-details' },
      el('summary', null, `Repasar las ${vocab.length} palabras de esta lección`),
      list));
  }

  if (grammar.length) {
    card.append(el('p', { class: 'small' },
      el('strong', null, 'Gramática: '),
      grammar.map((g) => g.heading).join(' · ')));
  }

  card.append(
    el('p', { class: 'small muted' },
      'Todo esto ya está en tu repaso. Vuelve mañana: es la repetición la que fija, no el primer día.'),
    el('div', { class: 'btn-row' },
      el('a', { class: 'btn primary', href: '#/repaso' }, 'Ir al repaso'),
      nextLink(ctx, entry, 'btn'))
  );

  return card;
}

function exerciseSection(lesson, ctx, entry, onProgress) {
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

  // Quanti sono stati risolti al primo colpo, in questa sessione.
  let firstTry = 0;
  const attempted = new Set();

  const updateCounter = () => {
    const rec = store.getLesson(lesson.id);
    const done = required.filter((i) => rec && rec.done.includes(i)).length;
    counter.textContent = `${done} de ${required.length} correctos`;
    clear(banner);
    const complete = store.refreshCompletion(lesson.id, required);
    if (complete) {
      banner.append(lessonSummary(lesson, ctx, entry, firstTry, required.length));
    }
    // La barra del modulo si aggiorna nello stesso momento della scheda.
    if (onProgress) onProgress();
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
      // Primo tentativo giusto: conta per il riepilogo di fine lezione.
      if (correct && !attempted.has(index)) firstTry += 1;
      attempted.add(index);
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
