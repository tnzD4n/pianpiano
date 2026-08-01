/* Pagina di una lezione: vocabolario, frasi, grammatica, «ojo» ed esercizi.
   Il JSON della lezione è l'unica fonte: qui non c'è nessun contenuto.

   Niente schede: le sezioni si separano con lo spazio bianco, le voci di
   elenco con una linea da 1px. L'unico blocco con un fondo pieno di tutta
   la lezione è «¡Ojo!», perché è il punto in cui lo spagnolo tradisce. */

import { el, clear, mdBlock, mdInline, withArticle, withPluralArticle } from '../util.js';
import * as store from '../store.js';
import * as srs from '../srs.js';
import * as tts from '../tts.js';
import { renderExercise, isUsable, LABEL } from '../exercises/index.js';

export async function render(root, ctx, lessonId) {
  clear(root);
  const entry = ctx.findLesson(lessonId);

  if (!entry) {
    root.append(el('div', { class: 'notice' },
      el('h1', null, 'No encontrado'),
      el('p', null, 'Esa lección no existe. ', el('a', { href: '#/' }, 'Volver al inicio.'))));
    return;
  }

  const moduleNumber = ctx.course.modules.indexOf(entry.module) + 1;
  const lessonNumber = entry.module.lessons.indexOf(entry.lesson) + 1;

  // Niente messaggio di caricamento: il JSON è locale, e in cache è
  // istantaneo. Uno spinner qui sarebbe solo un lampo di rumore.
  let lesson;
  try {
    const response = await fetch(entry.lesson.file, { cache: 'no-cache' });
    if (!response.ok) throw new Error(String(response.status));
    lesson = await response.json();
  } catch (err) {
    clear(root);
    root.append(
      eyebrow(entry, moduleNumber, lessonNumber),
      el('div', { class: 'notice' },
        el('h1', null, entry.lesson.title),
        el('p', null, 'Esta lección todavía no está disponible. Vuelve dentro de unos días.')));
    return;
  }

  clear(root);

  // Prima apertura: la lezione entra in corso e il suo materiale nel ripasso.
  store.openLesson(lesson.id);
  srs.seedFromLesson(lesson);
  ctx.refreshBadge();

  /* La barra della lezione resta appiccicata in alto per tutta la lettura:
     sapere quanto manca è metà della motivazione, e da 3px non toglie
     niente alla pagina. */
  const bar = el('div', { class: 'lesson-bar' },
    el('div', {
      class: 'progress',
      role: 'progressbar',
      'aria-valuenow': '0',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': 'Progreso de la lección'
    }, el('span', { style: 'width:0%' })));

  root.append(
    eyebrow(entry, moduleNumber, lessonNumber),
    el('h1', { class: 'page-title' }, lesson.title),
    lesson.goal ? el('p', { class: 'page-goal' }, lesson.goal) : null,
    bar
  );

  if (lesson.vocab && lesson.vocab.length) root.append(vocabSection(lesson.vocab));
  if (lesson.phrases && lesson.phrases.length) root.append(phraseSection(lesson.phrases));
  if (lesson.grammar && lesson.grammar.length) root.append(grammarSection(lesson.grammar));
  if (lesson.ojo && lesson.ojo.length) root.append(ojoSection(lesson.ojo));
  if (lesson.exercises && lesson.exercises.length) {
    root.append(exerciseSection(lesson, ctx, entry, bar));
  }

  root.append(lessonNav(ctx, entry));
}

/* «Módulo 1 · Lección 2»: occhiello e navigazione in una riga sola, al
   posto della briciola di pane. */
function eyebrow(entry, moduleNumber, lessonNumber) {
  return el('p', { class: 'page-eyebrow' },
    el('a', { href: `#/modulo/${entry.module.id}` }, `Módulo ${moduleNumber}`),
    ' · ',
    `Lección ${lessonNumber}`);
}

/* ---------- Vocabolario ----------

   È l'elemento più visto del sito. Gerarchia, non due colonne allineate:
   la parola italiana da sola sulla riga a 25px, la traduzione sotto e più
   piccola, genere e plurale come etichetta accanto alla parola, l'audio
   come icona discreta a destra. */
function vocabSection(vocab) {
  const list = el('ul', { class: 'vocab-list' });

  vocab.forEach((item) => {
    const italian = withArticle(item.it, item.gender);
    const row = el('li', null);
    const entry = el('div', { class: 'vocab-entry' });

    const word = el('div', { class: 'vocab-word' },
      el('span', { class: 'it', lang: 'it' }, italian));

    // Genere e plurale stanno insieme in una sola etichetta, non su righe proprie.
    const marks = [];
    if (item.gender) marks.push(item.gender === 'f' ? 'f.' : 'm.');
    if (item.plural) marks.push('pl. ' + withPluralArticle(item.plural, item.gender));
    if (marks.length) word.append(el('span', { class: 'vocab-tag' }, marks.join(' · ')));

    entry.append(word, el('p', { class: 'vocab-es' }, item.es));

    if (tts.available()) {
      entry.append(el('div', { class: 'vocab-audio' }, tts.audioButton(item.it, italian)));
    }
    if (item.note) entry.append(el('p', { class: 'vocab-note', html: mdInline(item.note) }));

    row.append(entry);
    list.append(row);
  });

  return el('section', { class: 'section' },
    el('h2', null, 'vocabulario'),
    list);
}

/* ---------- Frasi: come il vocabolario, ma più compatto ---------- */

function phraseSection(phrases) {
  const list = el('ul', { class: 'phrase-list' });
  phrases.forEach((item) => {
    const line = el('li', null,
      el('span', { class: 'it', lang: 'it' }, item.it),
      tts.available() ? tts.audioControls(item.it) : null,
      el('span', { class: 'es' }, item.es)
    );
    if (item.note) line.append(el('span', { class: 'phrase-note', html: mdInline(item.note) }));
    list.append(line);
  });
  return el('section', { class: 'section' },
    el('h2', null, 'frases útiles'),
    list);
}

/* ---------- Grammatica ---------- */

function grammarSection(blocks) {
  const section = el('section', { class: 'section grammar' }, el('h2', null, 'gramática'));
  blocks.forEach((block) => {
    section.append(el('h3', null, block.heading));
    if (block.body) section.append(...mdBlock(block.body));
    if (block.table) section.append(renderTable(block.table));
  });
  return section;
}

/* Le tabelle di lingua sono italiano, salvo le colonne che dichiarano di
   essere spagnole: la regola serif/sans vale anche dentro una tabella, e
   l'unica cosa che sa quale colonna è quale è l'intestazione. */
const SPANISH_COLUMN = /espa(ñ|n)ol|castellano|significa|sentidos?|qué|por qué|cuándo|sabes|concuerda|como en/i;

function renderTable(table) {
  const headers = table.headers || [];
  const spanish = headers.map((h) => SPANISH_COLUMN.test(String(h)));

  const head = el('tr');
  headers.forEach((h, i) => head.append(el('th', { class: spanish[i] ? 'es' : null }, h)));

  const body = el('tbody');
  (table.rows || []).forEach((row) => {
    const tr = el('tr');
    row.forEach((cell, i) => tr.append(el('td', {
      class: spanish[i] ? 'es' : null,
      lang: spanish[i] ? null : 'it',
      html: mdInline(cell)
    })));
    body.append(tr);
  });

  return el('div', { class: 'table-wrap' }, el('table', null, el('thead', null, head), body));
}

/* ---------- ¡Ojo! ----------

   L'unico blocco con un fondo pieno: nessun bordo, nessun angolo
   arrotondato, un filetto da 3px a sinistra. Deve spiccare perché è il
   valore del corso.

   Ogni «¡Ojo!» è una sezione a sé, allo stesso livello di Vocabulario e
   Gramática: quindi h2, non h3. La gerarchia dei titoli è come si naviga
   una pagina con il lettore di schermo. */
function ojoSection(blocks) {
  const wrap = el('div', { class: 'section' });
  blocks.forEach((block) => {
    wrap.append(el('section', { class: 'ojo' },
      el('h2', null, block.title),
      ...mdBlock(block.body)));
  });
  return wrap;
}

/* ---------- Esercizi, uno per schermata ----------

   Prima erano otto riquadri impilati e si vedeva solo quanto mancava.
   Adesso c'è quello che si sta facendo, e sopra «3 de 8». */

function exerciseSection(lesson, ctx, entry, bar) {
  // Gli esercizi non utilizzabili (l'ascolto senza voce italiana) spariscono
  // e non contano per il completamento.
  const usable = lesson.exercises
    .map((data, index) => ({ data, index }))
    .filter(({ data }) => isUsable(data.type));

  const required = usable.map((x) => x.index);

  const counter = el('span', { class: 'count' });
  const section = el('section', { class: 'section' },
    el('div', { class: 'section-head' },
      el('h2', null, 'ejercicios'),
      counter));

  const stage = el('div');
  const nav = el('div', { class: 'ex-nav' });
  const banner = el('div');
  section.append(stage, nav, banner);

  // Quanti sono stati risolti al primo colpo, in questa sessione.
  let firstTry = 0;
  const attempted = new Set();
  let position = 0;

  const doneCount = () => {
    const rec = store.getLesson(lesson.id);
    return rec ? required.filter((i) => rec.done.includes(i)).length : 0;
  };

  const refreshBar = () => {
    const percent = required.length ? Math.round((doneCount() / required.length) * 100) : 0;
    const track = bar.querySelector('.progress');
    track.setAttribute('aria-valuenow', String(percent));
    track.setAttribute('aria-label', `Progreso de la lección: ${doneCount()} de ${required.length} ejercicios`);
    track.firstChild.style.width = `${percent}%`;
  };

  const refreshBanner = () => {
    clear(banner);
    if (store.refreshCompletion(lesson.id, required)) {
      banner.append(lessonSummary(lesson, ctx, entry, firstTry, required.length));
    }
  };

  const show = () => {
    clear(stage);
    clear(nav);

    const { data, index } = usable[position];
    counter.textContent = `${position + 1} de ${usable.length}`;

    const card = el('article', { class: 'exercise' });
    const state = el('span', { class: 'ex-state' });
    card.append(el('div', { class: 'ex-head' },
      el('span', null, LABEL[data.type] || data.type),
      state));

    const markSolved = () => {
      state.textContent = '✓ resuelto';
      state.className = 'ex-state solved';
    };

    const rec = store.getLesson(lesson.id);
    if (rec && rec.done.includes(index)) markSolved();

    const goto = (n) => { position = n; show(); };

    /* I due comandi si costruiscono prima dell'esercizio, perché appena una
       risposta è giusta il fuoco deve poter saltare su «Siguiente»: senza,
       da tastiera si resta fermi sul campo appena risolto. */
    const prev = position > 0
      ? el('button', {
        type: 'button',
        class: 'btn btn-small',
        onclick: () => goto(position - 1)
      }, '← Anterior')
      : el('span');

    const next = position + 1 < usable.length
      ? el('button', {
        type: 'button',
        class: 'btn btn-small',
        onclick: () => goto(position + 1)
      }, 'Siguiente →')
      : null;

    const body = renderExercise(data, (correct) => {
      // Primo tentativo giusto: conta per il riepilogo di fine lezione.
      if (correct && !attempted.has(index)) firstTry += 1;
      attempted.add(index);
      if (correct) {
        store.markExerciseDone(lesson.id, index);
        markSolved();
      }
      refreshBar();
      refreshBanner();
      if (correct && next) next.focus();
    });

    if (body) card.append(body);
    stage.append(card);
    nav.append(prev, next || el('span'));
  };

  show();
  refreshBar();
  refreshBanner();
  return section;
}

/* ---------- Fine lezione ----------

   Che cosa ha imparato, non solo «bravo»: rivedere le parole appena
   studiate elencate insieme è il primo ripasso. */
function lessonSummary(lesson, ctx, entry, firstTry, total) {
  const vocab = lesson.vocab || [];
  const phrases = lesson.phrases || [];
  const grammar = lesson.grammar || [];

  const conta = [];
  if (vocab.length) conta.push(`${vocab.length} ${vocab.length === 1 ? 'palabra nueva' : 'palabras nuevas'}`);
  if (phrases.length) conta.push(`${phrases.length} ${phrases.length === 1 ? 'frase' : 'frases'}`);
  if (grammar.length) conta.push(`${grammar.length} ${grammar.length === 1 ? 'punto de gramática' : 'puntos de gramática'}`);

  const block = el('section', { class: 'lesson-done' },
    el('p', { class: 'done-mark', 'aria-hidden': 'true' }, '✓'),
    el('h2', null, 'lección terminada'),
    el('p', { class: 'done-lead' }, conta.length
      ? `Te llevas ${conta.join(', ').replace(/, ([^,]*)$/, ' y $1')}.`
      : 'Has terminado todos los ejercicios.')
  );

  if (total > 0) {
    block.append(el('p', { class: 'small muted' },
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
    block.append(el('details', { class: 'done-details' },
      el('summary', null, `Repasar las ${vocab.length} palabras de esta lección`),
      list));
  }

  if (grammar.length) {
    block.append(el('p', { class: 'small' },
      el('strong', null, 'Gramática: '),
      grammar.map((g) => g.heading).join(' · ')));
  }

  block.append(
    el('p', { class: 'small muted' },
      'Todo esto ya está en tu repaso. Vuelve mañana: es la repetición la que fija, no el primer día.'),
    el('div', { class: 'btn-row' },
      el('a', { class: 'btn primary', href: '#/repaso' }, 'Ir al repaso'),
      nextLink(ctx, entry, 'btn'))
  );

  return block;
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
  const nav = el('div', { class: 'btn-row', style: 'margin-top:42px' });
  if (prev) nav.append(el('a', { class: 'btn btn-small', href: `#/lezione/${prev.id}` }, '← ' + prev.title));
  if (next) nav.append(el('a', { class: 'btn btn-small', href: `#/lezione/${next.id}` }, next.title + ' →'));
  nav.append(el('a', { class: 'btn btn-small', href: `#/modulo/${entry.module.id}` }, 'Volver al módulo'));
  return nav;
}
