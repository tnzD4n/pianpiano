/* Avvio e router.
   Le rotte sono nell'hash, così GitHub Pages serve sempre lo stesso index.html:
     #/                  pagina iniziale
     #/modulo/m03        elenco delle lezioni di un modulo
     #/lezione/m03-l02   una lezione
     #/repaso            sessione di ripasso                                  */

import { el, clear } from './util.js';
import * as store from './store.js';
import * as srs from './srs.js';
import * as tts from './tts.js';
import * as pwa from './pwa.js';
import * as home from './render/home.js';
import * as moduleView from './render/module.js';
import * as lessonView from './render/lesson.js';
import * as reviewView from './render/review.js';
import * as rebelsView from './render/rebels.js';
import * as listenView from './render/listen.js';

const main = document.getElementById('main');
const navDue = document.getElementById('nav-due');
const BASE_TITLE = 'Pian piano · Italiano desde cero';

let course = null;
let flatLessons = [];

/* Contesto passato a tutte le viste. */
const ctx = {
  get course() { return course; },
  findLesson,
  nextLesson,
  prevLesson,
  refreshBadge,
  rerender: () => route()
};

function findLesson(id) {
  for (const module of course.modules) {
    const lesson = module.lessons.find((l) => l.id === id);
    if (lesson) return { module, lesson };
  }
  return null;
}

function nextLesson(id) {
  const i = flatLessons.findIndex((l) => l.id === id);
  return i >= 0 ? flatLessons[i + 1] || null : null;
}

function prevLesson(id) {
  const i = flatLessons.findIndex((l) => l.id === id);
  return i > 0 ? flatLessons[i - 1] : null;
}

function refreshBadge() {
  const due = srs.dueCount();
  navDue.textContent = String(due);
  navDue.hidden = due === 0;
}

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'home' };
  if (parts[0] === 'modulo' && parts[1]) return { name: 'module', id: parts[1] };
  if (parts[0] === 'lezione' && parts[1]) return { name: 'lesson', id: parts[1] };
  // #/repaso            sessione normale
  // #/repaso/rebeldes   solo le voci più sbagliate
  if (parts[0] === 'repaso') return { name: 'review', mode: parts[1] || null };
  if (parts[0] === 'rebeldes') return { name: 'rebels' };
  if (parts[0] === 'escucha') return { name: 'listen' };
  return { name: 'unknown' };
}

function markNav(name) {
  document.querySelectorAll('.site-nav a').forEach((link) => {
    const target = link.dataset.nav;
    const active = (name === 'home' && target === 'home') || (name === 'review' && target === 'review');
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function route() {
  const r = parseHash();
  refreshBadge();
  markNav(r.name);
  window.scrollTo(0, 0);

  if (r.name === 'module') {
    const found = course.modules.find((m) => m.id === r.id);
    document.title = found ? `${found.title} · ${BASE_TITLE}` : BASE_TITLE;
    moduleView.render(main, ctx, r.id);
    return;
  }
  if (r.name === 'lesson') {
    const found = findLesson(r.id);
    document.title = found ? `${found.lesson.title} · ${BASE_TITLE}` : BASE_TITLE;
    lessonView.render(main, ctx, r.id);
    return;
  }
  if (r.name === 'review') {
    document.title = `Repaso · ${BASE_TITLE}`;
    reviewView.render(main, ctx, { mode: r.mode });
    return;
  }
  if (r.name === 'rebels') {
    document.title = `Palabras rebeldes · ${BASE_TITLE}`;
    rebelsView.render(main, ctx);
    return;
  }
  if (r.name === 'listen') {
    // Senza voce italiana la modalità non esiste: chi ci arriva con un
    // segnalibro o con il tasto indietro finisce nel ripasso normale,
    // non su una schermata rotta.
    if (!tts.available()) {
      location.replace('#/repaso');
      return;
    }
    document.title = `Solo escuchar · ${BASE_TITLE}`;
    listenView.render(main, ctx);
    return;
  }
  if (r.name === 'unknown') {
    document.title = BASE_TITLE;
    clear(main);
    // h1 e non h2: ogni pagina deve avere un titolo di primo livello,
    // anche quella di errore.
    main.append(el('div', { class: 'card notice' },
      el('h1', null, 'Página no encontrada'),
      el('p', null, 'Esa dirección no existe. ', el('a', { href: '#/' }, 'Volver al inicio.'))));
    return;
  }
  document.title = BASE_TITLE;
  home.render(main, ctx);
}

async function boot() {
  /* Lo script inline nel <head> ha già messo `data-theme` per non far
     lampeggiare il bianco. Qui si riallinea la barra di stato del telefono
     al colore del tema, cosa che richiede il CSS già applicato. */
  store.applyTheme(store.getTheme());

  try {
    const response = await fetch('data/course.json', { cache: 'no-cache' });
    course = await response.json();
  } catch (err) {
    clear(main);
    main.append(el('div', { class: 'card notice' },
      el('h2', null, 'No se ha podido cargar el curso'),
      el('p', null, 'Falta el archivo de datos o el servidor no responde. Vuelve a cargar la página.')));
    return;
  }

  flatLessons = course.modules.flatMap((m) => m.lessons);

  // Senza voce italiana i controlli audio spariscono (regola in CSS)
  // e gli esercizi di ascolto non vengono creati.
  await tts.ready();
  if (!tts.available()) document.body.classList.add('no-tts');

  window.addEventListener('hashchange', route);
  route();

  // Per ultimo: l'uso offline è un di più, non deve ritardare la prima pagina.
  pwa.register();
}

boot();
