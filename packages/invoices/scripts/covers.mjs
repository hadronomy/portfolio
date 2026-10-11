// Regenerates the invoice covers in src/covers. Run from this package with
// `node scripts/covers.mjs`; it needs ImageMagick 7 (`magick`) on PATH.
//
// Each cover is a field of petal shapes drawn from a palette and then
// motion-blurred, so it reads like a long-exposure photograph. The shapes and
// the grain share one fixed seed per palette, so a rerun redraws the same
// images.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const palettes = {
  ember: {
    seed: 7,
    base: ['#2a0d08', '#7a2410'],
    colors: [
      ['#d9531e', 5],
      ['#f2b233', 4],
      ['#f4e6cf', 3],
      ['#3a0f0a', 4],
      ['#1f6f78', 2],
      ['#9cc9d8', 2],
      ['#e8793a', 3],
    ],
  },
  tide: {
    seed: 19,
    base: ['#0b2233', '#1d5f6e'],
    colors: [
      ['#1d7f86', 5],
      ['#8fd0cf', 4],
      ['#eef3ee', 3],
      ['#0d2b3e', 4],
      ['#d9c3a0', 2],
      ['#e0764f', 1],
      ['#3fa3b0', 3],
    ],
  },
  moss: {
    seed: 31,
    base: ['#16280f', '#3f5a1d'],
    colors: [
      ['#6b7d2a', 5],
      ['#c8d65a', 4],
      ['#efe9d2', 3],
      ['#1f3a1c', 4],
      ['#b4532a', 1],
      ['#a9c6cf', 2],
      ['#8fae3a', 3],
    ],
  },
  rose: {
    seed: 43,
    base: ['#2b0f18', '#6e2034'],
    colors: [
      ['#d2566e', 5],
      ['#f2b7b0', 4],
      ['#f4d3b5', 3],
      ['#4a1020', 4],
      ['#7d9a82', 2],
      ['#e98a6a', 3],
      ['#b03a55', 3],
    ],
  },
};

// mulberry32: small, fast, and stable across Node versions.
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The canvas is larger than the crop so the one-sided motion blur never
// samples past an edge, which would smear black into the corners.
function petals({ seed, base, colors }) {
  const random = generator(seed);
  const width = 1600;
  const height = 720;
  const bag = colors.flatMap(([color, weight]) => Array(weight).fill(color));
  let shapes = '';
  for (let index = 0; index < 900; index++) {
    const x = (random() * width).toFixed(1);
    const y = (random() * height).toFixed(1);
    const rx = 5 + random() ** 2.6 * 140;
    const ry = rx * (0.35 + random() * 0.6);
    const angle = (random() * 180).toFixed(1);
    const color = bag[Math.floor(random() * bag.length)];
    const opacity = (0.35 + random() * 0.65).toFixed(2);
    shapes += `<ellipse cx="${x}" cy="${y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${color}" fill-opacity="${opacity}" transform="rotate(${angle} ${x} ${y})"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${base[0]}"/><stop offset="1" stop-color="${base[1]}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`;
}

const out = fileURLToPath(new URL('../src/covers/', import.meta.url));
for (const [name, palette] of Object.entries(palettes)) {
  const streak = [
    ...['-seed', String(palette.seed), 'svg:-'],
    ...['-motion-blur', '0x60+-16', '-motion-blur', '0x36+164'],
    ...['-blur', '0x2.5', '-gravity', 'center'],
    ...['-crop', '1200x420+0+0', '+repage', '-modulate', '108,110'],
  ];
  // One blur pass feeds both files. The banner is 3x the 706 × 170 box it
  // fills on an A4 page; the backdrop is already soft, so a small file
  // scales up cleanly behind the workspace.
  execFileSync(
    'magick',
    [
      ...streak,
      ...['-write', 'mpr:streak', '+delete', 'mpr:streak'],
      ...['-resize', '2118x510^', '-extent', '2118x510'],
      ...['-attenuate', '0.2', '+noise', 'Gaussian'],
      ...['-quality', '82', '-sampling-factor', '4:2:0', '-strip'],
      ...['-write', `${out}${name}.jpg`, '+delete', 'mpr:streak'],
      ...['-resize', '640x400^', '-extent', '640x400', '-blur', '0x14'],
      ...['-quality', '80', '-strip'],
      `${out}${name}-backdrop.jpg`,
    ],
    { input: petals(palette) },
  );
}
