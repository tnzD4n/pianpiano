/* Controlla che il validatore sappia davvero bocciare.
   `node tools/test-validator.mjs` dalla radice del progetto.

   Rompe una lezione in tanti modi diversi, uno alla volta, e verifica che
   `validate-lessons.mjs` se ne accorga. Alla fine rimette tutto a posto:
   il file di partenza viene salvato e ripristinato anche se qualcosa va male. */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const TARGET = 'data/lessons/m01-l01.json';
const ORPHAN = 'data/lessons/zz-orfano.json';
const original = readFileSync(TARGET, 'utf8');

let passed = 0;
let failed = 0;

function runValidator() {
  try {
    execFileSync('node', ['tools/validate-lessons.mjs'], { encoding: 'utf8', stdio: 'pipe' });
    return { ok: true, output: '' };
  } catch (err) {
    return { ok: false, output: (err.stdout || '') + (err.stderr || '') };
  }
}

/* `mutate` riceve l'oggetto della lezione e lo rompe.
   `expect` è un pezzo del messaggio che ci si aspetta di leggere. */
function check(label, mutate, expect, { raw = false } = {}) {
  if (raw) {
    writeFileSync(TARGET, mutate(original));
  } else {
    const lesson = JSON.parse(original);
    mutate(lesson);
    writeFileSync(TARGET, JSON.stringify(lesson, null, 2));
  }

  const { ok, output } = runValidator();
  writeFileSync(TARGET, original);

  if (ok) {
    failed += 1;
    console.log(`FAIL  ${label}\n      il validatore è passato invece di bocciare`);
    return;
  }
  if (!output.includes(expect)) {
    failed += 1;
    console.log(`FAIL  ${label}\n      atteso un messaggio con «${expect}»\n      ottenuto:\n${output.split('\n').slice(0, 6).map((l) => '        ' + l).join('\n')}`);
    return;
  }
  // Il numero di riga deve esserci: senza, il messaggio è inservibile.
  if (!/\.json:\d+/.test(output)) {
    failed += 1;
    console.log(`FAIL  ${label}\n      il messaggio non indica il file e la riga`);
    return;
  }
  passed += 1;
  console.log(`ok    ${label}`);
}

/* --- Prima di tutto: da pulito deve passare --- */
const clean = runValidator();
if (!clean.ok) {
  console.log('FAIL  i contenuti di partenza non sono validi: ' + clean.output.slice(0, 400));
  process.exit(1);
}
console.log('ok    i contenuti di partenza sono validi');
passed += 1;

/* --- JSON rotto --- */
check('JSON non valido (virgola in più)',
  (text) => text.replace('"vocab": [', '"vocab": [,'),
  'JSON non valido', { raw: true });

/* --- Identità --- */
check('id diverso dal nome del file',
  (l) => { l.id = 'm09-l99'; },
  'diverso dal nome del file');

check('module incoerente con course.json',
  (l) => { l.module = 'm07'; },
  'in course.json questa lezione sta in');

check('title diverso da course.json',
  (l) => { l.title = 'Otro título cualquiera'; },
  'title diverso da course.json');

/* --- Campi vuoti e segnaposto --- */
check('goal vuoto',
  (l) => { l.goal = '   '; },
  'goal vuoto');

check('TODO lasciato nel testo',
  (l) => { l.ojo[0].body = 'TODO escribir esto'; },
  'segnaposto');

check('lorem ipsum nel vocabolario',
  (l) => { l.vocab[0].note = 'Lorem ipsum dolor sit amet'; },
  'segnaposto');

check('«todo» in spagnolo NON è un segnaposto',
  (l) => { l.ojo[0].body = 'Esto lo cambia todo, y todo el día vale igual.'; l.vocab[0].it = ''; },
  'vocab[0].it vuoto');

/* --- Esercizi --- */
check('type non registrato',
  (l) => { l.exercises[0].type = 'crucigrama'; },
  'non è registrato');

check('type mancante',
  (l) => { delete l.exercises[0].type; },
  'non ha un type');

check('multiple-choice: answer fuori intervallo',
  (l) => { l.exercises[0].answer = 7; },
  'indici validi');

check('multiple-choice: answer non intero',
  (l) => { l.exercises[0].answer = 'Buongiorno'; },
  "answer deve essere l'indice intero");

check('answer vuota',
  (l) => { l.exercises[4].answer = ['']; },
  'answer vuota');

check('answer mancante',
  (l) => { delete l.exercises[4].answer; },
  'answer mancante');

check('fill-in-the-blank senza ___',
  (l) => { l.exercises[1].prompt = 'Una frase sin hueco'; },
  "deve contenere '___'");

check('word-order: le parole non compongono la risposta',
  (l) => { l.exercises[3].answer = 'Otra cosa completamente distinta'; },
  'non compongono la answer');

check('matching: coppia ripetuta',
  (l) => { l.exercises[2].pairs[1] = l.exercises[2].pairs[0].slice(); },
  'compare due volte');

check('matching: coppia malformata',
  (l) => { l.exercises[2].pairs[0] = ['solo uno']; },
  'deve essere una coppia');

/* --- Vocabolario e frasi --- */
check('gender non valido',
  (l) => { l.vocab[0].gender = 'neutro'; },
  'gender deve essere');

check('parola ripetuta nel vocabolario',
  (l) => { l.vocab[1].it = l.vocab[0].it; },
  'è ripetuto nel vocabolario');

check('frase senza traduzione',
  (l) => { delete l.phrases[0].es; },
  'phrases[0].es mancante');

/* --- Tabelle di grammatica --- */
check('riga della tabella con celle in meno',
  (l) => { l.grammar[0].table.rows[0] = ['solo una cella']; },
  'headers ne dichiara');

/* --- File orfani e mancanti --- */
writeFileSync(ORPHAN, JSON.stringify({ id: 'zz-orfano', module: 'm01', title: 'x', exercises: [] }, null, 2));
{
  const { ok, output } = runValidator();
  if (!ok && output.includes('file orfano')) { passed += 1; console.log('ok    file orfano sul disco'); }
  else { failed += 1; console.log('FAIL  file orfano sul disco non segnalato'); }
}
if (existsSync(ORPHAN)) unlinkSync(ORPHAN);

/* --- Alla fine i contenuti devono essere tornati come prima --- */
if (readFileSync(TARGET, 'utf8') !== original) {
  failed += 1;
  console.log('FAIL  il file di prova non è stato ripristinato');
} else {
  passed += 1;
  console.log('ok    i contenuti sono stati ripristinati');
}

const finale = runValidator();
if (!finale.ok) {
  failed += 1;
  console.log('FAIL  dopo le prove i contenuti non sono più validi');
} else {
  passed += 1;
  console.log('ok    dopo le prove i contenuti sono ancora validi');
}

console.log(`\n${passed} passati, ${failed} falliti`);
process.exit(failed ? 1 : 0);
