/* «Tus palabras rebeldes»: le voci che si sbagliano più spesso.

   Il punto non è la classifica, è poterci lavorare: da qui parte un ripasso
   che contiene solo quelle. E finché i dati non bastano non si mostra
   nessuna graduatoria, perché una percentuale calcolata su tre tentativi
   dice soltanto che si è appena cominciato. */

import { el, clear, withArticle } from '../util.js';
import * as srs from '../srs.js';
import * as tts from '../tts.js';

const HOW_MANY = 10;

export function render(root, ctx) {
  clear(root);
  root.append(el('p', { class: 'breadcrumb' },
    el('a', { href: '#/' }, 'Inicio'), ' › Palabras rebeldes'));

  root.append(el('h1', null, 'Tus palabras rebeldes'));

  /* --- Non ci sono ancora abbastanza dati --- */
  if (!srs.hasEnoughData()) {
    const fatti = srs.totalAttempts();
    const mancano = srs.REBELS_MIN_ATTEMPTS - fatti;
    root.append(el('section', { class: 'card empty-state' },
      el('p', { class: 'empty-mark', 'aria-hidden': 'true' }, '◌'),
      el('p', { class: 'empty-lead' }, 'Todavía es pronto para esta lista.'),
      el('p', { class: 'small muted' },
        `Llevas ${fatti} ${fatti === 1 ? 'respuesta' : 'respuestas'} de repaso. `,
        `Con ${mancano} más ya se puede ver qué palabras se te resisten de verdad: `,
        'antes de eso, una lista de fallos sería casualidad, no un patrón.'),
      el('div', { class: 'btn-row', style: 'justify-content:center' },
        el('a', { class: 'btn primary', href: '#/repaso' }, 'Ir al repaso'),
        el('a', { class: 'btn', href: '#/' }, 'Volver al inicio'))));
    return;
  }

  const lista = srs.rebels(HOW_MANY);

  /* --- Dati sufficienti, ma nessun errore: è una buona notizia --- */
  if (lista.length === 0) {
    root.append(el('section', { class: 'card empty-state' },
      el('p', { class: 'empty-mark', 'aria-hidden': 'true' }, '✓'),
      el('p', { class: 'empty-lead' }, 'Ninguna palabra se te resiste.'),
      el('p', { class: 'small muted' },
        `Llevas ${srs.totalAttempts()} respuestas de repaso y ni un fallo pendiente. `,
        'Cuando falles alguna, aparecerá aquí para que puedas insistir solo en esa.'),
      el('div', { class: 'btn-row', style: 'justify-content:center' },
        el('a', { class: 'btn primary', href: '#/repaso' }, 'Seguir repasando'))));
    return;
  }

  root.append(el('p', { class: 'muted rebels-lead' },
    'Las que más se te resisten, de más a menos. ',
    'No es una regañina: es dónde conviene insistir.'));

  const list = el('ol', { class: 'rebels-list' });

  lista.forEach((item) => {
    const percentuale = Math.round(srs.errorRate(item) * 100);
    const italiano = item.kind === 'vocab' ? withArticle(item.it, item.gender) : item.it;

    const riga = el('li', { class: 'rebel' },
      el('div', { class: 'rebel-main' },
        el('span', { class: 'it', lang: 'it' }, italiano),
        tts.available() ? tts.audioControls(item.it, italiano) : null,
        el('span', { class: 'es' }, item.es)),
      el('div', { class: 'rebel-stats' },
        el('span', {
          class: 'rebel-rate',
          // La percentuale da sola è muta: si dice anche a parole.
          'aria-label': `${percentuale} por ciento de fallos, ${item.errors} de ${item.attempts} intentos`
        }, `${percentuale}%`),
        el('span', { class: 'rebel-count', 'aria-hidden': 'true' },
          `${item.errors}/${item.attempts}`))
    );

    if (item.note) riga.append(el('p', { class: 'rebel-note' }, item.note));
    list.append(riga);
  });

  root.append(list);

  root.append(el('div', { class: 'btn-row', style: 'margin-top:1.2rem' },
    el('a', {
      class: 'btn primary',
      href: '#/repaso/rebeldes'
    }, `Repasar solo estas ${lista.length}`),
    el('a', { class: 'btn', href: '#/repaso' }, 'Repaso normal')));

  root.append(el('p', { class: 'small muted', style: 'margin-top:1rem' },
    'El porcentaje cuenta todas las veces que ha salido en el repaso. ',
    'Una palabra sale de esta lista en cuanto empiezas a acertarla.'));
}
