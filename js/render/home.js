/* Pagina iniziale.

   Non è un cruscotto: è la prima pagina di un frasario. Nell'ordine, in una
   colonna sola: l'espressione del giorno (in italiano, ed è il motivo per
   cui questa pagina non sembra più un gestionale), una barra di avanzamento
   con una riga di testo, una sola azione, e l'indice dei moduli.

   Statistiche, serie di giorni, gestione dei dati e tema stanno in Ajustes:
   non sono cose da pagina iniziale. */

import { el, todayISO, clear, withArticle } from '../util.js';
import * as store from '../store.js';
import * as srs from '../srs.js';
import * as tts from '../tts.js';

export function render(root, ctx) {
  clear(root);
  const course = ctx.course;
  const progress = store.globalProgress(course);
  const due = srs.dueCount();

  // Un titolo di primo livello ci vuole comunque: qui è per chi naviga con
  // il lettore di schermo, perché l'apertura visiva è l'espressione.
  root.append(el('h1', { class: 'sr-only' }, 'Pian piano · italiano desde cero'));

  root.append(expression());
  root.append(progressBlock(course, progress));
  root.append(action(ctx, course, due));
  root.append(index(course));

  /* Il promemoria della copia di sicurezza è l'unica cosa che può ancora
     comparire qui, ed è una riga sola: `localStorage` sparisce insieme ai
     dati di navigazione, e mesi di ripasso sparirebbero con lui. Non è una
     scheda e non chiede niente: dice dov'è il comando e si toglie. */
  if (store.shouldOfferBackup()) {
    root.append(el('p', { class: 'home-note' },
      'Hace tiempo que no guardas una copia de tu progreso. ',
      el('a', { class: 'link-quiet', href: '#/ajustes' }, 'Guardarla en Ajustes')));
  }
}

/* ---------- L'espressione del giorno ----------

   Si pesca dal vocabolario e dalle frasi delle lezioni già aperte, cioè da
   quello che è entrato nel ripasso. Cambia una volta al giorno e non a ogni
   ricaricamento: un'espressione che salta a ogni tocco non è «del giorno»,
   è rumore. Se non c'è ancora niente, il sito si presenta con l'espressione
   da cui prende il nome. */

function expression() {
  const scelta = pickOfTheDay(srs.allItems());
  const primo = scelta === null;

  const italiano = primo ? 'pian piano' : scelta.text;
  const spagnolo = primo ? 'poco a poco' : scelta.es;

  const block = el('section', { class: 'expression' },
    el('p', { class: 'eyebrow' }, primo ? 'tu primera expresión' : 'expresión del día'),
    el('p', { class: 'expression-it', lang: 'it' }, italiano),
    el('p', { class: 'expression-es' },
      el('span', null, spagnolo),
      tts.available() ? el('button', {
        type: 'button',
        class: 'speak-link',
        'aria-label': `Escuchar: ${italiano}`,
        onclick: () => tts.speak(italiano)
      }, 'escuchar') : null)
  );

  if (primo) {
    block.append(el('p', { class: 'expression-why' },
      'El curso se llama así: ',
      el('span', { class: 'it', lang: 'it' }, 'pian piano'),
      ' es lo que se dice en italiano cuando algo se hace despacio y sale bien. ',
      'Un poco cada día.'));
  }

  return block;
}

/* Sempre la stessa per tutto il giorno, diversa domani: l'indice si ricava
   dalla data, non dal caso. */
function pickOfTheDay(items) {
  if (!items.length) return null;
  const iso = todayISO();
  let n = 0;
  for (let i = 0; i < iso.length; i++) n = (n * 31 + iso.charCodeAt(i)) % 1000003;
  const item = items[n % items.length];
  return {
    text: item.kind === 'vocab' ? withArticle(item.it, item.gender) : item.it,
    es: item.es
  };
}

/* ---------- Avanzamento: una barra da 3px e una riga sola ----------

   Nessun contatore, nessuna percentuale in grande, e soprattutto nessuno
   zero: il primo giorno la riga dice a che punto si comincia, non quanto
   non è stato fatto. */

function progressBlock(course, progress) {
  const next = nextLesson(course);

  let riga;
  if (!next) {
    riga = `Las ${progress.total} lecciones, hechas · ${course.modules.length} módulos`;
  } else {
    riga = `Lección ${next.lessonNumber} de ${progress.total} · ` +
      `módulo ${next.moduleNumber} de ${course.modules.length}`;
  }

  return el('section', { class: 'home-progress' },
    el('div', {
      class: 'progress',
      role: 'progressbar',
      'aria-valuenow': String(progress.percent),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `Progreso del curso: ${progress.percent}%`
    }, el('span', { style: `width:${progress.percent}%` })),
    el('p', { class: 'line' }, riga));
}

/* La prima lezione non ancora completata, con la sua posizione nel corso. */
function nextLesson(course) {
  let lessonNumber = 0;
  for (let m = 0; m < course.modules.length; m++) {
    const module = course.modules[m];
    for (const lesson of module.lessons) {
      lessonNumber += 1;
      if (store.lessonStatus(lesson.id) !== 'completada') {
        return { lesson, module, lessonNumber, moduleNumber: m + 1 };
      }
    }
  }
  return null;
}

/* ---------- L'azione: un solo pulsante ----------

   È l'unico elemento in --accent della schermata. Il ripasso in sospeso lo
   accompagna come collegamento attenuato, non come secondo pulsante: due
   pulsanti pieni sono due decisioni, e all'apertura ne basta una. */

function action(ctx, course, due) {
  const next = nextLesson(course);
  const first = store.isEmpty();

  const block = el('section', { class: 'home-action' });

  if (next) {
    block.append(el('a', {
      class: 'btn primary btn-block',
      href: `#/lezione/${next.lesson.id}`
    }, first ? 'Empezar' : `Continuar: ${next.lesson.title}`));
  } else {
    block.append(el('a', { class: 'btn primary btn-block', href: '#/repaso' }, 'Ir al repaso'));
  }

  if (due > 0) {
    block.append(el('p', { class: 'aside' },
      el('a', { class: 'link-quiet', href: '#/repaso' },
        due === 1 ? '1 palabra espera repaso' : `${due} palabras esperan repaso`)));
  } else if (!first && tts.available() && srs.allItems().length >= 4) {
    // Niente da ripassare: al posto del ripasso si offre l'ascolto, che è
    // la cosa che si può fare comunque.
    block.append(el('p', { class: 'aside' },
      el('a', { class: 'link-quiet', href: '#/escucha' }, 'escuchar sin mirar')));
  }

  return block;
}

/* ---------- L'indice ----------

   Undici righe di testo. Un indice si scorre con l'occhio; sei schede no.
   La descrizione del modulo non sta qui: sta nella pagina del modulo. */

function index(course) {
  const section = el('section', { class: 'section' },
    el('h2', null, 'el camino'));

  const list = el('ul', { class: 'index-list' });

  course.modules.forEach((module, i) => {
    const p = store.moduleProgress(module);
    const iniziato = module.lessons.some((l) => store.lessonStatus(l.id) !== 'no-iniciada');

    list.append(el('li', null,
      el('a', { class: 'index-row', href: `#/modulo/${module.id}` },
        el('span', {
          class: 'index-num' + (iniziato ? ' started' : ''),
          'aria-hidden': 'true'
        }, String(i + 1)),
        el('span', { class: 'index-title' },
          el('span', { class: 'sr-only' }, `Módulo ${i + 1}: `),
          module.title),
        // A zero non si scrive «0/4»: il conteggio compare quando c'è
        // qualcosa da contare.
        p.done > 0
          ? el('span', { class: 'index-count' },
            el('span', { 'aria-hidden': 'true' }, `${p.done}/${p.total}`),
            el('span', { class: 'sr-only' }, `${p.done} de ${p.total} lecciones`))
          : null)));
  });

  section.append(list);
  return section;
}
