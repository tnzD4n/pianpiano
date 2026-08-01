/* Ajustes: tema, dati e numeri.

   Tutto quello che stava in fondo alla pagina iniziale e non c'entrava
   niente con l'aprire una lezione. Statistiche e serie di giorni compresi:
   sono cose che si vanno a guardare, non cose che ti accolgono. */

import { el, clear, todayISO } from '../util.js';
import * as store from '../store.js';
import * as srs from '../srs.js';

export function render(root, ctx) {
  clear(root);

  root.append(
    el('p', { class: 'page-eyebrow' }, 'ajustes'),
    el('h1', { class: 'page-title' }, 'Tu curso, tu navegador')
  );

  root.append(figures(ctx));
  root.append(theme());
  root.append(data(ctx));

  const line = backupLine();
  if (line) root.append(line);
}

/* ---------- I numeri ---------- */

function figures(ctx) {
  const progress = store.globalProgress(ctx.course);
  const streak = store.currentStreak();
  const learned = srs.stats().total;
  const due = srs.dueCount();

  const section = el('section', { class: 'section' }, el('h2', null, 'dónde vas'));
  const list = el('ul', { class: 'figures' });

  const row = (label, value) => el('li', null,
    el('span', { class: 'label' }, label),
    el('span', { class: 'value' }, value));

  list.append(row('Lecciones completadas', `${progress.done} de ${progress.total}`));
  list.append(row('Palabras y frases en circulación', String(learned)));
  if (due > 0) list.append(row('Esperan repaso hoy', String(due)));
  if (streak > 0) {
    list.append(row('Días seguidos', streak === 1 ? '1 día' : `${streak} días`));
  }

  section.append(list);

  if (learned === 0) {
    section.append(el('p', { class: 'small muted', style: 'margin-top:13px' },
      'Los números empiezan a llenarse en cuanto abres la primera lección.'));
  }

  return section;
}

/* ---------- Tema ----------

   Tre pulsanti di testo in fila. Il gruppo si annuncia con il suo nome, e
   ogni pulsante dice da sé se è quello attivo (`aria-pressed`). Niente
   fieldset, niente cornice: era un controllo da modulo del 1998. */

function theme() {
  const opzioni = [
    ['auto', 'Automático'],
    ['light', 'Claro'],
    ['dark', 'Oscuro']
  ];

  const row = el('div', {
    class: 'theme-row',
    role: 'group',
    'aria-labelledby': 'tema-label'
  });

  const bottoni = [];
  const sync = () => {
    const attuale = store.getTheme();
    bottoni.forEach(({ value, node }) => {
      node.setAttribute('aria-pressed', value === attuale ? 'true' : 'false');
    });
  };

  opzioni.forEach(([value, etichetta]) => {
    const node = el('button', {
      type: 'button',
      class: 'theme-btn',
      onclick: () => { store.setTheme(value); sync(); }
    }, etichetta);
    bottoni.push({ value, node });
    row.append(node);
  });
  sync();

  return el('section', { class: 'section' },
    el('h2', { id: 'tema-label' }, 'tema'),
    row,
    el('p', { class: 'small muted', style: 'margin-top:13px' },
      'Con «automático» sigue la preferencia de tu sistema.'));
}

/* ---------- Dati ---------- */

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

function data(ctx) {
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
          class: 'btn',
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

  /* Il comando distruttivo resta neutro come tutti gli altri: l'arancione è
     il colore dell'errore negli esercizi, non una decorazione. Quello che
     lo difende è la conferma, non il colore. */
  const reiniciar = () => {
    const ok = window.confirm(
      '¿Seguro que quieres reiniciar? Se borrarán todas las lecciones completadas y todo el repaso. Esto no se puede deshacer.'
    );
    if (!ok) return;
    store.resetAll();
    ctx.rerender();
  };

  return el('section', { class: 'section' },
    el('h2', null, 'tus datos'),
    el('p', { class: 'prose' },
      'Todo se guarda en este navegador y en ningún sitio más: no se sincroniza entre dispositivos. ',
      'Si cambias de aparato o borras los datos de navegación, guarda antes una copia e impórtala después.'),
    el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn', onclick: exportar }, 'Guardar una copia'),
      el('button', { type: 'button', class: 'btn', onclick: () => fileInput.click() }, 'Importar una copia'),
      el('button', { type: 'button', class: 'btn', onclick: reiniciar }, 'Reiniciar')
    ),
    el('label', { class: 'sr-only', for: 'import-file' }, 'Archivo de progreso para importar'),
    fileInput,
    choice,
    message
  );
}

/* Riga discreta in fondo. Dopo due settimane smette di essere discreta: è
   il momento in cui una perdita comincia a costare davvero. */
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
