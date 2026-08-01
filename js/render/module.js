/* Pagina di un modulo: qui sta la descrizione che nell'indice della pagina
   iniziale non c'è, e l'elenco delle sue lezioni con lo stato di ciascuna.
   Righe di testo separate da una linea da 1px: nessuna scheda. */

import { el, clear } from '../util.js';
import * as store from '../store.js';

export function render(root, ctx, moduleId) {
  clear(root);
  const index = ctx.course.modules.findIndex((m) => m.id === moduleId);
  const module = ctx.course.modules[index];

  if (!module) {
    root.append(el('div', { class: 'notice' },
      el('h1', null, 'Módulo no encontrado'),
      el('p', null, 'Ese módulo no existe. ', el('a', { href: '#/' }, 'Volver al inicio.'))));
    return;
  }

  const progress = store.moduleProgress(module);

  root.append(
    el('p', { class: 'page-eyebrow' },
      el('a', { href: '#/' }, 'el camino'), ' · ', `módulo ${index + 1}`),
    el('h1', { class: 'page-title' }, module.title),
    el('p', { class: 'page-goal' }, module.goal),
    el('div', {
      class: 'progress',
      role: 'progressbar',
      'aria-valuenow': String(progress.percent),
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `Progreso del módulo: ${progress.done} de ${progress.total} lecciones`
    }, el('span', { style: `width:${progress.percent}%` }))
  );

  const section = el('section', { class: 'section', style: 'margin-top:26px' },
    el('div', { class: 'section-head' },
      el('h2', null, 'lecciones'),
      el('span', { class: 'count' }, `${progress.total} lecciones`)));

  const list = el('ul', { class: 'lesson-list' });
  module.lessons.forEach((lesson, i) => {
    const status = store.lessonStatus(lesson.id);
    const row = el('a', { class: 'lesson-row', href: `#/lezione/${lesson.id}` },
      el('span', { class: 'lesson-num', 'aria-hidden': 'true' }, String(i + 1)),
      el('span', { class: 'lesson-name' },
        el('span', { class: 'sr-only' }, `Lección ${i + 1}: `),
        lesson.title),
      el('span', { class: `status ${status}` }, store.STATUS_LABEL[status]),
      lesson.grammar ? el('span', { class: 'lesson-hint' }, lesson.grammar) : null);

    list.append(el('li', null, row));
  });
  section.append(list);
  root.append(section);

  const prev = ctx.course.modules[index - 1];
  const next = ctx.course.modules[index + 1];
  const nav = el('div', { class: 'btn-row', style: 'margin-top:42px' });
  if (prev) nav.append(el('a', { class: 'btn btn-small', href: `#/modulo/${prev.id}` }, '← ' + prev.title));
  if (next) nav.append(el('a', { class: 'btn btn-small', href: `#/modulo/${next.id}` }, next.title + ' →'));
  root.append(nav);
}
