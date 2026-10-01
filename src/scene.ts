import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BALL_RADIUS, BARRIER_D, BARRIER_H, BARRIER_W, BRIDGE_PLANK_T, PLANK_HINGE_H, PLANK_T, SEESAW_PIVOT_H, SEESAW_POST_D, SEESAW_POST_W, SEESAW_T, SUPPORT_BEND_R, SUPPORT_D, SUPPORT_GAP, SUPPORT_W, START_PAD_H, START_PAD_R, BLOCKADE_D, BLOCKADE_H, BLOCKADE_W, GOAL_BEAM_H, PILLAR_H, PILLAR_R, PLATFORM_EDGE_DROP, PLATFORM_EDGE_INSET, PLATFORM_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, TUBE_R, TUBE_WALL, tubeRings, type Tube, bridgeChain, holesOn, pieceBoxes, kickerCorners, pieceRot, plankPose, rampHeight, seesawTilt, supportPillars, rotXZ, type Bridge, type Level, type Piece, type XZ } from "./level.ts";
import { TILE, ballTextures, edgeTextures, structTextures, tileTexture } from "./textures.ts";
import { buildRails } from "./rails.ts";
import { platformGeometry } from "./platform.ts";
import { sweepTube, type SweepRing } from "./geometry.ts";

export const EDGE_RADIUS = 0.3;
const HOLE_LIP = 0.35;

export const SKY_TOP = 0x448fec;
export const SKY_HORIZON = 0xafcde9;
export const SUN_OFFSET = new THREE.Vector3(8, 14, 6);
export const SUN_DIR = SUN_OFFSET.clone().normalize();
export const OCEAN_Y = -45;
export const CLOUD_Y = 40, CLOUD_TOP = 75;

let MAT: Record<"platform" | "block" | "edge" | "rim" | "border", THREE.MeshStandardMaterial> | null = null;
const LIP = { inset: PLATFORM_EDGE_INSET, drop: PLATFORM_EDGE_DROP, border: 0.04 };
let STRUCT: Record<"body" | "top" | "panel" | "pillar" | "glow" | "crate" | "disc" | "padTop" | "padCentre" | "padSkirt" | "barrierPanel" | "grille" | "plank" | "plankGlow" | "hinge", THREE.MeshStandardMaterial> | null = null;
let ENV: THREE.Texture | null = null;

export function initMaterials(renderer: THREE.WebGLRenderer): void {
  if (MAT) return;
  const tiles = tileTexture(renderer.capabilities.getMaxAnisotropy());
  const edge = edgeTextures();
  MAT = {
    platform: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 }),
    block: new THREE.MeshStandardMaterial({ map: tiles, color: 0x8a97a6, roughness: 0.8 }),
    edge: new THREE.MeshStandardMaterial({ map: edge.map, emissiveMap: edge.glow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xf1f4f7, roughness: 0.35, metalness: 0.05 }),
    border: new THREE.MeshStandardMaterial({ color: 0x8c96a1, roughness: 0.7 }),
  };
  const st = structTextures();
  STRUCT = {
    body: new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.45, metalness: 0.05 }),
    top: new THREE.MeshStandardMaterial({ color: 0x7c8690, roughness: 0.7 }),
    panel: new THREE.MeshStandardMaterial({ map: st.panel, emissiveMap: st.panelGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
    pillar: new THREE.MeshStandardMaterial({ map: st.pillar, roughness: 0.5, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x2fe6ff, emissive: 0x2fe6ff, emissiveIntensity: 0.9, roughness: 0.4 }),
    crate: new THREE.MeshStandardMaterial({ map: st.crate, emissiveMap: st.crateGlow, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.6 }),
    disc: new THREE.MeshStandardMaterial({ map: st.goalDisc, color: 0xffffff, roughness: 0.7 }),
    padTop: new THREE.MeshStandardMaterial({ map: st.padTop, emissiveMap: st.padGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
    padCentre: new THREE.MeshStandardMaterial({ map: st.padCentre, roughness: 0.6 }),
    padSkirt: new THREE.MeshStandardMaterial({ map: st.padSkirt, roughness: 0.7 }),
    barrierPanel: new THREE.MeshStandardMaterial({ map: st.barrierPanel, emissiveMap: st.barrierGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.55 }),
    grille: new THREE.MeshStandardMaterial({ map: st.grille, roughness: 0.7 }),
    plank: new THREE.MeshStandardMaterial({ map: tiles, color: 0xbac3cb, roughness: 0.85 }),
    plankGlow: new THREE.MeshStandardMaterial({ color: 0x3fe87a, emissive: 0x3fe87a, emissiveIntensity: 0.8, roughness: 0.4 }),
    hinge: new THREE.MeshStandardMaterial({ color: 0x4a535d, roughness: 0.5, metalness: 0.3 }),
  };
  const pmrem = new THREE.PMREMGenerator(renderer);
  ENV = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
}

function buildBlockade(g: THREE.Group) {
  const st = STRUCT!;
  const W = BLOCKADE_W, H = BLOCKADE_H, D = BLOCKADE_D;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.18), st.body);
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, 0.05, D - 0.7), st.top);
  top.position.y = H + 0.01;
  g.add(body, top);
  const sides: [x: number, z: number, yaw: number, len: number][] = [
    [0, D / 2, 0, W], [0, -D / 2, Math.PI, W], [W / 2, 0, Math.PI / 2, D], [-W / 2, 0, -Math.PI / 2, D],
  ];
  for (const [x, z, yaw, len] of sides) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.3, H - 0.4), st.panel);
    m.position.set(x + Math.sin(yaw) * 0.012, H / 2, z + Math.cos(yaw) * 0.012);
    m.rotation.y = yaw;
    g.add(m);
  }
}

// Four inward-facing walls carrying the edge strip, under a raised lip that straddles the rim.
function buildHole(g: THREE.Group, w: number, d: number) {
  const mat = MAT!, st = STRUCT!;
  const sides: [x: number, z: number, yaw: number, len: number][] = [
    [0, d / 2, Math.PI, w], [0, -d / 2, 0, w], [w / 2, 0, -Math.PI / 2, d], [-w / 2, 0, Math.PI / 2, d],
  ];
  for (const [x, z, yaw, len] of sides) {
    const geo = new THREE.PlaneGeometry(len, PLATFORM_THICKNESS);
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * len) / TILE);
    const wall = new THREE.Mesh(geo, mat.edge);
    wall.position.set(x, -PLATFORM_THICKNESS / 2, z);
    wall.rotation.y = yaw;
    g.add(wall);
    const lip = new THREE.Mesh(new RoundedBoxGeometry(len + HOLE_LIP, 0.12, HOLE_LIP, 2, 0.05), st.body);
    lip.position.set(x, 0.06, z);
    lip.rotation.y = yaw;
    lip.castShadow = true;
    g.add(lip);
  }
}

// Slatted column with a domed cap and a glowing base ring.
// Barrier: a rounded white pod on two legs with a cyan band along its bottom, a recessed
// instrument panel on each long face and a louvred grille on each end. The pod fills the
// collider exactly. Every detail is a box standing proud of the body, never a plane lying on it.
function buildBarrier(g: THREE.Group) {
  const st = STRUCT!;
  const LEG = 0.16, W = BARRIER_W, D = BARRIER_D, H = BARRIER_H - LEG - 0.02, y0 = LEG;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.2), st.body);
  body.position.y = y0 + H / 2;
  body.castShadow = body.receiveShadow = true;
  const band = new THREE.Mesh(new RoundedBoxGeometry(W - 0.2, 0.1, D + 0.05, 2, 0.04), st.glow);
  band.position.y = y0 + 0.12;
  g.add(body, band);
  // The panel sits in the upper half of the pod, leaving a plain white band above the glow strip.
  const panelGeo = new THREE.BoxGeometry(W * 0.6, H * 0.4, 0.08);
  for (const z of [D / 2 - 0.01, -(D / 2 - 0.01)]) {
    const m = new THREE.Mesh(panelGeo, [st.top, st.top, st.top, st.top, st.barrierPanel, st.barrierPanel]);
    m.position.set(0, y0 + H * 0.64, z);
    g.add(m);
  }
  const grilleGeo = new THREE.BoxGeometry(0.08, H * 0.4, D * 0.55);
  for (const x of [W / 2, -W / 2]) {
    const m = new THREE.Mesh(grilleGeo, st.grille);
    m.position.set(x, y0 + H * 0.64, 0);
    g.add(m);
  }
  const legGeo = new THREE.CylinderGeometry(0.12, 0.12, LEG + 0.1, 16);
  for (const x of [W / 2 - 0.85, -(W / 2 - 0.85)]) {
    const leg = new THREE.Mesh(legGeo, st.body);
    leg.position.set(x, (LEG + 0.1) / 2, 0);
    leg.castShadow = true;
    g.add(leg);
  }
}

// Start pad: a low chamfered disc with a ribbed skirt, lit ring, and a raised centre of rings.
function buildStartPad(g: THREE.Group) {
  const st = STRUCT!;
  const R = START_PAD_R, H = START_PAD_H;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.08, R, H, 48), [st.padSkirt, st.padTop, st.top]);
  base.position.y = H / 2;
  base.castShadow = base.receiveShadow = true;
  const centre = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.56, R * 0.58, 0.05, 48), [st.top, st.padCentre, st.top]);
  centre.position.y = H + 0.025;
  centre.receiveShadow = true;
  g.add(base, centre);
}

// Hanging bridge: each plank is a tiled slat with a green light strip round its rim and a hinge
// barrel across its near end, so a barrel sits in every gap; the far anchor carries the last one.
// Plank groups are returned in chain order for the physics to pose each frame; a fixed mount
// bracket at each end stays with the piece.
function buildBridge(g: THREE.Group, p: Bridge): THREE.Group[] {
  const st = STRUCT!;
  const chain = bridgeChain(p);
  const T = BRIDGE_PLANK_T, W = p.w, STRIP = 0.12, LIP = 0.03;
  const barrel = () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, W - 0.5, 10), st.hinge);
    m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    return m;
  };
  const frameGeo = rimFrame(W + 0.04, chain.planks[0]!.len + 0.04, STRIP + 0.02, LIP);
  frameGeo.rotateX(-Math.PI / 2);
  const out: THREE.Group[] = [];
  for (const pl of chain.planks) {
    const pg = new THREE.Group();
    pg.position.set(0, pl.y, pl.z);
    pg.rotation.x = (pl.tilt * Math.PI) / 180;
    const body = new THREE.Mesh(roundedBox(W, T, pl.len, 0.04), st.plank);
    body.castShadow = body.receiveShadow = true;
    const rim = new THREE.Mesh(frameGeo, st.plankGlow);
    rim.position.y = T / 2;
    const b = barrel();
    b.position.z = chain.seg / 2;
    pg.add(body, rim, b);
    g.add(pg);
    out.push(pg);
  }
  const ends = [chain.hinges[0]!, chain.hinges[chain.hinges.length - 1]!];
  ends.forEach((h, i) => {
    if (i === 1) { const b = barrel(); b.position.set(0, h.y, h.z); g.add(b); }
    // Two mount lugs reaching back into the platform wall, one near each side of the hinge.
    const dir = i === 0 ? 1 : -1;
    for (const x of [W / 2 - 0.45, -(W / 2 - 0.45)]) {
      const lug = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.26, 0.4, 2, 0.04), st.hinge);
      lug.position.set(x, h.y, h.z + dir * 0.12);
      lug.castShadow = true;
      g.add(lug);
    }
  });
  return out;
}

// Rectangular light strip `strip` wide, lying in the XY plane and standing `lip` proud of it.
function rimFrame(w: number, h: number, strip: number, lip: number): THREE.BufferGeometry {
  const frame = new THREE.Shape();
  frame.moveTo(-w / 2, -h / 2); frame.lineTo(w / 2, -h / 2); frame.lineTo(w / 2, h / 2); frame.lineTo(-w / 2, h / 2);
  const hole = new THREE.Path();
  hole.moveTo(-w / 2 + strip, -h / 2 + strip); hole.lineTo(-w / 2 + strip, h / 2 - strip); hole.lineTo(w / 2 - strip, h / 2 - strip); hole.lineTo(w / 2 - strip, -h / 2 + strip);
  frame.holes.push(hole);
  return new THREE.ExtrudeGeometry(frame, { depth: lip, bevelEnabled: false });
}

// Knock-down plank: a tall tiled panel with a green rim on both faces, on a hinge barrel
// through its base that rests in a lit yoke at each side. The panel group is centred on the
// physics body, like a crate, and is returned for the physics to pose; the yokes stay put.
// One support pillar's body in the column's local frame (centred on the stem, x across it): the
// stem from the upper platform's underside `top` straight down, a quarter bend toward local -z,
// and a short foot running into the lower platform's side wall at mid-thickness. Extruded across
// x with a soft bevel so every edge catches light.
function supportBody(top: number): THREE.BufferGeometry {
  const W = SUPPORT_W, D = SUPPORT_D, ri = SUPPORT_BEND_R, ro = ri + D, b = 0.07, T = PLATFORM_THICKNESS;
  const yl1 = -T / 2 + D / 2, yl0 = -T / 2 - D / 2, zc = -D / 2 - ri, yc = yl1 + ri;
  const wall = -(SUPPORT_GAP + D / 2) - 0.05; // a hair inside the wall, so no seam shows
  // Shape coords: u is local z, v is y. Inset by the bevel so the finished piece is W x D.
  const s = new THREE.Shape();
  s.moveTo(D / 2 - b, top - b);
  s.lineTo(-D / 2 + b, top - b);
  s.lineTo(-D / 2 + b, yc);
  s.absarc(zc, yc, ri + b, 0, -Math.PI / 2, true);
  s.lineTo(wall, yl1 - b);
  s.lineTo(wall, yl0 + b);
  s.lineTo(zc, yl0 + b);
  s.absarc(zc, yc, ro - b, -Math.PI / 2, 0, false);
  s.lineTo(D / 2 - b, top - b);
  const geo = new THREE.ExtrudeGeometry(s, { depth: W - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 16 });
  geo.translate(0, 0, -(W - 2 * b) / 2);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

// Support pillars: a white column per pillar, its outer face carrying a dark recessed slot with
// two pale bars and a cyan light line down each side, facing inward, dark bands every few layers, ear lugs on
// the sides, a foot that bends into the lower platform's wall on a lit flange, and a flared head
// under the upper one. Drawn only; the collider is the stem's box
// from pieceBoxes.
function buildSupport(g: THREE.Group, p: Piece & { type: "support" }) {
  const st = STRUCT!, W = SUPPORT_W, D = SUPPORT_D;
  for (const c of supportPillars(p)) {
    const col = new THREE.Group();
    col.position.set(c.x, 0, c.z);
    const body = new THREE.Mesh(supportBody(c.y1), st.body);
    body.castShadow = body.receiveShadow = true;
    col.add(body);
    // The slot faces inward, toward the platforms, between the bend and the head.
    const s0 = 0.5, s1 = c.y1 - 0.7, sh = s1 - s0, sy = (s0 + s1) / 2, fz = -D / 2;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(W * 0.46, sh, 0.06), st.hinge);
    slot.position.set(0, sy, fz);
    col.add(slot);
    for (const x of [-0.08, 0.08]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, sh - 0.2, 0.08), st.top);
      bar.position.set(x, sy, fz - 0.01);
      col.add(bar);
    }
    for (const x of [-W * 0.33, W * 0.33]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, sh, 0.05), st.glow);
      line.position.set(x, sy, fz);
      col.add(line);
    }
    for (let y = s0 + 2.4; y < s1 - 0.8; y += 2.4) {
      const band = new THREE.Mesh(new RoundedBoxGeometry(W + 0.04, 0.16, D + 0.04, 2, 0.05), st.hinge);
      band.position.y = y;
      col.add(band);
      for (const x of [W / 2 + 0.06, -(W / 2 + 0.06)]) {
        const ear = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.7, D * 0.55, 2, 0.04), st.body);
        ear.position.set(x, y + 0.5, 0);
        ear.castShadow = true;
        col.add(ear);
      }
    }
    // A dark band where the bend begins, and a dark flange with a cyan rim where the foot meets
    // the lower platform's wall.
    const T = PLATFORM_THICKNESS, wallZ = -(SUPPORT_GAP + D / 2);
    const band = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, 0.16, D + 0.06, 2, 0.05), st.hinge);
    band.position.y = -T / 2 + D / 2 + SUPPORT_BEND_R + 0.1;
    const flange = new THREE.Mesh(new RoundedBoxGeometry(W + 0.24, D + 0.24, 0.08, 2, 0.03), st.hinge);
    flange.position.set(0, -T / 2, wallZ + 0.04);
    const rim = new THREE.Mesh(rimFrame(W + 0.24, D + 0.24, 0.04, 0.02), st.glow);
    rim.position.set(0, -T / 2, wallZ + 0.08);
    const head = new THREE.Mesh(new RoundedBoxGeometry(W + 0.2, 0.3, D + 0.16, 3, 0.08), st.body);
    head.position.y = c.y1 - 0.15;
    head.castShadow = true;
    const headBand = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, 0.06, D + 0.18), st.hinge);
    headBand.position.y = c.y1 - 0.42;
    col.add(band, flange, rim, head, headBand);
    g.add(col);
  }
}

const KICKER_ORANGE = new THREE.MeshStandardMaterial({ color: 0xff7a2e, emissive: 0xff6a1a, emissiveIntensity: 0.6, roughness: 0.45 });

// Kicker: a white wedge with a dark tread inset on its slope, pale slats across the tread and an
// orange light strip along each side of it.
function buildKicker(g: THREE.Group, p: Piece & { type: "kicker" }) {
  const st = STRUCT!;
  const k = kickerCorners(p);
  // Corner indices: 0-1 low front edge, 2-3 back bottom, 4-5 back top; every face wound outward.
  const tris = [0, 1, 4, 0, 4, 5, 3, 5, 4, 3, 4, 2, 1, 2, 4, 0, 5, 3, 0, 3, 2, 0, 2, 1].map((i) => k[i]!);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, st.body);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // The tread lies on the slope: a group at the slope's centre, tilted down toward local +z.
  const L = Math.hypot(p.d, p.h), tread = new THREE.Group();
  tread.position.set(0, p.h / 2, 0);
  tread.rotation.x = Math.atan2(p.h, p.d);
  const tw = p.w - 0.5, tl = L - 0.5;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.03, tl), st.hinge);
  plate.position.y = 0.012;
  tread.add(plate);
  const n = Math.max(3, Math.round(tl / 0.32));
  for (let i = 0; i < n; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(tw - 0.5, 0.03, 0.09), st.top);
    slat.position.set(0, 0.022, -tl / 2 + ((i + 0.5) * tl) / n);
    tread.add(slat);
  }
  for (const x of [tw / 2 - 0.08, -(tw / 2 - 0.08)]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, tl), KICKER_ORANGE);
    strip.position.set(x, 0.022, 0);
    tread.add(strip);
  }
  g.add(tread);
}

function buildPlank(g: THREE.Group, p: Piece & { type: "plank" }): THREE.Group {
  const st = STRUCT!, w = p.w, h = p.h, pose = plankPose(p);
  const panel = new THREE.Group();
  panel.position.set(0, pose.y, pose.z);
  panel.rotation.x = (-pose.tilt * Math.PI) / 180;
  const body = new THREE.Mesh(roundedBox(w, h, PLANK_T, 0.06), st.plank);
  body.castShadow = body.receiveShadow = true;
  panel.add(body);
  const rim = rimFrame(w - 0.3, h - 0.3, 0.1, 0.02);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(rim, st.plankGlow);
    m.position.z = side * PLANK_T / 2;
    if (side < 0) m.rotation.y = Math.PI;
    panel.add(m);
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w + 0.7, 12), st.hinge);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.y = -h / 2;
  barrel.castShadow = true;
  panel.add(barrel);
  g.add(panel);
  const yokeH = PLANK_HINGE_H + 0.12;
  for (const x of [w / 2 + 0.22, -(w / 2 + 0.22)]) {
    const yoke = new THREE.Mesh(new RoundedBoxGeometry(0.34, yokeH, 0.5, 2, 0.05), st.hinge);
    yoke.position.set(x, yokeH / 2, 0);
    yoke.castShadow = true;
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), st.plankGlow);
    light.position.set(x, yokeH + 0.01, 0.1);
    g.add(yoke, light);
  }
  return panel;
}

// Seesaw: a tiled board with a green rim on both faces and a dark hub under its middle, on an
// axle between two rounded white posts that carry a dark slotted face and a lit cap. The board
// group is centred on the physics body and returned for the physics to pose; the posts stay.
function buildSeesaw(g: THREE.Group, p: Piece & { type: "seesaw" }): THREE.Group {
  const st = STRUCT!, W = p.w, D = p.d, T = SEESAW_T, H = SEESAW_PIVOT_H;
  const board = new THREE.Group();
  board.position.y = H;
  board.rotation.x = (seesawTilt(p) * Math.PI) / 180;
  const body = new THREE.Mesh(roundedBox(W, T, D, 0.06), st.plank);
  body.castShadow = body.receiveShadow = true;
  board.add(body);
  const rim = rimFrame(W - 0.2, D - 0.2, 0.1, 0.02);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(rim, st.plankGlow);
    m.rotation.x = -side * Math.PI / 2;
    m.position.y = side * T / 2;
    board.add(m);
  }
  const hub = new THREE.Mesh(new RoundedBoxGeometry(W - 0.6, 0.22, 0.6, 2, 0.06), st.hinge);
  hub.position.y = -T / 2 - 0.09;
  board.add(hub);
  g.add(board);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, W + 2 * SEESAW_POST_W + 0.2, 12), st.hinge);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = H;
  g.add(axle);
  const postH = H + 0.3;
  for (const side of [1, -1]) {
    const x = side * (W / 2 + SEESAW_POST_W / 2 + 0.05);
    const post = new THREE.Mesh(new RoundedBoxGeometry(SEESAW_POST_W, postH, SEESAW_POST_D, 4, 0.16), st.body);
    post.position.set(x, postH / 2, 0);
    post.castShadow = post.receiveShadow = true;
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH - 0.6, SEESAW_POST_D * 0.5), st.hinge);
    slot.position.set(x + side * (SEESAW_POST_W / 2), postH / 2 - 0.05, 0);
    for (const z of [-0.08, 0.08]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, postH - 0.8, 0.06), st.top);
      bar.position.set(x + side * (SEESAW_POST_W / 2 + 0.01), postH / 2 - 0.05, z);
      g.add(bar);
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(SEESAW_POST_W * 0.6, 0.03, SEESAW_POST_D * 0.5), st.glow);
    cap.position.set(x, postH + 0.005, 0);
    g.add(post, slot, cap);
  }
  return board;
}

const TUBE_GLASS = new THREE.MeshPhysicalMaterial({
  color: 0x5ad2e6, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1,
});
const TUBE_COLLAR = new THREE.MeshStandardMaterial({ color: 0xc9d0d6, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide });
const TUBE_EXIT_GLOW = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff6a1a, emissiveIntensity: 0.8, roughness: 0.4 });

// Wall of thickness r1 - r0 swept through `rings`, with flat annular ends.
function tubeShell(rings: SweepRing[], r0: number, r1: number, sides = 32): THREE.BufferGeometry {
  const inner = sweepTube(rings, r0, true, sides), outer = sweepTube(rings, r1, false, sides, rings.length * sides);
  const pos = [...inner.positions, ...outer.positions], idx = [...inner.indices, ...outer.indices];
  const n = rings.length * sides;
  for (const [ring, flip] of [[0, true], [rings.length - 1, false]] as const) {
    for (let j = 0; j < sides; j++) {
      const a = ring * sides + j, b = ring * sides + ((j + 1) % sides), c = a + n, d = b + n;
      if (flip) idx.push(a, d, c, a, b, d); else idx.push(a, c, d, a, d, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Tube: a glass pipe with a metal collar at each mouth, slotted into eight segments, and a light
// ring on the inside face (cyan at the entrance, orange at the exit).
function buildTube(g: THREE.Group, p: Tube) {
  const rings = tubeRings(p);
  const glass = new THREE.Mesh(tubeShell(rings, TUBE_R, TUBE_R + TUBE_WALL), TUBE_GLASS);
  glass.renderOrder = 1;
  g.add(glass);
  const COLLAR_L = 0.4, COLLAR_T = 0.16, SLOTS = 8;
  for (const [at, out, glow] of [[rings[0]!, -1, STRUCT!.glow], [rings[rings.length - 1]!, 1, TUBE_EXIT_GLOW]] as const) {
    const d = new THREE.Vector3(...at.d), c = new THREE.Vector3(...at.c);
    const collar = new THREE.Group();
    collar.position.copy(c);
    collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().multiplyScalar(out));
    // Built along +z, pointing out of the mouth.
    const along = (z: number): SweepRing => ({ c: [0, 0, z], d: [0, 0, 1], m: [0, 0, 1] });
    for (let k = 0; k < SLOTS; k++) {
      const a0 = (k / SLOTS) * Math.PI * 2 + 0.06, a1 = ((k + 1) / SLOTS) * Math.PI * 2 - 0.06;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(TUBE_R + TUBE_WALL + COLLAR_T, TUBE_R + TUBE_WALL + COLLAR_T, COLLAR_L, 6, 1, true, a0, a1 - a0), TUBE_COLLAR);
      seg.rotation.x = Math.PI / 2;
      seg.position.z = -COLLAR_L / 2;
      seg.castShadow = true;
      collar.add(seg);
    }
    const sleeve = new THREE.Mesh(tubeShell([along(-COLLAR_L), along(0)], TUBE_R - 0.02, TUBE_R + TUBE_WALL + COLLAR_T - 0.03, 32), STRUCT!.hinge);
    const light = new THREE.Mesh(new THREE.TorusGeometry(TUBE_R + 0.02, 0.035, 8, 40), glow);
    light.position.z = 0.01;
    collar.add(sleeve, light);
    g.add(collar);
  }
}

// Pushable crate: one textured cube, placed by the physics body each frame.
function buildCrate(g: THREE.Group, w: number, h: number, d: number) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.08, w / 2, h / 2, d / 2) * 0.99), STRUCT!.crate);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

const BEAM_MAT = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  uniforms: { height: { value: GOAL_BEAM_H }, time: { value: 0 } },
  vertexShader: `varying float vY; varying vec3 vN, vV;
    void main(){ vY = position.y; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `uniform float height, time; varying float vY; varying vec3 vN, vV;
    void main(){
      // Bright at the disc, thinning quickly with height.
      float t = clamp(vY / height, 0.0, 1.0);
      float fade = pow(1.0 - t, 3.0);
      float rim = abs(dot(vN, vV));
      float a = fade * (0.035 + 0.2 * pow(rim, 1.5));
      vec3 col = mix(vec3(0.18, 0.85, 1.0), vec3(0.8, 1.0, 1.0), rim * 0.6);
      gl_FragColor = vec4(col * a, a);
      #include <colorspace_fragment>
    }`,
});

// Goal: a spoked disc with a cyan ring and a tall beam of light fading upward.
function buildGoal(g: THREE.Group, r: number) {
  const st = STRUCT!;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 40), [st.top, st.disc, st.top]);
  disc.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.06, 0.07, 10, 48), st.glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, GOAL_BEAM_H, 32, 1, true), BEAM_MAT);
  beam.position.y = GOAL_BEAM_H / 2;
  beam.frustumCulled = false;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, GOAL_BEAM_H, 16, 1, true), BEAM_MAT);
  core.position.y = GOAL_BEAM_H / 2;
  g.add(disc, ring, beam, core);
}

function buildPillar(g: THREE.Group) {
  const st = STRUCT!;
  const R = PILLAR_R, H = PILLAR_H, capH = 0.3;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - capH, 32), st.pillar);
  body.position.y = (H - capH) / 2;
  body.castShadow = body.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.12, 32), st.body);
  collar.position.y = H - capH + 0.06;
  collar.castShadow = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.05, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), st.body);
  dome.scale.y = (capH - 0.12) / (R + 0.05);
  dome.position.y = H - capH + 0.12;
  dome.castShadow = true;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.12, 32), st.glow);
  ring.position.y = 0.06;
  g.add(body, collar, dome, ring);
}

// Box UVs projected from the dominant normal axis so tiles stay world-sized on every face.
function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const geo = new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2));
  const p = geo.getAttribute("position"), n = geo.getAttribute("normal");
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ay >= ax && ay >= az ? [x, z] : ax >= az ? [z, y] : [x, y];
    uv[i * 2] = u / TILE; uv[i * 2 + 1] = v / TILE;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geo;
}
const SPINNER_MAT = new THREE.MeshStandardMaterial({ color: 0xff8a3d, flatShading: true, roughness: 0.6 });
const START_MAT = new THREE.MeshBasicMaterial({ color: 0xffd23f, wireframe: true });

// The sky dome lives on this layer: the main camera skips it and sees the low-res sky
// buffer as the background instead; the ball's cube camera draws it directly.
export const SKY_LAYER = 1;
const SKY_SCALE = 1 / 3;

export interface SceneEnv {
  scene: THREE.Scene; sun: THREE.DirectionalLight; tick(camera: THREE.Camera): void;
  // One frame: the sky at a third of the resolution into a buffer (clouds are soft, and the
  // cloud march is by far the dearest pixel), then the scene over it at full resolution.
  render(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera): void;
  // Low detail swaps the sky's cloud march and the sea's ripple normals for flat versions; the
  // ball's reflection passes use it, since a 256px cube face cannot show the difference.
  setDetail(full: boolean): void;
}

export function createScene(): SceneEnv {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.FogExp2(SKY_HORIZON, 0.0035);
  const sky = makeSky(), ocean = makeOcean();
  sky.layers.set(SKY_LAYER);
  scene.add(sky, ocean);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7ea0c8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 60;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03; // the shadow map re-renders as the sun tracks the ball; this keeps shallow faces from shimmering
  scene.add(sun, sun.target);
  const t0 = performance.now();
  // Sky and sea ride along with the camera; their shaders work in world space so nothing swims.
  const tick = (camera: THREE.Camera) => {
    const t = (performance.now() - t0) / 1000;
    sky.position.copy(camera.position);
    (sky.material as THREE.ShaderMaterial).uniforms.time!.value = t;
    ocean.position.set(camera.position.x, OCEAN_Y, camera.position.z);
    (ocean.material as THREE.ShaderMaterial).uniforms.time!.value = t;
  };
  const setDetail = (full: boolean) => {
    (sky.material as THREE.ShaderMaterial).uniforms.detail!.value = full ? 1 : 0;
    (ocean.material as THREE.ShaderMaterial).uniforms.detail!.value = full ? 1 : 0;
  };
  let skyTarget: THREE.WebGLRenderTarget | null = null;
  const skyCam = new THREE.PerspectiveCamera();
  const size = new THREE.Vector2();
  const render = (renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) => {
    tick(camera);
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, Math.round(size.x * SKY_SCALE)), h = Math.max(1, Math.round(size.y * SKY_SCALE));
    if (!skyTarget || skyTarget.width !== w || skyTarget.height !== h) {
      skyTarget?.dispose();
      skyTarget = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false, colorSpace: THREE.SRGBColorSpace });
    }
    skyCam.copy(camera);
    skyCam.layers.set(SKY_LAYER);
    const bg = scene.background;
    scene.background = null;
    renderer.setRenderTarget(skyTarget);
    renderer.render(scene, skyCam);
    renderer.setRenderTarget(null);
    scene.background = skyTarget.texture;
    camera.layers.disable(SKY_LAYER);
    renderer.render(scene, camera);
    scene.background = bg;
  };
  return { scene, sun, tick, render, setDetail };
}

const NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
  }
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 2; i++) { v += a * noise3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
    return v;
  }
  // Where the cloud deck is, seen from above: the sky marches it and the sea darkens under it.
  // The sea uses the full fbm; the march (many samples per pixel) uses a 3-octave version.
  float fbmLow(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v + 0.0625; // the two dropped octaves average to this
  }
  float cloudCover(vec2 xz, float time) { return smoothstep(0.42, 0.68, fbm(xz * 0.025 + vec2(time * 0.01, time * 0.004))); }
  float cloudCoverLow(vec2 xz, float time) { return smoothstep(0.42, 0.68, fbmLow(xz * 0.025 + vec2(time * 0.01, time * 0.004))); }`;

// Gradient dome under a volumetric cloud deck between CLOUD_Y and CLOUD_TOP. Each sky pixel
// marches its view ray through the deck: coverage decides where clouds stand, coverage also
// sets how tall they billow, 3D noise erodes the edges into puffs, and one step toward the sun
// shades their undersides. Distant clouds melt into the horizon haze.
function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) },
      time: { value: 0 }, cloudY: { value: CLOUD_Y }, cloudTop: { value: CLOUD_TOP }, sunDir: { value: SUN_DIR }, detail: { value: 1 },
    },
    // Pinned to the far plane: anything in the scene draws in front, and covered pixels skip the march.
    vertexShader: `varying vec3 vP; void main(){ vP = position; vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = c.xyww; }`,
    fragmentShader: `uniform vec3 top, bottom, sunDir; uniform float time, cloudY, cloudTop, detail; varying vec3 vP;
      ${NOISE_GLSL}
      // Soft top and bottom so the ray march never crosses a hard edge (hard edges show as bands).
      float shape(float cover, float h) {
        float tall = 0.35 + 0.65 * cover;
        return smoothstep(-0.05, 0.4, h) * (1.0 - smoothstep(tall * 0.4, tall, h));
      }
      float density(vec3 p, out float cover) {
        cover = cloudCoverLow(p.xz, time);
        if (cover <= 0.0) return 0.0;
        float det = noise3(p * 0.07 + vec3(time * 0.25, 0.0, time * 0.1));
        float h = (p.y - cloudY) / (cloudTop - cloudY) + (det - 0.5) * 0.35;
        return clamp(cover * shape(cover, h) * 1.3 - (1.0 - det) * 0.35, 0.0, 1.0);
      }
      void main(){
        vec3 d = normalize(vP);
        vec3 sky = mix(bottom, top, smoothstep(0.04, 0.7, d.y));
        vec3 col = sky;
        if (d.y > 0.01 && detail < 0.5) {
          // Flat deck for reflection passes.
          float t = max((cloudY - cameraPosition.y) / d.y, 0.0);
          vec2 p = cameraPosition.xz + d.xz * t;
          col = mix(sky, vec3(0.97), cloudCoverLow(p, time) * exp(-t * 0.0016));
        } else if (d.y > 0.01) {
          float t0 = max((cloudY - cameraPosition.y) / d.y, 0.0);
          float t1 = (cloudTop - cameraPosition.y) / d.y;
          if (t1 > 0.0 && t0 < 2000.0) {
            const int STEPS = 36;
            float len = min(t1 - t0, 160.0), dt = len / float(STEPS);
            // A quarter-step blue-ish jitter breaks up any residual slice without reading as grain.
            float t = t0 + dt * (0.35 + 0.3 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))));
            vec3 acc = vec3(0.0);
            float trans = 1.0;
            for (int i = 0; i < STEPS; i++) {
              vec3 p = cameraPosition + d * t;
              float cover;
              float den = density(p, cover);
              if (den > 0.0) {
                vec3 ps = p + sunDir * 8.0;
                float cs = cloudCoverLow(ps.xz, time);
                float hs = (ps.y - cloudY) / (cloudTop - cloudY);
                float shade = exp(-cs * shape(cs, hs) * 2.4);
                float h = (p.y - cloudY) / (cloudTop - cloudY);
                vec3 light = mix(vec3(0.58, 0.65, 0.78), vec3(1.0, 0.99, 0.97), shade) * (0.86 + 0.14 * h);
                float a = 1.0 - exp(-den * dt * 0.14);
                acc += trans * a * light;
                trans *= 1.0 - a;
                if (trans < 0.03) break;
              }
              t += dt;
            }
            float fade = exp(-t0 * 0.0016);
            col = mix(sky, sky * trans + acc, fade);
          }
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat);
  m.frustumCulled = false;
  return m;
}

// Endless sea: slow noise ripples, sky fresnel, a soft sun glint, and the shadows of the
// cloud deck drifting over it (same coverage the sky marches, sampled straight below).
function makeOcean(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: SUN_DIR },
      deep: { value: new THREE.Color(0x2a6cb0) }, shallow: { value: new THREE.Color(0x3a80c4) }, sky: { value: new THREE.Color(0x8fb8e0) },
      detail: { value: 1 },
    }]),
    vertexShader: `#include <fog_pars_vertex>
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `#include <fog_pars_fragment>
      uniform float time, detail; uniform vec3 sunDir, deep, shallow, sky; varying vec3 vWorld;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vWorld.xz;
        vec2 g = vec2(0.0);
        if (detail > 0.5) {
          vec2 rp = p * 0.35 + vec2(time * 0.012, -time * 0.008);
          float e = 0.05;
          g = vec2(fbm(rp + vec2(e, 0.0)) - fbm(rp - vec2(e, 0.0)), fbm(rp + vec2(0.0, e)) - fbm(rp - vec2(0.0, e))) * 0.25;
        }
        float tone = fbmLow(p * 0.03 + vec2(time * 0.006, -time * 0.004));
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
        vec3 col = mix(mix(deep, shallow, smoothstep(0.3, 0.7, tone)), sky, fres);
        float spec = pow(max(dot(n, normalize(sunDir + V)), 0.0), 140.0);
        col += vec3(1.0, 0.99, 0.95) * spec * 0.12;
        col *= 1.0 - 0.16 * (detail > 0.5 ? cloudCover(p, time) : cloudCoverLow(p, time));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = OCEAN_Y;
  m.frustumCulled = false;
  return m;
}

export interface Built {
  group: THREE.Group;
  pieceGroups: THREE.Group[];
  spinnerBars: Map<number, THREE.Mesh>;
  crates: Map<number, THREE.Group>;
  // Plank groups per bridge piece, in chain order, local to the piece group.
  bridges: Map<number, THREE.Group[]>;
  // The swinging panel of each knock-down plank, local to the piece group.
  planks: Map<number, THREE.Group>;
  goal: { index: number; mesh: THREE.Object3D } | null;
}

const UP = new THREE.Vector3(0, 1, 0);
// Pose a bridge plank from its physics body: the plank group lives under the piece group, which
// only yaws and translates, so the world pose is pulled back into the piece's local frame.
export function posePlank(piece: THREE.Group, plank: THREE.Group, t: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): void {
  plank.position.set(t.x, t.y, t.z).sub(piece.position).applyAxisAngle(UP, -piece.rotation.y);
  plank.quaternion.set(q.x, q.y, q.z, q.w).premultiply(piece.quaternion.clone().invert());
}

export function buildLevel(level: Level, editor: boolean): Built {
  if (!MAT) throw new Error("initMaterials first");
  const mat = MAT;
  const group = new THREE.Group();
  const pieceGroups: THREE.Group[] = [];
  const spinnerBars = new Map<number, THREE.Mesh>();
  const crates = new Map<number, THREE.Group>();
  const bridges = new Map<number, THREE.Group[]>();
  const planks = new Map<number, THREE.Group>();
  let goal: Built["goal"] = null;

  level.pieces.forEach((p, index) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.order = "YXZ"; // tilt about the piece's own x axis, then yaw
    g.rotation.y = (pieceRot(p) * Math.PI) / 180;
    if (p.type === "slab") g.rotation.x = (p.tilt * Math.PI) / 180;
    g.userData.pieceIndex = index;
    if (p.type === "blockade") buildBlockade(g);
    if (p.type === "barrier") buildBarrier(g);
    if (p.type === "pillar") buildPillar(g);
    if (p.type === "crate") { buildCrate(g, p.w, p.h, p.d); g.position.y += p.h / 2 + 0.02; crates.set(index, g); }
    if (p.type === "bridge") bridges.set(index, buildBridge(g, p));
    if (p.type === "plank") planks.set(index, buildPlank(g, p));
    if (p.type === "seesaw") planks.set(index, buildSeesaw(g, p));
    if (p.type === "support") buildSupport(g, p);
    if (p.type === "kicker") buildKicker(g, p);
    if (p.type === "tube") buildTube(g, p);
    for (const b of pieceBoxes(p)) {
      if (b.kind !== "block" || p.type === "blockade" || p.type === "barrier" || p.type === "support") continue; // these props draw themselves; the box is only their collider
      const m = new THREE.Mesh(roundedBox(b.w, b.h, b.d, EDGE_RADIUS), mat.block);
      m.position.set(b.x, b.y, b.z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "slab" || p.type === "curve") {
      const rot = pieceRot(p);
      const cuts: XZ[][] = holesOn(level, p).map((h) => h.map((v) => { const o = rotXZ(v[0] - p.x, v[1] - p.z, -rot); return [o.x, o.z] as XZ; }));
      const geo = p.type === "slab"
        ? platformGeometry(p.w, p.d, PLATFORM_THICKNESS, LIP, TILE, undefined, undefined, cuts)
        : platformGeometry(((p.inner + p.outer) / 2) * (Math.PI / 2), p.outer - p.inner, PLATFORM_THICKNESS, LIP, TILE, { rmid: (p.inner + p.outer) / 2 });
      const m = new THREE.Mesh(geo, [mat.platform, mat.edge, mat.rim, mat.border]);
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "hole") buildHole(g, p.w, p.d);
    if (p.type === "ramp") {
      const geo = platformGeometry(p.d, p.w, PLATFORM_THICKNESS, LIP, TILE, undefined, (t) => rampHeight(p, t));
      geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, [mat.platform, mat.edge, mat.rim, mat.border]);
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);
    }
    buildRails(p, g, ENV);
    if (p.type === "spinner") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(p.length, SPINNER_HEIGHT, SPINNER_WIDTH), SPINNER_MAT);
      bar.position.y = SPINNER_HEIGHT / 2;
      bar.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, SPINNER_HEIGHT + 0.1, 12), mat.block);
      hub.position.y = SPINNER_HEIGHT / 2;
      g.add(bar, hub);
      spinnerBars.set(index, bar);
    }
    if (p.type === "goal") {
      buildGoal(g, p.r);
      goal = { index, mesh: g };
    }
    if (p.type === "start") {
      buildStartPad(g);
      if (editor) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 12, 8), START_MAT);
        m.position.y = START_PAD_H + BALL_RADIUS;
        g.add(m);
      }
    }
    group.add(g);
    pieceGroups.push(g);
  });

  return { group, pieceGroups, spinnerBars, crates, bridges, planks, goal };
}

let BAD_MAT: THREE.MeshStandardMaterial | null = null;
// Editor: paint the platforms at `bad` indices red and restore the rest, so an overlap reads at a glance.
export function markOverlapping(built: Built, bad: Set<number>) {
  if (!MAT) return;
  BAD_MAT ??= new THREE.MeshStandardMaterial({ map: MAT.platform.map, color: 0xe0392b, emissive: 0x5a0a05, roughness: 0.85 });
  built.pieceGroups.forEach((g, i) => {
    for (const o of g.children) {
      if (!(o instanceof THREE.Mesh) || !Array.isArray(o.material)) continue;
      const m = o.material as THREE.Material[];
      if (m[0] === MAT!.platform || m[0] === BAD_MAT) m[0] = bad.has(i) ? BAD_MAT! : MAT!.platform;
    }
  });
}

export interface Ball { mesh: THREE.Mesh; reflect(renderer: THREE.WebGLRenderer, env: SceneEnv): void; dispose(): void }

// Lacquered ball mirroring the live scene: a cube camera at the ball re-renders the surroundings
// each frame into its environment map, so platforms, rails and sky slide across it as it rolls.
export function makeBall(): Ball {
  const maps = ballTextures();
  const target = new THREE.WebGLCubeRenderTarget(128);
  const cube = new THREE.CubeCamera(0.2, 400, target);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 48, 24),
    new THREE.MeshPhysicalMaterial({
      map: maps.map, roughnessMap: maps.roughness, roughness: 1, metalness: 1,
      emissiveMap: maps.emissive, emissive: 0xffffff, emissiveIntensity: 1.1,
      envMap: target.texture, envMapIntensity: 1.2, clearcoat: 0.6, clearcoatRoughness: 0.15,
    }),
  );
  mesh.castShadow = true;
  return {
    mesh,
    reflect(renderer, env) {
      cube.position.copy(mesh.position);
      mesh.visible = false;
      const auto = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false; // the six faces reuse the main view's shadow maps
      env.setDetail(false);
      const bg = env.scene.background;
      env.scene.background = null; // the six faces draw the dome itself, not the main view's sky buffer
      for (const c of cube.children) c.layers.enable(SKY_LAYER);
      cube.update(renderer, env.scene);
      env.scene.background = bg;
      env.setDetail(true);
      renderer.shadowMap.autoUpdate = auto;
      mesh.visible = true;
    },
    dispose() { target.dispose(); },
  };
}
