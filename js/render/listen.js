/* Modalità solo-ascolto.

   La voce legge l'italiano, lei sceglie fra quattro traduzioni spagnole.
   Pensata per lo schermo grande e le mani occupate: pulsanti larghi, un
   solo gesto per rispondere, e l'italiano *scritto* non compare mai prima
   della risposta — altrimenti si legge invece di ascoltare, e l'esercizio
   non allena più niente.

   Senza una voce it-IT questa schermata non esiste: non ci si arriva dalla
   pagina iniziale e la rotta rimanda al ripasso normale (vedi app.js). */

import { el, clear, shuffle, withArticle } from '../util.js';
import * as srs from '../srs.js';
import * as store from '../store.js';
import * as tts from '../tts.js';

const SESSION_SIZE = 20;
const OPTIONS = 4;
// Quanto si aspetta, dopo la risposta, prima di passare al successivo.
const PAUSA_DOPO_RISPOSTA = 1600;

export function render(root, ctx) {
  clear(root);
  const pool = srs.allItems();

  root.append(el('p', { class: 'page-eyebrow' }, 'solo escuchar'));

  /* Servono almeno quattro voci: tre fanno da distrattori. */
  if (pool.length < OPTIONS) {
    root.append(el('section', { class: 'empty-state' },
      el('p', { class: 'empty-mark', 'aria-hidden': 'true' }, '◌'),
      el('h1', null, 'Todavía no'),
      el('p', { class: 'empty-lead' },
        'Para escuchar hacen falta al menos cuatro palabras en el repaso.'),
      el('p', { class: 'small muted' },
        'Abre una lección: su vocabulario entra aquí en cuanto la abres.'),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/' }, 'Volver al inicio'))));
    return;
  }

  // Prima quello che scade; se non scade niente, si pratica lo stesso.
  const dovute = srs.dueItems();
  const soloPratica = dovute.length === 0;
  const queue = shuffle(soloPratica ? pool : dovute).slice(0, SESSION_SIZE);

  store.touchStreak();

  const heading = el('h1', { class: 'page-title' }, 'Solo escuchar');
  const sottotitolo = el('p', { class: 'page-goal' }, soloPratica
    ? 'Hoy no toca repasar nada: esto es práctica libre, no cuenta para las cajas.'
    : 'Escucha y elige la traducción. Sin mirar: el italiano aparece después.');

  const progressBar = el('div', { class: 'progress' }, el('span', { style: 'width:0%' }));
  const progressText = el('p', { class: 'small muted', style: 'margin:13px 0 0' });
  const stage = el('div', { class: 'listen-stage' });

  root.append(heading, sottotitolo, progressBar, progressText, stage);

  let position = 0;
  let giuste = 0;
  let inPausa = false;
  let timer = null;

  const stopTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };

  /* Uscendo dalla schermata la voce deve tacere: senza questo continua a
     parlare mentre si naviga altrove. */
  const abbandona = () => {
    stopTimer();
    tts.cancel();
    window.removeEventListener('hashchange', abbandona);
  };
  window.addEventListener('hashchange', abbandona);

  const mostra = () => {
    stopTimer();
    clear(stage);
    if (position >= queue.length) return finisci();

    const item = queue[position];
    const testo = item.kind === 'vocab' ? withArticle(item.it, item.gender) : item.it;
    let risposto = false;

    progressText.textContent = `${position + 1} de ${queue.length}`;
    progressBar.firstChild.style.width = `${Math.round((position / queue.length) * 100)}%`;

    /* Le quattro opzioni: la giusta più tre traduzioni di altre voci.
       Si pescano fra quelle dello stesso tipo, così non capita di dover
       scegliere fra una parola sola e tre frasi intere. */
    const altri = pool.filter((p) => p.id !== item.id && p.kind === item.kind);
    const fonte = altri.length >= OPTIONS - 1 ? altri : pool.filter((p) => p.id !== item.id);
    const distrattori = shuffle(fonte).slice(0, OPTIONS - 1).map((p) => p.es);
    const opzioni = shuffle([item.es, ...distrattori]);

    const card = el('article');

    // L'italiano scritto sta qui ma coperto: si scopre solo dopo la risposta.
    const rivelazione = el('p', { class: 'listen-reveal', hidden: true, lang: 'it' }, testo);

    const stato = el('p', { class: 'listen-state', role: 'status', 'aria-live': 'polite' },
      'Escuchando…');

    const bottoni = [];
    const griglia = el('div', { class: 'listen-options' });

    const rispondi = (scelta, bottone) => {
      if (risposto || inPausa) return;
      risposto = true;
      const corretta = scelta === item.es;
      if (corretta) giuste += 1;

      // In pratica libera non si tocca la programmazione del ripasso,
      // ma i contatori delle «rebeldes» contano lo stesso.
      if (soloPratica) srs.countAttempt(item.id, corretta);
      else srs.grade(item.id, corretta);
      ctx.refreshBadge();

      bottoni.forEach((b) => {
        b.disabled = true;
        if (b.dataset.value === item.es) b.classList.add('is-ok');
        else if (b === bottone) b.classList.add('is-bad');
      });

      rivelazione.hidden = false;
      stato.textContent = corretta
        ? `✓ Correcto: «${testo}»`
        : `✗ Era «${testo}» — ${item.es}`;
      stato.className = 'listen-state ' + (corretta ? 'ok' : 'bad');

      // Avanzamento automatico, a meno che non sia in pausa.
      timer = setTimeout(() => {
        position += 1;
        mostra();
      }, PAUSA_DOPO_RISPOSTA);
    };

    opzioni.forEach((testoOpzione) => {
      const b = el('button', {
        type: 'button',
        class: 'listen-option',
        lang: 'es',
        'data-value': testoOpzione,
        onclick: (event) => rispondi(testoOpzione, event.currentTarget)
      }, testoOpzione);
      bottoni.push(b);
      griglia.append(b);
    });

    const parla = () => {
      if (inPausa) return;
      stato.textContent = 'Escuchando…';
      stato.className = 'listen-state';
      tts.speak(item.it, 1, () => {
        if (!risposto && !inPausa) stato.textContent = 'Elige la traducción.';
      });
    };

    const comandi = el('div', { class: 'listen-controls' },
      el('button', {
        type: 'button',
        class: 'btn listen-again',
        onclick: () => { if (!inPausa) tts.speak(item.it, 1); }
      }, '🔊 Repetir'),
      el('button', {
        type: 'button',
        class: 'btn listen-slow',
        onclick: () => { if (!inPausa) tts.speak(item.it, 0.7); }
      }, '🐢 Despacio'),
      pausaBottone()
    );

    card.append(stato, griglia, rivelazione, comandi);
    stage.append(card);

    parla();
  };

  /* Il pulsante di pausa ferma la voce e blocca l'avanzamento automatico.
     Si ricrea a ogni item ma legge sempre la stessa variabile. */
  function pausaBottone() {
    const b = el('button', { type: 'button', class: 'btn listen-pause' },
      inPausa ? '▶ Reanudar' : '⏸ Pausa');
    b.setAttribute('aria-pressed', inPausa ? 'true' : 'false');
    b.addEventListener('click', () => {
      inPausa = !inPausa;
      b.textContent = inPausa ? '▶ Reanudar' : '⏸ Pausa';
      b.setAttribute('aria-pressed', inPausa ? 'true' : 'false');
      if (inPausa) {
        stopTimer();
        tts.cancel();
      }
    });
    return b;
  }

  const finisci = () => {
    abbandona();
    progressText.textContent = '';
    progressBar.firstChild.style.width = '100%';
    clear(stage);
    stage.append(el('div', { class: 'review-done' },
      el('p', { class: 'big', lang: 'it' }, 'Pian piano.'),
      el('p', null, `Has acertado ${giuste} de ${queue.length} solo de oído.`),
      el('p', { class: 'small muted' }, soloPratica
        ? 'Era práctica libre: el repaso sigue como estaba.'
        : 'Lo que has fallado vuelve pronto; lo que has acertado, más adelante.'),
      el('div', { class: 'btn-row' },
        el('a', { class: 'btn primary', href: '#/' }, 'Volver al inicio'),
        el('button', {
          type: 'button',
          class: 'btn',
          onclick: () => render(root, ctx)
        }, 'Otra ronda'))));
  };

  mostra();
}
