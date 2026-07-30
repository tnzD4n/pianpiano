/* Genera le icone della PWA partendo da una descrizione vettoriale.
   `node tools/make-icons.mjs` dalla radice del progetto.

   Niente dipendenze e niente servizi esterni: le forme sono cerchi e
   rettangoli arrotondati, quindi si possono sia scrivere in SVG sia
   disegnare pixel per pixel qui dentro. Il risultato è identico su
   qualsiasi macchina, senza dipendere dai font installati.

   Il segno è «pp»: in musica il pianissimo, e le iniziali di «Pian piano». */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'assets/icons';

const ACCENT = [0x1e, 0x5f, 0x82];   // --accent del tema chiaro
const INK = [0xff, 0xff, 0xff];

/* ---------- Geometria della lettera «p», in unità di corpo ----------
   L'origine è sulla linea di base, a sinistra dell'asta.           */

const STEM = { x0: 0.04, x1: 0.24, yTop: -0.68, yBot: 0.42, r: 0.10 };
const BOWL = { cx: 0.44, cy: -0.34, outer: 0.34, inner: 0.155 };
const ADVANCE = 0.86;                // distanza fra le due «p»
const GLYPHS = 2;

// Riquadro dell'inchiostro, dal bordo sinistro della prima asta
// al bordo destro dell'ultima pancia.
const INK_X0 = STEM.x0;
const INK_X1 = (GLYPHS - 1) * ADVANCE + Math.max(STEM.x1, BOWL.cx + BOWL.outer);
const INK_Y0 = STEM.yTop;
const INK_Y1 = STEM.yBot;
const INK_W = INK_X1 - INK_X0;
const INK_H = INK_Y1 - INK_Y0;

/* ---------- Test di appartenenza ---------- */

function inRoundedRect(px, py, x, y, w, h, r) {
  const dx = Math.max(x + r - px, 0, px - (x + w - r));
  const dy = Math.max(y + r - py, 0, py - (y + h - r));
  return dx * dx + dy * dy <= r * r;
}

function inCircle(px, py, cx, cy, rad) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= rad * rad;
}

// Coordinate già riportate al corpo della singola «p».
function inGlyph(gx, gy) {
  const stem = inRoundedRect(gx, gy, STEM.x0, STEM.yTop, STEM.x1 - STEM.x0, STEM.yBot - STEM.yTop, STEM.r);
  if (stem) return true;
  const bowl = inCircle(gx, gy, BOWL.cx, BOWL.cy, BOWL.outer) &&
    !inCircle(gx, gy, BOWL.cx, BOWL.cy, BOWL.inner);
  return bowl;
}

/* ---------- Disegno ---------- */

/* opts: { size, markWidth, rounded }
   `markWidth` è la frazione del lato occupata dal segno; per l'icona
   «maskable» si stringe, perché il sistema operativo può ritagliare
   fino al cerchio centrale dell'80%. */
function draw({ size, markWidth, rounded }) {
  const s = (markWidth * size) / INK_W;
  const originX = size / 2 - ((INK_X0 + INK_X1) / 2) * s;
  const baseline = size / 2 - ((INK_Y0 + INK_Y1) / 2) * s;
  const radius = rounded ? size * 0.22 : 0;

  const px = Buffer.alloc(size * size * 4);
  const SS = 4;                        // 4×4 sotto-campioni: bordi morbidi
  const step = 1 / SS;
  const start = step / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bg = 0;
      let ink = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const cx = x + start + sx * step;
          const cy = y + start + sy * step;
          if (rounded && !inRoundedRect(cx, cy, 0, 0, size, size, radius)) continue;
          bg += 1;
          const gy = (cy - baseline) / s;
          let hit = false;
          for (let i = 0; i < GLYPHS && !hit; i++) {
            const gx = (cx - originX) / s - i * ADVANCE;
            if (inGlyph(gx, gy)) hit = true;
          }
          if (hit) ink += 1;
        }
      }
      const total = SS * SS;
      const alpha = bg / total;
      const inkPart = ink / total;
      const o = (y * size + x) * 4;
      if (alpha === 0) continue;
      // L'inchiostro si fonde sul fondo, poi si applica l'opacità del fondo.
      const k = inkPart / alpha;
      for (let c = 0; c < 3; c++) {
        px[o + c] = Math.round(ACCENT[c] * (1 - k) + INK[c] * k);
      }
      px[o + 3] = Math.round(alpha * 255);
    }
  }
  return { px, size };
}

/* ---------- Scrittura del PNG ---------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png({ px, size }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // 8 bit per canale
  ihdr[9] = 6;      // RGBA
  ihdr[10] = 0;     // deflate
  ihdr[11] = 0;     // filtro adattivo
  ihdr[12] = 0;     // non interlacciato

  // Ogni riga è preceduta dal byte di filtro (0 = nessuno).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const from = y * size * 4;
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, from, from + size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- Sorgente SVG, dalla stessa geometria ---------- */

function svg(size = 512) {
  const markWidth = 0.62;
  const s = (markWidth * size) / INK_W;
  const originX = size / 2 - ((INK_X0 + INK_X1) / 2) * s;
  const baseline = size / 2 - ((INK_Y0 + INK_Y1) / 2) * s;
  const n = (v) => Number(v.toFixed(2));
  const hex = '#' + ACCENT.map((c) => c.toString(16).padStart(2, '0')).join('');

  let marks = '';
  for (let i = 0; i < GLYPHS; i++) {
    const dx = originX + i * ADVANCE * s;
    marks += `
    <rect x="${n(dx + STEM.x0 * s)}" y="${n(baseline + STEM.yTop * s)}" ` +
      `width="${n((STEM.x1 - STEM.x0) * s)}" height="${n((STEM.yBot - STEM.yTop) * s)}" ` +
      `rx="${n(STEM.r * s)}" fill="#fff"/>
    <path d="M ${n(dx + (BOWL.cx - BOWL.outer) * s)} ${n(baseline + BOWL.cy * s)} ` +
      `a ${n(BOWL.outer * s)} ${n(BOWL.outer * s)} 0 1 0 ${n(2 * BOWL.outer * s)} 0 ` +
      `a ${n(BOWL.outer * s)} ${n(BOWL.outer * s)} 0 1 0 ${n(-2 * BOWL.outer * s)} 0 Z ` +
      `M ${n(dx + (BOWL.cx - BOWL.inner) * s)} ${n(baseline + BOWL.cy * s)} ` +
      `a ${n(BOWL.inner * s)} ${n(BOWL.inner * s)} 0 1 1 ${n(2 * BOWL.inner * s)} 0 ` +
      `a ${n(BOWL.inner * s)} ${n(BOWL.inner * s)} 0 1 1 ${n(-2 * BOWL.inner * s)} 0 Z" ` +
      `fill="#fff" fill-rule="evenodd"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <title>Pian piano</title>
  <rect width="${size}" height="${size}" rx="${n(size * 0.22)}" fill="${hex}"/>${marks}
</svg>
`;
}

/* ---------- Esecuzione ---------- */

mkdirSync(OUT, { recursive: true });

const files = [
  ['icon-192.png', { size: 192, markWidth: 0.62, rounded: true }],
  ['icon-512.png', { size: 512, markWidth: 0.62, rounded: true }],
  // Zona di sicurezza: il sistema può ritagliare fino al cerchio centrale.
  ['icon-maskable-512.png', { size: 512, markWidth: 0.50, rounded: false }],
  // iOS applica da sé gli angoli arrotondati: qui il fondo arriva al bordo.
  ['apple-touch-icon.png', { size: 180, markWidth: 0.62, rounded: false }],
  ['favicon-32.png', { size: 32, markWidth: 0.70, rounded: true }],
  ['favicon-16.png', { size: 16, markWidth: 0.74, rounded: true }]
];

for (const [name, opts] of files) {
  const buf = png(draw(opts));
  writeFileSync(`${OUT}/${name}`, buf);
  console.log(`${OUT}/${name}  ${opts.size}×${opts.size}  ${(buf.length / 1024).toFixed(1)} kB`);
}

writeFileSync(`${OUT}/icon.svg`, svg());
console.log(`${OUT}/icon.svg  sorgente vettoriale`);
