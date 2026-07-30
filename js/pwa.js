/* Registrazione del service worker e avviso di versione nuova.

   Il percorso è relativo (`./sw.js`): sotto /pianpiano/ l'ambito diventa
   /pianpiano/ e non la radice del dominio.

   L'aggiornamento non è mai automatico. Se il sito si ricaricasse da solo
   mentre lei sta scrivendo una risposta, perderebbe il lavoro dell'esercizio
   in corso: la versione nuova aspetta in disparte finché non la accetta. */

import { el } from './util.js';

let ricarico = false;

export function register() {
  if (!('serviceWorker' in navigator)) return;
  // Da file:// non si può registrare nulla: si esce in silenzio.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  // `boot()` è asincrono e finisce dopo l'evento `load`: aspettarlo qui
  // vorrebbe dire non registrare mai niente. Se la pagina è già carica
  // si parte subito.
  if (document.readyState === 'complete') avvia();
  else window.addEventListener('load', avvia, { once: true });
}

async function avvia() {
  let reg;
  try {
    reg = await navigator.serviceWorker.register('./sw.js');
  } catch (err) {
    return;   // niente uso offline, ma il sito funziona lo stesso
  }

  // Una versione nuova può essere già pronta da una visita precedente.
  if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const nuovo = reg.installing;
    if (!nuovo) return;
    nuovo.addEventListener('statechange', () => {
      // `controller` esiste solo se un service worker sta già servendo la
      // pagina: senza, è la prima installazione e non c'è niente da dire.
      if (nuovo.state === 'installed' && navigator.serviceWorker.controller) showBanner(nuovo);
    });
  });

  // Al ritorno sulla scheda si controlla se è uscito qualcosa di nuovo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {});
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (ricarico) return;
    ricarico = true;
    location.reload();
  });
}

function showBanner(worker) {
  if (document.querySelector('.update-banner')) return;

  const banner = el('div', {
    class: 'update-banner',
    role: 'status',
    'aria-live': 'polite'
  },
    el('span', { class: 'update-text' }, 'Hay una versión nueva.'),
    el('button', {
      type: 'button',
      class: 'btn primary btn-small',
      onclick: () => {
        banner.remove();
        // Il service worker in attesa prende il posto del vecchio; il
        // `controllerchange` qui sopra ricarica la pagina subito dopo.
        worker.postMessage('skip-waiting');
      }
    }, 'Recargar'),
    el('button', {
      type: 'button',
      class: 'btn btn-small',
      onclick: () => banner.remove()
    }, 'Ahora no')
  );

  document.body.append(banner);
}
