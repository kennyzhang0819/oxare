// The mixed floor: mostly grass, with patches of the other floors laid out in squares of the tile grid and
// cut on the slant between them.
// The same pattern is worked out here for the plants (decor.ts) and in the floor's shader (scene.ts), so
// both must stay in step: change one, change the other.
import type { FloorKind } from "./level.ts";

// Each SQUARE of the floor's frame is one floor. A slow noise sampled at the square's middle, nudged a little
// per square so the edges step raggedly, makes it a patch past COVER; a slower one picks which floor, by
// KINDS' cut points (each kind's upper bound; grass's is unused). Between square middles each floor's share
// is blended bilinearly and a point takes the floor with the most, so a step of the grid is cut on a 45°
// slant, a lone square becomes a diamond and an inside corner fills (animechs' terrain seams). LINE is how
// wide the darker line is where two floors meet.
export const PATCH = { SQUARE: 1, FREQ: 0.13, KIND_FREQ: 0.06, JITTER: 0.14, COVER: 0.6, LINE: 0.04 };
export const PATCH_KINDS: [FloorKind, number][] = [["grass", 0], ["soil", 0.45], ["metal", 0.6], ["stone", 1]];

const hash = (x: number): number => {
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return x >>> 0;
};
const h2 = (x: number, z: number, s: number): number => hash((Math.imul(x, 1597334677) ^ Math.imul(z, 3812015801 | 0) ^ s) >>> 0) / 4294967296;
const fade = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, z: number, s: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = fade(x - ix), fz = fade(z - iz);
  const a = h2(ix, iz, s), b = h2(ix + 1, iz, s), c = h2(ix, iz + 1, s), d = h2(ix + 1, iz + 1, s);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
// The kind of the square at (i, j), as its index in PATCH_KINDS.
function squareKind(i: number, j: number, s: number): number {
  const x = (i + 0.5) * PATCH.SQUARE, z = (j + 0.5) * PATCH.SQUARE;
  if (noise(x * PATCH.FREQ, z * PATCH.FREQ, s ^ 0x51) + (h2(i, j, s ^ 0x13) - 0.5) * PATCH.JITTER < PATCH.COVER) return 0;
  const u = noise(x * PATCH.KIND_FREQ, z * PATCH.KIND_FREQ, s ^ 0xa7);
  let k = 1;
  while (k < PATCH_KINDS.length - 1 && u >= PATCH_KINDS[k]![1]) k++;
  return k;
}

// A level's patch seed, from its id, so each level lays its patches out its own way.
export function patchSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return (h >>> 0) % 65536;
}
// The floor at (x, z) in the floor's frame (scene.ts tileFrame), for a level seeded `seed`: the one with the
// biggest blended share from the four nearest square middles (ties to the first in PATCH_KINDS).
export function patchAt(x: number, z: number, seed: number): FloorKind {
  const qx = x / PATCH.SQUARE - 0.5, qz = z / PATCH.SQUARE - 0.5, i = Math.floor(qx), j = Math.floor(qz), fx = qx - i, fz = qz - j;
  const share = PATCH_KINDS.map(() => 0);
  for (const [di, dj, w] of [[0, 0, (1 - fx) * (1 - fz)], [1, 0, fx * (1 - fz)], [0, 1, (1 - fx) * fz], [1, 1, fx * fz]] as const) share[squareKind(i + di, j + dj, seed >>> 0)]! += w;
  let best = 0;
  share.forEach((v, k) => { if (v > share[best]!) best = k; });
  return PATCH_KINDS[best]![0];
}

// The same in GLSL ES 3.0: `patchKind(p, seed, line)` gives the kind's index in PATCH_KINDS and sets `line`
// where the runner-up's share comes within the line's width of it.
const f = (v: number) => v.toFixed(4);
export const PATCH_GLSL = `
uint pHash(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float pH2(int x, int z, uint s) { return float(pHash((uint(x) * 1597334677u) ^ (uint(z) * 3812015801u) ^ s)) / 4294967296.0; }
float pNoise(vec2 p, uint s) {
  ivec2 i = ivec2(floor(p)); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = pH2(i.x, i.y, s), b = pH2(i.x + 1, i.y, s), c = pH2(i.x, i.y + 1, s), d = pH2(i.x + 1, i.y + 1, s);
  return a + (b - a) * f.x + (c - a) * f.y + (a - b - c + d) * f.x * f.y;
}
int pSquare(ivec2 c, uint s) {
  vec2 m = (vec2(c) + 0.5) * ${f(PATCH.SQUARE)};
  if (pNoise(m * ${f(PATCH.FREQ)}, s ^ 0x51u) + (pH2(c.x, c.y, s ^ 0x13u) - 0.5) * ${f(PATCH.JITTER)} < ${f(PATCH.COVER)}) return 0;
  float u = pNoise(m * ${f(PATCH.KIND_FREQ)}, s ^ 0xa7u);
  ${PATCH_KINDS.slice(1, -1).map(([, cut], k) => `if (u < ${f(cut)}) return ${k + 1};`).join(" ")}
  return ${PATCH_KINDS.length - 1};
}
int patchKind(vec2 p, uint s, out bool line) {
  vec2 q = p / ${f(PATCH.SQUARE)} - 0.5, fr = fract(q);
  ivec2 c = ivec2(floor(q));
  float share[${PATCH_KINDS.length}];
  for (int k = 0; k < ${PATCH_KINDS.length}; k++) share[k] = 0.0;
  share[pSquare(c, s)] += (1.0 - fr.x) * (1.0 - fr.y);
  share[pSquare(c + ivec2(1, 0), s)] += fr.x * (1.0 - fr.y);
  share[pSquare(c + ivec2(0, 1), s)] += (1.0 - fr.x) * fr.y;
  share[pSquare(c + ivec2(1, 1), s)] += fr.x * fr.y;
  int best = 0; float next = 0.0;
  for (int k = 1; k < ${PATCH_KINDS.length}; k++) {
    if (share[k] > share[best]) { next = share[best]; best = k; } else next = max(next, share[k]);
  }
  // The shares change by up to about two a square across a seam, so this is about LINE wide.
  line = share[best] - next < ${f((2 * PATCH.LINE) / PATCH.SQUARE)};
  return best;
}`;
