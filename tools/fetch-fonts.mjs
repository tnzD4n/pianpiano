/* Scarica i font nel repository. UNA VOLTA SOLA, a mano:
     node tools/fetch-fonts.mjs

   NON va nella CI e NON viene mai eseguito dal sito. È l'unico script del
   progetto che tocca la rete, e serve proprio a non doverla toccare mai più:
   i .woff2 finiscono in assets/fonts/ e vengono pubblicati con il sito, così
   in pagina non c'è nessuna richiesta verso l'esterno.

   Due famiglie, entrambe con licenza SIL Open Font License 1.1:
     Newsreader   serif da lettura → tutto ciò che è in italiano
     Public Sans  sans da interfaccia → lo spagnolo di servizio

   Si prendono le varianti variabili (un file copre tutti i pesi da 400 a 700)
   e solo il sottoinsieme latino, che è l'unico che serve a spagnolo e
   italiano. La licenza OFL richiede di distribuire il testo della licenza
   insieme ai font: viene scaricata anche quella. */

import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'assets/fonts';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* Le famiglie, con il nome del file locale per ciascuno stile. */
const FAMILIES = [
  {
    name: 'Newsreader',
    /* `opsz` fissato a 16 e non lasciato libero da 6 a 72: l'asse della
       dimensione ottica raddoppia il peso del file (129 kB contro 56 kB) e
       qui non serve, perché il testo italiano sta fra 16 e 31 px. */
    query: 'family=Newsreader:ital,opsz,wght@0,16,400..700;1,16,400..700',
    license: 'https://raw.githubusercontent.com/google/fonts/main/ofl/newsreader/OFL.txt',
    licenseFile: 'Newsreader-OFL.txt',
    files: { normal: 'newsreader-latin-variable.woff2', italic: 'newsreader-latin-italic-variable.woff2' }
  },
  {
    name: 'Public Sans',
    query: 'family=Public+Sans:ital,wght@0,400..700;1,400..700',
    license: 'https://raw.githubusercontent.com/google/fonts/main/ofl/publicsans/OFL.txt',
    licenseFile: 'PublicSans-OFL.txt',
    files: { normal: 'publicsans-latin-variable.woff2', italic: 'publicsans-latin-italic-variable.woff2' }
  }
];

mkdirSync(OUT, { recursive: true });

async function get(url, asText = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
}

/* Nel CSS di Google Fonts ogni @font-face è precedute da un commento con il
   nome del sottoinsieme: /* latin *​/. Ci interessa solo quello, non
   cyrillic né greek né vietnamese. */
function findLatin(css, style) {
  const blocks = css.split('@font-face').slice(1);
  for (const block of blocks) {
    const isStyle = new RegExp(`font-style:\\s*${style}\\b`).test(block);
    if (!isStyle) continue;
    // «latin» e non «latin-ext»: il commento sta prima del blocco successivo.
    const range = block.match(/unicode-range:\s*([^;]+);/);
    const url = block.match(/url\((https:[^)]+\.woff2)\)/);
    if (!range || !url) continue;
    // Il sottoinsieme latino di base contiene sempre U+0000-00FF.
    if (/U\+0000-00FF/.test(range[1])) {
      return { url: url[1], range: range[1].trim() };
    }
  }
  return null;
}

const summary = [];

for (const family of FAMILIES) {
  const css = await get(
    `https://fonts.googleapis.com/css2?${family.query}&display=swap`, true);

  for (const [style, filename] of Object.entries(family.files)) {
    const found = findLatin(css, style);
    if (!found) {
      console.error(`  ! ${family.name} ${style}: sottoinsieme latino non trovato, salto`);
      continue;
    }
    const buf = await get(found.url);
    writeFileSync(`${OUT}/${filename}`, buf);
    summary.push({ file: filename, kB: +(buf.length / 1024).toFixed(1), range: found.range });
    console.log(`${OUT}/${filename}  ${(buf.length / 1024).toFixed(1)} kB  (${family.name} ${style})`);
  }

  const license = await get(family.license, true);
  writeFileSync(`${OUT}/${family.licenseFile}`, license);
  console.log(`${OUT}/${family.licenseFile}  licenza OFL`);
}

const total = summary.reduce((n, f) => n + f.kB, 0);
console.log(`\nTotale font: ${total.toFixed(1)} kB in ${summary.length} file.`);
console.log('Ricordati di rigenerare l\'impronta della cache: node tools/stamp-sw.mjs');
