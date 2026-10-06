import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { BALL_RADIUS } from "./level.ts";
import { ENV } from "./palette.ts";
import { inkMaterial, outlineMaterial, toonRamp } from "./scene.ts";

// The protagonist: a hedgehog drawn over the physics ball, which it never changes. Rolling, it is a
// curled ball of quills with its face on one side, turning with the ball; still for SIT_AFTER seconds,
// it uncurls and sits upright, facing wherever it ended up. It is one body mesh reshaped every frame between the two poses (`shape`), quills
// and face riding its surface, so every in-between is drawn. See docs/levels.md "The hedgehog".

// Seconds still before it sits up; how long sitting up and curling take.
export const SIT_AFTER = 1;
const SIT_TIME = 0.55, CURL_TIME = 0.16;
// Below this spin (rad/s) and this rise or fall (units/s) the ball counts as still.
const STILL_SPIN = 0.6, STILL_RISE = 0.5;

const HOG = { quill: 0x5a3a28, tip: 0xe6cfa8, skin: 0x7c5640, face: 0xf4dfbd, paw: 0xd9ae84, ear: 0xe8c09a, dark: 0x22181a, blush: 0xf29a9e };
const K = BALL_RADIUS / 0.5;
// Curled: the body is a ball this big under quills reaching to about the ball's radius, its bare face
// raised FACE_BUMP to their tips and its snout tucked in, so it is round from every side.
const CURL_R = 0.37 * K, FACE_BUMP = 0.09 * K;
// Sitting: an upright egg its bottom on the ground, wider low down; its snout pushed out round FACE.
const EGG = { a: 0.4 * K, b: 0.44 * K, c: 0.38 * K, widen: 0.14 };
const SNOUT = { len: 0.27 * K, sharp: 18 };
// Local frame: +y up, +z the way it faces when sitting. The quills cover a cap CURLED degrees round
// the back of its face curled (leaving its face bare) and SAT degrees round QUILLS sitting (leaving
// its face and belly bare).
const FACE = new THREE.Vector3(0, 0.42, 0.91).normalize(), SNOUT_DIR = new THREE.Vector3(0, -0.12, 1).normalize();
const QUILLS = new THREE.Vector3(0, 0.35, -0.94).normalize(), CURLED = 134, SAT = 104, CURL_AXIS = FACE.clone().negate();
// The quills lie back toward this, a little curled and flatter sitting.
const TAIL = new THREE.Vector3(0, -0.35, -1).normalize();

const V = THREE.Vector3;
const smooth = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);
const angleTo = (d: THREE.Vector3, axis: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, d.dot(axis)))));

// The body's surface point in direction `d` (unit) at `e` of the way from curled to sitting.
function shape(d: THREE.Vector3, e: number, breathe: number, out: THREE.Vector3): THREE.Vector3 {
  const low = Math.max(0, -d.y), a = EGG.a * (1 + EGG.widen * low), b = EGG.b * breathe, c = EGG.c * (1 + EGG.widen * low);
  const s = 1 / Math.hypot(d.x / a, d.y / b, d.z / c), toFace = d.dot(FACE);
  const snout = SNOUT.len * Math.max(0, toFace) ** SNOUT.sharp * e;
  const r = CURL_R + FACE_BUMP * smooth(toFace, 0.45, 0.62);
  const cx = d.x * r, cy = d.y * r, cz = d.z * r, sx = d.x * s, sy = -0.5 * K + b + d.y * s, sz = d.z * s;
  return out.set(cx + (sx - cx) * e + SNOUT_DIR.x * snout, cy + (sy - cy) * e + SNOUT_DIR.y * snout, cz + (sz - cz) * e + SNOUT_DIR.z * snout);
}
// The surface point and its outward normal in direction `d`.
const T1 = new V(), T2 = new V(), P1 = new V(), P2 = new V();
function surface(d: THREE.Vector3, e: number, breathe: number, p: THREE.Vector3, n: THREE.Vector3): void {
  shape(d, e, breathe, p);
  T1.set(0, 1, 0).cross(d);
  if (T1.lengthSq() < 1e-6) T1.set(1, 0, 0).cross(d);
  T1.normalize();
  T2.copy(d).cross(T1);
  shape(P1.copy(d).addScaledVector(T1, 0.01).normalize(), e, breathe, P1);
  shape(P2.copy(d).addScaledVector(T2, 0.01).normalize(), e, breathe, P2);
  n.copy(P1.sub(p)).cross(P2.sub(p)).normalize();
  if (n.dot(d) < 0) n.negate();
}

function material(color: number, vertexColors = false): THREE.Material {
  return ENV.toon
    ? new THREE.MeshToonMaterial({ color, vertexColors, gradientMap: toonRamp() })
    : new THREE.MeshStandardMaterial({ color, vertexColors, roughness: 0.7 });
}

export interface HogState {
  // The ball's rotation, how fast it spins and rises, whether the player is pushing, and the eye.
  rot: { x: number; y: number; z: number; w: number };
  spin: number;
  rise: number;
  push: boolean;
  eye: THREE.Vector3;
}
export interface Hedgehog { mesh: THREE.Group; update(dt: number, s: HogState): void; dispose(): void }

export function makeHedgehog(): Hedgehog {
  const mesh = new THREE.Group(), ink = ENV.outline > 0 ? inkMaterial() : null;
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };
  const outline = (m: THREE.Mesh) => { if (!ink) return; const h = new THREE.Mesh(m.geometry, ink); h.userData.outline = true; m.add(h); };

  // The body: a seamless sphere of directions, placed by `shape` each frame and coloured quill skin
  // inside the quills' cap, face and belly outside it.
  const base = new THREE.IcosahedronGeometry(1, 12);
  base.deleteAttribute("normal"); base.deleteAttribute("uv");
  const geo = keep(mergeVertices(base, 1e-5));
  base.dispose();
  const dir = Float32Array.from(geo.getAttribute("position").array), count = dir.length / 3;
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const body = new THREE.Mesh(geo, keep(material(0xffffff, true)));
  body.castShadow = true;
  body.userData.live = true;
  outline(body);
  mesh.add(body);

  // Quills: short soft spikes with rounded tips, dark with pale ends, over the cap; swept back from the
  // face curled, lying flatter sitting. Each has its own length and lean so the coat looks grown.
  const QL = 0.15 * K;
  const quillGeo = keep(new THREE.LatheGeometry([[0.074, 0], [0.072, 0.03], [0.06, 0.07], [0.042, 0.104], [0.024, 0.13], [0.01, 0.146], [0, 0.15]].map(([x, y]) => new THREE.Vector2(x! * K, y! * K)), 8));
  {
    const qp = quillGeo.getAttribute("position"), qc = new Float32Array(qp.count * 3), a = new THREE.Color(HOG.quill), b = new THREE.Color(HOG.tip), c = new THREE.Color();
    for (let i = 0; i < qp.count; i++) { c.lerpColors(a, b, smooth(qp.getY(i) / QL, 0.7, 1)).toArray(qc, i * 3); }
    quillGeo.setAttribute("color", new THREE.BufferAttribute(qc, 3));
  }
  type Quill = { d: THREE.Vector3; len: number; lean: THREE.Vector3 };
  const quills: Quill[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const N = 220;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
    const d = new V(Math.cos(t) * r, y, Math.sin(t) * r);
    if (angleTo(d, CURL_AXIS) < CURLED - 4 || angleTo(d, QUILLS) < SAT - 4) quills.push({ d, len: 0.85 + rnd() * 0.3, lean: new V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.25) });
  }
  const coat = new THREE.InstancedMesh(quillGeo, keep(material(0xffffff, true)), quills.length);
  coat.castShadow = true;
  coat.frustumCulled = false;
  mesh.add(coat);
  if (ink) {
    // Quills take a finer line than the body, or the coat reads as ink.
    const hull = new THREE.InstancedMesh(quillGeo, keep(outlineMaterial(ENV.outline * 0.35, ENV.outlineColor)), quills.length);
    hull.instanceMatrix = coat.instanceMatrix;
    hull.frustumCulled = false;
    hull.userData.outline = true;
    mesh.add(hull);
  }

  // The face and paws: each a little mesh placed on the surface in its direction (`d`, pushed `out`
  // along the normal), or, the feet, at a spot on the ground. The face shows curled too; the paws grow
  // in as it uncurls.
  const ball = keep(new THREE.SphereGeometry(1, 20, 14));
  type Part = { m: THREE.Mesh; d?: THREE.Vector3; at?: THREE.Vector3; out: number; size: THREE.Vector3; from: number; eye?: boolean };
  const parts: Part[] = [];
  const part = (color: number, size: [number, number, number], where: { d?: [number, number, number]; at?: [number, number, number] }, out: number, from: number, ink = true, eye = false) => {
    const m = new THREE.Mesh(ball, keep(material(color)));
    m.castShadow = true;
    if (ink) outline(m);
    mesh.add(m);
    parts.push({ m, d: where.d && new V(...where.d).normalize(), at: where.at && new V(...where.at).multiplyScalar(K), out: out * K, size: new V(...size).multiplyScalar(K), from, eye });
    return m;
  };
  for (const s of [-1, 1]) {
    const eye = part(HOG.dark, [0.062, 0.07, 0.04], { d: [s * 0.34, 0.62, 0.71] }, 0.004, 0, false, true);
    const shine = new THREE.Mesh(ball, keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    shine.scale.setScalar(0.32);
    shine.position.set(-s * 0.3, 0.38, 0.75);
    eye.add(shine);
    part(HOG.blush, [0.055, 0.032, 0.012], { d: [s * 0.5, 0.38, 0.78] }, 0.004, 0, false);
    part(HOG.ear, [0.07, 0.075, 0.035], { d: [s * 0.5, 0.72, 0.45] }, 0.03, 0);
    part(HOG.paw, [0.06, 0.055, 0.05], { d: [s * 0.45, -0.18, 0.87] }, 0.025, 0.4);
    part(HOG.paw, [0.075, 0.045, 0.105], { at: [s * 0.17, -0.47, 0.22] }, 0, 0.55);
  }
  const nose = part(HOG.dark, [0.055, 0.048, 0.045], { d: [0, 0.42, 0.91] }, 0.012, 0, false);

  // What changes: `u` from curled (0) to sitting (1), eased into `e`; how long it has been still; its
  // rolling turn, integrated from the ball's own; the upright pose it sits in; and its clock.
  let u = 1, still = SIT_AFTER, clock = 0;
  const roll = new THREE.Quaternion(), last = new THREE.Quaternion(), now = new THREE.Quaternion(), step = new THREE.Quaternion(), sit = new THREE.Quaternion();
  let started = false;
  const Y = new V(0, 1, 0), Z = new V(0, 0, 1), p = new V(), n = new V(), d = new V(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), sc = new V(), lie = new V(), axis = new V();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, col = geo.getAttribute("color") as THREE.BufferAttribute;
  const skin = new THREE.Color(HOG.skin), face = new THREE.Color(HOG.face), c = new THREE.Color();

  const draw = (e: number) => {
    // The quills' cap swings from round the back of the face to round the back as it opens.
    const alpha = CURLED + (SAT - CURLED) * e, idle = smooth(e, 0.85, 1);
    axis.copy(CURL_AXIS).lerp(QUILLS, e).normalize();
    const breathe = 1 + 0.018 * idle * Math.sin(clock * 2.6);
    for (let i = 0; i < count; i++) {
      d.fromArray(dir, i * 3);
      shape(d, e, breathe, p).toArray(pos.array, i * 3);
      c.lerpColors(skin, face, smooth(angleTo(d, axis), alpha - 3, alpha + 3)).toArray(col.array, i * 3);
    }
    pos.needsUpdate = col.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    quills.forEach((k, i) => {
      const vis = 1 - smooth(angleTo(k.d, axis), alpha - 12, alpha - 3);
      if (vis < 0.01) { coat.setMatrixAt(i, m4.makeScale(0, 0, 0)); return; }
      surface(k.d, e, breathe, p, n);
      lie.copy(TAIL).addScaledVector(n, -TAIL.dot(n)).normalize();
      d.copy(n).addScaledVector(lie, 0.45 + 0.75 * e).add(k.lean).normalize();
      q.setFromUnitVectors(Y, d);
      p.addScaledVector(n, -0.03 * K);
      const len = k.len * (1 - 0.15 * e) * vis;
      coat.setMatrixAt(i, m4.compose(p, q, sc.set(vis, len, vis)));
    });
    coat.instanceMatrix.needsUpdate = true;
    // A blink every few seconds and a sniff, while it sits.
    const blink = idle * (1 - smooth(Math.abs(((clock + 0.6) % 3.4) - 0.08), 0, 0.08));
    for (const t of parts) {
      const vis = t.from > 0 ? smooth(e, t.from, Math.min(1, t.from + 0.4)) : 1;
      t.m.visible = vis > 0.01;
      if (!t.m.visible) continue;
      if (t.d) {
        surface(t.d, e, breathe, p, n);
        t.m.position.copy(p).addScaledVector(n, t.out);
        t.m.quaternion.setFromUnitVectors(Z, n);
      } else {
        t.m.position.copy(t.at!);
        t.m.quaternion.identity();
      }
      t.m.scale.copy(t.size).multiplyScalar(vis);
      if (t.eye) t.m.scale.y *= 1 - 0.9 * blink;
    }
    nose.position.addScaledVector(SNOUT_DIR, 0.006 * K * idle * Math.sin(clock * 9) * Math.max(0, Math.sin(clock * 0.9)));
  };

  return {
    mesh,
    update(dt, s) {
      clock += dt;
      now.set(s.rot.x, s.rot.y, s.rot.z, s.rot.w);
      // It starts the level sitting, facing the camera.
      if (!started) { started = true; last.copy(now); sit.setFromAxisAngle(Y, Math.atan2(s.eye.x - mesh.position.x, s.eye.z - mesh.position.z)); roll.copy(sit); }
      // The rolling turn follows the ball's own, step by step, so a curl starts from wherever it sat.
      step.copy(now).multiply(last.invert());
      roll.premultiply(step).normalize();
      last.copy(now);
      still = s.spin < STILL_SPIN && Math.abs(s.rise) < STILL_RISE && !s.push ? still + dt : 0;
      const sitting = still >= SIT_AFTER;
      u = sitting ? Math.min(1, u + dt / SIT_TIME) : Math.max(0, u - dt / CURL_TIME);
      const e = smooth(u, 0, 1);
      // Curled, the pose it would sit up in is its own turned the least way that stands it upright;
      // once it starts to sit up that is kept.
      if (u <= 0) sit.setFromUnitVectors(d.copy(Y).applyQuaternion(roll), Y).multiply(roll);
      if (u >= 1) roll.copy(sit);
      mesh.quaternion.copy(roll).slerp(sit, e);
      draw(e);
    },
    dispose() { for (const x of disposables) x.dispose(); coat.dispose(); },
  };
}
