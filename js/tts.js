/* Sintesi vocale italiana con l'API del browser.
   Se non c'è nessuna voce italiana disponibile, `available()` resta false:
   l'interfaccia nasconde i pulsanti audio e salta gli esercizi di ascolto,
   senza messaggi d'errore. */

import { el } from './util.js';

const SLOW = 0.7;
const NORMAL = 1;

let italianVoice = null;
let checked = false;

function findItalianVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.find((v) => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith('it')) || null;
}

// Le voci arrivano in modo asincrono: aspettiamo l'evento, ma non all'infinito.
export function ready() {
  return new Promise((resolve) => {
    if (checked) return resolve(available());
    if (!('speechSynthesis' in window)) {
      checked = true;
      return resolve(false);
    }

    const finish = () => {
      if (checked) return;
      checked = true;
      italianVoice = findItalianVoice();
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve(available());
    };

    italianVoice = findItalianVoice();
    if (italianVoice) return finish();

    window.speechSynthesis.addEventListener('voiceschanged', finish);
    setTimeout(finish, 1200);
  });
}

export function available() {
  return Boolean(italianVoice);
}

export function speak(text, rate = NORMAL) {
  if (!available()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.voice = italianVoice;
  utterance.lang = 'it-IT';
  utterance.rate = rate;
  synth.speak(utterance);
}

// Coppia di pulsanti: velocità normale e velocità lenta.
export function audioControls(text, label = text) {
  const wrap = el('span', { class: 'audio' });
  wrap.append(
    el('button', {
      type: 'button',
      class: 'normal',
      title: 'Escuchar',
      'aria-label': `Escuchar: ${label}`,
      onclick: () => speak(text, NORMAL)
    }, '🔊'),
    el('button', {
      type: 'button',
      class: 'slow',
      title: 'Escuchar despacio',
      'aria-label': `Escuchar despacio: ${label}`,
      onclick: () => speak(text, SLOW)
    }, '🐢')
  );
  return wrap;
}
