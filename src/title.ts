// Dev-only: renders the menu's title picture (public/title.png) in the game's own look: Fredoka Medium
// capitals (inked, about the weight of the old Fredoka Bold title) as solid 3D pieces, "RUST" in the props' rusting steel and "BLOOM" in the grass floor's green, cel
// lit and inked, overgrown with the game's plants. Open /title.html, then window.save() writes the
// picture. See docs/colors.md "UI".
import * as THREE from "three";
import opentype from "opentype.js";
import fredoka from "@fontsource/fredoka/files/fredoka-latin-500-normal.woff?url";
import { addLights, initMaterials, steelMaterial, stylize } from "./scene.ts";
import { plantGroup } from "./decor.ts";
import { DECOR, ENV, GRASS } from "./palette.ts";

const W = 2400, H = 900;
const canvas = document.getElementById("game") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
initMaterials(renderer);

// Letters are built GROW times their drawn size and scaled down, so the steel's texture (laid in object
// units) packs more of its plates and rust onto each.
const SIZE = 2, DEPTH = 0.32, INK = 0.042, GROW = 3;
const font = opentype.parse(await (await fetch(fredoka)).arrayBuffer());

// A glyph's outline as THREE shapes, y up, from opentype's y-down path.
function glyphShapes(ch: string, x: number): THREE.Shape[] {
  const path = font.getPath(ch, x, 0, SIZE * GROW), sp = new THREE.ShapePath();
  for (const c of path.commands) {
    if (c.type === "M") sp.moveTo(c.x, -c.y);
    else if (c.type === "L") sp.lineTo(c.x, -c.y);
    else if (c.type === "Q") sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === "C") sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  return sp.toShapes();
}

// A letter's solid, and its ink: the same glyph grown by INK all round (a wider, deeper bevel), drawn
// inside out. Pushing the letter's own hull out along its normals flips the cap's thin triangles.
const BEVEL = { t: 0.04, s: 0.012 };
const inkMat = new THREE.MeshBasicMaterial({ color: ENV.outlineColor, side: THREE.BackSide });
const letterGeo = (shapes: THREE.Shape[], grow: number) => new THREE.ExtrudeGeometry(shapes, {
  depth: DEPTH * GROW, bevelEnabled: true, bevelThickness: (BEVEL.t + grow) * GROW, bevelSize: (BEVEL.s + grow) * GROW, bevelSegments: 3, curveSegments: 12,
});

// "bloom" is the grass floor's own green (GRASS.turf), plain, so it matches the levels.
const steel = steelMaterial();
const mossy = new THREE.MeshStandardMaterial({ color: GRASS.turf, roughness: ENV.floorRoughness });

const scene = new THREE.Scene();
const sun = addLights(scene);
sun.castShadow = false;
sun.position.set(-6, 10, 14);
const title = new THREE.Group();
scene.add(title);

const WORD = "RUSTBLOOM", letters: THREE.Mesh[] = [];
let x = 0;
for (const [i, ch] of [...WORD].entries()) {
  const shapes = glyphShapes(ch, x), m = new THREE.Mesh(letterGeo(shapes, 0), i < 4 ? steel : mossy);
  m.scale.setScalar(1 / GROW);
  // Kept out of stylize's thinner outline; the letters wear their own ink.
  m.userData.noShadow = true;
  m.add(new THREE.Mesh(letterGeo(shapes, INK), inkMat));
  title.add(m);
  letters.push(m);
  x += ((font.charToGlyph(ch).advanceWidth! / font.unitsPerEm) * SIZE + 0.12) * GROW;
}
stylize(title);
const box = new THREE.Box3().setFromObject(title), mid = box.getCenter(new THREE.Vector3());
title.position.set(-mid.x, -mid.y, 0);
title.updateMatrixWorld(true);

// Plants: found on the letters by casting rays at them, placed as the level's overgrowth is.
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
const at = new Map<string, { m: THREE.Matrix4; c: number }[]>();
const Y = new THREE.Vector3(0, 1, 0);
const put = (kind: string, p: THREE.Vector3, up: THREE.Vector3, yaw: number, s: number, c: number) => {
  const q = new THREE.Quaternion().setFromUnitVectors(Y, up).multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
  at.set(kind, [...(at.get(kind) ?? []), { m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(s, s, s)), c }]);
};
const ray = new THREE.Raycaster();
const hit = (from: THREE.Vector3, dir: THREE.Vector3, only?: THREE.Mesh) => {
  ray.set(from, dir);
  return ray.intersectObjects(only ? [only] : letters, false)[0] ?? null;
};
const top = box.max.y - mid.y + 1, bottom = box.min.y - mid.y - 1;
const lo = box.min.x - mid.x, hi = box.max.x - mid.x;
const zMid = DEPTH / 2;

// Over every letter's tops: grass, clover and flowers everywhere, ferns and moss more on "bloom".
for (let px = lo; px <= hi; px += 0.09) {
  const h = hit(new THREE.Vector3(px, top, zMid + (rnd() - 0.5) * 0.3), new THREE.Vector3(0, -1, 0));
  if (!h || !h.face) continue;
  const up = h.face.normal.clone().transformDirection(h.object.matrixWorld);
  if (up.y < 0.55) continue;
  const bloom = letters.indexOf(h.object as THREE.Mesh) >= 4, r = rnd(), p = h.point;
  if (r < (bloom ? 0.22 : 0.08)) put("fern", p, up, rnd() * 6.3, 0.42 + rnd() * 0.25, pick(DECOR.fern));
  else if (r < (bloom ? 0.42 : 0.3)) put("tuft", p, up, rnd() * 6.3, 0.6 + rnd() * 0.4, pick(DECOR.tuft));
  else if (r < (bloom ? 0.58 : 0.4)) { const yaw = rnd() * 6.3, s = 0.5 + rnd() * 0.2; put("stems", p, up, yaw, s, DECOR.stem); put("heads", p, up, yaw, s, pick(DECOR.flower)); }
  else if (r < (bloom ? 0.68 : 0.46)) put("clover", p, up, rnd() * 6.3, 0.6, pick(DECOR.clover));
  else if (r < (bloom ? 0.74 : 0.5)) { const yaw = rnd() * 6.3; put("spireStems", p, up, yaw, 0.45, DECOR.stem); put("spires", p, up, yaw, 0.45, pick(DECOR.spire)); }
  else if (bloom && r < 0.8) put("mound", p.clone().addScaledVector(up, -0.04), up, rnd() * 6.3, 0.45, pick(DECOR.moss));
}
// Two shrubs and a sapling standing on "bloom", one shrub and a fir on "Rust".
const stand = (px: number, kind: string, s: number, c: number, extra?: [string, number]) => {
  const h = hit(new THREE.Vector3(px, top, zMid), new THREE.Vector3(0, -1, 0));
  if (!h) return;
  put(kind, h.point, Y, rnd() * 6.3, s, c);
  if (extra) put(extra[0], h.point, Y, 0, s, extra[1]);
};
const span = (k: number) => { const b = new THREE.Box3().setFromObject(letters[k]!); return [b.min.x, b.max.x] as const; };
const across = (k: number, t: number) => { const [a, b] = span(k); return a + (b - a) * t; };
stand(across(0, 0.25), "shrub", 0.45, pick(DECOR.canopy));
stand(across(3, 0.5), "firTrunk", 0.4, pick(DECOR.bark), ["firCones", pick(DECOR.deep)]);
stand(across(4, 0.5), "shrub", 0.42, pick(DECOR.blossom), ["shrubDots", DECOR.flower[2]!]);
stand(across(6, 0.6), "shrubTall", 0.5, pick(DECOR.lime));
stand(across(8, 0.75), "shrub", 0.5, pick(DECOR.canopy), ["shrubDots", pick(DECOR.flower)]);

// Vines hanging from the letters' undersides, some ending in a bloom; more off "bloom".
for (let px = lo; px <= hi; px += 0.2) {
  const h = hit(new THREE.Vector3(px, bottom, DEPTH + 0.02), new THREE.Vector3(0, 1, 0));
  if (!h || !h.face) continue;
  const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
  const bloom = letters.indexOf(h.object as THREE.Mesh) >= 4;
  if (n.y > -0.5 || rnd() > (bloom ? 0.55 : 0.3)) continue;
  const v = Math.floor(rnd() * 2), s = 0.3 + rnd() * 0.12, yaw = rnd() * 6.3, p = h.point.clone().add(new THREE.Vector3(0, 0.03, -0.02));
  put(`vine${v}`, p, Y, yaw, s, pick(DECOR.vine));
  if (rnd() < 0.4) put(`bloom${v}`, p, Y, yaw, s, pick(DECOR.bloom));
}
// Ivy and small flowers clinging low on the fronts, leaving the letters readable.
for (let k = 0; k < 90; k++) {
  const px = lo + rnd() * (hi - lo), py = (box.min.y - mid.y) + rnd() * (box.max.y - box.min.y) * 0.55;
  const h = hit(new THREE.Vector3(px, py, 5), new THREE.Vector3(0, 0, -1));
  if (!h || !h.face) continue;
  const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
  if (n.z < 0.9) continue;
  const p = h.point.clone().add(new THREE.Vector3(0, 0, 0.012)), q = new THREE.Quaternion(), s = 0.38 + rnd() * 0.2;
  const kind = rnd() < 0.65 ? "ivy" : "blossoms";
  // The patch hangs about 0.8 of its size down and 0.5 to each side: all of it must lie on this letter.
  const on = (dx: number, dy: number) => hit(new THREE.Vector3(px + dx * s, py + dy * s, 5), new THREE.Vector3(0, 0, -1))?.object === h.object;
  if (!(on(-0.5, -0.8) && on(0.5, -0.8) && on(-0.5, 0) && on(0.5, 0))) continue;
  q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rnd() - 0.5) * 0.8);
  at.set(kind, [...(at.get(kind) ?? []), { m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(s, s, s)), c: kind === "ivy" ? pick(DECOR.ivy) : pick(DECOR.flower) }]);
}
const plants = plantGroup(at);
stylize(plants);
scene.add(plants);

const all = new THREE.Box3().setFromObject(scene);
const camera = new THREE.PerspectiveCamera(24, W / H, 0.1, 200);
const fit = (Math.max(all.max.x - all.min.x, (all.max.y - all.min.y) * (W / H)) / 2 / Math.tan((camera.fov * Math.PI) / 360)) / (W / H);
camera.position.set(0, (all.min.y + all.max.y) / 2 + fit * 0.06, fit * 1.12);
camera.lookAt(0, (all.min.y + all.max.y) / 2, 0);
renderer.render(scene, camera);

// The render cropped to what it drew, as a PNG data URL.
function cropped(): string {
  const c = document.createElement("canvas"), g = c.getContext("2d")!;
  c.width = W; c.height = H;
  g.drawImage(canvas, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]! > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = 6, o = document.createElement("canvas");
  o.width = x1 - x0 + 1 + 2 * pad; o.height = y1 - y0 + 1 + 2 * pad;
  o.getContext("2d")!.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, pad, pad, x1 - x0 + 1, y1 - y0 + 1);
  return o.toDataURL("image/png");
}
// Writes the picture through the dev server's thumbnail endpoint as thumbs/title.png.
(window as unknown as { save: () => Promise<string> }).save = async () => {
  const res = await fetch("/__thumb/save", { method: "POST", body: JSON.stringify({ id: "title", key: "title", png: cropped() }) });
  return res.text();
};
(window as unknown as { titleReady: boolean }).titleReady = true;
