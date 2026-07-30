/* Pagina iniziale: avanzamento globale, serie di giorni, ripasso di oggi,
   elenco dei moduli e gestione dei dati. */

import { el, clear, todayISO } from '../util.js';
import * as store from '../store.js';
import * as srs from '../srs.js';
import * as tts from '../tts.js';

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

  /* --- Copia di sicurezza, se è il momento di proporla --- */
  const offer = backupOffer(ctx);
  if (offer) root.append(offer);

  /* --- Ripasso di oggi --- */
  const reviewCard = el('section', { class: 'card' }, el('h2', null, 'Repaso de hoy'));
  if (learned === 0) {
    reviewCard.append(el('p', { class: 'muted' },
      'Todavía no hay nada en el repaso. Empieza por la primera lección: el vocabulario y las frases entran solos.'));
  } else if (due === 0) {
    // Niente da fare oggi è un risultato, non un vuoto: si dice così.
    reviewCard.append(el('p', { class: 'nothing-due' },
      el('span', { class: 'nd-mark', 'aria-hidden': 'true' }, '✓'),
      el('span', null,
        el('strong', null, 'Nada pendiente. '),
        `Has repasado todo lo que tocaba. Las ${learned} palabras y frases que llevas vuelven cuando toque.`)));
  } else {
    reviewCard.append(
      el('p', null, `Tienes ${due} ${due === 1 ? 'elemento pendiente' : 'elementos pendientes'} de repaso.`),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/repaso' }, 'Empezar el repaso'))
    );
  }

  /* La modalità solo-ascolto compare soltanto se c'è davvero una voce
     italiana: proporla e poi non farla funzionare sarebbe peggio che non
     averla. Stessa regola degli esercizi di dettato. */
  if (learned >= 4 && tts.available()) {
    reviewCard.append(el('p', { class: 'listen-entry' },
      el('a', { href: '#/escucha' }, '🎧 Solo escuchar'),
      el('span', { class: 'small muted' },
        ' — la voz lee, tú eliges la traducción. Para las manos ocupadas.')));
  }

  root.append(reviewCard);

  /* --- Palabras rebeldes --- */
  if (srs.totalAttempts() > 0) {
    const ribelli = srs.rebels(3);
    const card = el('section', { class: 'card' }, el('h2', null, 'Tus palabras rebeldes'));
    if (!srs.hasEnoughData()) {
      card.append(el('p', { class: 'muted small' },
        `Con ${srs.REBELS_MIN_ATTEMPTS - srs.totalAttempts()} respuestas más se puede ver qué palabras se te resisten.`));
    } else if (ribelli.length === 0) {
      card.append(el('p', { class: 'muted small' }, 'Ninguna se te resiste ahora mismo.'));
    } else {
      card.append(
        el('p', { class: 'rebels-peek' }, ribelli.map((r, i) =>
          el('span', { class: 'peek', lang: 'it' }, r.it, i < ribelli.length - 1 ? ', ' : ''))),
        el('div', { class: 'btn-row' },
          el('a', { class: 'btn', href: '#/rebeldes' }, 'Ver las 10 más rebeldes')));
    }
    root.append(card);
  }

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

  const line = backupLine();
  if (line) root.append(line);
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

/* Scarica il file di progresso e segna la data della copia. */
export function downloadBackup() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: `pian-piano-progreso-${todayISO()}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  store.markBackupDone();
}

/* Proposta di copia, ogni 5 lezioni completate. Non blocca niente: è una
   scheda in più che si può ignorare, e «Ahora no» la nasconde fino alla
   prossima visita. `localStorage` sparisce insieme ai dati di navigazione,
   e tre mesi di ripasso sparirebbero con lui senza un file da qualche parte. */
function backupOffer(ctx) {
  if (!store.shouldOfferBackup()) return null;
  if (sessionStorage.getItem('pianpiano.backup-dismissed')) return null;

  const info = store.backupInfo();
  const motivo = info.lastAt === null
    ? `Llevas ${store.completedCount()} lecciones y todavía no has guardado ninguna copia.`
    : info.lessonsSince >= 5
      ? `Has completado ${info.lessonsSince} lecciones desde tu última copia.`
      : `Tu última copia es de hace ${info.daysAgo} días.`;

  const card = el('section', { class: 'card backup-offer' },
    el('h2', null, 'Guarda una copia'),
    el('p', null, motivo, ' Tu progreso vive solo en este navegador: si borras los datos de navegación, se pierde.'),
    el('div', { class: 'btn-row' },
      el('button', {
        type: 'button',
        class: 'btn primary',
        onclick: () => { downloadBackup(); ctx.rerender(); }
      }, 'Descargar copia'),
      el('button', {
        type: 'button',
        class: 'btn',
        onclick: () => {
          sessionStorage.setItem('pianpiano.backup-dismissed', '1');
          ctx.rerender();
        }
      }, 'Ahora no')
    )
  );
  return card;
}

/* Riga discreta in fondo alla pagina. Dopo due settimane smette di essere
   discreta: è il momento in cui una perdita comincia a costare davvero. */
function backupLine() {
  if (store.isEmpty()) return null;
  const info = store.backupInfo();
  const vecchia = info.lastAt === null || info.daysAgo >= 14;

  let testo;
  if (info.lastAt === null) testo = 'Todavía no has guardado ninguna copia de seguridad.';
  else if (info.daysAgo === 0) testo = 'Última copia de seguridad: hoy.';
  else if (info.daysAgo === 1) testo = 'Última copia de seguridad: ayer.';
  else testo = `Última copia de seguridad: hace ${info.daysAgo} días.`;

  return el('p', { class: 'backup-line' + (vecchia ? ' stale' : '') },
    vecchia ? el('span', { 'aria-hidden': 'true' }, '⚑ ') : null,
    testo);
}

function dataTools(ctx) {
  const message = el('p', { class: 'small muted', role: 'status', 'aria-live': 'polite' });
  const choice = el('div');

  /* Importazione: prima si controlla il file, poi — se c'è già qualcosa da
     perdere — si chiede che cosa farne. Mai sovrascrivere di nascosto. */
  const onFile = (text) => {
    clear(choice);
    message.textContent = '';

    let report;
    try {
      report = store.parseBackup(text);
    } catch (err) {
      message.textContent = 'No se ha podido importar. ' + err.message;
      return;
    }

    const plural = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;
    const resumen = `El archivo tiene ${plural(report.lessons, 'lección', 'lecciones')} ` +
      `(${plural(report.completed, 'completada', 'completadas')}) y ` +
      `${plural(report.items, 'palabra o frase', 'palabras y frases')}.`;

    if (store.isEmpty()) {
      store.replaceWith(report.state);
      ctx.rerender();
      return;
    }

    choice.append(el('div', { class: 'import-choice' },
      el('p', null, resumen),
      el('p', { class: 'small muted' },
        'Ya tienes progreso guardado en este navegador. ¿Qué quieres hacer?'),
      el('div', { class: 'btn-row' },
        el('button', {
          type: 'button',
          class: 'btn primary',
          onclick: () => { store.mergeWith(report.state); ctx.rerender(); }
        }, 'Unir los dos'),
        el('button', {
          type: 'button',
          class: 'btn danger',
          onclick: () => {
            const ok = window.confirm('Se borrará el progreso que tienes ahora en este navegador y se quedará solo el del archivo. ¿Seguro?');
            if (!ok) return;
            store.replaceWith(report.state);
            ctx.rerender();
          }
        }, 'Sustituir el mío'),
        el('button', {
          type: 'button',
          class: 'btn',
          onclick: () => { clear(choice); }
        }, 'Cancelar')
      ),
      el('p', { class: 'small muted' },
        'Unir conserva siempre lo más avanzado de los dos: no pierdes nada.')
    ));
  };

  const fileInput = el('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'hidden-file',
    id: 'import-file',
    onchange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onFile(String(reader.result));
      reader.onerror = () => { message.textContent = 'No se ha podido leer el archivo.'; };
      reader.readAsText(file);
      event.target.value = '';
    }
  });

  const exportar = () => {
    downloadBackup();
    message.textContent = 'Copia descargada. Guárdala en un sitio que no sea este navegador.';
    ctx.rerender();
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
      el('button', { type: 'button', class: 'btn', onclick: exportar }, 'Guardar una copia'),
      el('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Importar una copia'),
      el('button', { type: 'button', class: 'btn danger', onclick: reiniciar }, 'Reiniciar')
    ),
    el('label', { class: 'sr-only', for: 'import-file' }, 'Archivo de progreso para importar'),
    fileInput,
    el('p', { class: 'small muted' },
      'Todo se guarda en este navegador y en ningún sitio más. Si cambias de dispositivo o borras los datos de navegación, guarda antes una copia e impórtala después.'),
    choice,
    message
  );
}
