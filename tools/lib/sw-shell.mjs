/* Lettura dell'elenco SHELL da sw.js, condivisa fra gli strumenti.

   Sta in un file a parte per un motivo preciso: estrarre le stringhe con
   /'([^']+)'/ sembra funzionare finché in un commento non compare un
   apostrofo — «all'altro» — che si accoppia con la virgoletta della riga
   dopo e sfalsa tutto l'elenco senza dare errore. In italiano gli apostrofi
   nei commenti sono la norma, quindi i commenti vanno via prima. */

/* Toglie /* … *​/ e // … dalla fine della riga.
   Non è un parser JavaScript: non serve, perché in sw.js non ci sono
   stringhe che contengono le sequenze di apertura di un commento. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* Restituisce i percorsi dichiarati in `const SHELL = [ … ];`
   oppure null se la costante non c'è. */
export function readShell(source) {
  const clean = stripComments(source);
  const block = clean.match(/const SHELL\s*=\s*\[([\s\S]*?)\];/);
  if (!block) return null;
  return [...block[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

/* Il nome della cache dichiarato in sw.js, oppure null. */
export function readCacheName(source) {
  const m = stripComments(source).match(/const CACHE\s*=\s*'([^']*)'/);
  return m ? m[1] : null;
}
