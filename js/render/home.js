/* Pagina iniziale: avanzamento globale, serie di giorni, ripasso di oggi,
   elenco dei moduli e gestione dei dati. */

import { el, clear, todayISO } from '../util.js';
import * as store from '../store.js';
import * as srs from '../srs.js';

export function render(root, ctx) {
  clear(root);
  const course = ctx.course;
  const progress = store.globalProgress(course);
  const streak = store.currentStreak();
  const due = srs.dueCount();
  const learned = srs.stats().total;

  root.append(
    el('section', { class: 'hero' },
      el('h1', null, course.meta.title),
      el('p', { class: 'lead' },
        'Curso de italiano desde cero para hispanohablantes. ',
        'Nivel ', course.meta.level, ': ', String(course.modules.length), ' módulos, ',
        String(progress.total), ' lecciones. Un poco cada día.')
    )
  );

  /* --- Avanzamento --- */
  root.append(
    el('section', { class: 'card' },
      el('div', { class: 'stats' },
        stat(progress.percent + '%', 'del curso'),
        stat(`${progress.done}/${progress.total}`, 'lecciones completadas'),
        stat(String(streak), streak === 1 ? 'día seguido' : 'días seguidos'),
        stat(String(learned), 'palabras y frases')
      ),
      bar(progress.percent)
    )
  );

  /* --- Ripasso di oggi --- */
  const reviewCard = el('section', { class: 'card' }, el('h2', null, 'Repaso de hoy'));
  if (learned === 0) {
    reviewCard.append(el('p', { class: 'muted' },
      'Todavía no hay nada en el repaso. Empieza por la primera lección: el vocabulario y las frases entran solos.'));
  } else if (due === 0) {
    reviewCard.append(el('p', { class: 'muted' },
      'Hoy no toca repasar nada. Vuelve mañana o abre una lección nueva.'));
  } else {
    reviewCard.append(
      el('p', null, `Tienes ${due} ${due === 1 ? 'elemento pendiente' : 'elementos pendientes'} de repaso.`),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/repaso' }, 'Empezar el repaso'))
    );
  }
  root.append(reviewCard);

  /* --- Moduli --- */
  root.append(el('div', { class: 'section-title' },
    el('h2', null, 'Módulos'),
    el('span', { class: 'count' }, `${course.modules.length} módulos`)));

  const list = el('ul', { class: 'module-list' });
  course.modules.forEach((module, index) => {
    const p = store.moduleProgress(module);
    list.append(el('li', null,
      el('a', { class: 'module-card', href: `#/modulo/${module.id}` },
        el('span', { class: 'module-num' }, `Módulo ${String(index + 1).padStart(2, '0')}`),
        el('h3', null, module.title),
        el('p', { class: 'goal' }, module.goal),
        bar(p.percent),
        el('p', { class: 'meta' }, `${p.done} de ${p.total} lecciones · ${p.percent}%`)
      )));
  });
  root.append(list);

  /* --- Dati --- */
  root.append(dataTools(ctx));
}

function stat(value, label) {
  return el('div', { class: 'stat' }, el('b', null, value), el('span', null, label));
}

function bar(percent) {
  return el('div', {
    class: 'progress',
    role: 'progressbar',
    'aria-valuenow': String(percent),
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-label': `Progreso: ${percent}%`
  }, el('span', { style: `width:${percent}%` }));
}

function dataTools(ctx) {
  const message = el('p', { class: 'small muted' });

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'hidden-file',
    onchange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          store.importJSON(String(reader.result));
          ctx.rerender();
        } catch (err) {
          message.textContent = 'No se ha podido leer el archivo: no parece un progreso de Pian piano.';
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    }
  });

  const exportar = () => {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = el('a', { href: url, download: `pian-piano-progreso-${todayISO()}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    message.textContent = 'Progreso exportado.';
  };

  const reiniciar = () => {
    const ok = window.confirm(
      '¿Seguro que quieres reiniciar? Se borrarán todas las lecciones completadas y todo el repaso. Esto no se puede deshacer.'
    );
    if (!ok) return;
    store.resetAll();
    ctx.rerender();
  };

  return el('section', { class: 'card data-tools' },
    el('h2', null, 'Tus datos'),
    el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn', onclick: exportar }, 'Exportar progreso'),
      el('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Importar progreso'),
      el('button', { type: 'button', class: 'btn danger', onclick: reiniciar }, 'Reiniciar')
    ),
    fileInput,
    el('p', { class: 'small muted' },
      'Todo se guarda en este navegador y en ningún sitio más. Si cambias de dispositivo o borras los datos de navegación, exporta antes el archivo e impórtalo después.'),
    message
  );
}
