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

## Pubblicare su GitHub Pages

1. Metti tutto alla radice del repository (compreso il file vuoto `.nojekyll`).
2. `Settings → Pages → Source: Deploy from a branch`, ramo `main`, cartella `/ (root)`.
3. Il sito esce su `https://<utente>.github.io/<repo>/`. Tutti i percorsi sono
   relativi, quindi funziona anche in una sottocartella senza toccare niente.

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
index.html            impalcatura, avviso file://, meta noindex
css/style.css         tema chiaro e scuro (prefers-color-scheme)
js/app.js             bootstrap e router a hash (#/, #/modulo/:id, #/lezione/:id, #/repaso)
js/store.js           localStorage versionato, avanzamento, streak, import/export
js/srs.js             Leitner a 5 scatole, intervalli 1-3-7-16-35 giorni
js/tts.js             sintesi vocale it-IT, velocità 1.0 e 0.7
js/util.js            DOM, date, mini-markdown, articoli, confronto risposte
js/render/*.js        home, modulo, lezione, ripasso
js/exercises/index.js registro tipo → modulo
data/course.json      indice dei moduli e delle lezioni
data/lessons/*.json   il contenuto vero e proprio
```
