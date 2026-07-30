/* Controlli del confronto lettera per lettera.
   Nessuna dipendenza: `node tools/test-diff.mjs` dalla radice del progetto. */

import { alignChars, geminationDiff, geminationMessage } from '../js/diff.js';

let fails = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`FAIL ${label}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${label}`);
}

const render = (given, expected) => {
  const { ops } = alignChars(given, expected);
  let mine = '', good = '';
  for (const o of ops) {
    if (o.op === 'equal') { mine += o.a; good += o.b; }
    else if (o.op === 'sub') { mine += `[-${o.a}-]`; good += `[+${o.b}+]`; }
    else if (o.op === 'extra') { mine += `[-${o.a}-]`; }
    else { good += `[+${o.b}+]`; }
  }
  return { mine, good };
};

// --- allineamento ---
eq('identiche, distanza 0', alignChars('ciao', 'ciao').distance, 0);
eq('maiuscole ignorate', alignChars('Ciao', 'ciao').distance, 0);
// Quale delle due «l» venga marcata è indifferente: il testo reso è identico.
eq('lettera mancante', render('pala', 'palla'), { mine: 'pala', good: 'pa[+l+]la' });
eq('lettera di troppo', render('palla', 'pala'), { mine: 'pa[-l-]la', good: 'pala' });
// La riga ricostruita deve sempre coincidere con la stringa di partenza.
const strip = (s) => s.replace(/\[[-+]|[-+]\]/g, '');
eq('ricostruzione riga sinistra', strip(render('pala', 'palla').mine), 'pala');
eq('ricostruzione riga destra', strip(render('pala', 'palla').good), 'palla');
eq('ricostruzione frase', strip(render('buonasera comesta', 'buonasera come sta').good), 'buonasera come sta');
eq('sostituzione', render('come stai', 'come stia'), { mine: 'come st[-a-][-i-]', good: 'come st[+i+][+a+]' });
eq('frase con spazio mancante', render('buonasera comesta', 'buonasera come sta').good, 'buonasera come[+ +]sta');
eq('stringa vuota', alignChars('', 'ciao').distance, 4);
eq('accento come sostituzione', render('perche', 'perché'), { mine: 'perch[-e-]', good: 'perch[+é+]' });

// --- doppie ---
eq('pala -> palla', geminationDiff('pala', 'palla'), { letter: 'l', shouldDouble: true });
eq('palla -> pala', geminationDiff('palla', 'pala'), { letter: 'l', shouldDouble: false });
eq('nono -> nonno', geminationDiff('nono', 'nonno'), { letter: 'n', shouldDouble: true });
eq('sete -> sette', geminationDiff('sete', 'sette'), { letter: 't', shouldDouble: true });
eq('casa -> cassa', geminationDiff('casa', 'cassa'), { letter: 's', shouldDouble: true });
eq('dentro una frase', geminationDiff('ho sete grazie', 'ho sette grazie'), { letter: 't', shouldDouble: true });
eq('identiche -> nessuna doppia', geminationDiff('ciao', 'ciao'), null);
eq('altra differenza -> null', geminationDiff('come stai', 'come sta'), null);
eq('parola diversa -> null', geminationDiff('gatto', 'cane'), null);
eq('vocale doppia non conta', geminationDiff('idea', 'ideaa'), null);
eq('sostituzione non e doppia', geminationDiff('pane', 'pana'), null);

console.log('\n' + geminationMessage({ letter: 'n', shouldDouble: true }));
console.log(geminationMessage({ letter: 'l', shouldDouble: false }));
console.log(geminationMessage({ letter: 'b', shouldDouble: true }));

console.log(fails ? `\n${fails} test falliti` : '\nTutti i test passati.');
process.exit(fails ? 1 : 0);
