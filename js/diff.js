/* Confronto carattere per carattere fra la risposta data e quella giusta.
   Modulo puro: nessun accesso al DOM, nessuna dipendenza.
   Chi disegna il riscontro è `showFeedback` in util.js.

   Due cose servono a chi impara l'italiano partendo dallo spagnolo:
     1. vedere *dove* si è sbagliato, non solo *che* si è sbagliato;
     2. riconoscere l'errore di consonante doppia, che in italiano
        non è un refuso ma un'altra parola. */

/* ---------- Allineamento (Levenshtein con ricostruzione del percorso) ---------- */

// Maiuscole e minuscole non contano: il confronto delle risposte le ignora già.
function same(x, y) {
  return x === y || x.toLowerCase() === y.toLowerCase();
}

/* Restituisce { ops, distance }, dove `ops` è la sequenza di operazioni
   che trasforma `given` in `expected`, in ordine di lettura:
     equal   la lettera è a posto
     sub     lettera sbagliata (a = quella scritta, b = quella giusta)
     extra   lettera di troppo nella risposta data (b = null)
     missing lettera mancante nella risposta data (a = null)          */
export function alignChars(given, expected) {
  const a = Array.from(String(given).normalize('NFC'));
  const b = Array.from(String(expected).normalize('NFC'));
  const n = a.length;
  const m = b.length;

  // d[i][j] = costo minimo per trasformare i primi i caratteri di a
  //           nei primi j caratteri di b.
  const d = [];
  for (let i = 0; i <= n; i++) {
    d.push(new Array(m + 1).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) d[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = same(a[i - 1], b[j - 1]) ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }

  // Si torna indietro dall'angolo in basso a destra fino all'origine.
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const diagonal = i > 0 && j > 0 &&
      d[i][j] === d[i - 1][j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1);
    if (diagonal) {
      ops.push(same(a[i - 1], b[j - 1])
        ? { op: 'equal', a: a[i - 1], b: b[j - 1] }
        : { op: 'sub', a: a[i - 1], b: b[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ op: 'extra', a: a[i - 1], b: null });
      i -= 1;
    } else {
      ops.push({ op: 'missing', a: null, b: b[j - 1] });
      j -= 1;
    }
  }

  ops.reverse();
  return { ops, distance: d[n][m] };
}

/* ---------- Consonanti doppie ---------- */

// L'italiano raddoppia queste; h, q e le vocali restano fuori.
const DOUBLABLE = 'bcdfglmnprstvz';

// "palla" -> [{ch:'p',n:1},{ch:'a',n:1},{ch:'l',n:2},{ch:'a',n:1}]
function runs(text) {
  const out = [];
  for (const ch of String(text).toLowerCase()) {
    const last = out[out.length - 1];
    if (last && last.ch === ch) last.n += 1;
    else out.push({ ch, n: 1 });
  }
  return out;
}

/* Se le due forme differiscono *solo* per una consonante raddoppiata o
   scempiata, restituisce { letter, shouldDouble }. Altrimenti null.
   Le due stringhe vanno passate già normalizzate. */
export function geminationDiff(given, expected) {
  const g = runs(given);
  const e = runs(expected);
  if (g.length !== e.length) return null;

  let found = null;
  for (let i = 0; i < g.length; i++) {
    if (g[i].ch !== e[i].ch) return null;
    if (g[i].n === e[i].n) continue;
    if (!DOUBLABLE.includes(e[i].ch)) return null;
    if (!found) found = { letter: e[i].ch, shouldDouble: e[i].n > g[i].n };
  }
  return found;
}

/* Coppie minime: la stessa parola con e senza doppia, e due significati
   diversi. Scegliamo quella che usa la consonante sbagliata, così l'esempio
   parla della lettera che ha davanti agli occhi in quel momento. */
const MINIMAL_PAIRS = {
  l: { single: 'pala', singleEs: 'pala', double: 'palla', doubleEs: 'pelota' },
  n: { single: 'nono', singleEs: 'noveno', double: 'nonno', doubleEs: 'abuelo' },
  t: { single: 'sete', singleEs: 'sed', double: 'sette', doubleEs: 'siete' },
  s: { single: 'casa', singleEs: 'casa', double: 'cassa', doubleEs: 'caja' }
};

export function minimalPair(letter) {
  return MINIMAL_PAIRS[letter] || MINIMAL_PAIRS.l;
}

// Messaggio in spagnolo, senza rimprovero: si spiega la regola, non l'errore.
export function geminationMessage(info) {
  const pair = minimalPair(info.letter);
  const where = info.shouldDouble
    ? `Aquí la **${info.letter}** va doble.`
    : `Aquí la **${info.letter}** va sencilla, no doble.`;
  return `${where} En italiano una consonante doble cambia la palabra: ` +
    `**${pair.single}** («${pair.singleEs}») y **${pair.double}** («${pair.doubleEs}») ` +
    `son dos palabras distintas.`;
}
