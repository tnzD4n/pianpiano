/* Marca il nome della cache con l'impronta dei contenuti.
     node tools/stamp-sw.mjs          riscrive il nome
     node tools/stamp-sw.mjs --check  verifica che sia aggiornato (per la CI)

   Perché serve. La strategia è cache-first: finché il nome della cache non
   cambia, il browser continua a servire la copia locale e le modifiche non
   arrivano mai. Ricordarsi di alzare il numero a mano a ogni pubblicazione
   è una cosa che si dimentica una volta su tre, e il guasto non si vede in
   locale: si vede solo sul telefono di chi usa il sito, che resta indietro
   di settimane senza un errore da nessuna parte.

   Così invece il nome contiene l'impronta di tutto ciò che sta in cache:
   qualsiasi modifica al codice, allo stile o alle lezioni produce un nome
   nuovo, il service worker si accorge del cambiamento e compare l'avviso
   «hay una versión nueva». Il prefisso `pianpiano-v1` resta, per poterlo
   alzare a mano quando cambia la struttura della cache. */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readShell } from './lib/sw-shell.mjs';

const SW = 'sw.js';
const PREFIX = 'pianpiano-v1';
const LINE = /const CACHE = '[^']*';/;

const source = readFileSync(SW, 'utf8');

if (!LINE.test(source)) {
  console.error(`${SW}:1  non trovo la riga «const CACHE = '...';»`);
  process.exit(1);
}

/* --- Che cosa entra nell'impronta --- */

const shell = readShell(source);
if (!shell) {
  console.error(`${SW}:1  non trovo la costante SHELL`);
  process.exit(1);
}

const files = new Set();

for (const entry of shell) {
  const path = entry.replace(/^\.\//, '');
  if (path && existsSync(path)) files.add(path);
}

// Le lezioni non sono nell'elenco (le ricava course.json), ma stanno in cache.
if (existsSync('data/lessons')) {
  for (const name of readdirSync('data/lessons')) {
    if (name.endsWith('.json')) files.add(`data/lessons/${name}`);
  }
}

/* Anche il service worker stesso: se cambia la sua logica, la cache va
   rifatta. La riga del nome viene neutralizzata, altrimenti l'impronta
   dipenderebbe da sé stessa e non si stabilizzerebbe mai. */
const swNeutral = source.replace(LINE, "const CACHE = '<stamp>';");

const hash = createHash('sha256');
for (const path of [...files].sort()) {
  hash.update(path);
  hash.update('\0');
  hash.update(readFileSync(path));
  hash.update('\0');
}
hash.update('sw.js\0');
hash.update(swNeutral);

const stamp = hash.digest('hex').slice(0, 8);
const wanted = `${PREFIX}-${stamp}`;
const current = source.match(/const CACHE = '([^']*)';/)[1];

if (process.argv.includes('--check')) {
  if (current !== wanted) {
    console.error(`\n✗ Il nome della cache non è aggiornato.`);
    console.error(`    trovato:  ${current}`);
    console.error(`    atteso:   ${wanted}`);
    console.error(`\n  I contenuti sono cambiati ma il nome della cache no: chi ha già`);
    console.error(`  il sito installato continuerebbe a vedere la versione vecchia.`);
    console.error(`  Esegui «node tools/stamp-sw.mjs» e aggiungi sw.js al commit.\n`);
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::error file=sw.js,line=1::Nome della cache non aggiornato: atteso ${wanted}. Esegui 'node tools/stamp-sw.mjs'.`);
    }
    process.exit(1);
  }
  console.log(`✓ nome della cache aggiornato: ${current} (${files.size + 1} file nell'impronta)`);
  process.exit(0);
}

if (current === wanted) {
  console.log(`Nessuna modifica: ${current} è già aggiornato.`);
} else {
  writeFileSync(SW, source.replace(LINE, `const CACHE = '${wanted}';`));
  console.log(`${current}  →  ${wanted}   (${files.size + 1} file nell'impronta)`);
}
