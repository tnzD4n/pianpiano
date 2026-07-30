/* Validatore dei contenuti del corso.
   `node tools/validate-lessons.mjs` dalla radice del progetto.
   Solo moduli built-in: nessuna dipendenza da installare, così gira
   identico in locale e nella GitHub Action.

   Ogni errore dice il file e la riga: un JSON di 250 righe senza numero
   di riga è inservibile. Per questo qui sotto c'è un piccolo parser che
   tiene il conto delle righe, invece del solo JSON.parse. */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
// Le stesse regole di confronto che usa il sito: se il validatore ne avesse
// una copia propria, prima o poi le due si allontanerebbero.
import { normalizeAnswer } from '../js/util.js';

const COURSE = 'data/course.json';
const LESSON_DIR = 'data/lessons';
const REGISTRY_FILE = 'js/exercises/index.js';

/* ---------- Parser JSON che ricorda le righe ----------
   Restituisce { value, line(path) }: `path` è tipo "exercises/3/answer". */

function parseWithLines(text, file) {
  let i = 0;
  let line = 1;
  const locs = new Map();

  const fail = (msg) => {
    throw new Error(`${file}:${line}  JSON non valido: ${msg}`);
  };

  const ws = () => {
    while (i < text.length) {
      const c = text[i];
      if (c === '\n') { line += 1; i += 1; }
      else if (c === ' ' || c === '\t' || c === '\r') i += 1;
      else break;
    }
  };

  const lit = (word, value) => {
    if (text.startsWith(word, i)) { i += word.length; return value; }
    return fail(`atteso ${word}`);
  };

  const str = () => {
    if (text[i] !== '"') return fail('attesa una stringa');
    i += 1;
    let out = '';
    while (i < text.length) {
      const c = text[i];
      if (c === '"') { i += 1; return out; }
      if (c === '\\') {
        const esc = text[i + 1];
        i += 2;
        if (esc === 'n') out += '\n';
        else if (esc === 't') out += '\t';
        else if (esc === 'r') out += '\r';
        else if (esc === 'b') out += '\b';
        else if (esc === 'f') out += '\f';
        else if (esc === 'u') { out += String.fromCharCode(parseInt(text.slice(i, i + 4), 16)); i += 4; }
        else out += esc;
        continue;
      }
      if (c === '\n') line += 1;
      out += c;
      i += 1;
    }
    return fail('stringa non chiusa');
  };

  const num = () => {
    const start = i;
    if (text[i] === '-') i += 1;
    while (i < text.length && /[0-9eE+.\-]/.test(text[i])) i += 1;
    const n = Number(text.slice(start, i));
    if (Number.isNaN(n)) return fail('numero non valido');
    return n;
  };

  const value = (path) => {
    ws();
    locs.set(path, line);
    const c = text[i];
    if (c === '{') {
      i += 1;
      const out = {};
      ws();
      if (text[i] === '}') { i += 1; return out; }
      for (;;) {
        ws();
        const key = str();
        ws();
        if (text[i] !== ':') return fail("atteso ':'");
        i += 1;
        out[key] = value(path ? `${path}/${key}` : key);
        ws();
        if (text[i] === ',') { i += 1; continue; }
        if (text[i] === '}') { i += 1; return out; }
        return fail("attesa ',' o '}'");
      }
    }
    if (c === '[') {
      i += 1;
      const out = [];
      ws();
      if (text[i] === ']') { i += 1; return out; }
      for (;;) {
        out.push(value(`${path}/${out.length}`));
        ws();
        if (text[i] === ',') { i += 1; continue; }
        if (text[i] === ']') { i += 1; return out; }
        return fail("attesa ',' o ']'");
      }
    }
    if (c === '"') return str();
    if (c === 't') return lit('true', true);
    if (c === 'f') return lit('false', false);
    if (c === 'n') return lit('null', null);
    if (c === '-' || (c >= '0' && c <= '9')) return num();
    return fail(`carattere inatteso ${JSON.stringify(c || '(fine del file)')}`);
  };

  const root = value('');
  ws();
  if (i < text.length) fail('contenuto in più dopo la fine del JSON');
  return { value: root, locs };
}

/* ---------- Raccolta degli errori ---------- */

const errors = [];
let checked = 0;

function makeReporter(file, locs) {
  return (path, message) => {
    // Si risale al primo antenato di cui si conosce la riga.
    let p = path;
    while (p && !locs.has(p)) p = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
    const line = locs.get(p) ?? 1;
    const where = path ? ` (${path})` : '';
    errors.push(`${file}:${line}  ${message}${where}`);
  };
}

/* ---------- Regole di forma ---------- */

/* Segnaposto dimenticati nel testo.

   Attenzione: «todo» in spagnolo vuol dire «tutto» ed è una delle parole più
   frequenti del corso («todo el día», «lo cambia todo»). Cercare /todo/i
   segnalerebbe mezzo corso come incompleto. Quindi i marcatori da codice si
   cercano solo maiuscoli, com'è la convenzione; senza distinguere le
   maiuscole restano solo le parole che in spagnolo non esistono. */
const PLACEHOLDER_STRICT = /\b(TODO|FIXME|TBD|HACK|XXX+)\b/;
const PLACEHOLDER_LOOSE = /\b(lorem ipsum|lorem|placeholder)\b/i;

function hasPlaceholder(text) {
  return PLACEHOLDER_STRICT.test(text) || PLACEHOLDER_LOOSE.test(text);
}

function checkText(report, path, value, { required = true, label = 'campo' } = {}) {
  if (value === undefined || value === null) {
    if (required) report(path, `${label} mancante`);
    return;
  }
  if (typeof value !== 'string') {
    report(path, `${label} deve essere una stringa, non ${typeof value}`);
    return;
  }
  if (!value.trim()) {
    report(path, `${label} vuoto`);
    return;
  }
  if (hasPlaceholder(value)) {
    report(path, `${label} contiene un segnaposto da sostituire: «${value.trim().slice(0, 60)}»`);
  }
}

function checkArray(report, path, value, { min = 1, label = 'elenco', required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) report(path, `${label} mancante`);
    return false;
  }
  if (!Array.isArray(value)) {
    report(path, `${label} deve essere un elenco`);
    return false;
  }
  if (value.length < min) {
    report(path, `${label} deve avere almeno ${min} ${min === 1 ? 'elemento' : 'elementi'}, ne ha ${value.length}`);
    return false;
  }
  return true;
}

/* Le risposte accettate: sempre un elenco di stringhe non vuote. */
function checkAnswerList(report, path, value) {
  if (value === undefined || value === null) {
    report(path, 'answer mancante');
    return;
  }
  const list = Array.isArray(value) ? value : [value];
  if (list.length === 0) {
    report(path, 'answer vuota: serve almeno una forma accettata');
    return;
  }
  list.forEach((a, k) => {
    const p = Array.isArray(value) ? `${path}/${k}` : path;
    if (typeof a !== 'string') report(p, `answer deve essere una stringa, non ${typeof a}`);
    else if (!a.trim()) report(p, 'answer vuota');
    else if (hasPlaceholder(a)) report(p, `answer contiene un segnaposto: «${a}»`);
  });
}

/* ---------- Esercizi, tipo per tipo ---------- */

const EXERCISE_TYPES = {
  'multiple-choice'(report, path, ex) {
    checkText(report, `${path}/prompt`, ex.prompt, { label: 'prompt' });
    if (!checkArray(report, `${path}/options`, ex.options, { min: 2, label: 'options' })) return;
    ex.options.forEach((o, k) => checkText(report, `${path}/options/${k}`, o, { label: `options[${k}]` }));
    if (typeof ex.answer !== 'number' || !Number.isInteger(ex.answer)) {
      report(`${path}/answer`, `answer deve essere l'indice intero dell'opzione giusta, non ${JSON.stringify(ex.answer)}`);
      return;
    }
    if (ex.answer < 0 || ex.answer >= ex.options.length) {
      report(`${path}/answer`, `answer vale ${ex.answer} ma options ha ${ex.options.length} voci (indici validi 0–${ex.options.length - 1})`);
    }
  },

  'fill-in-the-blank'(report, path, ex) {
    checkText(report, `${path}/prompt`, ex.prompt, { label: 'prompt' });
    if (typeof ex.prompt === 'string' && !ex.prompt.includes('___')) {
      report(`${path}/prompt`, "il prompt di fill-in-the-blank deve contenere '___' per segnare il buco");
    }
    checkAnswerList(report, `${path}/answer`, ex.answer);
  },

  matching(report, path, ex) {
    // Qui la risposta sono le coppie: non esiste un campo `answer`.
    if (!checkArray(report, `${path}/pairs`, ex.pairs, { min: 2, label: 'pairs' })) return;
    const seen = new Set();
    ex.pairs.forEach((pair, k) => {
      if (!Array.isArray(pair) || pair.length !== 2) {
        report(`${path}/pairs/${k}`, `pairs[${k}] deve essere una coppia [italiano, spagnolo]`);
        return;
      }
      checkText(report, `${path}/pairs/${k}/0`, pair[0], { label: `pairs[${k}] italiano` });
      checkText(report, `${path}/pairs/${k}/1`, pair[1], { label: `pairs[${k}] spagnolo` });
      const key = String(pair[0]).trim().toLowerCase();
      if (seen.has(key)) report(`${path}/pairs/${k}/0`, `«${pair[0]}» compare due volte nelle coppie: l'esercizio diventa ambiguo`);
      seen.add(key);
    });
  },

  'word-order'(report, path, ex) {
    if (!checkArray(report, `${path}/words`, ex.words, { min: 2, label: 'words' })) return;
    ex.words.forEach((w, k) => checkText(report, `${path}/words/${k}`, w, { label: `words[${k}]` }));
    checkText(report, `${path}/answer`, ex.answer, { label: 'answer' });
    /* Le parole date devono bastare a comporre la risposta — misurato con la
       stessa normalizzazione del sito, non alla lettera: `words` di solito
       lascia fuori la punteggiatura finale e le virgole, che `normalizeAnswer`
       ignora comunque. Confrontare i caratteri grezzi segnalerebbe come rotti
       esercizi che in pagina si risolvono benissimo. */
    if (typeof ex.answer === 'string' && ex.words.every((w) => typeof w === 'string')) {
      const composed = normalizeAnswer(ex.words.join(' '));
      const target = normalizeAnswer(ex.answer);
      if (composed !== target) {
        report(`${path}/answer`,
          `le words non compongono la answer:\n      words → «${composed}»\n      answer → «${target}»`);
      }
    }
  },

  translation(report, path, ex) {
    checkText(report, `${path}/prompt`, ex.prompt, { label: 'prompt' });
    checkAnswerList(report, `${path}/answer`, ex.answer);
  },

  listening(report, path, ex) {
    checkText(report, `${path}/audio`, ex.audio, { label: 'audio' });
    checkAnswerList(report, `${path}/answer`, ex.answer);
  }
};

/* ---------- Una lezione ---------- */

function validateLesson(file, expected) {
  const raw = readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = parseWithLines(raw, file);
  } catch (err) {
    errors.push(err.message);
    return;
  }

  const lesson = parsed.value;
  const report = makeReporter(file, parsed.locs);
  checked += 1;

  if (!lesson || typeof lesson !== 'object' || Array.isArray(lesson)) {
    report('', 'la lezione deve essere un oggetto JSON');
    return;
  }

  /* --- Identità, contro course.json --- */
  const stem = basename(file, '.json');
  checkText(report, 'id', lesson.id, { label: 'id' });
  if (lesson.id && lesson.id !== stem) {
    report('id', `id «${lesson.id}» diverso dal nome del file «${stem}»`);
  }
  if (expected) {
    if (lesson.module !== expected.module) {
      report('module', `module «${lesson.module}» ma in course.json questa lezione sta in «${expected.module}»`);
    }
    if (lesson.title !== expected.title) {
      report('title', `title diverso da course.json:\n      file:   «${lesson.title}»\n      corso:  «${expected.title}»`);
    }
  } else {
    checkText(report, 'module', lesson.module, { label: 'module' });
  }
  checkText(report, 'title', lesson.title, { label: 'title' });
  checkText(report, 'goal', lesson.goal, { label: 'goal' });

  /* --- Vocabolario --- */
  if (lesson.vocab !== undefined) {
    if (checkArray(report, 'vocab', lesson.vocab, { min: 1, label: 'vocab' })) {
      const seen = new Set();
      lesson.vocab.forEach((v, k) => {
        const p = `vocab/${k}`;
        if (!v || typeof v !== 'object') { report(p, `vocab[${k}] deve essere un oggetto`); return; }
        checkText(report, `${p}/it`, v.it, { label: `vocab[${k}].it` });
        checkText(report, `${p}/es`, v.es, { label: `vocab[${k}].es` });
        if (v.gender !== null && v.gender !== undefined && !['m', 'f'].includes(v.gender)) {
          report(`${p}/gender`, `gender deve essere "m", "f" o null, non ${JSON.stringify(v.gender)}`);
        }
        if (v.plural !== null && v.plural !== undefined) {
          checkText(report, `${p}/plural`, v.plural, { label: `vocab[${k}].plural` });
        }
        if (v.note !== null && v.note !== undefined) {
          checkText(report, `${p}/note`, v.note, { label: `vocab[${k}].note` });
        }
        const key = String(v.it).trim().toLowerCase();
        if (seen.has(key)) report(`${p}/it`, `«${v.it}» è ripetuto nel vocabolario della lezione`);
        seen.add(key);
      });
    }
  }

  /* --- Frasi --- */
  if (lesson.phrases !== undefined) {
    if (checkArray(report, 'phrases', lesson.phrases, { min: 1, label: 'phrases' })) {
      lesson.phrases.forEach((f, k) => {
        const p = `phrases/${k}`;
        if (!f || typeof f !== 'object') { report(p, `phrases[${k}] deve essere un oggetto`); return; }
        checkText(report, `${p}/it`, f.it, { label: `phrases[${k}].it` });
        checkText(report, `${p}/es`, f.es, { label: `phrases[${k}].es` });
        if (f.note !== null && f.note !== undefined) {
          checkText(report, `${p}/note`, f.note, { label: `phrases[${k}].note` });
        }
      });
    }
  }

  /* --- Grammatica --- */
  if (lesson.grammar !== undefined) {
    if (checkArray(report, 'grammar', lesson.grammar, { min: 1, label: 'grammar' })) {
      lesson.grammar.forEach((g, k) => {
        const p = `grammar/${k}`;
        if (!g || typeof g !== 'object') { report(p, `grammar[${k}] deve essere un oggetto`); return; }
        checkText(report, `${p}/heading`, g.heading, { label: `grammar[${k}].heading` });
        checkText(report, `${p}/body`, g.body, { label: `grammar[${k}].body` });
        if (g.table !== undefined && g.table !== null) {
          const headers = g.table.headers;
          if (!checkArray(report, `${p}/table/headers`, headers, { min: 1, label: `grammar[${k}].table.headers` })) return;
          if (!checkArray(report, `${p}/table/rows`, g.table.rows, { min: 1, label: `grammar[${k}].table.rows` })) return;
          g.table.rows.forEach((row, r) => {
            if (!Array.isArray(row)) {
              report(`${p}/table/rows/${r}`, `rows[${r}] deve essere un elenco di celle`);
              return;
            }
            if (row.length !== headers.length) {
              report(`${p}/table/rows/${r}`, `rows[${r}] ha ${row.length} celle ma headers ne dichiara ${headers.length}`);
            }
            row.forEach((cell, c) => {
              if (typeof cell !== 'string') report(`${p}/table/rows/${r}/${c}`, `la cella [${r}][${c}] deve essere una stringa`);
              else if (hasPlaceholder(cell)) report(`${p}/table/rows/${r}/${c}`, `la cella [${r}][${c}] contiene un segnaposto: «${cell}»`);
            });
          });
        }
      });
    }
  }

  /* --- ¡Ojo! --- */
  if (lesson.ojo !== undefined) {
    if (checkArray(report, 'ojo', lesson.ojo, { min: 1, label: 'ojo' })) {
      lesson.ojo.forEach((o, k) => {
        const p = `ojo/${k}`;
        if (!o || typeof o !== 'object') { report(p, `ojo[${k}] deve essere un oggetto`); return; }
        checkText(report, `${p}/title`, o.title, { label: `ojo[${k}].title` });
        checkText(report, `${p}/body`, o.body, { label: `ojo[${k}].body` });
      });
    }
  }

  /* --- Esercizi --- */
  if (checkArray(report, 'exercises', lesson.exercises, { min: 1, label: 'exercises' })) {
    lesson.exercises.forEach((ex, k) => {
      const p = `exercises/${k}`;
      if (!ex || typeof ex !== 'object') { report(p, `exercises[${k}] deve essere un oggetto`); return; }
      if (typeof ex.type !== 'string' || !ex.type.trim()) {
        report(`${p}/type`, `exercises[${k}] non ha un type`);
        return;
      }
      const check = EXERCISE_TYPES[ex.type];
      if (!check) {
        report(`${p}/type`, `type «${ex.type}» non è registrato. Tipi validi: ${Object.keys(EXERCISE_TYPES).join(', ')}`);
        return;
      }
      check(report, p, ex);
      if (ex.explain !== undefined && ex.explain !== null) {
        checkText(report, `${p}/explain`, ex.explain, { label: `exercises[${k}].explain` });
      }
    });
  }
}

/* ---------- Il corso ---------- */

function run() {
  if (!existsSync(COURSE)) {
    errors.push(`${COURSE}:1  manca l'indice del corso`);
    return;
  }

  let course;
  try {
    course = parseWithLines(readFileSync(COURSE, 'utf8'), COURSE);
  } catch (err) {
    errors.push(err.message);
    return;
  }

  const report = makeReporter(COURSE, course.locs);
  const modules = course.value.modules;
  if (!checkArray(report, 'modules', modules, { min: 1, label: 'modules' })) return;

  // Elenco atteso: id -> { module, title, file }
  const expected = new Map();
  const moduleIds = new Set();

  modules.forEach((m, mi) => {
    const p = `modules/${mi}`;
    checkText(report, `${p}/id`, m.id, { label: `modules[${mi}].id` });
    checkText(report, `${p}/title`, m.title, { label: `modules[${mi}].title` });
    checkText(report, `${p}/goal`, m.goal, { label: `modules[${mi}].goal` });
    if (moduleIds.has(m.id)) report(`${p}/id`, `il modulo «${m.id}» è dichiarato due volte`);
    moduleIds.add(m.id);

    if (!checkArray(report, `${p}/lessons`, m.lessons, { min: 1, label: `modules[${mi}].lessons` })) return;
    m.lessons.forEach((l, li) => {
      const lp = `${p}/lessons/${li}`;
      checkText(report, `${lp}/id`, l.id, { label: 'id della lezione' });
      checkText(report, `${lp}/title`, l.title, { label: 'title della lezione' });
      checkText(report, `${lp}/file`, l.file, { label: 'file della lezione' });
      if (expected.has(l.id)) report(`${lp}/id`, `la lezione «${l.id}» è dichiarata due volte in course.json`);
      expected.set(l.id, { module: m.id, title: l.title, file: l.file, path: lp });
      if (l.file && !existsSync(l.file)) {
        report(`${lp}/file`, `il file «${l.file}» dichiarato in course.json non esiste`);
      }
    });
  });

  /* --- Nessun file orfano --- */
  const onDisk = readdirSync(LESSON_DIR).filter((n) => n.endsWith('.json')).sort();
  const declared = new Set([...expected.values()].map((e) => basename(e.file)));
  for (const name of onDisk) {
    if (!declared.has(name)) {
      errors.push(`${LESSON_DIR}/${name}:1  file orfano: esiste sul disco ma course.json non lo dichiara`);
    }
  }

  /* --- Ogni lezione --- */
  for (const [id, info] of expected) {
    if (!existsSync(info.file)) continue;   // già segnalato sopra
    validateLesson(info.file, { ...info, id });
  }

  /* --- I tipi di esercizio non devono divergere dal registro reale --- */
  if (existsSync(REGISTRY_FILE)) {
    const src = readFileSync(REGISTRY_FILE, 'utf8');
    const block = src.match(/export const REGISTRY\s*=\s*\{([\s\S]*?)\}/);
    if (block) {
      const live = [...block[1].matchAll(/['"]([\w-]+)['"]\s*:/g)].map((m) => m[1]);
      const known = Object.keys(EXERCISE_TYPES);
      for (const t of live) {
        if (!known.includes(t)) {
          errors.push(`${REGISTRY_FILE}:1  il tipo «${t}» è registrato nel sito ma il validatore non lo controlla: aggiungilo a EXERCISE_TYPES in tools/validate-lessons.mjs`);
        }
      }
      for (const t of known) {
        if (!live.includes(t)) {
          errors.push(`tools/validate-lessons.mjs:1  il validatore controlla il tipo «${t}» ma il sito non lo registra più in ${REGISTRY_FILE}`);
        }
      }
    }
  }
}

run();

if (errors.length) {
  console.error(`\n✗ ${errors.length} ${errors.length === 1 ? 'problema' : 'problemi'} nei contenuti:\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('');

  /* Su GitHub gli errori vengono anche annotati sulla riga giusta del file,
     così si vedono nel diff senza aprire il log dell'azione. */
  if (process.env.GITHUB_ACTIONS) {
    for (const e of errors) {
      const m = e.match(/^(\S+?):(\d+)\s+([\s\S]*)$/);
      if (!m) continue;
      const testo = m[3].replace(/\r?\n/g, '%0A');
      console.log(`::error file=${m[1]},line=${m[2]}::${testo}`);
    }
  }

  process.exit(1);
}

console.log(`✓ ${checked} lezioni validate, nessun problema.`);
