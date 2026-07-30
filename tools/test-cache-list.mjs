/* Controlla che l'elenco del service worker sia completo.
   `node tools/test-cache-list.mjs` dalla radice del progetto.

   Senza build step l'elenco in sw.js è scritto a mano, e dimenticarci un
   file non dà nessun errore visibile: il sito continua a funzionare online
   e si rompe solo offline, cioè proprio quando non si può più indagare.
   Questo controllo è il prezzo di non avere un build step. */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { readShell, readCacheName } from './lib/sw-shell.mjs';

const errors = [];

/* --- Prova di non-regressione del lettore ---
   Un apostrofo in un commento italiano si accoppiava con la virgoletta
   della riga dopo e sfalsava tutto l'elenco, senza dare errore. */
{
  const finto = "const SHELL = [\n  './a.js',  // niente d'altro\n" +
    "  './b.js',  /* un'altra nota */\n  './c.js'\n];";
  const letto = readShell(finto);
  if (JSON.stringify(letto) !== JSON.stringify(['./a.js', './b.js', './c.js'])) {
    errors.push(`tools/lib/sw-shell.mjs:1  gli apostrofi nei commenti rompono la lettura di SHELL: ${JSON.stringify(letto)}`);
  }
}

const sw = readFileSync('sw.js', 'utf8');
const shell = readShell(sw);
if (!shell) {
  console.error('sw.js:1  non trovo la costante SHELL');
  process.exit(1);
}
const shellSet = new Set(shell);

/* --- Tutti i moduli JS devono essere nell'elenco --- */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

for (const file of walk('js')) {
  if (!shellSet.has('./' + file)) {
    errors.push(`sw.js:1  «./${file}» esiste ma non è nell'elenco SHELL: offline non verrebbe caricato`);
  }
}

/* --- I fogli di stile, le icone e il manifest --- */
const extra = ['css/style.css', 'manifest.webmanifest', 'index.html'];
for (const file of extra) {
  if (existsSync(file) && !shellSet.has('./' + file)) {
    errors.push(`sw.js:1  «./${file}» non è nell'elenco SHELL`);
  }
}

if (existsSync('assets/icons')) {
  for (const name of readdirSync('assets/icons')) {
    if (!name.endsWith('.png')) continue;
    if (!shellSet.has(`./assets/icons/${name}`)) {
      errors.push(`sw.js:1  l'icona «./assets/icons/${name}» non è nell'elenco SHELL`);
    }
  }
}

// I font arriveranno con la fase C: quando esistono, devono entrare qui.
if (existsSync('assets/fonts')) {
  for (const name of readdirSync('assets/fonts')) {
    if (!name.endsWith('.woff2')) continue;
    if (!shellSet.has(`./assets/fonts/${name}`)) {
      errors.push(`sw.js:1  il font «./assets/fonts/${name}» non è nell'elenco SHELL`);
    }
  }
}

/* --- Nessuna voce che punta al vuoto --- */
for (const entry of shell) {
  if (entry === './') continue;
  const path = entry.replace(/^\.\//, '');
  if (!existsSync(path)) {
    errors.push(`sw.js:1  l'elenco SHELL cita «${entry}», che non esiste`);
  } else if (statSync(path).isDirectory()) {
    errors.push(`sw.js:1  l'elenco SHELL cita «${entry}», che è una cartella`);
  }
}

/* --- Il nome della cache deve essere versionato --- */
// Forma attesa: pianpiano-v1-<impronta>, vedi tools/stamp-sw.mjs.
const cacheName = readCacheName(sw);
if (!cacheName) {
  errors.push('sw.js:1  non trovo il nome della cache');
} else if (!/-v\d+(-[0-9a-f]{8})?$/.test(cacheName)) {
  errors.push(`sw.js:1  il nome della cache «${cacheName}» non è versionato: senza versione le cache vecchie non vengono sostituite`);
}

/* --- Registrazione con percorso relativo --- */
const pwa = readFileSync('js/pwa.js', 'utf8');
if (!/register\(\s*'\.\/sw\.js'/.test(pwa)) {
  errors.push("js/pwa.js:1  il service worker va registrato con './sw.js' (percorso relativo), altrimenti sotto /pianpiano/ l'ambito è sbagliato");
}

/* --- Il manifest deve usare percorsi relativi --- */
if (existsSync('manifest.webmanifest')) {
  const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  for (const [key, value] of Object.entries({ start_url: manifest.start_url, scope: manifest.scope })) {
    if (typeof value !== 'string' || !value.startsWith('.')) {
      errors.push(`manifest.webmanifest:1  ${key} deve essere relativo (es. "./"), non ${JSON.stringify(value)}`);
    }
  }
  for (const icon of manifest.icons || []) {
    if (icon.src.startsWith('/')) {
      errors.push(`manifest.webmanifest:1  l'icona «${icon.src}» ha un percorso assoluto: sotto /pianpiano/ non si troverebbe`);
    }
    if (!existsSync(icon.src)) {
      errors.push(`manifest.webmanifest:1  l'icona «${icon.src}» non esiste`);
    }
  }
  const purposes = (manifest.icons || []).map((i) => i.purpose);
  if (!purposes.includes('maskable')) {
    errors.push('manifest.webmanifest:1  manca un\'icona con purpose "maskable"');
  }
  const sizes = (manifest.icons || []).map((i) => i.sizes);
  for (const needed of ['192x192', '512x512']) {
    if (!sizes.includes(needed)) {
      errors.push(`manifest.webmanifest:1  manca l'icona ${needed}`);
    }
  }
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} ${errors.length === 1 ? 'problema' : 'problemi'}:\n`);
  for (const e of errors) console.error('  ' + e);
  console.error('');
  process.exit(1);
}

console.log(`✓ elenco offline completo: ${shell.length} voci nel guscio, manifest coerente.`);
