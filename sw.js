/* Service worker di Pian piano.

   Sta nella radice e viene registrato con un percorso relativo (`./sw.js`),
   così sotto /pianpiano/ il suo ambito è /pianpiano/ e non la radice del
   dominio: su GitHub Pages il sito non è mai da solo sul suo host.

   Strategia: cache-first per tutto quello che serve a giocare una lezione.
   Il contenuto è fisso e versionato, quindi la copia locale è sempre buona
   finché non cambia il nome della cache. Chi decide quando aggiornare è
   l'utente, con l'avviso in pagina: mai a metà di un esercizio.

   La parte finale del nome della cache è l'impronta dei file in cache: la
   riscrive `node tools/stamp-sw.mjs`, e la CI controlla che sia aggiornata.
   Non modificarla a mano. Se cambia la struttura della cache si alza il
   `v1` del prefisso, dentro tools/stamp-sw.mjs. */

const CACHE = 'pianpiano-v1-dd6a62f3';

/* Guscio dell'applicazione. I file delle lezioni non stanno qui:
   si ricavano da course.json, così aggiungerne una non obbliga
   a ricordarsi di toccare anche questo elenco. */
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/diff.js',
  './js/pwa.js',
  './js/srs.js',
  './js/store.js',
  './js/tts.js',
  './js/util.js',
  './js/exercises/index.js',
  './js/exercises/fill-in-the-blank.js',
  './js/exercises/listening.js',
  './js/exercises/matching.js',
  './js/exercises/multiple-choice.js',
  './js/exercises/translation.js',
  './js/exercises/word-order.js',
  './js/render/home.js',
  './js/render/lesson.js',
  './js/render/listen.js',
  './js/render/module.js',
  './js/render/rebels.js',
  './js/render/review.js',
  // I font vanno in cache come tutto il resto: offline il sito non deve
  // ricadere sui caratteri di sistema, o cambia faccia da un giorno all'altro.
  './assets/fonts/newsreader-latin-variable.woff2',
  './assets/fonts/newsreader-latin-italic-variable.woff2',
  './assets/fonts/publicsans-latin-variable.woff2',
  './assets/fonts/publicsans-latin-italic-variable.woff2',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './assets/icons/favicon-16.png',
  './data/course.json'
];

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);

  // Tutte le lezioni, lette dall'indice del corso: dopo la prima visita
  // il sito funziona senza rete, anche su lezioni mai aperte.
  try {
    const response = await cache.match('./data/course.json');
    const course = await response.json();
    const lessons = course.modules.flatMap((m) => m.lessons.map((l) => './' + l.file));
    await cache.addAll(lessons);
  } catch (err) {
    // Se l'indice non si legge, il guscio è comunque installato:
    // meglio un sito parzialmente offline che nessun service worker.
  }
}

self.addEventListener('install', (event) => {
  // Niente skipWaiting: la versione nuova aspetta il via libera dell'utente.
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => (name === CACHE ? null : caches.delete(name))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      // Si mette da parte quello che manca all'elenco (una lezione nuova,
      // un font aggiunto dopo l'installazione).
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      // Offline e non in cache: per una pagina si torna all'index,
      // che il router sa gestire da solo.
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

// L'avviso in pagina chiede di passare alla versione nuova.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
