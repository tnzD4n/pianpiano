/* Pagina di un modulo: elenco delle sue lezioni con lo stato di ciascuna. */

import { el, clear } from '../util.js';
import * as store from '../store.js';

export function render(root, ctx, moduleId) {
  clear(root);
  const index = ctx.course.modules.findIndex((m) => m.id === moduleId);
  const module = ctx.course.modules[index];

  if (!module) {
    root.append(el('div', { class: 'card notice' },
      el('h1', null, 'Módulo no encontrado'),
      el('p', null, 'Ese módulo no existe. ', el('a', { href: '#/' }, 'Volver al inicio.'))));
    return;
  }

  const progress = store.moduleProgress(module);

  root.append(
    el('p', { class: 'breadcrumb' }, el('a', { href: '#/' }, 'Inicio'), ' › ', module.title),
    el('h1', null, module.title),
    el('p', { class: 'muted' }, module.goal),
    el('div', { class: 'progress' }, el('span', { style: `width:${progress.percent}%` })),
    el('p', { class: 'small muted' }, `${progress.done} de ${progress.total} lecciones completadas`)
  );

  const list = el('ul', { class: 'lesson-list' });
  module.lessons.forEach((lesson, i) => {
    const status = store.lessonStatus(lesson.id);
    list.append(el('li', { class: 'lesson-item' },
      el('a', { href: `#/lezione/${lesson.id}` },
        el('div', { class: 'head' },
          el('h3', null, `${i + 1}. ${lesson.title}`),
          el('span', { class: `status ${status}` }, store.STATUS_LABEL[status])),
        lesson.grammar ? el('p', { class: 'hint' }, lesson.grammar) : null
      )));
  });
  root.append(list);

  const prev = ctx.course.modules[index - 1];
  const next = ctx.course.modules[index + 1];
  const nav = el('div', { class: 'btn-row', style: 'margin-top:1.5rem' });
  if (prev) nav.append(el('a', { class: 'btn', href: `#/modulo/${prev.id}` }, '← ' + prev.title));
  if (next) nav.append(el('a', { class: 'btn', href: `#/modulo/${next.id}` }, next.title + ' →'));
  root.append(nav);
}
