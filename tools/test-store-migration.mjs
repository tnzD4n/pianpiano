/* Controlla la migrazione dello schema di localStorage.
   `node tools/test-store-migration.mjs` dalla radice del progetto.

   Il punto delicato di tutta la fase B: se la migrazione perde qualcosa,
   spariscono mesi di ripasso senza che nessuno se ne accorga subito.
   Si parte da un backup nel formato vecchio, come quello che c'è davvero
   nei browser di chi usa il sito adesso. */

import { readFileSync } from 'node:fs';

/* `store.js` parla con localStorage al momento dell'import: gliene diamo
   uno finto prima di caricarlo, così il modulo si può provare fuori dal
   browser senza modificarlo. */
class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const KEY = 'pianpiano.v1';

// Progresso nel formato v1: `version`, nessun blocco `backup`.
const V1 = {
  version: 1,
  lessons: {
    'm01-l01': { opened: '2026-05-02', done: [0, 1, 2, 3, 4, 5], completedAt: '2026-05-02' },
    'm01-l02': { opened: '2026-05-04', done: [0, 1], completedAt: null },
    'm02-l03': { opened: '2026-06-11', done: [0, 2], completedAt: '2026-06-12' }
  },
  srs: {
    'v:ciao': { id: 'v:ciao', kind: 'vocab', it: 'ciao', es: 'hola / adiós', gender: null, note: null, lesson: 'm01-l01', box: 5, due: '2026-09-01', right: 11, wrong: 2 },
    'f:come stai?': { id: 'f:come stai?', kind: 'phrase', it: 'Come stai?', es: '¿Cómo estás?', gender: null, note: null, lesson: 'm01-l01', box: 3, due: '2026-08-04', right: 6, wrong: 3 }
  },
  streak: { current: 23, best: 41, last: '2026-07-29' },
  updatedAt: '2026-07-29T19:12:00.000Z'
};

let passed = 0;
let failed = 0;
function check(label, cond, extra = '') {
  if (cond) { passed += 1; console.log('ok    ' + label); }
  else { failed += 1; console.log('FAIL  ' + label + (extra ? '\n      ' + extra : '')); }
}

async function loadStore(initial) {
  const storage = new FakeStorage();
  if (initial) storage.setItem(KEY, JSON.stringify(initial));
  globalThis.localStorage = storage;
  // Cache-busting: ogni prova vuole un modulo appena inizializzato.
  const mod = await import(`../js/store.js?t=${Math.random()}`);
  return { store: mod, storage };
}

/* ---------- 1. v1 -> v2 senza perdere niente ---------- */
{
  const { store, storage } = await loadStore(V1);
  const dopo = JSON.parse(storage.getItem(KEY) || JSON.stringify(V1));

  // La scrittura avviene solo quando qualcosa cambia: forziamola.
  store.markBackupDone();
  const salvato = JSON.parse(storage.getItem(KEY));

  check('lo schema passa a 3', salvato.schemaVersion === 3, `trovato ${salvato.schemaVersion}`);
  check('il vecchio campo `version` viene rimosso', salvato.version === undefined, JSON.stringify(salvato.version));

  check('le lezioni sono identiche',
    JSON.stringify(salvato.lessons) === JSON.stringify(V1.lessons),
    JSON.stringify(salvato.lessons));

  /* Il ripasso non è più identico alla lettera — guadagna attempts/errors —
     ma tutti i campi di prima devono essere rimasti al loro posto. */
  for (const [id, prima] of Object.entries(V1.srs)) {
    const dopoM = salvato.srs[id];
    const campiIntatti = dopoM && ['kind','it','es','gender','lesson','box','due','right','wrong']
      .every((k) => JSON.stringify(dopoM[k]) === JSON.stringify(prima[k]));
    check(`«${id}»: i campi di prima sono intatti`, campiIntatti, JSON.stringify(dopoM));
  }

  check('la serie di giorni è identica',
    salvato.streak.current === 23 && salvato.streak.best === 41 && salvato.streak.last === '2026-07-29',
    JSON.stringify(salvato.streak));

  check('nasce il blocco backup', salvato.backup && typeof salvato.backup === 'object');
  check('due lezioni risultano completate', store.completedCount() === 2, String(store.completedCount()));
  void dopo;
}

/* ---------- 1b. v1 -> v3: i contatori si travasano da right/wrong ---------- */
{
  const { store, storage } = await loadStore(V1);
  store.markBackupDone();
  const srs = JSON.parse(storage.getItem(KEY)).srs;

  // v:ciao aveva right 11, wrong 2  →  attempts 13, errors 2
  check('attempts = right + wrong', srs['v:ciao'].attempts === 13, String(srs['v:ciao'].attempts));
  check('errors = wrong', srs['v:ciao'].errors === 2, String(srs['v:ciao'].errors));
  // f:come stai? aveva right 6, wrong 3  →  attempts 9, errors 3
  check('travaso anche sulle frasi',
    srs['f:come stai?'].attempts === 9 && srs['f:come stai?'].errors === 3,
    JSON.stringify(srs['f:come stai?']));
  check('la storia raccolta non viene azzerata',
    Object.values(srs).every((i) => i.attempts > 0));
}

/* ---------- 2. Rileggere un v2 non cambia niente ---------- */
{
  const { store, storage } = await loadStore(V1);
  store.markBackupDone();
  const primo = storage.getItem(KEY);

  const { storage: storage2 } = await loadStore(JSON.parse(primo));
  const secondo = storage2.getItem(KEY);
  check('la migrazione è idempotente',
    secondo === null || JSON.parse(secondo).schemaVersion === 3);

  // Rileggere non deve rigonfiare i contatori.
  const riletti = JSON.parse(primo).srs;
  check('rileggere non altera i contatori',
    riletti['v:ciao'].attempts === 13 && riletti['v:ciao'].errors === 2,
    JSON.stringify(riletti['v:ciao']));

  const riletto = JSON.parse(primo);
  check('rileggere non perde il ripasso',
    Object.keys(riletto.srs).length === 2, JSON.stringify(Object.keys(riletto.srs)));
}

/* ---------- 3. Stato vuoto e dati corrotti ---------- */
{
  const { store } = await loadStore(null);
  check('senza dati si parte vuoti', store.isEmpty());
  check('nessuna copia da proporre a zero lezioni', store.shouldOfferBackup() === false);
}

/* ---------- 4. Il file v1 si può ancora importare ---------- */
{
  const { store } = await loadStore(null);
  const report = store.parseBackup(JSON.stringify(V1));
  check('un backup v1 si importa ancora', report.lessons === 3 && report.items === 2,
    `lezioni ${report.lessons}, voci ${report.items}`);
  check('conta le lezioni completate', report.completed === 2, String(report.completed));
  store.replaceWith(report.state);
  check('dopo l\'importazione lo stato non è vuoto', !store.isEmpty());
}

/* ---------- 5. File non validi vengono rifiutati ---------- */
{
  const { store } = await loadStore(null);
  const rifiuta = (label, text) => {
    try { store.parseBackup(text); check(label, false, 'accettato invece di rifiutare'); }
    catch (err) { check(label, true); }
  };
  rifiuta('rifiuta un JSON rotto', '{ non un json');
  rifiuta('rifiuta un elenco', '[1,2,3]');
  rifiuta('rifiuta un oggetto senza versione', '{"lessons":{}}');
  rifiuta('rifiuta una versione futura', '{"schemaVersion":99,"lessons":{},"srs":{}}');
  rifiuta('rifiuta lessons non oggetto', '{"schemaVersion":2,"lessons":[],"srs":{}}');
}

/* ---------- 6. Unire tiene sempre il meglio dei due ---------- */
{
  const { store } = await loadStore(V1);

  const altro = {
    schemaVersion: 2,
    lessons: {
      'm01-l02': { opened: '2026-05-03', done: [2, 3], completedAt: '2026-05-06' },
      'm05-l01': { opened: '2026-07-01', done: [0], completedAt: null }
    },
    srs: {
      'v:ciao': { id: 'v:ciao', kind: 'vocab', it: 'ciao', es: 'hola', gender: null, note: null, lesson: 'm01-l01', box: 2, due: '2026-07-10', right: 3, wrong: 9 },
      'v:grazie': { id: 'v:grazie', kind: 'vocab', it: 'grazie', es: 'gracias', gender: null, note: null, lesson: 'm01-l01', box: 4, due: '2026-08-20', right: 7, wrong: 1 }
    },
    streak: { current: 2, best: 55, last: '2026-07-20' },
    backup: { lastAt: null, lessonsAt: 0 },
    updatedAt: null
  };

  store.mergeWith(altro);
  const srs = store.getSrs();

  check('unendo, gli esercizi fatti si sommano',
    JSON.stringify(store.getLesson('m01-l02').done) === '[0,1,2,3]',
    JSON.stringify(store.getLesson('m01-l02').done));
  check('unendo, una lezione completata resta completata',
    store.getLesson('m01-l02').completedAt === '2026-05-06');
  check('unendo, arrivano le lezioni nuove', store.getLesson('m05-l01') !== null);
  check('unendo, non si perdono le lezioni proprie', store.getLesson('m02-l03') !== null);
  check('unendo, vince la scatola di ripasso più alta',
    srs['v:ciao'].box === 5, String(srs['v:ciao'].box));
  check('unendo, arrivano le voci nuove del ripasso', srs['v:grazie'] !== undefined);
  check('unendo, vince la serie migliore', store.completedCount() >= 2);
}

/* ---------- 7. La proposta di copia scatta ogni 5 lezioni ---------- */
{
  const { store } = await loadStore({
    schemaVersion: 2,
    lessons: Object.fromEntries(
      Array.from({ length: 5 }, (_, i) => [`m01-l0${i}`, { opened: '2026-07-01', done: [0], completedAt: '2026-07-01' }])
    ),
    srs: {},
    streak: { current: 1, best: 1, last: '2026-07-01' },
    backup: { lastAt: null, lessonsAt: 0 },
    updatedAt: null
  });
  check('a 5 lezioni completate propone la copia', store.shouldOfferBackup() === true);
  store.markBackupDone();
  check('subito dopo la copia non la ripropone', store.shouldOfferBackup() === false);
  check('la data della copia viene registrata', store.backupInfo().lastAt !== null);
  check('la copia risulta di oggi', store.backupInfo().daysAgo === 0);
}

/* ---------- 8. Il vero backup di esempio nel repository ---------- */
{
  // Se un giorno si aggiunge un file di esempio, deve restare importabile.
  try {
    const text = readFileSync('tools/fixtures/progreso-v1.json', 'utf8');
    const { store } = await loadStore(null);
    const report = store.parseBackup(text);
    check('il backup di esempio si importa', report.lessons > 0);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // Nessun file di esempio: non è un errore.
  }
}

console.log(`\n${passed} passati, ${failed} falliti`);
process.exit(failed ? 1 : 0);
