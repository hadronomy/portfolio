/**
 * Contour lines traced from a generated height field.
 *
 * This is a build-time module. It exists so that a component can ask for
 * terrain and receive paths, without knowing that underneath there is a noise
 * lattice, a sampling grid, a marching-squares walk and a chaining pass — none
 * of which it could do anything useful with. Everything below the two exported
 * types is private for that reason.
 *
 * It must never reach a browser. Nothing here is reactive, the output is fixed
 * by the seed, and shipping it would mean shipping a generator to recompute a
 * constant. The guard at the bottom of this comment block is not decoration:
 * the whole point of generating at build is that the page carries the result
 * rather than the means.
 */

if (!import.meta.env.SSR) {
  throw new Error(
    'terrain.ts is a build-time module and must not be bundled for the browser.',
  );
}

export interface TerrainOptions {
  /** The coordinate space the paths are drawn in, matching the SVG viewBox. */
  width: number;
  height: number;
  /** Fixes the terrain. The same seed gives the same ground on every build. */
  seed: number;
  /** How many contour lines to cut between the lowest and highest ground. */
  levels?: number;
  /**
   * Grid columns. Higher follows the surface more closely and costs path data
   * roughly in proportion; rows are derived so cells stay square-ish.
   */
  resolution?: number;
  /**
   * How much ground the frame covers. Higher fits more, smaller landforms into
   * the same box; lower gives fewer, broader ones.
   */
  span?: number;
}

export interface Contour {
  /** SVG path data for every line at this elevation. */
  d: string;
  /** Where the line sits between the lowest and highest ground, 0 to 1. */
  elevation: number;
  /**
   * The heavier line a survey draws every fifth level, which is what gives a
   * contour map a sense of height rather than an even hatch.
   */
  index: boolean;
}

/**
 * Trace contour lines across a generated landscape.
 *
 * Lines never cross, branch where the ground does, and crowd where it is
 * steep — because they come off an actual surface rather than being drawn to
 * look like they did.
 */
export function terrainContours(options: TerrainOptions): Contour[] {
  const {
    width,
    height,
    seed,
    levels = 9,
    resolution = 92,
    span = 5.2,
  } = options;

  const cols = resolution;
  const rows = Math.max(2, Math.round((resolution * height) / width));
  const field = heightField(seed);

  const grid: number[] = [];
  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (let y = 0; y <= rows; y += 1) {
    for (let x = 0; x <= cols; x += 1) {
      const v = field((x / cols) * span, (y / rows) * span * (height / width));
      grid[y * (cols + 1) + x] = v;
      if (v < lowest) lowest = v;
      if (v > highest) highest = v;
    }
  }

  const surface: Surface = {
    at: (x, y) => grid[y * (cols + 1) + x],
    cols,
    rows,
    cellW: width / cols,
    cellH: height / rows,
  };

  const contours: Contour[] = [];
  for (let i = 0; i < levels; i += 1) {
    const t = (i + 1) / (levels + 1);
    const d = trace(surface, lowest + (highest - lowest) * t);
    if (d) contours.push({ d, elevation: t, index: i % 5 === 2 });
  }
  return contours;
}

/* ────────────────────────────────────────────────────────────────────────── */

interface Surface {
  at: (x: number, y: number) => number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

/** Deterministic from the seed, so a build is reproducible. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Value noise stacked into octaves.
 *
 * Each octave doubles the frequency and halves the weight, which is what makes
 * the result look like ground: broad landforms carrying progressively finer
 * detail, rather than one scale of bumps.
 */
function heightField(seed: number) {
  const rand = mulberry32(seed);
  const SIZE = 256;
  const lattice = Array.from({ length: SIZE * SIZE }, () => rand());
  const at = (x: number, y: number) =>
    lattice[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)];

  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    // Smoothstep on both axes: linear interpolation alone leaves creases along
    // the lattice, and a contour walk finds every one of them.
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };

  return (x: number, y: number) => {
    let sum = 0;
    let amp = 0.5;
    let fx = x;
    let fy = y;
    for (let o = 0; o < 5; o += 1) {
      sum += amp * noise(fx, fy);
      // Not exactly two, so octaves do not line up on the lattice and repeat.
      fx *= 2.03;
      fy *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };
}

/**
 * Which cell edges a contour joins, keyed by which corners are above the level.
 *
 * Five and ten are the saddles, where the surface passes through the cell
 * twice and the line has two separate crossings to make.
 */
const JOINS: Record<number, number[][]> = {
  1: [[3, 0]],
  14: [[3, 0]],
  2: [[0, 1]],
  13: [[0, 1]],
  3: [[3, 1]],
  12: [[3, 1]],
  4: [[1, 2]],
  11: [[1, 2]],
  6: [[0, 2]],
  9: [[0, 2]],
  7: [[2, 3]],
  8: [[2, 3]],
  5: [
    [3, 0],
    [1, 2],
  ],
  10: [
    [0, 1],
    [2, 3],
  ],
};

/** Where the surface crosses one edge of a cell, interpolated between corners. */
function crossing(
  s: Surface,
  edge: number,
  x: number,
  y: number,
  level: number,
): [number, number] {
  const a = s.at(x, y);
  const b = s.at(x + 1, y);
  const c = s.at(x + 1, y + 1);
  const d = s.at(x, y + 1);
  const mix = (v0: number, v1: number) => (level - v0) / (v1 - v0 || 1e-6);
  if (edge === 0) return [(x + mix(a, b)) * s.cellW, y * s.cellH];
  if (edge === 1) return [(x + 1) * s.cellW, (y + mix(b, c)) * s.cellH];
  if (edge === 2) return [(x + mix(d, c)) * s.cellW, (y + 1) * s.cellH];
  return [x * s.cellW, (y + mix(a, d)) * s.cellH];
}

/**
 * Walk one iso-level across the grid and return it as SVG path data.
 *
 * Marching squares hands back one short segment per cell. Writing those out as
 * they come repeats every shared point and spends an `M` on each — more than
 * twice the path data for identical geometry. Two cells sharing an edge derive
 * that crossing from the same pair of corner heights, so their endpoints match
 * exactly rather than nearly, and the pieces can be chained before they are
 * written.
 */
function trace(s: Surface, level: number): string {
  const segments: number[][] = [];
  for (let y = 0; y < s.rows; y += 1) {
    for (let x = 0; x < s.cols; x += 1) {
      const code =
        (s.at(x, y) >= level ? 1 : 0) |
        (s.at(x + 1, y) >= level ? 2 : 0) |
        (s.at(x + 1, y + 1) >= level ? 4 : 0) |
        (s.at(x, y + 1) >= level ? 8 : 0);
      const joins = JOINS[code];
      if (!joins) continue;
      for (const [from, to] of joins) {
        const p0 = crossing(s, from, x, y, level);
        const p1 = crossing(s, to, x, y, level);
        segments.push([
          Math.round(p0[0]),
          Math.round(p0[1]),
          Math.round(p1[0]),
          Math.round(p1[1]),
        ]);
      }
    }
  }
  if (segments.length === 0) return '';

  const key = (x: number, y: number) => `${x},${y}`;
  const ends = new Map<string, number[]>();
  segments.forEach((seg, i) => {
    for (const k of [key(seg[0], seg[1]), key(seg[2], seg[3])]) {
      const list = ends.get(k);
      if (list) list.push(i);
      else ends.set(k, [i]);
    }
  });

  const used = new Array<boolean>(segments.length).fill(false);

  /** Walk away from one end for as long as an unused segment shares its point. */
  const follow = (from: number, x: number, y: number) => {
    const path: number[][] = [];
    let cx = x;
    let cy = y;
    let current = from;
    for (;;) {
      const next = (ends.get(key(cx, cy)) ?? []).find(
        (i) => i !== current && !used[i],
      );
      if (next === undefined) break;
      used[next] = true;
      const seg = segments[next];
      const headIsHere = seg[0] === cx && seg[1] === cy;
      cx = headIsHere ? seg[2] : seg[0];
      cy = headIsHere ? seg[3] : seg[1];
      path.push([cx, cy]);
      current = next;
    }
    return path;
  };

  const parts: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    const [ax, ay, bx, by] = segments[i];
    const points = [
      ...follow(i, ax, ay).reverse(),
      [ax, ay],
      [bx, by],
      ...follow(i, bx, by),
    ];
    parts.push(`M${points.map(([px, py]) => `${px} ${py}`).join('L')}`);
  }
  return parts.join('');
}
