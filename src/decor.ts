import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { BARRIER_D, BARRIER_H, BARRIER_LEG, BARRIER_W, COLUMN_R, LAMP, MAST, PILLAR_H, PILLAR_R, TREE_CROWN, TREE_STEM, mastRings, treeSize, floorOf, type FloorKind, type TreeCrown, type TreeLeaves, PLATFORM_THICKNESS, RAIL_R, SUPPORT_D, SUPPORT_W, TUBE_R, curveRollPoint, curveStrip, fenceRings, frameToWorld, isSliding, platformHeightAt, slabPoint, worldToFrame, railsRingsWorld, riders, tubeRingsWorld, isMoving, isPlatform, isShaped, isTilted, pieceRoll, pieceRot, pieceTilt, rotXZ, slabOutline, supportOver, supportPillars, surfaceAt, type Level, type Piece, type XZ } from "./level.ts";
import { CURIO, DECOR, ENV } from "./palette.ts";
import { patchAt, patchSeed } from "./patches.ts";
import { INK_FADE, NEAR_ON, fadeGlsl } from "./fade.ts";

// Overgrowth over every platform, its open edges and the props that stand still. Drawn only (the ball
// rolls through it) and seeded from the level, so a level always grows the same. See docs/decor.md.
export const DECOR_TIME = { value: 0 };
// Edge samples this far apart; an edge is open when no platform within this height lies just past it.
const STEP = 0.5, SEAM_H = 0.5;
// How far round a hole's cut the plants keep off, so none overhangs the opening.
const HOLE_PAD = 0.35;
// The plants' ink line, thinner than the pieces' so small leaves don't drown in it.
const OUTLINE = ENV.outline * 0.5;

type V3 = [number, number, number];
// A platform's top as the plants see it. `at(x, z, h)` carries a point of its flat layout, h up off the
// top, to where the platform draws it, twisted, curled, rolled, tilted or sloped as it is; `inside`
// says whether a layout point is on the top `inset` in from its rim; `box` bounds the layout; `edges`
// are its open rim every STEP with the layout's outward normal. `flat` is a level, unturned one.
interface Surface { at(x: number, z: number, h: number): V3; inside(x: number, z: number, inset: number): boolean; box: [number, number, number, number]; edges: { a: XZ; n: XZ; corner: boolean }[]; flat: boolean }

// Every part is a closed solid wound outward, so the inverted-hull outline has a rim to show.
function solid(pos: number[], faces: [number, number, number][]): THREE.BufferGeometry {
  const n = pos.length / 3, c = [0, 1, 2].map((k) => pos.filter((_, i) => i % 3 === k).reduce((a, v) => a + v, 0) / n);
  const P = (i: number) => new THREE.Vector3(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
  const idx: number[] = [];
  for (const [a, b, d] of faces) {
    const pa = P(a), nrm = P(b).sub(pa).cross(P(d).sub(pa)), mid = pa.add(P(b)).add(P(d)).divideScalar(3);
    if (nrm.dot(mid.sub(new THREE.Vector3(c[0], c[1], c[2]))) >= 0) idx.push(a, b, d); else idx.push(a, d, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
// A thin closed ribbon along local +z from the origin, `w(t, i)` wide, its top lifted `y(t)`, `thick`
// deep, t from 0 to 1. Each face is wound against its own side's direction, as the ribbon bends.
function ribbon(len: number, n: number, w: (t: number, i: number) => number, y: (t: number) => number, thick = 0.025): THREE.BufferGeometry {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, h = Math.max(0.004, w(t, i) / 2), z = t * len;
    pos.push(-h, y(t), z, h, y(t), z, h, y(t) - thick, z, -h, y(t) - thick, z);
  }
  const V = (i: number) => new THREE.Vector3(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!);
  const tri = (a: number, b: number, d: number, hint: THREE.Vector3) => {
    const pa = V(a);
    if (V(b).sub(pa).cross(V(d).sub(pa)).dot(hint) >= 0) idx.push(a, b, d); else idx.push(a, d, b);
  };
  const quad = (a: number, b: number, d: number, e: number, hint: THREE.Vector3) => { tri(a, b, d, hint); tri(a, d, e, hint); };
  for (let i = 0; i < n; i++) {
    const s = 4 * i, e = s + 4, dy = (pos[e * 3 + 1]! - pos[s * 3 + 1]!) / (len / n);
    const up = new THREE.Vector3(0, 1, -dy).normalize();
    quad(s, s + 1, e + 1, e, up);
    quad(s + 3, s + 2, e + 2, e + 3, up.clone().negate());
    quad(s, s + 3, e + 3, e, new THREE.Vector3(-1, 0, 0));
    quad(s + 1, s + 2, e + 2, e + 1, new THREE.Vector3(1, 0, 0));
  }
  quad(0, 1, 2, 3, new THREE.Vector3(0, 0, -1));
  quad(4 * n, 4 * n + 1, 4 * n + 2, 4 * n + 3, new THREE.Vector3(0, 0, 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const place = (g: THREE.BufferGeometry, yaw: number, pitch = 0, at: V3 = [0, 0, 0]) =>
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")), new THREE.Vector3(1, 1, 1)));
// Shared corners are welded so normals run smooth and the outline hull stays closed round each part.
function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(parts.map((q) => { for (const a of ["uv", "normal"]) q.deleteAttribute(a); return mergeVertices(q, 1e-4); }))!;
  g.computeVertexNormals();
  return g;
}
const ball = (r: number, sx = 1, sy = 1, sz = 1) => new THREE.IcosahedronGeometry(r, 0).scale(sx, sy, sz);
// Leaves are diamonds: they come by the thousand, so each is the fewest faces that still has volume.
const leaf = (r: number, sx = 1, sy = 1, sz = 1) => new THREE.OctahedronGeometry(r, 0).scale(sx, sy, sz);
// A seeded scatter for building one plant's parts, the same every time.
function parts(seed: number, make: (rnd: () => number) => THREE.BufferGeometry[]): THREE.BufferGeometry {
  let s = seed;
  return merged(make(() => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }));
}

// Fronds arching out and drooping, their leaflets a zigzag down each side.
const fern = () => parts(3, (rnd) => Array.from({ length: 7 }, (_, k) =>
  place(ribbon(0.5 + rnd() * 0.25, 6, (t, i) => 0.24 * Math.sin(Math.PI * t) ** 0.6 * (i % 2 ? 1 : 0.45), (t) => 0.42 * Math.sin(t * Math.PI * 0.7) - 0.22 * t * t), (k / 7) * Math.PI * 2 + rnd() * 0.5, -0.15)));
// Thin blades leaning every way from one root, each a sliver of a pyramid.
const tuft = () => parts(5, (rnd) => Array.from({ length: 7 }, (_, k) => {
  const h = 0.22 + rnd() * 0.2, a = (k / 7) * Math.PI * 2 + rnd(), lean = 0.06 + rnd() * 0.08;
  return place(solid([-0.03, 0, 0, 0.03, 0, 0, 0, 0, -0.02, 0, h, lean], [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]]), a, 0, [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05]);
}));
// A clump of stems standing `h` tall about the root, from `at` (x, z, height) per stem; heads are a mesh of their own.
const stemsOf = (at: V3[], r = 0.014) => merged(at.map(([x, z, h]) => new THREE.CylinderGeometry(r * 0.8, r, h, 4).translate(x, h / 2, z)));
const FLOWERS: V3[] = [[0, 0, 0.42], [0.1, 0.06, 0.3], [-0.08, 0.07, 0.34], [0.02, -0.1, 0.26], [-0.1, -0.05, 0.38]];
const flowerHeads = () => merged(FLOWERS.map(([x, z, h], i) => (i % 3 === 0 ? new THREE.ConeGeometry(0.055, 0.22, 5).translate(x, h + 0.08, z) : ball(0.06).translate(x, h + 0.02, z))));
// Wheat and grass spikes: tall straws, each carrying a long seed head that nods a little.
const WHEAT: V3[] = [[0, 0, 0.95], [0.09, 0.05, 0.8], [-0.07, 0.08, 0.88], [0.04, -0.09, 0.72], [-0.1, -0.04, 1.02], [0.12, -0.06, 0.66]];
const wheatHeads = () => merged(WHEAT.map(([x, z, h], i) => ball(0.05, 0.9, 3.6, 0.9).rotateX(0.15 * ((i % 3) - 1)).translate(x, h + 0.16, z)));
// Delphinium spires: three tall stems, beads of flowers stacked up their top half, smaller toward the tip.
const SPIRES: V3[] = [[0, 0, 1.25], [0.12, 0.06, 0.95], [-0.1, 0.07, 1.08]];
const spireHeads = () => merged(SPIRES.flatMap(([x, z, h]) => Array.from({ length: 7 }, (_, k) => ball(0.075 * (1 - k * 0.08)).translate(x + Math.cos(k * 2.4) * 0.04, h * 0.55 + k * h * 0.065, z + Math.sin(k * 2.4) * 0.04))));
// Heather: a low green mound with tiny flower clusters all over its top.
const mound = () => merged([ball(0.32, 1, 0.5, 1)]);
const heatherDots = () => parts(9, (rnd) => Array.from({ length: 16 }, () => {
  const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.26;
  return ball(0.045, 1, 1.8, 1).translate(Math.cos(a) * r, 0.16 * Math.sqrt(1 - (r / 0.34) ** 2) + 0.05, Math.sin(a) * r);
}));
// A bush of broad rounded leaves on arching stalks.
const bush = () => parts(13, (rnd) => Array.from({ length: 6 }, (_, k) =>
  place(ribbon(0.55 + rnd() * 0.2, 5, (t) => 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7 * Math.min(1, t * 4), (t) => 0.5 * Math.sin(t * Math.PI * 0.6) - 0.1 * t, 0.03), (k / 6) * Math.PI * 2 + rnd() * 0.6, -0.3 - rnd() * 0.3)));
// Mushrooms: stalks with round caps, a big one and two small.
const SHROOMS: [number, number, number, number][] = [[0, 0, 0.22, 0.12], [0.12, 0.05, 0.14, 0.08], [-0.06, 0.11, 0.1, 0.06]];
const shroomStalks = () => merged(SHROOMS.map(([x, z, h, r]) => new THREE.CylinderGeometry(r * 0.35, r * 0.45, h, 6).translate(x, h / 2, z)));
const shroomCaps = () => merged(SHROOMS.map(([x, z, h, r]) => new THREE.SphereGeometry(r, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1).translate(x, h - 0.01, z)));
// Clover: a patch of little round leaves lying on the ground in threes.
const clover = () => parts(17, (rnd) => Array.from({ length: 7 }, () => {
  const x = (rnd() - 0.5) * 0.6, z = (rnd() - 0.5) * 0.6;
  return merged([0, 1, 2].map((k) => leaf(0.05, 1, 0.3, 1).translate(x + Math.cos(k * 2.1) * 0.045, 0.02, z + Math.sin(k * 2.1) * 0.045)));
}));
// Ivy clinging to a wall: leaves lying flat in the local XY plane, spread over a patch facing +z.
const ivy = () => parts(21, (rnd) => Array.from({ length: 11 }, () =>
  leaf(0.1, 1.2, 1, 0.35).rotateZ(rnd() * 3).translate((rnd() - 0.5) * 0.9, -rnd() * 0.75, 0.02 + rnd() * 0.03)));
// A vine `len` long hanging straight down from the origin, a leaf every so often turning round it.
function vine(len: number): THREE.BufferGeometry {
  const ps: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.014, 0.014, len, 4).translate(0, -len / 2, 0)];
  for (let y = 0.1, k = 0; y < len; y += 0.15, k++) {
    const a = k * 2.4;
    ps.push(leaf(0.1, 1.4, 0.55, 0.9).rotateY(a).translate(Math.cos(a) * 0.06, -y, Math.sin(a) * 0.06));
  }
  return merged(ps);
}
// A hanging cluster of flowers, wide at its top, at the foot of a vine `len` long: placed at the vine's
// root so it sways exactly as the vine's tip does.
const BLOOM_H = 0.5;
const bloom = (len: number) => merged([new THREE.ConeGeometry(0.12, BLOOM_H, 6).rotateX(Math.PI).translate(0, -len - BLOOM_H / 2, 0)]);
const VINES = [1, 2, 3.4, 5];

// A climbing vine wound half a turn round a post `r` round for each unit it climbs, one unit tall, its
// leaves lying flat against the post; stacked a unit apart, each turned half a turn on, they climb a
// post of any height as one vine.
function wrap(r: number): THREE.BufferGeometry {
  const pts = Array.from({ length: 13 }, (_, k) => { const a = (k / 12) * Math.PI; return new THREE.Vector3(Math.sin(a) * r, k / 12, Math.cos(a) * r); });
  const ps: THREE.BufferGeometry[] = [new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.025, 4, false)];
  for (let k = 0; k < 8; k++) {
    const t = (k + 0.5) / 8, a = t * Math.PI + (k % 2 ? 0.22 : -0.22);
    ps.push(leaf(0.1, 1.2, 1, 0.4).rotateZ(k % 2 ? 0.6 : -0.6).rotateY(a).translate(Math.sin(a) * (r + 0.03), t + (k % 2 ? 0.06 : -0.06), Math.cos(a) * (r + 0.03)));
  }
  return merged(ps);
}
// Small flat flowers scattered over a patch of a wall facing +z, hanging down from the origin.
const blossoms = () => parts(41, (rnd) => Array.from({ length: 11 }, () => {
  const r = 0.05 + rnd() * 0.04;
  return new THREE.CylinderGeometry(r, r, 0.03, 6).rotateX(Math.PI / 2).translate((rnd() - 0.5) * 0.6, -rnd() * 0.6, 0.035);
}));
// A sprig of leaves sticking out of a wall facing +z.
const sprig = () => parts(43, (rnd) => Array.from({ length: 5 }, (_, k) =>
  leaf(0.1, 0.5, 0.3, 1.5).rotateX(-0.3 - rnd() * 0.5).rotateY((k - 2) * 0.45).translate((k - 2) * 0.04, 0, 0.1)));

// Trees grow out of a platform's wall and arch away from it along local +z, so the canopy hangs past
// the edge over the void, its lowest leaves about a ball's height above the top. TREE is where the
// canopy's centre sits from the root.
const TREE: V3 = [0, 3.1, 1.9];
// A tapered limb from `a` to `b`, `r0` thick at a and `r1` at b, with a ball at its end to close the joint.
function limb(a: V3, b: V3, r0: number, r1: number): THREE.BufferGeometry[] {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), len = d.length();
  const cyl = new THREE.CylinderGeometry(r1, r0, len, 7).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return [cyl.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), ball(r1).translate(...b)];
}
const trunk = () => merged([
  ...limb([0, -0.2, -0.2], [0, 0.9, 0.45], 0.3, 0.24), ...limb([0, 0.9, 0.45], [0.1, 1.9, 1.15], 0.24, 0.18), ...limb([0.1, 1.9, 1.15], [0, 2.8, 1.7], 0.18, 0.13),
  ...limb([0.1, 1.9, 1.15], [0.8, 2.6, 1.5], 0.1, 0.06), ...limb([0, 2.8, 1.7], [-0.6, 3.3, 2.1], 0.09, 0.05),
  // Roots gripping the wall.
  ...limb([0, 0.1, 0], [0.45, -0.5, -0.15], 0.12, 0.05), ...limb([0, 0.1, 0], [-0.4, -0.65, -0.12], 0.12, 0.05),
]);
// A round crown of lumpy blobs round TREE.
const crown = () => parts(29, (rnd) => Array.from({ length: 9 }, (_, k) => {
  const a = (k / 9) * Math.PI * 2, out = k ? 0.75 + rnd() * 0.3 : 0;
  return new THREE.IcosahedronGeometry(0.75 + rnd() * 0.35, 1).translate(TREE[0] + Math.cos(a) * out, TREE[1] + (rnd() - 0.4) * 0.6 + (k ? 0 : 0.35), TREE[2] + Math.sin(a) * out);
}));
// A willow: a flatter crown with strands of leaves hanging from all round its rim.
const weeping = () => parts(37, (rnd) => [
  ...Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2; return new THREE.IcosahedronGeometry(0.8, 1).scale(1, 0.6, 1).translate(TREE[0] + Math.cos(a) * 0.7, TREE[1] + 0.2, TREE[2] + Math.sin(a) * 0.7); }),
  ...Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2 + rnd() * 0.3, r = 1.15 + rnd() * 0.3; return vine(1.4 + rnd() * 1.4).scale(0.55, 1, 0.55).translate(TREE[0] + Math.cos(a) * r, TREE[1] + 0.05, TREE[2] + Math.sin(a) * r); }),
]);
// More puff crowns round TREE: tall (puffs stacked up, smaller toward the top), wide (a flat umbrella of
// puffs) and twin (two clusters side by side).
const puff = (r: number, x: number, y: number, z: number, sy = 1) => new THREE.IcosahedronGeometry(r, 1).scale(1, sy, 1).translate(TREE[0] + x, TREE[1] + y, TREE[2] + z);
const crownTall = () => parts(31, (rnd) => Array.from({ length: 8 }, (_, k) => {
  const t = k / 7, a = k * 2.3;
  return puff(0.9 - t * 0.4, Math.cos(a) * 0.35 * (1 - t), -0.4 + t * 2.1, Math.sin(a) * 0.35 * (1 - t));
}));
const crownWide = () => parts(33, (rnd) => Array.from({ length: 10 }, (_, k) => {
  const a = (k / 9) * Math.PI * 2, out = k ? 1.1 + rnd() * 0.35 : 0;
  return puff(0.6 + rnd() * 0.25, Math.cos(a) * out, 0.3 + (rnd() - 0.5) * 0.3 + (k ? 0 : 0.2), Math.sin(a) * out, 0.7);
}));
const crownTwin = () => parts(35, (rnd) => [-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, k) => {
  const a = (k / 5) * Math.PI * 2, out = k ? 0.5 + rnd() * 0.2 : 0;
  return puff(0.6 + rnd() * 0.25, side * 0.85 + Math.cos(a) * out, (side < 0 ? 0 : 0.5) + (rnd() - 0.4) * 0.4 + (k ? 0 : 0.3), Math.sin(a) * out);
})));
// A placed tree's trunk (a "tree" piece): TREE_STEM's pieces upright to the crown, two branches
// off it and three roots flaring into the ground.
const trunkUp = () => merged([
  ...TREE_STEM.flatMap((c) => limb(c.a, c.b, c.r, c.end ?? c.r)),
  ...limb([-0.04, 2.2, 0.1], [0.75, 2.85, 0.3], 0.1, 0.06), ...limb([0, 2.6, 0.05], [-0.65, 3.05, -0.25], 0.09, 0.05),
  ...[0.3, 2.4, 4.4].flatMap((a) => limb([0, 0.35, 0], [Math.cos(a) * 0.55, -0.02, Math.sin(a) * 0.55], 0.13, 0.05)),
]);
// Curios: odd, bright things left lying about, now and then (CURIO_RATE). Each is a few kinds placed
// together, one per colour, standing on y 0 and about a ball across or less.
const sphere = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 14, 10).scale(sx, sy, sz).translate(x, y, z);
const can = (r: number, h: number, y: number) => new THREE.CylinderGeometry(r, r, h, 16).translate(0, y, 0).rotateZ(Math.PI / 2).translate(0, 0.1, 0);
const CURIOS: [kind: string, make: () => THREE.BufferGeometry, colours: readonly number[]][][] = [
  [
    ["duck", () => merged([sphere(0.2, 0, 0.16, 0, 1.3, 0.8, 1), sphere(0.13, 0.13, 0.36, 0), new THREE.ConeGeometry(0.07, 0.14, 8).rotateZ(0.9).translate(-0.25, 0.25, 0)]), CURIO.duck],
    ["duckBeak", () => merged([sphere(0.07, 0.25, 0.34, 0, 1.4, 0.45, 1.1)]), CURIO.beak],
    ["duckEyes", () => merged([sphere(0.026, 0.22, 0.41, 0.07), sphere(0.026, 0.22, 0.41, -0.07)]), CURIO.eye],
  ],
  [
    ["can", () => merged([can(0.1, 0.26, 0)]), CURIO.can],
    ["canEnds", () => merged([can(0.092, 0.03, 0.14), can(0.092, 0.03, -0.14)]), CURIO.tin],
  ],
  [
    ["mug", () => merged([new THREE.CylinderGeometry(0.13, 0.12, 0.24, 18).translate(0, 0.12, 0), new THREE.TorusGeometry(0.075, 0.022, 8, 16, Math.PI * 1.3).rotateZ(-Math.PI * 0.65).translate(0.13, 0.12, 0)]), CURIO.mug],
    ["coffee", () => merged([new THREE.CylinderGeometry(0.112, 0.112, 0.02, 18).translate(0, 0.236, 0)]), CURIO.coffee],
  ],
  [
    ["cone", () => merged([new THREE.ConeGeometry(0.16, 0.5, 16).translate(0, 0.29, 0), new THREE.BoxGeometry(0.42, 0.04, 0.42).translate(0, 0.02, 0)]), CURIO.cone],
    ["coneStripe", () => merged([new THREE.CylinderGeometry(0.083, 0.106, 0.08, 16).translate(0, 0.25, 0)]), CURIO.stripe],
  ],
  // A beach ball: six slices round it, opposite slices alike.
  ...[[["ballA", 0], ["ballB", 1], ["ballC", 2]] as const].map((ks) => ks.map(([kind, k]): [string, () => THREE.BufferGeometry, readonly number[]] =>
    [kind, () => merged([0, 3].map((o) => new THREE.SphereGeometry(0.22, 6, 10, ((k + o) * Math.PI) / 3, Math.PI / 3).translate(0, 0.22, 0))), CURIO[kind]])),
  [
    ["gnome", () => merged([new THREE.CylinderGeometry(0.09, 0.14, 0.26, 14).translate(0, 0.13, 0)]), CURIO.gnome],
    ["gnomeHat", () => merged([new THREE.ConeGeometry(0.11, 0.3, 14).rotateZ(0.15).translate(-0.02, 0.5, 0)]), CURIO.hat],
    ["gnomeBeard", () => merged([new THREE.ConeGeometry(0.09, 0.18, 12).rotateX(Math.PI).translate(0, 0.26, 0).scale(1, 1, 0.8).translate(0.05, 0, 0)]), CURIO.beard],
    ["gnomeFace", () => merged([sphere(0.075, 0.03, 0.37, 0)]), CURIO.face],
  ],
];
// About one curio per this many square units of open top.
const CURIO_RATE = 1 / 400;
// Between the ground plants and the trees. Shrubs: leafy puffs (x, y, z, r) round or upright, and the
// flowers dotted over a flowering one's puffs (a kind of their own, swaying with it).
type Puff = [number, number, number, number];
const SHRUBS: Record<string, Puff[]> = {
  shrub: [[0, 0.32, 0, 0.36], [0.28, 0.22, 0.08, 0.26], [-0.24, 0.24, 0.14, 0.27], [0.05, 0.22, -0.27, 0.26], [0.02, 0.56, 0.03, 0.26]],
  shrubTall: [[0, 0.3, 0, 0.3], [0.08, 0.62, 0.02, 0.27], [-0.04, 0.9, -0.02, 0.21], [0.2, 0.32, 0.12, 0.2], [-0.18, 0.4, -0.1, 0.2]],
};
const shrubOf = (ps: Puff[]) => merged(ps.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)));
const shrubDots = (ps: Puff[], seed: number) => parts(seed, (rnd) => Array.from({ length: 18 }, () => {
  const [x, y, z, r] = ps[Math.floor(rnd() * ps.length)]!, a = rnd() * 6.3, e = 0.2 + rnd() * 1.1;
  return ball(0.055).translate(x + Math.cos(a) * Math.cos(e) * r, y + Math.sin(e) * r, z + Math.sin(a) * Math.cos(e) * r);
}));
// A sapling: a slim upright stem with a small puff crown round SAPLING; a fir: cones stacked on a stub.
const SAPLING: V3 = [0.05, 1.35, 0.1];
const saplingTrunk = () => merged([...limb([0, -0.05, 0], [0.04, 0.7, 0.05], 0.07, 0.055), ...limb([0.04, 0.7, 0.05], SAPLING, 0.055, 0.04), ...limb([0.04, 0.7, 0.05], [0.28, 1.0, -0.04], 0.03, 0.02)]);
const saplingCrown = () => parts(39, (rnd) => Array.from({ length: 6 }, (_, k) => {
  const a = (k / 5) * Math.PI * 2, out = k ? 0.32 + rnd() * 0.1 : 0;
  return new THREE.IcosahedronGeometry(k ? 0.28 + rnd() * 0.08 : 0.38, 1).translate(SAPLING[0] + Math.cos(a) * out, SAPLING[1] + 0.15 + (rnd() - 0.5) * 0.2 + (k ? 0 : 0.15), SAPLING[2] + Math.sin(a) * out);
}));
const firTrunk = () => merged(limb([0, -0.05, 0], [0, 0.5, 0], 0.08, 0.06));
const SHRUB_LEAVES = [...DECOR.canopy, ...DECOR.deep, ...DECOR.lime, ...DECOR.leaf, DECOR.autumn[0]!];
const firCones = () => merged([[0.5, 0.42, 0.75], [0.38, 0.85, 0.65], [0.26, 1.22, 0.55]].map(([r, y, h]) => new THREE.ConeGeometry(r!, h!, 7).translate(0, y!, 0)));
// A tree's crown shape and leaf colour are picked apart, each by weight, and its bark goes with its
// leaves: a willow in green or in blossom; any other crown green, dark green, autumn, blossom, or lime
// on pale birch bark.
const SHAPES: [number, string][] = [[0.3, "crown"], [0.18, "crownTall"], [0.17, "crownWide"], [0.15, "crownTwin"], [0.2, "weeping"]];
const LEAVES: [number, readonly number[], boolean][] = [[0.45, DECOR.canopy, false], [0.13, DECOR.deep, false], [0.15, DECOR.autumn, false], [0.13, DECOR.blossom, false], [0.14, DECOR.lime, true]];
function weighted<T extends [number, ...unknown[]]>(rnd: () => number, xs: T[]): T {
  let r = rnd() * xs.reduce((t, k) => t + k[0], 0);
  return xs.find(([w]) => (r -= w) < 0) ?? xs[0]!;
}
function pickTree(rnd: () => number): [string, number, number] {
  const [, shape] = weighted(rnd, SHAPES), pick = (xs: readonly number[]) => xs[Math.floor(rnd() * xs.length)]!;
  if (shape === "weeping") return [shape, pick(rnd() < 0.7 ? DECOR.willow : DECOR.blossom), pick(DECOR.bark)];
  const [, leaves, birch] = weighted(rnd, LEAVES);
  return [shape, pick(leaves), birch ? DECOR.birch : pick(DECOR.bark)];
}

// Wind: each vertex moves by how far it is from its plant's root, phased by where the plant stands.
const swayGlsl = (sway: number) => `
  #ifdef USE_INSTANCING
    vec3 root = instanceMatrix[3].xyz;
  #else
    vec3 root = vec3(0.0);
  #endif
  float ph = decorTime * 1.4 + root.x * 0.6 + root.z * 0.45;
  transformed.xz += vec2(sin(ph), cos(ph * 0.8)) * ${sway.toFixed(3)} * abs(position.y);`;
// In the game's view (NEAR_ON, fade.ts) a plant near the camera turns see-through as a whole (fadeGlsl),
// by how near its nearest point could be: its root's distance less its kind's reach (`plantReach`, its
// farthest point from the root, on every vertex). Its outline fades faster (INK_FADE). A plant growing
// on a prop (`plantOwner`, the prop's piece index, or -1) fades at least as much as that prop
// (fadePlantsOn, from hideHullsAround in scene.ts), so the two go see-through together.
const OWNERS_W = 64;
const OWNERS = new Uint8Array(OWNERS_W * OWNERS_W * 4).fill(255);
export const PLANT_FADE = { value: new THREE.DataTexture(OWNERS, OWNERS_W, OWNERS_W) };
PLANT_FADE.value.needsUpdate = true;
let fadeKey = "";
// `pieces`: each faded prop's index and how solid it is drawn (0 to 1).
export function fadePlantsOn(pieces: [number, number][]): void {
  const key = pieces.map(([i, o]) => `${i}:${Math.round(o * 255)}`).join(",");
  if (key === fadeKey) return;
  fadeKey = key;
  OWNERS.fill(255);
  for (const [i, o] of pieces) if (i < OWNERS_W * OWNERS_W) OWNERS[i * 4] = Math.round(o * 255);
  PLANT_FADE.value.needsUpdate = true;
}
const FADE_VERT = `#include <project_vertex>
  vPlantFade = 1.0;
  #ifdef USE_INSTANCING
    if (nearOn > 0.5) {
      float d = length((modelViewMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz) - plantReach * length(instanceMatrix[1].xyz);
      vPlantFade = ${fadeGlsl("d")};
      if (plantOwner >= 0.0) vPlantFade = min(vPlantFade, texelFetch(plantFade, ivec2(int(mod(plantOwner, ${OWNERS_W}.0)), int(plantOwner / ${OWNERS_W}.0)), 0).r);
    }
  #endif`;
const whole = (shader: THREE.WebGLProgramParametersWithUniforms, ink = false) => {
  shader.uniforms.nearOn = NEAR_ON;
  shader.uniforms.plantFade = PLANT_FADE;
  shader.vertexShader = "uniform float nearOn;\nuniform sampler2D plantFade;\nattribute float plantReach;\nattribute float plantOwner;\nvarying float vPlantFade;\n" + shader.vertexShader.replace("#include <project_vertex>", FADE_VERT);
  shader.fragmentShader = "varying float vPlantFade;\n" + shader.fragmentShader.replace("#include <alphamap_fragment>",
    `#include <alphamap_fragment>\n  diffuseColor.a *= ${ink ? `pow(vPlantFade, ${INK_FADE.toFixed(1)})` : "vPlantFade"};`);
};
// The plants' materials, one per sway and shared by every build; scene.ts lights them in steps.
const SWAYING = new Map<number, THREE.MeshStandardMaterial>();
function swaying(sway: number): THREE.MeshStandardMaterial {
  const hit = SWAYING.get(sway);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.decorTime = DECOR_TIME;
    shader.vertexShader = "uniform float decorTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>${swayGlsl(sway)}`);
    whole(shader);
  };
  m.customProgramCacheKey = () => `decor-sway-${sway}`;
  SWAYING.set(sway, m);
  return m;
}
// Their ink outline: the same instances drawn inside out, pushed out along the normals and swaying alike.
// `ink` set: that wide in world units whatever the plant's scale (uniformly scaled kinds only).
const OUTLINED = new Map<string, THREE.MeshBasicMaterial>();
function outlined(sway: number, ink?: number): THREE.MeshBasicMaterial {
  const key = `${sway}-${ink ?? ""}`, hit = OUTLINED.get(key);
  if (hit) return hit;
  const m = new THREE.MeshBasicMaterial({ color: ENV.outlineColor, side: THREE.BackSide, transparent: true });
  const push = ink ? `${ink.toFixed(4)} / length(instanceMatrix[1].xyz)` : OUTLINE.toFixed(4);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.decorTime = DECOR_TIME;
    shader.vertexShader = "uniform float decorTime;\n" + shader.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = vec3(position) + normal * (${push});${swayGlsl(sway)}`);
    whole(shader, true);
  };
  m.customProgramCacheKey = () => `decor-outline-${key}`;
  OUTLINED.set(key, m);
  return m;
}

// Every still platform's surface. A rim sample is kept only where the edge is open: no platform near its
// height lies just past it. A turned or bent platform keeps its long sides whatever lies past them.
function surfaceOf(level: Level, p: Piece): Surface | null {
  if (!isPlatform(p) || isMoving(p) || (p.type === "slab" && p.belt)) return null;
  const rim: { a: XZ; n: XZ; corner: boolean; side: boolean }[] = [];
  let sf: Omit<Surface, "edges">;
  const sides = (poly: XZ[]) => {
    const cx = poly.reduce((t, q) => t + q[0], 0) / poly.length, cz = poly.reduce((t, q) => t + q[1], 0) / poly.length;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 1e-6) return;
      let n: XZ = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L];
      if (n[0] * ((a[0] + b[0]) / 2 - cx) + n[1] * ((a[1] + b[1]) / 2 - cz) < 0) n = [-n[0], -n[1]];
      const side = Math.abs(n[0]) > 0.5;
      rim.push({ a, n, corner: true, side });
      const k = Math.floor(L / STEP);
      for (let j = 0; j < k; j++) { const t = (j + 0.5) / k; rim.push({ a: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], n, corner: false, side }); }
    });
  };
  if (p.type === "slab") {
    const poly: XZ[] = isShaped(p) ? slabOutline(p) : [[-p.w / 2, -p.d / 2], [p.w / 2, -p.d / 2], [p.w / 2, p.d / 2], [-p.w / 2, p.d / 2]];
    sides(poly);
    const xs = poly.map((q) => q[0]), zs = poly.map((q) => q[1]), flat = !isTilted(p) && !p.twist && !p.curl;
    // In from every side of the outline by `inset` (a convex test; a shaped slab's dents are rare enough).
    const within = (x: number, z: number, inset: number) => poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const d = ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / L;
      return d <= -inset;
    }) || poly.every((a, i) => {
      const b = poly[(i + 1) % poly.length]!, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) / L >= inset;
    });
    sf = {
      at: (x, z, h) => frameToWorld(p, slabPoint(p, [x, h, z])),
      // A level slab may have holes cut in it: only where the floor is really there.
      inside: (x, z, inset) => {
        if (!within(x, z, inset)) return false;
        if (!flat) return true;
        const w = frameToWorld(p, [x, 0, z]), y = surfaceAt(level, w[0], w[2], p.y);
        return y !== null && Math.abs(y - p.y) < 0.05;
      },
      box: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], flat,
    };
  } else if (p.type === "ramp") {
    const hw = p.w / 2, hd = p.d / 2;
    sides([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]);
    for (let k = rim.length - 1; k >= 0; k--) if (!rim[k]!.side) rim.splice(k, 1);
    sf = {
      at: (x, z, h) => { const o = rotXZ(x, z, p.rot); return [p.x + o.x, platformHeightAt(p, p.x + o.x, p.z + o.z) + h, p.z + o.z]; },
      inside: (x, z, inset) => Math.abs(x) <= hw - inset && Math.abs(z) <= hd - inset,
      box: [-hw, hw, -hd, hd], flat: false,
    };
  } else {
    // A curve's layout is (along it, across it): u from 0 to its length, v its radius.
    const c = curveStrip(p);
    for (const [v, k] of [[p.outer, 1], [p.inner, -1]] as const) {
      if (v <= 0.5) continue;
      for (let u = STEP / 2; u < c.len; u += STEP) rim.push({ a: [u, v], n: [0, k], corner: false, side: true });
    }
    sf = {
      at: (u, v, h) => {
        const [x, z] = c.at(u, v), l: V3 = p.roll ? curveRollPoint(p, [x, h, z]) : [x, h, z], o = rotXZ(l[0], l[2], p.rot);
        return [p.x + o.x, p.y + l[1], p.z + o.z];
      },
      inside: (u, v, inset) => u >= inset && u <= c.len - inset && v >= p.inner + inset && v <= p.outer - inset,
      box: [0, c.len, p.inner, p.outer], flat: !p.roll,
    };
  }
  const edges = rim.filter(({ a, n, side }) => {
    if (!sf.flat && side) return true;
    const w = sf.at(a[0], a[1], 0), q = sf.at(a[0] + n[0] * 0.4, a[1] + n[1] * 0.4, 0), past = surfaceAt(level, q[0], q[2], w[1]);
    return past === null || Math.abs(past - w[1]) >= SEAM_H;
  });
  return { ...sf, edges };
}

// What the plants keep clear of: every piece that isn't a platform, a hole or an apple, as a set of discs.
function keepOut(level: Level): { x: number; z: number; r: number }[] {
  const out: { x: number; z: number; r: number }[] = [];
  for (const p of level.pieces) {
    if (isPlatform(p) || p.type === "hole" || p.type === "apple" || p.type === "clearing") continue;
    const rot = "rot" in p && typeof p.rot === "number" ? p.rot : 0;
    if ("path" in p) {
      const pts = p.path.map((n) => { const o = rotXZ(n.x, n.z, rot); return [p.x + o.x, p.z + o.z] as XZ; });
      pts.forEach((a, i) => {
        const b = pts[i + 1] ?? a, L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / 0.5));
        for (let j = 0; j <= k; j++) out.push({ x: a[0] + ((b[0] - a[0]) * j) / k, z: a[1] + ((b[1] - a[1]) * j) / k, r: 1 });
      });
      continue;
    }
    if (p.type === "bridge") {
      for (const s of [-1, 1]) { const o = rotXZ(0, (s * p.d) / 2, rot); out.push({ x: p.x + o.x, z: p.z + o.z, r: p.w / 2 + 0.6 }); }
      continue;
    }
    if (p.type === "lamp" || p.type === "mast" || p.type === "tree") {
      out.push({ x: p.x, z: p.z, r: p.type === "lamp" ? LAMP.footW : p.type === "mast" ? MAST.foot + 0.3 : 0.4 * treeSize(p) });
      continue;
    }
    const size = Math.max(0, ...(["w", "d", "h", "r", "length"] as const).map((k) => Number((p as unknown as Record<string, unknown>)[k] ?? 0) || 0));
    out.push({ x: p.x, z: p.z, r: Math.max(1.5, size / 2 + 0.8) });
  }
  return out;
}

// The plant kinds: geometry, how much it sways, and the colours its instances pick from. A plant
// in two colours (stems and heads) is two kinds placed together.
const KINDS = {
  fern: { make: fern, sway: 0.05 }, tuft: { make: tuft, sway: 0.12 },
  stems: { make: () => stemsOf(FLOWERS), sway: 0.08 }, heads: { make: flowerHeads, sway: 0.08 },
  straws: { make: () => stemsOf(WHEAT, 0.012), sway: 0.07 }, wheat: { make: wheatHeads, sway: 0.07 },
  spireStems: { make: () => stemsOf(SPIRES, 0.018), sway: 0.05 }, spires: { make: spireHeads, sway: 0.05 },
  mound: { make: mound, sway: 0 }, heather: { make: heatherDots, sway: 0.03 },
  bush: { make: bush, sway: 0.04 }, stalks: { make: shroomStalks, sway: 0 }, caps: { make: shroomCaps, sway: 0 },
  clover: { make: clover, sway: 0 }, ivy: { make: ivy, sway: 0 },
  wrap: { make: () => wrap(COLUMN_R + 0.03), sway: 0 }, wrapPillar: { make: () => wrap(PILLAR_R + 0.03), sway: 0 }, wrapStem: { make: () => wrap(Math.hypot(SUPPORT_W, SUPPORT_D) / 2 + 0.03), sway: 0 },
  blossoms: { make: blossoms, sway: 0 }, sprig: { make: sprig, sway: 0.03 },
  trunk: { make: trunk, sway: 0.004, ink: 0.05 }, trunkUp: { make: trunkUp, sway: 0.004, ink: 0.05 }, wrapLamp: { make: () => wrap(LAMP.r + 0.03), sway: 0 }, crown: { make: crown, sway: 0.01, ink: 0.05 }, weeping: { make: weeping, sway: 0.012, ink: 0.05 }, crownTall: { make: crownTall, sway: 0.01, ink: 0.05 }, crownWide: { make: crownWide, sway: 0.01, ink: 0.05 }, crownTwin: { make: crownTwin, sway: 0.01, ink: 0.05 },
  ...Object.fromEntries(Object.entries(SHRUBS).flatMap(([k, ps], i) => [[k, { make: () => shrubOf(ps), sway: 0.02, ink: 0.032 }], [`${k}Dots`, { make: () => shrubDots(ps, 51 + i), sway: 0.02, ink: 0.032 }]])),
  saplingTrunk: { make: saplingTrunk, sway: 0.008, ink: 0.04 }, saplingCrown: { make: saplingCrown, sway: 0.008, ink: 0.04 },
  firTrunk: { make: firTrunk, sway: 0.008, ink: 0.04 }, firCones: { make: firCones, sway: 0.008, ink: 0.04 },
  ...Object.fromEntries(VINES.map((L, i) => [`vine${i}`, { make: () => vine(L), sway: 0.05 }])),
  ...Object.fromEntries(CURIOS.flat().map(([kind, make]) => [kind, { make, sway: 0, ink: 0.025 }])),
  ...Object.fromEntries(VINES.map((L, i) => [`bloom${i}`, { make: () => bloom(L), sway: 0.05 }])),
} as Record<string, { make: () => THREE.BufferGeometry; sway: number; ink?: number }>;
const GEOS = new Map<string, THREE.BufferGeometry>();
// How thickly each floor's top grows over, against grass; a mixed floor goes by the patch under each clump.
const GROWTH: Record<Exclude<FloorKind, "mixed">, number> = { grass: 1, soil: 0.8, stone: 0.55, metal: 0.3 };

// Every plant of a level, as an instanced mesh per kind in world space, each with its outline.
// Geometry and materials are shared between builds; nothing in it can be clicked.
// A tree's stem as the physics sees it: straight pieces from `a` to `b`, `r` thick, in world space.
// Everything else that grows is drawn only.
export interface Stem { a: V3; b: V3; r: number }
// Each trunk kind's stem in its own frame, piece by piece along its main limb (not its branches or roots).
const STEMS: Record<string, [V3, V3, number][]> = {
  trunk: [[[0, -0.2, -0.2], [0, 0.9, 0.45], 0.27], [[0, 0.9, 0.45], [0.1, 1.9, 1.15], 0.21], [[0.1, 1.9, 1.15], [0, 2.8, 1.7], 0.155]],
  saplingTrunk: [[[0, -0.05, 0], [0.04, 0.7, 0.05], 0.062], [[0.04, 0.7, 0.05], SAPLING, 0.048]],
  firTrunk: [[[0, -0.05, 0], [0, 0.5, 0], 0.07]],
};
// The stems of a level's trees as buildDecor placed them, for the physics (createSim).
export const decorStems = (decor: THREE.Object3D): Stem[] => (decor.userData.stems as Stem[] | undefined) ?? [];

export function buildDecor(level: Level): THREE.Group {
  const group = new THREE.Group();
  const at = new Map<string, { m: THREE.Matrix4; c: number; o?: number }[]>();
  // Nothing grows in a hole or on its rim: a point near a hole's top, within HOLE_PAD of its cut, in the
  // hole's own frame so a tilted or rolled one counts too.
  const holes = level.pieces.filter((h): h is Piece & { type: "hole" } => h.type === "hole");
  const inHole = (w: V3) => holes.some((h) => {
    const [x, y, z] = worldToFrame(h, w);
    return Math.abs(y) < 0.3 && Math.abs(x) < h.w / 2 + HOLE_PAD && Math.abs(z) < h.d / 2 + HOLE_PAD;
  });
  // The prop the plants being placed grow on (its piece index), or -1 on the ground or a platform.
  let owner = -1;
  const add = (kind: string, x: number, y: number, z: number, yaw: number, s: number | V3, col: number, lean = 0, lx = 0, lz = 0, face?: number) => {
    if (holes.length && inHole([x, y, z])) return;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, face ?? yaw, 0));
    if (lean) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(lz, 0, -lx), lean));
    const sc = typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    at.set(kind, [...(at.get(kind) ?? []), { m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, sc), c: col, o: owner }]);
  };
  // A plant standing on a surface whose up is `up`: turned `yaw` about it, or facing `out` (a wall plant's
  // face), tipped `lean` toward `out`.
  const Y = new THREE.Vector3(0, 1, 0);
  const addOn = (kind: string, pos: V3, up: THREE.Vector3, yaw: number, s: number | V3, col: number, out?: THREE.Vector3, lean = 0) => {
    if (holes.length && inHole(pos)) return;
    let q = new THREE.Quaternion().setFromUnitVectors(Y, up).multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
    if (out && !lean) {
      const z = out.clone().addScaledVector(up, -out.dot(up)).normalize(), x = up.clone().cross(z);
      q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
    }
    if (out && lean) q.premultiply(new THREE.Quaternion().setFromAxisAngle(up.clone().cross(out).normalize(), lean));
    const sc = typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
    at.set(kind, [...(at.get(kind) ?? []), { m: new THREE.Matrix4().compose(new THREE.Vector3(...pos), q, sc), c: col, o: owner }]);
  };
  const clear = keepOut(level), trees: V3[] = [], young: XZ[] = [], riding = riders(level);
  // No tree, sapling or fir roots inside a clearing, or within half a unit of it (so one drawn to a
  // platform's edge stops the trees out of that wall), at about its height.
  const clearings = level.pieces.filter((c): c is Piece & { type: "clearing" } => c.type === "clearing");
  const treeless = (w: V3) => clearings.some((c) => {
    const l = rotXZ(w[0] - c.x, w[2] - c.z, -c.rot);
    return Math.abs(w[1] - c.y) < 1.5 && Math.abs(l.x) < c.w / 2 + 0.5 && Math.abs(l.z) < c.d / 2 + 0.5;
  });
  level.pieces.forEach((p, index) => {
    let seed = (index * 2654435761 + 12345) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
    // A shrub at `pos` standing up `up`, one in four in flower.
    const shrubAt = (pos: V3, up: THREE.Vector3, s: number) => {
      const kind = rnd() < 0.7 ? "shrub" : "shrubTall", yaw = rnd() * 6.3;
      addOn(kind, pos, up, yaw, s, pick(SHRUB_LEAVES));
      if (rnd() < 0.25) addOn(`${kind}Dots`, pos, up, yaw, s, pick(DECOR.flower));
    };
    // A sapling or a small fir, a few units from any other.
    const youngAt = (pos: V3, up: THREE.Vector3, s: number) => {
      if (treeless(pos)) return;
      if (young.some(([x, z]) => Math.hypot(x - pos[0], z - pos[2]) < 2.5)) return;
      young.push([pos[0], pos[2]]);
      const yaw = rnd() * 6.3;
      if (rnd() < 0.4) { addOn("firTrunk", pos, up, yaw, s, pick(DECOR.bark)); addOn("firCones", pos, up, yaw, s, pick(DECOR.deep)); return; }
      const [, leaves, birch] = weighted(rnd, LEAVES);
      addOn("saplingTrunk", pos, up, yaw, s, birch ? DECOR.birch : pick(DECOR.bark));
      addOn("saplingCrown", pos, up, yaw, s, pick(leaves));
    };
    // A vine no longer than `room`, hanging from (x, y, z).
    const hang = (x: number, y: number, z: number, room: number) => {
      const fits = VINES.filter((L) => L * 1.1 < room);
      if (fits.length) add(`vine${VINES.indexOf(pick(fits))}`, x, y, z, rnd() * 6.3, 0.9 + rnd() * 0.2, pick(DECOR.vine));
    };
    // On a wall at (x, y, z) facing `face`: ivy, flowers or a sprig of leaves, `narrow` to hug a round post.
    const onWall = (x: number, y: number, z: number, face: number, narrow: number) => {
      const r = rnd();
      if (r < 0.45) add("ivy", x, y, z, 0, [narrow, 1, 1], pick(DECOR.ivy), 0, 0, 0, face);
      else if (r < 0.75) add("blossoms", x, y, z, 0, [narrow, 1, 1], pick(DECOR.flower), 0, 0, 0, face);
      else add("sprig", x, y - 0.2, z, 0, 0.8 + rnd() * 0.5, pick(DECOR.leaf), 0, 0, 0, face);
    };
    // A climbing vine from height y0 up to y1 round (x, z), starting at angle a.
    const climb = (kind: string, x: number, y0: number, y1: number, z: number, a: number, s: number | V3 = 1) => {
      const col = pick(DECOR.vine);
      for (let k = 0; y0 + k + 1 <= y1; k++) add(kind, x, y0 + k, z, a + k * Math.PI, s, col);
    };
    owner = -1;
    if (p.type === "column" && !pieceRoll(p) && !pieceTilt(p)) {
      // A steel post taken over: moss and flowers on its head, vines hanging from it and climbing it,
      // ivy, flowers and leaves all up it, ferns and flowers round its foot.
      // The wrap is made round a COLUMN_R post; a wider or narrower one stretches it to fit.
      const R = p.r, h = p.h, fit = (R + 0.03) / (COLUMN_R + 0.03);
      owner = index;
      add("mound", p.x, p.y + h - 0.06, p.z, rnd() * 6.3, [R / 0.3, 0.9, R / 0.3], pick(DECOR.moss));
      const crown = rnd() * 6.3;
      add("stems", p.x, p.y + h + 0.05, p.z, crown, 1, DECOR.stem);
      add("heads", p.x, p.y + h + 0.05, p.z, crown, 1, pick(DECOR.flower));
      for (let k = 0; k < 2 + rnd() * 3; k++) { const a = rnd() * 6.3; hang(p.x + Math.sin(a) * (R + 0.04), p.y + h - 0.08, p.z + Math.cos(a) * (R + 0.04), h - 0.2); }
      for (let k = 0; k < 2 + rnd() * 2; k++) climb("wrap", p.x, p.y + 0.05, p.y + 0.05 + (h - 0.3) * (0.5 + rnd() * 0.5), p.z, rnd() * 6.3, [fit, 1, fit]);
      for (let k = 0; k < h * 6; k++) {
        const a = rnd() * 6.3;
        onWall(p.x + Math.sin(a) * (R + 0.005), p.y + 0.6 + rnd() * Math.max(0, h - 0.7), p.z + Math.cos(a) * (R + 0.005), a, 0.55);
      }
      owner = -1;
      for (let k = 0; k < 5; k++) {
        const a = rnd() * 6.3, x = p.x + Math.sin(a) * (R + 0.3), z = p.z + Math.cos(a) * (R + 0.3);
        if (k === 0) add("fern", x, p.y, z, rnd() * 6.3, 0.9 + rnd() * 0.4, pick(DECOR.fern));
        else if (k === 1) { const yaw = rnd() * 6.3; add("stems", x, p.y, z, yaw, 0.9, DECOR.stem); add("heads", x, p.y, z, yaw, 0.9, pick(DECOR.flower)); }
        else add(k === 2 ? "clover" : "tuft", x, p.y, z, rnd() * 6.3, 0.9 + rnd() * 0.4, k === 2 ? pick(DECOR.clover) : pick(DECOR.tuft));
      }
    }
    if (p.type === "support") {
      // Each pillar: ivy, flowers and leaves up all its faces, a vine climbing it now and then, and one
      // hanging down its outer face from the platform it holds.
      const T = PLATFORM_THICKNESS, over = supportOver(p);
      owner = index;
      const world = (x: number, y: number, z: number): V3 => { const l: V3 = over ? [-x, -T - y, z] : [x, y, z], o = rotXZ(l[0], l[2], p.rot); return [p.x + o.x, p.y + l[1], p.z + o.z]; };
      for (const c of supportPillars(p)) {
        const lo = c.y0 + 0.6, hi = c.y1 - 0.1;
        for (let k = 0; k < (hi - lo) * 5; k++) {
          const side = Math.floor(rnd() * 4), y = lo + rnd() * Math.max(0, hi - lo);
          const [nx, nz] = side === 0 ? [0, 1] : side === 1 ? [1, 0] : side === 2 ? [-1, 0] : [0, -1];
          const n = rotXZ(over ? -nx! : nx!, nz!, p.rot);
          onWall(...world(c.x + nx! * (SUPPORT_W / 2 + 0.005), y, c.z + nz! * (SUPPORT_D / 2 + 0.005)), Math.atan2(n.x, n.z), nz ? 0.75 : 0.65);
        }
        if (!over && rnd() < 0.6) { const [x, , z] = world(c.x, 0, c.z); climb("wrapStem", x, p.y + lo, p.y + lo + (hi - lo) * (0.5 + rnd() * 0.5), z, rnd() * 6.3); }
        if (!over) hang(...world(c.x + (rnd() - 0.5) * SUPPORT_W * 0.6, c.y1 - 0.05, c.z + SUPPORT_D / 2 + 0.06), c.y1 - c.y0);
      }
      owner = -1;
    }
    // The old structure's machines, grown over where they stand still: at `local` in the piece's frame.
    const rot = "rot" in p && typeof p.rot === "number" ? p.rot : 0;
    const at = (x: number, y: number, z: number): V3 => { const o = rotXZ(x, z, rot); return [p.x + o.x, p.y + y, p.z + o.z]; };
    const turn = (a: number) => a + (rot * Math.PI) / 180;
    // A cushion of moss w x d on a flat top at height y, with a flower clump or tuft in it now and then.
    const cushion = (y: number, w: number, d: number) => {
      add("mound", ...at(0, y - 0.06, 0), turn(0), [(w * 0.75) / 0.64, 0.8, (d * 0.75) / 0.64], pick(DECOR.moss));
      if (rnd() < 0.6) { const yaw = rnd() * 6.3, x = (rnd() - 0.5) * w * 0.4, z = (rnd() - 0.5) * d * 0.4; add("stems", ...at(x, y + 0.04, z), yaw, 0.9, DECOR.stem); add("heads", ...at(x, y + 0.04, z), yaw, 0.9, pick(DECOR.flower)); }
    };
    // Ivy, flowers and leaves up the four sides of a w x d box from y0 to y1.
    const sides = (w: number, d: number, y0: number, y1: number, per: number) => {
      for (const [nx, nz, len] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]] as const) {
        for (let k = 0; k < len * (y1 - y0) * per; k++) {
          const t = (rnd() - 0.5) * len * 0.8, y = y0 + 0.6 + rnd() * Math.max(0, y1 - y0 - 0.6);
          onWall(...at(nx * (w / 2 + 0.005) + (nz ? t : 0), y, nz * (d / 2 + 0.005) + (nx ? t : 0)), turn(Math.atan2(nx, nz)), 0.7);
        }
      }
    };
    // Ferns, tufts, clover and flowers in a ring `r` round the foot.
    const foot = (r: number, n: number) => {
      const was = owner;
      owner = -1;
      for (let k = 0; k < n; k++) {
        const a = rnd() * 6.3, [x, y, z] = at(Math.sin(a) * r, 0, Math.cos(a) * r), q = rnd();
        if (q < 0.15) shrubAt([x, y, z], Y, 0.6 + rnd() * 0.5);
        else if (q < 0.35) add("fern", x, y, z, rnd() * 6.3, 0.8 + rnd() * 0.4, pick(DECOR.fern));
        else if (q < 0.5) { const yaw = rnd() * 6.3; add("stems", x, y, z, yaw, 0.9, DECOR.stem); add("heads", x, y, z, yaw, 0.9, pick(DECOR.flower)); }
        else add(q < 0.7 ? "clover" : "tuft", x, y, z, rnd() * 6.3, 0.9 + rnd() * 0.4, q < 0.7 ? pick(DECOR.clover) : pick(DECOR.tuft));
      }
      owner = was;
    };
    if (!riding.has(index) && !pieceRoll(p) && !pieceTilt(p)) {
      owner = index;
      if (p.type === "blockade") { cushion(p.h, p.w, p.d); sides(p.w, p.d, 0, p.h, 1.2); foot(Math.max(p.w, p.d) / 2 + 0.5, Math.round((2 + p.w + p.d) / 1.5)); }
      if (p.type === "block") { cushion(p.h, p.w, p.d); sides(p.w, p.d, 0, p.h, 1); foot(Math.max(p.w, p.d) / 2 + 0.4, 4); }
      if (p.type === "barrier") { cushion(BARRIER_H, BARRIER_W, BARRIER_D); sides(BARRIER_W, BARRIER_D, BARRIER_LEG, BARRIER_H, 1); foot(0.9, 3); }
      if (p.type === "pillar") {
        add("mound", ...at(0, PILLAR_H - 0.12, 0), 0, [PILLAR_R / 0.3, 0.8, PILLAR_R / 0.3], pick(DECOR.moss));
        for (let k = 0; k < 1 + rnd() * 2; k++) climb("wrapPillar", p.x, p.y + 0.05, p.y + 0.05 + (PILLAR_H - 0.6) * (0.5 + rnd() * 0.5), p.z, rnd() * 6.3);
        for (let k = 0; k < PILLAR_H * 4; k++) { const a = rnd() * 6.3; onWall(p.x + Math.sin(a) * (PILLAR_R + 0.005), p.y + 0.6 + rnd() * (PILLAR_H - 0.9), p.z + Math.cos(a) * (PILLAR_R + 0.005), a, 0.45); }
        foot(PILLAR_R + 0.35, 4);
      }
      if (p.type === "puffer") foot(1.3, 5);
      if (p.type === "magnet") foot(1.2, 4);
      if (p.type === "kicker" && !isSliding(p)) {
        const back = -(p.d + (p.flat ?? 0)) / 2;
        for (let k = 0; k < 5; k++) { const side = rnd() < 0.5 ? -1 : 1, z = back + rnd() * (p.d + (p.flat ?? 0)); add(rnd() < 0.5 ? "fern" : "tuft", ...at(side * (p.w / 2 + 0.3), 0, z), rnd() * 6.3, 0.8 + rnd() * 0.4, pick(DECOR.fern)); }
        for (let k = 0; k < 3; k++) { const [x, y, z] = at((rnd() - 0.5) * p.w * 0.7, p.h - 0.05, back - 0.04); hang(x, y, z, p.h); }
      }
      if (p.type === "jump") for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) if (rnd() < 0.7) add(rnd() < 0.5 ? "fern" : "tuft", ...at(sx * (p.w / 2 + 0.3), 0, sz * (p.d / 2 + 0.3)), rnd() * 6.3, 0.8 + rnd() * 0.4, pick(DECOR.fern));
      if (p.type === "arch") for (const z of p.d ? [-p.d / 2, p.d / 2] : [0]) for (let x = -p.w / 2 + 0.6; x < p.w / 2 - 0.4; x += 0.8) if (rnd() < 0.55) hang(...at(x, p.h - 0.3, z), p.h - 0.6);
      if (p.type === "lamp") {
        climb("wrapLamp", p.x, p.y + LAMP.foot, p.y + LAMP.foot + (p.h - 0.6) * (0.4 + rnd() * 0.5), p.z, rnd() * 6.3);
        for (let k = 0; k < 2; k++) { const [x, y, z] = at(LAMP.reach - 0.04 + (rnd() - 0.5) * 0.4, p.h + LAMP.rise - 0.1, (rnd() - 0.5) * 0.3); hang(x, y, z, p.h); }
        foot(LAMP.footW, 3);
      }
      if (p.type === "mast") {
        // Vines hanging from its rings and its deck, moss on the deck, the foot grown over.
        const rings = mastRings(p.h), c = (y: number) => MAST.foot + ((MAST.top - MAST.foot) * y) / p.h;
        for (const y of [...rings.slice(1), p.h]) for (let k = 0; k < 3; k++) {
          if (rnd() > 0.45) continue;
          const t = (rnd() - 0.5) * 1.6 * c(y), side = Math.floor(rnd() * 4), [sx, sz] = side === 0 ? [1, 0] : side === 1 ? [-1, 0] : side === 2 ? [0, 1] : [0, -1];
          hang(...at(sx! * c(y) + (sz ? t : 0), y - 0.05, sz! * c(y) + (sx ? t : 0)), y);
        }
        cushion(p.h + 0.12, 2 * MAST.top + 0.3, 2 * MAST.top + 0.3);
        foot(MAST.foot + 0.4, 7);
      }
      if (p.type === "tree") foot(0.55 * treeSize(p), 5);
      if (p.type === "fence") for (const q of fenceRings(p)) {
        if (rnd() > 0.3) continue;
        const l = Math.hypot(q.d[0], q.d[2]) || 1, side = rnd() < 0.5 ? -1 : 1, nx = (q.d[2] / l) * side, nz = (-q.d[0] / l) * side;
        const [x, y, z] = at(q.c[0] + nx * (RAIL_R + 0.005), q.c[1] + 0.25, q.c[2] + nz * (RAIL_R + 0.005)), n = rotXZ(nx, nz, rot);
        add(rnd() < 0.5 ? "sprig" : "blossoms", x, y, z, 0, [0.5, 0.6, 1], pick(rnd() < 0.5 ? DECOR.leaf : DECOR.flower), 0, 0, 0, Math.atan2(n.x, n.z));
      }
      if (p.type === "rails") for (const q of railsRingsWorld(p, level)) if (rnd() < 0.25) hang(q.c[0], q.c[1] - RAIL_R, q.c[2], 2.5);
      if (p.type === "tube") for (const q of tubeRingsWorld(p)) {
        if (rnd() < 0.3) hang(q.c[0], q.c[1] - TUBE_R - 0.02, q.c[2], 3);
        if (rnd() < 0.25) add("mound", q.c[0], q.c[1] + TUBE_R - 0.1, q.c[2], rnd() * 6.3, [1.2, 0.7, 1.2], pick(DECOR.moss));
      }
    }
    owner = -1;
    const surf = surfaceOf(level, p);
    if (!surf) return;
    const v3 = (w: V3) => new THREE.Vector3(...w);
    const upAt = (x: number, z: number) => v3(surf.at(x, z, 0.1)).sub(v3(surf.at(x, z, 0))).normalize();
    const kept = (w: V3) => !clear.some((c) => Math.hypot(c.x - w[0], c.z - w[2]) < c.r);
    // One of the low or taller plants at a layout point, standing up off the surface there.
    const grow = (x: number, z: number, tall: number, corner: boolean) => {
      const w = surf.at(x, z, 0), up = upAt(x, z), yaw = rnd() * 6.3, s = 0.85 + rnd() * 0.4;
      if (!kept(w)) return;
      if (tall < (corner ? 0.35 : 0.1)) { addOn("stems", w, up, yaw, s, DECOR.stem); addOn("heads", w, up, yaw, s, pick(DECOR.flower)); }
      else if (tall < (corner ? 0.55 : 0.18)) { addOn("straws", w, up, yaw, s, DECOR.straw); addOn("wheat", w, up, yaw, s, pick(DECOR.wheat)); }
      else if (tall < (corner ? 0.7 : 0.24)) { addOn("spireStems", w, up, yaw, s, DECOR.stem); addOn("spires", w, up, yaw, s, pick(DECOR.spire)); }
      else if (tall < (corner ? 0.8 : 0.3)) { addOn("mound", w, up, yaw, s, DECOR.mound); addOn("heather", w, up, yaw, s, pick(DECOR.heather)); }
      else if (tall < (corner ? 0.9 : 0.36)) addOn("bush", w, up, yaw, s, pick(DECOR.leaf));
      else if (tall < 0.4) { addOn("stalks", w, up, yaw, s * 1.2, DECOR.stalk); addOn("caps", w, up, yaw, s * 1.2, pick(DECOR.cap)); }
    };
    for (const e of surf.edges) {
      const [ax, az] = e.a, [nx, nz] = e.n, on = (d: number, h = 0) => surf.at(ax - nx * d, az - nz * d, h);
      const w0 = on(0), up = upAt(ax, az), out = v3(surf.at(ax + nx * 0.1, az + nz * 0.1, 0)).sub(v3(w0)).normalize();
      if (!kept(w0)) continue;
      const r = rnd();
      // Some ferns sit on the lip and spill over it, the rest stand a little further in.
      const fernAt = rnd() < 0.5 ? 0.1 : 0.45;
      if (e.corner || r < 0.4) addOn("fern", on(fernAt), up, rnd() * 6.3, 1.1 + rnd() * 0.9, rnd() < 0.15 ? DECOR.rust : pick(DECOR.fern), out, fernAt < 0.2 ? 0.55 : 0.2);
      if (r > 0.25 && r < 0.8) addOn("tuft", on(0.3 + rnd() * 0.6), up, rnd() * 6.3, 0.9 + rnd() * 0.6, pick(DECOR.tuft));
      if (rnd() < 0.18) addOn("clover", on(0.3 + rnd() * 0.7), up, rnd() * 6.3, 0.9 + rnd() * 0.5, pick(DECOR.clover));
      // One of the taller plants, now and then, a little further in.
      const d = 0.55 + rnd() * 0.45;
      grow(ax - nx * d, az - nz * d, rnd(), e.corner);
      // Between the low plants and the trees: shrubs here and there, now and then a sapling or a fir.
      if (rnd() < 0.13) { const w = on(0.35 + rnd() * 0.5); if (kept(w)) shrubAt(w, up, 0.55 + rnd() * 0.75); }
      if (rnd() < 0.045) { const w = on(0.5 + rnd() * 0.3); if (kept(w)) youngAt(w, up, 0.7 + rnd() * 0.6); }
      // Down the wall: ivy clinging to it, and on a platform the right way up vines hanging past it.
      if (rnd() < 0.3) addOn("ivy", v3(on(0, -0.15)).addScaledVector(out, 0.01).toArray() as V3, up, 0, 0.9 + rnd() * 0.4, pick(DECOR.ivy), out);
      if (up.y < 0.7) continue;
      const face = Math.atan2(out.x, out.z);
      // Now and then a tree out of the wall of a level platform, its crown over open air: mostly small or
      // middling, now and then big, the bigger the further from the others, and one of a few kinds (see TREES).
      const size = rnd(), ts = size < 0.35 ? 0.5 + rnd() * 0.25 : size < 0.65 ? 0.85 + rnd() * 0.3 : size < 0.87 ? 1.25 + rnd() * 0.25 : 1.6 + rnd() * 0.4, room = 4 + 4 * ts;
      if (surf.flat && !e.corner && rnd() < 0.08 && trees.every(([x, z, r]) => Math.hypot(x - w0[0], z - w0[2]) > Math.max(r, room))) {
        const cx = w0[0] + out.x * TREE[2] * ts, cz = w0[2] + out.z * TREE[2] * ts, rr = 1.6 * ts;
        const free = [[0, 0], [rr, 0], [-rr, 0], [0, rr], [0, -rr]].every(([dx, dz]) => surfaceAt(level, cx + dx!, cz + dz!) === null);
        if (free && !treeless(w0)) {
          trees.push([w0[0], w0[2], room]);
          const x = w0[0] + out.x * 0.12, z = w0[2] + out.z * 0.12, y = w0[1] - 0.5 - 0.15 * ts;
          const [crown, leaves, bark] = pickTree(rnd);
          add("trunk", x, y, z, 0, ts, bark, 0, 0, 0, face);
          add(crown, x, y, z, 0, ts, leaves, 0, 0, 0, face);
          // Its undergrowth: a shrub or two along the rim by its root, and now and then a sapling.
          const by = (dd: number, t: number) => surf.inside(ax - nx * dd - nz * t, az - nz * dd + nx * t, 0.3) ? surf.at(ax - nx * dd - nz * t, az - nz * dd + nx * t, 0) : null;
          for (let k = 0; k < 1 + rnd() * 2; k++) { const w = by(0.4 + rnd() * 0.5, (rnd() - 0.5) * 2.4); if (w && kept(w)) shrubAt(w, up, 0.7 + rnd() * 0.6); }
          if (rnd() < 0.5) { const w = by(0.6, (rnd() < 0.5 ? -1 : 1) * (1 + rnd())); if (w && kept(w)) youngAt(w, up, 0.6 + rnd() * 0.4); }
        }
      }
      if (rnd() < 0.5) {
        // Only as long as clears any platform below, its bloom included. Whichever platform top lies
        // nearest the middle of the span lies inside it, if any does.
        const [x, y, z] = v3(on(0, -0.05)).addScaledVector(out, 0.05).toArray(), vs = 0.9 + rnd() * 0.3, yaw = rnd() * 6.3;
        const fits = VINES.map((_, i) => i).filter((i) => {
          const low = y - (VINES[i]! + BLOOM_H) * vs - 0.1, top = surfaceAt(level, x, z, (y + low) / 2);
          return top === null || top >= y || top < low;
        });
        if (fits.length) {
          const v = pick(fits);
          add(`vine${v}`, x, y, z, yaw, vs, pick(DECOR.vine));
          if (rnd() < 0.35) add(`bloom${v}`, x, y, z, yaw, vs, pick(DECOR.bloom));
        }
      }
    }
    // The whole top grown over in clumps, each a few plants close together: mostly grass and clover,
    // now and then flowers, a small fern, a mushroom or one of the taller plants. Fewer on a floor less
    // given to growing (GROWTH).
    const [x0, x1, z0, z1] = surf.box, clumps = Math.round((x1 - x0) * (z1 - z0) * 0.11), floor = floorOf(level, p);
    const off = pieceRot(p) - 90 * Math.round(pieceRot(p) / 90), pseed = patchSeed(level.id);
    for (let k = 0; k < clumps; k++) {
      const cx = x0 + rnd() * (x1 - x0), cz = z0 + rnd() * (z1 - z0), n = 3 + Math.floor(rnd() * 5);
      const [wx, , wz] = surf.at(cx, cz, 0), fr = rotXZ(wx, wz, -off);
      if (rnd() > GROWTH[floor === "mixed" ? patchAt(fr.x, fr.z, pseed) as Exclude<FloorKind, "mixed"> : floor]) continue;
      for (let q = 0; q < n; q++) {
        const a = rnd() * 6.3, d = Math.sqrt(rnd()) * 0.9, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!surf.inside(x, z, 0.35)) continue;
        const w = surf.at(x, z, 0), up = upAt(x, z), r = rnd();
        if (!kept(w)) continue;
        if (r < 0.5) addOn("tuft", w, up, rnd() * 6.3, 0.8 + rnd() * 0.6, pick(DECOR.tuft));
        else if (r < 0.75) addOn("clover", w, up, rnd() * 6.3, 0.8 + rnd() * 0.5, pick(DECOR.clover));
        else if (r < 0.85) { const yaw = rnd() * 6.3; addOn("stems", w, up, yaw, 0.8, DECOR.stem); addOn("heads", w, up, yaw, 0.8, pick(DECOR.flower)); }
        else if (r < 0.92) addOn("fern", w, up, rnd() * 6.3, 0.7 + rnd() * 0.3, pick(DECOR.fern));
        else if (r < 0.96) { const yaw = rnd() * 6.3; addOn("stalks", w, up, yaw, 0.9, DECOR.stalk); addOn("caps", w, up, yaw, 0.9, pick(DECOR.cap)); }
        else if (r < 0.975) shrubAt(w, up, 0.45 + rnd() * 0.3);
        else grow(x, z, rnd() * 0.36, false);
      }
    }
    // Now and then a curio among the plants, turned any way.
    for (let k = Math.floor((x1 - x0) * (z1 - z0) * CURIO_RATE + rnd()); k > 0; k--) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      if (!surf.inside(x, z, 0.6)) continue;
      const w = surf.at(x, z, 0), up = upAt(x, z), yaw = rnd() * 6.3, sc = 0.9 + rnd() * 0.3;
      if (!kept(w)) continue;
      for (const [kind, , colours] of pick(CURIOS)) addOn(kind, w, up, yaw, sc, pick(colours));
    }
  });
  const stems: Stem[] = [];
  for (const [kind, list] of at) for (const { m } of STEMS[kind] ? list : []) {
    const k = m.getMaxScaleOnAxis(), w = (v: V3) => new THREE.Vector3(...v).applyMatrix4(m).toArray() as V3;
    for (const [a, b, r] of STEMS[kind]!) stems.push({ a: w(a), b: w(b), r: r * k });
  }
  group.userData.stems = stems;
  instance(group, at);
  return group;
}

// A tree placed as a piece, in its own frame: the trunk upright with the crown over it, `size` scaling both.
// Its leaves' shade and its bark are picked from where it stands. It is drawn like the scattered trees, but
// can be clicked. Its stem is solid (pieceCapsules); the rest is drawn only.
const CROWN_KIND: Record<TreeCrown, string> = { round: "crown", tall: "crownTall", wide: "crownWide", twin: "crownTwin", willow: "weeping" };
const LEAF_LIST: Record<TreeLeaves, readonly number[]> = { green: DECOR.canopy, deep: DECOR.deep, autumn: DECOR.autumn, blossom: DECOR.blossom, lime: DECOR.lime };
export function buildTree(p: Piece & { type: "tree" }): THREE.Group {
  const s = treeSize(p), crown = p.crown ?? "round", leaves = p.leaves ?? "green";
  const shade = Math.abs(Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1, pick = (xs: readonly number[]) => xs[Math.floor(shade * xs.length)]!;
  const list = crown === "willow" && leaves === "green" ? DECOR.willow : LEAF_LIST[leaves];
  const scale = new THREE.Matrix4().makeScale(s, s, s);
  const g = plantGroup(new Map([
    ["trunkUp", [{ m: scale.clone(), c: leaves === "lime" ? DECOR.birch : pick(DECOR.bark) }]],
    [CROWN_KIND[crown], [{ m: scale.clone().multiply(new THREE.Matrix4().makeTranslation(-TREE[0], TREE_CROWN - TREE[1], -TREE[2])), c: pick(list) }]],
  ]));
  g.traverse((o) => { if (o instanceof THREE.InstancedMesh && !o.userData.outline) delete (o as { raycast?: unknown }).raycast; });
  return g;
}

// Plants placed by hand (the title picture): `at` lists each kind's instance matrices and colours.
export function plantGroup(at: Map<string, { m: THREE.Matrix4; c: number }[]>): THREE.Group {
  const group = new THREE.Group();
  instance(group, at);
  return group;
}

// Puts `plantReach` (see WHOLE_GLSL) on every vertex: the kind's farthest point from its root, plus its sway.
function withReach(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute("position");
  let r = 0;
  for (let i = 0; i < pos.count; i++) r = Math.max(r, Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)));
  geo.setAttribute("plantReach", new THREE.BufferAttribute(new Float32Array(pos.count).fill(r + 0.1), 1));
  return geo;
}

// A build's own geometry for a kind: the kind's shared attributes, plus each instance's owner.
function owned(base: THREE.BufferGeometry, owners: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(base.attributes)) g.setAttribute(name, a);
  g.setIndex(base.index);
  g.setAttribute("plantOwner", new THREE.InstancedBufferAttribute(new Float32Array(owners), 1));
  g.userData.owned = true;
  return g;
}

function instance(group: THREE.Group, at: Map<string, { m: THREE.Matrix4; c: number; o?: number }[]>): void {
  for (const [kind, list] of at) {
    const k = KINDS[kind]!;
    let geo = GEOS.get(kind);
    if (!geo) { geo = withReach(k.make()); GEOS.set(kind, geo); }
    geo = owned(geo, list.map((a) => a.o ?? -1));
    const m = new THREE.InstancedMesh(geo, swaying(k.sway), list.length);
    // Drawn as see-through (to fade) but before other see-through things, such as tubes' glass, and
    // before their own outline, so a plant's body hides its hull's inside.
    m.renderOrder = -2;
    m.name = kind;
    list.forEach((a, i) => { m.setMatrixAt(i, a.m); m.setColorAt(i, new THREE.Color(a.c)); });
    m.userData.noShadow = true;
    m.raycast = () => {};
    group.add(m);
    if (OUTLINE > 0) {
      const o = new THREE.InstancedMesh(geo, outlined(k.sway, k.ink), list.length);
      o.instanceMatrix = m.instanceMatrix;
      o.renderOrder = -1;
      o.userData.outline = true;
      o.userData.noShadow = true;
      o.raycast = () => {};
      group.add(o);
    }
  }
}

// Frees a build's instance buffers and owner lists; the kinds' geometry and materials are shared and stay.
export function disposeDecor(group: THREE.Group): void {
  const own = new Set<THREE.BufferGeometry>();
  group.traverse((o) => { if (o instanceof THREE.InstancedMesh) { o.dispose(); if (o.geometry.userData.owned) own.add(o.geometry); } });
  for (const g of own) {
    for (const name of Object.keys(g.attributes)) if (name !== "plantOwner") g.deleteAttribute(name);
    g.setIndex(null);
    g.dispose();
  }
}
