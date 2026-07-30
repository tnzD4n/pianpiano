/* Controlli della classifica «palabras rebeldes» e dei contatori.
   `node tools/test-rebels.mjs` dalla radice del progetto.

   La classifica decide su che cosa passerà il tempo: se ordina male, o se
   mostra percentuali costruite su due tentativi, manda a ripassare le cose
   sbagliate. Vale la pena provarla. */

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const KEY = 'pianpiano.v1';

let passed = 0;
let failed = 0;
function check(label, cond, extra = '') {
  if (cond) { passed += 1; console.log('ok    ' + label); }
  else { failed += 1; console.log('FAIL  ' + label + (extra ? '\n      ' + extra : '')); }
}

// voce: [id, attempts, errors, box]
function voce(id, attempts, errors, box = 2) {
  return [id, {
    id, kind: 'vocab', it: id.slice(2), es: 'trad-' + id.slice(2),
    gender: null, note: null, lesson: 'm01-l01',
    box, due: '2026-08-01',
    right: attempts - errors, wrong: errors,
    attempts, errors
  }];
}

/* I moduli si caricano UNA volta sola: rimportare `srs.js` con una query
   diversa non serve a niente, perché il suo `import './store.js'` resta
   quello di prima e lo stato in memoria non si azzera. Fra uno scenario e
   l'altro si sostituisce lo stato con l'API dello store, che è anche il
   percorso che segue davvero un'importazione. */
globalThis.localStorage = new FakeStorage();
const store = await import('../js/store.js');
const srs = await import('../js/srs.js');

async function carica(srsEntries) {
  store.replaceWith({
    schemaVersion: 3,
    lessons: {},
    srs: Object.fromEntries(srsEntries),
    streak: { current: 1, best: 1, last: '2026-07-30' },
    backup: { lastAt: null, lessonsAt: 0 },
    updatedAt: null
  });
  return { srs, store };
}

/* ---------- 1. Ordinamento per tasso d'errore ---------- */
{
  await carica([
    voce('v:alfa', 10, 9),    // 90%
    voce('v:beta', 10, 5),    // 50%
    voce('v:gamma', 4, 4),    // 100%
    voce('v:delta', 10, 1)    // 10%
  ]);
  const ordine = srs.rebels(10).map((i) => i.id);
  check('ordinate dal tasso più alto al più basso',
    JSON.stringify(ordine) === JSON.stringify(['v:gamma', 'v:alfa', 'v:beta', 'v:delta']),
    JSON.stringify(ordine));
  check('il tasso è errori diviso tentativi',
    Math.abs(srs.errorRate({ attempts: 10, errors: 9 }) - 0.9) < 1e-9);
  check('tasso zero se non ci sono tentativi',
    srs.errorRate({ attempts: 0, errors: 0 }) === 0);
}

/* ---------- 2. A parità di tasso vince chi ha più errori assoluti ---------- */
{
  await carica([
    voce('v:pochi', 2, 1),    // 50%, 1 errore
    voce('v:tanti', 20, 10),  // 50%, 10 errori
    voce('v:medi', 8, 4)      // 50%, 4 errori
  ]);
  const ordine = srs.rebels(10).map((i) => i.id);
  check('a parità di tasso, prima chi sbaglia di più in assoluto',
    JSON.stringify(ordine) === JSON.stringify(['v:tanti', 'v:medi', 'v:pochi']),
    JSON.stringify(ordine));
}

/* ---------- 3. Chi resta fuori dalla classifica ---------- */
{
  await carica([
    voce('v:mai-sbagliata', 12, 0),   // nessun errore: fuori
    voce('v:appena-vista', 1, 1),     // un solo tentativo: fuori
    voce('v:legittima', 6, 3)         // dentro
  ]);
  const ids = srs.rebels(10).map((i) => i.id);
  check('chi non ha mai sbagliato non compare', !ids.includes('v:mai-sbagliata'));
  check('chi ha un solo tentativo non compare', !ids.includes('v:appena-vista'),
    'un 100% costruito su un tentativo è rumore, non un dato');
  check('chi ha una storia vera compare', ids.includes('v:legittima'));
  check('in classifica resta solo quella', ids.length === 1, JSON.stringify(ids));
}

/* ---------- 4. La soglia dei dati sufficienti ---------- */
{
  await carica([voce('v:a', 5, 2), voce('v:b', 5, 1)]);
  check('con 10 tentativi i dati non bastano', srs.hasEnoughData() === false);
  check('totalAttempts somma tutto', srs.totalAttempts() === 10, String(srs.totalAttempts()));
}
{
  await carica([voce('v:a', 12, 2), voce('v:b', 8, 1)]);
  check('con 20 tentativi i dati bastano', srs.hasEnoughData() === true);
  check('la soglia è esposta', srs.REBELS_MIN_ATTEMPTS === 20);
}

/* ---------- 5. Il limite di quante se ne mostrano ---------- */
{
  await carica(
    Array.from({ length: 25 }, (_, i) => voce('v:p' + i, 10, 9 - (i % 5)))
  );
  check('rebels(10) ne restituisce al massimo dieci', srs.rebels(10).length === 10);
  check('rebels(3) ne restituisce tre', srs.rebels(3).length === 3);
}

/* ---------- 6. I contatori crescono nel modo giusto ---------- */
{
  await carica([voce('v:prova', 4, 1, 3)]);

  srs.grade('v:prova', false);
  let item = srs.itemsByIds(['v:prova'])[0];
  check('grade sbagliato: attempts +1', item.attempts === 5, String(item.attempts));
  check('grade sbagliato: errors +1', item.errors === 2, String(item.errors));
  check('grade sbagliato: la scatola torna alla prima', item.box === 1, String(item.box));

  srs.grade('v:prova', true);
  item = srs.itemsByIds(['v:prova'])[0];
  check('grade giusto: attempts +1', item.attempts === 6, String(item.attempts));
  check('grade giusto: errors invariato', item.errors === 2, String(item.errors));
  check('grade giusto: la scatola sale', item.box === 2, String(item.box));
}

/* ---------- 7. countAttempt conta ma non riprogramma ---------- */
{
  await carica([voce('v:libera', 4, 1, 3)]);
  const prima = srs.itemsByIds(['v:libera'])[0];
  const scadenzaPrima = prima.due;
  const scatolaPrima = prima.box;

  srs.countAttempt('v:libera', false);
  const dopo = srs.itemsByIds(['v:libera'])[0];
  check('pratica libera: attempts +1', dopo.attempts === 5, String(dopo.attempts));
  check('pratica libera: errors +1', dopo.errors === 2, String(dopo.errors));
  check('pratica libera: la scatola non si muove', dopo.box === scatolaPrima, String(dopo.box));
  check('pratica libera: la scadenza non si muove', dopo.due === scadenzaPrima, dopo.due);

  srs.countAttempt('v:libera', true);
  const dopo2 = srs.itemsByIds(['v:libera'])[0];
  check('pratica libera giusta: attempts +1, errors fermo',
    dopo2.attempts === 6 && dopo2.errors === 2, JSON.stringify(dopo2));
}

/* ---------- 8. Un id che non esiste non fa esplodere niente ---------- */
{
  await carica([voce('v:x', 3, 1)]);
  check('grade su id sconosciuto restituisce null', srs.grade('v:non-esiste', true) === null);
  check('countAttempt su id sconosciuto restituisce null', srs.countAttempt('v:non-esiste', true) === null);
  check('itemsByIds salta gli id sconosciuti',
    srs.itemsByIds(['v:x', 'v:non-esiste']).length === 1);
}

/* ---------- 9. Dati vecchi senza contatori non rompono l'ordinamento ---------- */
{
  // Come si presenterebbero se una migrazione fosse andata a metà.
  const grezzo = [
    ['v:vecchia', { id: 'v:vecchia', kind: 'vocab', it: 'vecchia', es: 'vieja', gender: null, note: null, lesson: 'm01-l01', box: 2, due: '2026-08-01', right: 3, wrong: 1 }]
  ];
  await carica(grezzo);
  // La migrazione dello store li ha già riempiti: qui si controlla che
  // comunque non si ottengano NaN né eccezioni.
  const lista = srs.rebels(10);
  check('nessun NaN con dati incompleti',
    lista.every((i) => Number.isFinite(srs.errorRate(i))),
    JSON.stringify(lista.map((i) => srs.errorRate(i))));
  check('totalAttempts resta un numero', Number.isFinite(srs.totalAttempts()));
}

console.log(`\n${passed} passati, ${failed} falliti`);
process.exit(failed ? 1 : 0);
