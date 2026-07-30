# Pian piano · italiano desde cero

Corso statico di italiano (livello A1) per ispanofoni. HTML, CSS e JavaScript vanilla
con moduli ES: nessun build step, nessuna dipendenza, nessuna richiesta di rete verso
l'esterno. I progressi vivono solo nel `localStorage` del browser (`pianpiano.v1`).

## Provarlo in locale

I browser bloccano i moduli ES e `fetch()` sotto `file://`, quindi serve un
server statico qualsiasi:

```
python -m http.server 8000
```

Poi apri `http://localhost:8000/`.

## Controlli

Nessuna dipendenza da installare: sono tutti script che usano solo i moduli
built-in di Node. La GitHub Action `.github/workflows/validate.yml` li lancia
a ogni push.

```
node tools/validate-lessons.mjs      # schema e coerenza dei contenuti
node tools/test-diff.mjs             # confronto risposte e consonanti doppie
node tools/test-validator.mjs        # il validatore sa anche bocciare
node tools/test-cache-list.mjs       # elenco offline completo, manifest coerente
node tools/test-store-migration.mjs  # migrazione dei progressi salvati
node tools/test-rebels.mjs           # contatori e classifica delle rebeldes
node tools/stamp-sw.mjs --check      # nome della cache aggiornato ai contenuti
node tools/check-contrast.mjs        # contrasto WCAG nei due temi
```

Due script rigenerano file invece di controllarli:

```
node tools/make-icons.mjs            # icone della PWA, da assets/icons/icon.svg
node tools/stamp-sw.mjs              # riscrive il nome della cache in sw.js
```

E uno, l'unico che tocca la rete, si lancia a mano una volta sola e non sta
nella CI (i font stanno nel repository, il sito non scarica niente):

```
node tools/fetch-fonts.mjs           # scarica Lora e Inter in assets/fonts/
```

## Caratteri

Due famiglie, self-hosted, licenza SIL OFL 1.1 (il testo della licenza sta
accanto ai file). La divisione è di sostanza, non decorativa:

* **Lora**, serif caldo → tutto ciò che è in italiano: parole, frasi, esercizi;
* **Inter**, sans neutro → l'interfaccia e le spiegazioni in spagnolo.

Sono varianti variabili con il solo sottoinsieme latino: quattro file, 174 kB
in tutto, tondo e corsivo per famiglia. La scala tipografica ha rapporto 1.25
(`--step--1` … `--step-4`) e la base sta su `html` in percentuale, non in px,
perché il corpo del testo deve seguire le preferenze del browser.

## Pubblicare su GitHub Pages

1. Metti tutto alla radice del repository (compreso il file vuoto `.nojekyll`).
2. `Settings → Pages → Source: Deploy from a branch`, ramo `main`, cartella `/ (root)`.
3. Il sito esce su `https://<utente>.github.io/<repo>/`. Tutti i percorsi sono
   relativi, quindi funziona anche in una sottocartella senza toccare niente.

**Prima di ogni pubblicazione**: `node tools/stamp-sw.mjs`. La strategia della
cache è cache-first, quindi chi ha già il sito installato continua a vedere la
versione vecchia finché il nome della cache non cambia. Lo script calcola
l'impronta dei file e riscrive il nome; la CI blocca il push se te ne dimentichi.

## Aggiungere una lezione

1. L'indice del corso è `data/course.json`: 11 moduli e 44 lezioni, con il campo
   `file` che punta al JSON di ciascuna. Non serve modificarlo per aggiungere
   contenuto, solo per cambiare titoli o ordine.
2. Crea il file indicato da `file`, per esempio `data/lessons/m02-l01.json`,
   seguendo lo schema qui sotto.
3. Ricarica la pagina. Non si tocca una riga di codice: il motore legge il JSON,
   costruisce la lezione, genera gli esercizi e alimenta il ripasso spaziato.

Le voci di `vocab` e `phrases` entrano da sole nel sistema di ripasso (scatola 1)
la prima volta che la lezione viene aperta.

## Schema di una lezione

```json
{
  "id": "m01-l01",
  "module": "m01",
  "title": "Saludar y despedirse",
  "goal": "Al final de esta lección sabrás…",
  "vocab": [
    { "it": "cena", "es": "la cena", "gender": "f", "plural": "cene", "note": "Se lee /CHE-na/." }
  ],
  "grammar": [
    {
      "heading": "Tú y usted",
      "body": "Testo in spagnolo. Accetta **grassetto**, *corsivo* e `codice`.",
      "table": { "headers": ["Persona", "Italiano"], "rows": [["io", "sono"], ["tu", "sei"]] }
    }
  ],
  "phrases": [
    { "it": "Come ti chiami?", "es": "¿Cómo te llamas?", "note": "informal" }
  ],
  "ojo": [
    { "title": "«Burro» no es un burro", "body": "En italiano *burro* significa mantequilla…" }
  ],
  "exercises": []
}
```

Campi:

- **`vocab[].it`** è il sostantivo nudo, senza articolo: `"cena"`, non `"la cena"`.
  Ci pensa il motore a mostrare `la cena` e, se c'è `plural`, `(pl. le cene)`.
- **`vocab[].gender`** vale `"m"`, `"f"` o `null`. Con `null` non viene mostrato
  nessun articolo (avverbi, saluti, espressioni).
- **`plural`** e **`note`** sono opzionali: metti `null` se non servono.
- **`grammar[].table`** è opzionale; `body` accetta il mini-markdown
  (`**grassetto**`, `*corsivo*`, `` `codice` ``) e i paragrafi si separano con una
  riga vuota.
- Tutti i testi esplicativi vanno **in spagnolo**; in italiano solo ciò che si impara.

## Schema degli esercizi

Sei tipi, tutti con la stessa interfaccia interna `render(data, onAnswer)`.
Il campo `explain` è sempre opzionale e appare come spiegazione dopo la risposta.

```json
[
  { "type": "multiple-choice",
    "prompt": "¿Cómo saludas a las 9 de la mañana?",
    "options": ["Buonasera", "Buongiorno", "Buonanotte"],
    "answer": 1,
    "explain": "Buongiorno se usa hasta media tarde." },

  { "type": "fill-in-the-blank",
    "prompt": "Io ___ spagnola.",
    "answer": ["sono"],
    "explain": "Primera persona de essere." },

  { "type": "matching",
    "pairs": [["ciao", "hola"], ["grazie", "gracias"]] },

  { "type": "word-order",
    "words": ["Come", "ti", "chiami", "?"],
    "answer": "Come ti chiami?" },

  { "type": "translation",
    "prompt": "¿Cómo te llamas?",
    "answer": ["Come ti chiami?", "Come si chiama?"] },

  { "type": "listening",
    "audio": "Buongiorno, come sta?",
    "answer": ["Buongiorno, come sta?"] }
]
```

Note:

- `answer` è **sempre un array** tranne in `word-order` (una stringa sola) e in
  `multiple-choice` (l'indice dell'opzione giusta). Metti nell'array tutte le
  varianti accettabili.
- Il confronto è normalizzato: maiuscole/minuscole indifferenti, spazi multipli
  collassati, punteggiatura finale ignorata, virgole ignorate ovunque (in un
  dettato non si sentono), apostrofi tipografici uniformati.
  Gli **accenti contano**: se la risposta è giusta a meno dell'accento viene
  accettata, ma con un avviso che mostra la forma corretta.
- `listening` richiede una voce italiana nel browser. Se non c'è, quegli esercizi
  spariscono, i pulsanti audio si nascondono e la lezione si completa lo stesso.
- Una lezione è `completada` quando tutti i suoi esercizi utilizzabili sono stati
  risolti almeno una volta. Non c'è nessuna penalità per gli errori.

## Struttura

```
index.html            impalcatura, avviso file://, meta noindex, manifest e icone
manifest.webmanifest  PWA installabile, percorsi relativi
sw.js                 service worker, cache-first, nome cache con impronta
css/style.css         tema chiaro e scuro (prefers-color-scheme)
js/app.js             bootstrap e router a hash (#/, #/modulo/:id, #/lezione/:id,
                      #/repaso, #/repaso/rebeldes, #/rebeldes, #/escucha)
js/store.js           localStorage versionato, avanzamento, streak, copie di sicurezza
js/srs.js             Leitner a 5 scatole, intervalli 1-3-7-16-35 giorni
js/tts.js             sintesi vocale it-IT, velocità 1.0 e 0.7
js/util.js            DOM, date, mini-markdown, articoli, campi di risposta, riscontro
js/diff.js            allineamento lettera per lettera, consonanti doppie
js/pwa.js             registrazione del service worker e avviso di versione nuova
js/render/*.js        home, modulo, lezione, ripasso, rebeldes, solo-ascolto
js/exercises/index.js registro tipo → modulo
data/course.json      indice dei moduli e delle lezioni
data/lessons/*.json   il contenuto vero e proprio
assets/icons/         icone generate da tools/make-icons.mjs
assets/fonts/         Lora e Inter in woff2, con le licenze OFL
tools/                validatore, controlli, generatori (nessuna dipendenza npm)
```
