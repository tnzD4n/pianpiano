/* Registro dei tipi di esercizio: tipo -> modulo.
   Per aggiungerne uno basta creare il file, importarlo e metterlo qui:
   ogni modulo espone `render(data, onAnswer)` e restituisce un elemento DOM. */

import * as multipleChoice from './multiple-choice.js';
import * as fillInTheBlank from './fill-in-the-blank.js';
import * as matching from './matching.js';
import * as wordOrder from './word-order.js';
import * as translation from './translation.js';
import * as listening from './listening.js';
import * as tts from '../tts.js';

export const REGISTRY = {
  'multiple-choice': multipleChoice,
  'fill-in-the-blank': fillInTheBlank,
  'matching': matching,
  'word-order': wordOrder,
  'translation': translation,
  'listening': listening
};

export const LABEL = {
  'multiple-choice': 'Elige la opción correcta',
  'fill-in-the-blank': 'Completa la frase',
  'matching': 'Une las parejas',
  'word-order': 'Ordena las palabras',
  'translation': 'Traduce al italiano',
  'listening': 'Escucha y escribe'
};

// Un esercizio è utilizzabile se il tipo esiste e, per l'ascolto,
// se il browser ha davvero una voce italiana.
export function isUsable(type) {
  if (!REGISTRY[type]) return false;
  if (type === 'listening') return tts.available();
  return true;
}

export function renderExercise(data, onAnswer) {
  if (!isUsable(data.type)) return null;
  return REGISTRY[data.type].render(data, onAnswer);
}
