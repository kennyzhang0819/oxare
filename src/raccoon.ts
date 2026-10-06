import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { BALL_RADIUS } from "./level.ts";
import { ENV } from "./palette.ts";
import { inkMaterial, toonRamp } from "./scene.ts";
import type { Critter } from "./critter.ts";

// The protagonist as a raccoon, drawn over the physics ball, which it never changes. Rolling, it is
// curled up as it sleeps: a ball of fur with its ringed tail wrapped round it and its masked face
// tucked in on one side, all turning with the ball. Still for SIT_AFTER seconds, it sits up on its
// bottom, upright the least turn away, its tail curled round its feet. Its body and tail are reshaped
// every frame between the two poses and its head carried between them, so every in-between is drawn.
// See docs/levels.md "The raccoon".

export const SIT_AFTER = 1;
const SIT_TIME = 0.6, CURL_TIME = 0.18;
// Below this spin (rad/s) and this rise or fall (units/s) the ball counts as still.
const STILL_SPIN = 0.6, STILL_RISE = 0.5;

const COON = {
  fur: 0x8f8a84, belly: 0xd2cbc0, head: 0x9d978f, mask: 0x4a454c, white: 0xf3efe7,
  ring: 0x34302f, tail: 0x9e978e, paw: 0x4d474a, ear: 0x5b5559, earIn: 0xe9e2d6, dark: 0x1d1a1c,
};
const K = BALL_RADIUS / 0.5;
// Local frame: +y up, +z the way it faces sitting.
// Curled: a ball of fur this big. Sitting: an upright pear, its bottom on the ground.
const CURL_R = 0.4 * K;
const PEAR = { a: 0.33 * K, b: 0.28 * K, c: 0.3 * K, widen: 0.2 };
// Its belly, the paler fur in front.
const BELLY = new THREE.Vector3(0, -0.15, 1).normalize();
// The head: a ball HEAD_R across with a pointed muzzle toward MUZZLE. Curled it is tucked into the
// front of the ball, chin down; sitting it rests on the body, looking a little up.
const HEAD_R = 0.29 * K, MUZZLE = new THREE.Vector3(0, -0.3, 1).normalize();
const HEAD_CURLED = { at: new THREE.Vector3(0, 0.03 * K, 0.22 * K), tilt: 0.38, size: 0.76 };
const HEAD_SAT = { at: new THREE.Vector3(0, 0.3 * K, 0.03 * K), tilt: -0.08, size: 1 };
// The tail: TAIL_N rings along its length, thickest past its middle, closed at the tip.
const TAIL_N = 40, TAIL_SIDES = 10, TAIL_RINGS = 5;

const V = THREE.Vector3;
const smooth = (x: number, a: number, b: number) => THREE.MathUtils.smoothstep(x, a, b);

function material(color: number, vertexColors = false): THREE.Material {
  return ENV.toon
    ? new THREE.MeshToonMaterial({ color, vertexColors, gradientMap: toonRamp() })
    : new THREE.MeshStandardMaterial({ color, vertexColors, roughness: 0.8 });
}
// A seamless unit sphere of directions, indexed so normals come out smooth.
function directions(detail: number): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1, detail);
  base.deleteAttribute("normal"); base.deleteAttribute("uv");
  const g = mergeVertices(base, 1e-5);
  base.dispose();
  return g;
}

// The body's surface point in direction `d` at `e` of the way from curled to sitting.
function bodyAt(d: THREE.Vector3, e: number, breathe: number, out: THREE.Vector3): THREE.Vector3 {
  const low = Math.max(0, -d.y), a = PEAR.a * (1 + PEAR.widen * low), b = PEAR.b * breathe, c = PEAR.c * (1 + PEAR.widen * low);
  const s = 1 / Math.hypot(d.x / a, d.y / b, d.z / c);
  const cx = d.x * CURL_R, cy = d.y * CURL_R, cz = d.z * CURL_R;
  return out.set(cx + (d.x * s - cx) * e, cy + (-0.5 * K + b + d.y * s - cy) * e, cz + (d.z * s - cz) * e);
}
// The tail's thickness `t` of the way to its tip: fluffy past its middle, rounded shut at the tip.
const tailR = (t: number) => 0.112 * K * Math.sin(Math.PI * (0.16 + 0.84 * t)) ** 0.6;
// The tail's centre line `t` along it: curled, round the ball's waist from its back, past its right
// side and under its chin; sitting, out from its bottom and round its feet on the ground, tip up.
function tailAt(t: number, e: number, sway: number, out: THREE.Vector3): THREE.Vector3 {
  const tc = Math.PI - t * 1.45 * Math.PI, phi = -0.6, rc = 0.41 * K;
  const ts = Math.PI - t * 1.25 * Math.PI + sway * t * t, rs = (0.3 + 0.13 * smooth(t, 0, 0.3)) * K;
  const ys = -0.5 * K + tailR(t) + 0.16 * K * (1 - smooth(t, 0, 0.3)) + 0.12 * K * smooth(t, 0.75, 1);
  const cx = Math.sin(tc) * Math.cos(phi) * rc, cy = Math.sin(phi) * rc, cz = Math.cos(tc) * Math.cos(phi) * rc;
  return out.set(cx + (Math.sin(ts) * rs - cx) * e, cy + (ys - cy) * e, cz + (Math.cos(ts) * rs - cz) * e);
}

export function makeRaccoon(): Critter {
  const mesh = new THREE.Group(), ink = ENV.outline > 0 ? inkMaterial() : null;
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T): T => { disposables.push(x); return x; };
  const outline = (m: THREE.Mesh) => { if (!ink) return; const h = new THREE.Mesh(m.geometry, ink); h.userData.outline = true; m.add(h); };
  const lit = (m: THREE.Mesh) => { m.castShadow = true; outline(m); return m; };

  // Body: reshaped every frame (bodyAt); grey fur, paler at the belly.
  const geo = keep(directions(10));
  const dir = Float32Array.from(geo.getAttribute("position").array), count = dir.length / 3;
  {
    const col = new Float32Array(count * 3), fur = new THREE.Color(COON.fur), belly = new THREE.Color(COON.belly), c = new THREE.Color(), d = new V();
    for (let i = 0; i < count; i++) c.lerpColors(fur, belly, smooth(d.fromArray(dir, i * 3).dot(BELLY), 0.55, 0.8)).toArray(col, i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const body = lit(new THREE.Mesh(geo, keep(material(0xffffff, true))));
  body.userData.live = true;
  mesh.add(body);

  // Head: a fixed shape carried between its two places. The bandit mask round the eyes, white brows,
  // cheeks and muzzle are painted on its vertices.
  const head = new THREE.Group();
  mesh.add(head);
  {
    const hg = keep(directions(8)), hp = hg.getAttribute("position") as THREE.BufferAttribute, col = new Float32Array(hp.count * 3);
    const base = new THREE.Color(COON.head), white = new THREE.Color(COON.white), mask = new THREE.Color(COON.mask), c = new THREE.Color(), h = new V();
    for (let i = 0; i < hp.count; i++) {
      h.fromBufferAttribute(hp, i);
      const front = smooth(h.z, 0.15, 0.4);
      const blob = (x: number, y: number, rx: number, ry: number) => Math.max(...[-1, 1].map((s) => smooth(1 - ((h.x - s * x) / rx) ** 2 - ((h.y - y) / ry) ** 2, 0, 0.3))) * front;
      c.copy(base);
      c.lerp(white, blob(0.3, 0.46, 0.24, 0.1));
      c.lerp(white, blob(0.44, -0.08, 0.22, 0.16));
      c.lerp(white, smooth(h.dot(MUZZLE), 0.78, 0.88));
      c.lerp(mask, Math.max(blob(0.36, 0.19, 0.27, 0.16), front * smooth(1 - (h.x / 0.26) ** 2 - ((h.y - 0.17) / 0.07) ** 2, 0, 0.3)));
      c.toArray(col, i * 3);
      const m = 0.1 * K * Math.max(0, h.dot(MUZZLE)) ** 4;
      hp.setXYZ(i, h.x * HEAD_R * 1.1 + MUZZLE.x * m, h.y * HEAD_R * 0.95 + MUZZLE.y * m, h.z * HEAD_R + MUZZLE.z * m);
    }
    hg.setAttribute("color", new THREE.BufferAttribute(col, 3));
    hg.computeVertexNormals();
    head.add(lit(new THREE.Mesh(hg, keep(material(0xffffff, true)))));
  }
  const ball = keep(new THREE.SphereGeometry(1, 20, 14));
  // A little sphere at (x, y, z) in its parent, sized s: in units on the head or body, as a share
  // of the part it sits on otherwise.
  const bit = (parent: THREE.Object3D, color: number, at: [number, number, number], s: [number, number, number], inked = true, mat?: THREE.Material) => {
    const m = new THREE.Mesh(ball, mat ?? keep(material(color))), k = parent === head || parent === mesh ? K : 1;
    m.position.set(...at).multiplyScalar(k);
    m.scale.set(...s).multiplyScalar(k);
    if (inked) lit(m);
    parent.add(m);
    return m;
  };
  const eyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = bit(head, COON.dark, [s * 0.114, 0.058, 0.25], [0.056, 0.062, 0.036], false);
    eye.rotation.y = s * 0.35;
    bit(eye, 0xffffff, [-s * 0.28, 0.36, 0.8], [0.42, 0.42, 0.42], false, keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
    eyes.push(eye);
    const ear = bit(head, COON.ear, [s * 0.18, 0.232, -0.02], [0.09, 0.105, 0.038]);
    ear.rotation.set(-0.15, s * 0.35, -s * 0.45);
    bit(ear, COON.earIn, [0, -0.08, 0.6], [0.62, 0.62, 0.5], false);
  }
  const nose = bit(head, COON.dark, [0, -0.1, 0.385], [0.042, 0.034, 0.034], false);

  // Tail: a tube round its centre line (tailAt), rebuilt every frame, in rings of grey and black.
  const tailGeo = keep(new THREE.BufferGeometry());
  const tp = new Float32Array((TAIL_N + 1) * TAIL_SIDES * 3), tn = new Float32Array(tp.length), tc = new Float32Array(tp.length), tidx: number[] = [];
  {
    const grey = new THREE.Color(COON.tail), ring = new THREE.Color(COON.ring), c = new THREE.Color();
    for (let i = 0; i <= TAIL_N; i++) {
      const t = i / TAIL_N, band = smooth(Math.sin(2 * Math.PI * TAIL_RINGS * t + 1), -0.2, 0.2);
      c.lerpColors(grey, ring, Math.max(band * smooth(t, 0.08, 0.15), smooth(t, 0.86, 0.92)));
      for (let k = 0; k < TAIL_SIDES; k++) c.toArray(tc, (i * TAIL_SIDES + k) * 3);
      if (i < TAIL_N) for (let k = 0; k < TAIL_SIDES; k++) {
        const a = i * TAIL_SIDES + k, b = i * TAIL_SIDES + ((k + 1) % TAIL_SIDES);
        tidx.push(a, b, a + TAIL_SIDES, b, b + TAIL_SIDES, a + TAIL_SIDES);
      }
    }
  }
  tailGeo.setAttribute("position", new THREE.BufferAttribute(tp, 3));
  tailGeo.setAttribute("normal", new THREE.BufferAttribute(tn, 3));
  tailGeo.setAttribute("color", new THREE.BufferAttribute(tc, 3));
  tailGeo.setIndex(tidx);
  const tail = lit(new THREE.Mesh(tailGeo, keep(material(0xffffff, true))));
  tail.userData.live = true;
  tail.frustumCulled = false;
  mesh.add(tail);

  // Paws, dark: hands tucked under its chin curled and resting low at its sides sitting; feet only sitting.
  type Paw = { m: THREE.Mesh; curled: THREE.Vector3; sat: THREE.Vector3; size: THREE.Vector3; from: number };
  const paws: Paw[] = [];
  for (const s of [-1, 1]) {
    const hand = bit(mesh, COON.paw, [0, 0, 0], [1, 1, 1]);
    paws.push({ m: hand, curled: new V(s * 0.13, -0.12, 0.37).multiplyScalar(K), sat: new V(s * 0.22, -0.36, 0.15).multiplyScalar(K), size: new V(0.045, 0.04, 0.05).multiplyScalar(K), from: 0 });
    const foot = bit(mesh, COON.paw, [0, 0, 0], [1, 1, 1]);
    paws.push({ m: foot, curled: new V(s * 0.12, -0.3, 0.2).multiplyScalar(K), sat: new V(s * 0.14, -0.47, 0.2).multiplyScalar(K), size: new V(0.07, 0.042, 0.095).multiplyScalar(K), from: 0.5 });
  }

  // What changes: `u` from curled (0) to sitting (1), eased into `e`; how long it has been still; its
  // rolling turn, integrated from the ball's own; the upright pose it sits in; and its clock.
  let u = 1, still = SIT_AFTER, clock = 0, started = false;
  const roll = new THREE.Quaternion(), last = new THREE.Quaternion(), now = new THREE.Quaternion(), step = new THREE.Quaternion(), sit = new THREE.Quaternion();
  const Y = new V(0, 1, 0), X = new V(1, 0, 0), p = new V(), d = new V(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const C = Array.from({ length: TAIL_N + 1 }, () => new V()), T = new V(), b1 = new V(), b2 = new V(), w = new V();

  const draw = (e: number) => {
    const idle = smooth(e, 0.85, 1), breathe = 1 + 0.02 * idle * Math.sin(clock * 2.4);
    for (let i = 0; i < count; i++) bodyAt(d.fromArray(dir, i * 3), e, breathe, p).toArray(pos.array, i * 3);
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    // The head between its curled and sitting places, nodding a touch as it breathes.
    head.position.lerpVectors(HEAD_CURLED.at, HEAD_SAT.at, e);
    head.position.y += 0.008 * K * idle * Math.sin(clock * 2.4 - 0.6);
    head.quaternion.slerpQuaternions(q0.setFromAxisAngle(X, HEAD_CURLED.tilt), q1.setFromAxisAngle(X, HEAD_SAT.tilt), e);
    head.scale.setScalar(HEAD_CURLED.size + (HEAD_SAT.size - HEAD_CURLED.size) * e);
    // A blink every few seconds, and a sniff, while it sits.
    const blink = idle * (1 - smooth(Math.abs(((clock + 0.9) % 3.8) - 0.08), 0, 0.08));
    for (const eye of eyes) eye.scale.y = 0.062 * K * (1 - 0.9 * blink);
    nose.position.y = (-0.1 + 0.004 * idle * Math.sin(clock * 10) * Math.max(0, Math.sin(clock * 0.8))) * K;

    // The tail's rings round its centre line, each square to it, turned out from the body.
    const sway = 0.25 * idle * Math.sin(clock * 1.3);
    for (let i = 0; i <= TAIL_N; i++) tailAt(i / TAIL_N, e, sway, C[i]!);
    for (let i = 0; i <= TAIL_N; i++) {
      const t = i / TAIL_N, r = tailR(t), c = C[i]!;
      T.subVectors(C[Math.min(TAIL_N, i + 1)]!, C[Math.max(0, i - 1)]!).normalize();
      w.copy(c).setY(c.y * (1 - e) + (c.y + 0.5 * K) * e);
      b1.copy(w).addScaledVector(T, -w.dot(T));
      if (b1.lengthSq() < 1e-8) b1.set(0, 1, 0).addScaledVector(T, -T.y);
      b1.normalize();
      b2.crossVectors(T, b1);
      for (let k = 0; k < TAIL_SIDES; k++) {
        const a = (k / TAIL_SIDES) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), o = (i * TAIL_SIDES + k) * 3;
        const nx = b1.x * ca + b2.x * sa, ny = b1.y * ca + b2.y * sa, nz = b1.z * ca + b2.z * sa;
        tn[o] = nx; tn[o + 1] = ny; tn[o + 2] = nz;
        tp[o] = c.x + nx * r; tp[o + 1] = c.y + ny * r; tp[o + 2] = c.z + nz * r;
      }
    }
    tailGeo.attributes.position!.needsUpdate = tailGeo.attributes.normal!.needsUpdate = true;

    for (const pw of paws) {
      const vis = pw.from > 0 ? smooth(e, pw.from, pw.from + 0.4) : 1;
      pw.m.visible = vis > 0.01;
      pw.m.position.lerpVectors(pw.curled, pw.sat, e);
      pw.m.scale.copy(pw.size).multiplyScalar(vis);
    }
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
      u = still >= SIT_AFTER ? Math.min(1, u + dt / SIT_TIME) : Math.max(0, u - dt / CURL_TIME);
      const e = smooth(u, 0, 1);
      // Curled, the pose it would sit up in is its own turned the least way that stands it upright;
      // once it starts to sit up that is kept.
      if (u <= 0) sit.setFromUnitVectors(d.copy(Y).applyQuaternion(roll), Y).multiply(roll);
      if (u >= 1) roll.copy(sit);
      mesh.quaternion.copy(roll).slerp(sit, e);
      draw(e);
    },
    dispose() { for (const x of disposables) x.dispose(); },
  };
}
