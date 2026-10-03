import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { BALL_RADIUS, BEAN_LIFT, beltRods, isBelt, isShaped, slabOutline, type Slab, crateRound, GATE_CORNER, GATE_CUBE, GATE_LINK, GATE_ROUND, gateHang, gateLinks, gateStrip, type Gate, pieceRoll, propLift, barrelProfile, bumperProfile, magnetProfile, MAGNET_REACH, BRIDGE_BARREL, BRIDGE_LUG, GOAL_DISC_H, GOAL_RING, PILLAR_CAP, PILLAR_COLLAR, PILLAR_RING, propRound, SPINNER_HUB_R, startPadProfile, START_PAD_BOWL, START_PAD_EDGE_N, START_PAD_REST, BARRIER_D, BARRIER_H, BARRIER_LEG, BARRIER_LEG_R, BARRIER_LEG_X, BARRIER_R, BARRIER_W, BLOCK_R, BLOCKADE_R, BRIDGE_PLANK_T, PLANK_HINGE_H, PLANK_T, seesawPivot, seesawPostH, SEESAW_HUB, SEESAW_POST_D, SEESAW_POST_R, SEESAW_POST_W, SEESAW_STUB, SEESAW_T, PAINT, SUPPORT_BEND_R, SUPPORT_D, SUPPORT_GAP, SUPPORT_W, START_PAD_H, START_PAD_R, BLOCKADE_D, BLOCKADE_H, BLOCKADE_W, GOAL_BEAM_H, PILLAR_H, PILLAR_R, PLATFORM_EDGE_DROP, PLATFORM_EDGE_INSET, PLATFORM_LIP, PLATFORM_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, TUBE_R, TUBE_SKIN_SIDES, tubeRings, mouthRings, RING_R, RING_T, RING_SIDES, RING_SEGMENTS, RAIL_R, type Tube, bridgeChain, holesOn, pieceBoxes, kickerHull, kickerSpan, KICKER_W, kickerSlide, isSliding, COLUMN_R, isMoving, twistAt, type Mover, pieceRot, plankMounts, plankPose, PLANK_BARREL, PLANK_MOUNT_R, rampHeight, seesawTilt, stoolAxis, stoolSlide, jumpPadSize, jumpRings, JUMP_H, JUMP_REACH, JUMP_RUN, supportPillars, rotXZ, curveStrip, type Curve, type Bridge, beanAt, beanTrack, type Bean, type Level, type Piece, type XZ } from "./level.ts";
import { BELT_TILE, TILE, ballTextures, beanTexture, beltTextures, edgeTextures, magnetAuraTexture, structTextures, tileTexture } from "./textures.ts";
import { RAIL_MAT, STRIPE_MAT, buildFence, buildRailsPiece } from "./rails.ts";
import { BUMPER, EFFECTS, GATE, KICKER, MAGNET, PILLAR, PLATFORM, PROPS, STOOL, TREADMILL, TUBE } from "./palette.ts";
import { platformMesh } from "./platform.ts";
import { revolveMesh, ringMesh, sweepTube, torusMesh } from "./geometry.ts";

export const EDGE_RADIUS = BLOCK_R;

export const SKY_TOP = 0x448fec;
export const SKY_HORIZON = 0xafcde9;
// Far enough out that the shadow camera sits above everything a level stacks over the ball.
export const SUN_OFFSET = new THREE.Vector3(24, 42, 18);
export const SUN_DIR = SUN_OFFSET.clone().normalize();
export const OCEAN_Y = -45;
export const CLOUD_Y = 40, CLOUD_TOP = 75;

let MAT: Record<"platform" | "block" | "edge" | "rim" | "border", THREE.MeshStandardMaterial> | null = null;
const LIP = PLATFORM_LIP;
// Spacing of stacked paint layers (dark base, slats, light strips), three of them fitting in PAINT.
const LAYER = PAINT / 3.5;
// A curve's strip laid round its straight ends and arc, breaking at the arc's ends.
function curveGeometry(p: Curve): THREE.BufferGeometry {
  const c = curveStrip(p), rmid = (p.inner + p.outer) / 2;
  return platformGeometry(c.len, p.outer - p.inner, PLATFORM_THICKNESS, LIP, TILE, { at: (u, z) => c.at(u, rmid + z), knots: c.s > 0 ? [c.s, c.len - c.s] : [] });
}
// The drawn platform mesh (platform.ts) as a three geometry with its material groups.
function platformGeometry(...args: Parameters<typeof platformMesh>): THREE.BufferGeometry {
  const m = platformMesh(...args), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(m.uv, 2));
  geo.setIndex(m.indices);
  for (const [start, count, mat] of m.groups) geo.addGroup(start, count, mat);
  geo.computeVertexNormals();
  return geo;
}
let STRUCT: Record<"body" | "top" | "panel" | "pillar" | "glow" | "crate" | "disc" | "padTop" | "padCentre" | "padSkirt" | "barrierPanel" | "grille" | "plank" | "plankGlow" | "hinge" | "tread" | "stoolTop" | "bumperTop" | "barrelPanel", THREE.MeshStandardMaterial> | null = null;

export function initMaterials(renderer: THREE.WebGLRenderer): void {
  if (MAT) return;
  const tiles = tileTexture(renderer.capabilities.getMaxAnisotropy());
  const edge = edgeTextures();
  MAT = {
    platform: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.85 }),
    block: new THREE.MeshStandardMaterial({ map: tiles, color: PLATFORM.block, roughness: 0.8 }),
    edge: new THREE.MeshStandardMaterial({ map: edge.map, emissiveMap: edge.glow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6 }),
    rim: new THREE.MeshStandardMaterial({ color: PLATFORM.rim, roughness: 0.35, metalness: 0.05 }),
    border: new THREE.MeshStandardMaterial({ color: PLATFORM.border, roughness: 0.7 }),
  };
  const st = structTextures();
  STRUCT = {
    body: new THREE.MeshStandardMaterial({ color: PROPS.white, roughness: 0.45, metalness: 0.05 }),
    top: new THREE.MeshStandardMaterial({ color: PROPS.grey, roughness: 0.7 }),
    panel: new THREE.MeshStandardMaterial({ map: st.panel, emissiveMap: st.panelGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
    pillar: new THREE.MeshStandardMaterial({ map: st.pillar, roughness: 0.5, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({ color: PROPS.cyan, emissive: PROPS.cyan, emissiveIntensity: 0.9, roughness: 0.4 }),
    crate: new THREE.MeshStandardMaterial({ map: st.crate, emissiveMap: st.crateGlow, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.6 }),
    disc: new THREE.MeshStandardMaterial({ map: st.goalDisc, color: 0xffffff, roughness: 0.7 }),
    padTop: new THREE.MeshStandardMaterial({ map: st.padTop, emissiveMap: st.padGlow, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }),
    padCentre: new THREE.MeshStandardMaterial({ map: st.padCentre, roughness: 0.6 }),
    padSkirt: new THREE.MeshStandardMaterial({ map: st.padSkirt, roughness: 0.7 }),
    barrierPanel: new THREE.MeshStandardMaterial({ map: st.barrierPanel, roughness: 0.55 }),
    grille: new THREE.MeshStandardMaterial({ map: st.grille, roughness: 0.7 }),
    plank: new THREE.MeshStandardMaterial({ map: tiles, color: PLATFORM.plank, roughness: 0.85 }),
    plankGlow: new THREE.MeshStandardMaterial({ color: PROPS.green, emissive: PROPS.green, emissiveIntensity: 0.8, roughness: 0.4 }),
    stoolTop: new THREE.MeshStandardMaterial({ map: st.stoolTop, roughness: 0.55 }),
    barrelPanel: new THREE.MeshStandardMaterial({ map: st.barrelPanel, roughness: 0.55 }),
    bumperTop: new THREE.MeshStandardMaterial({ map: st.bumperTop, roughness: 0.55 }),
    hinge: new THREE.MeshStandardMaterial({ color: PROPS.hinge, roughness: 0.5, metalness: 0.3 }),
    // The kicker's tread and the jump pad's vents: a shade lighter and less metallic than hinge.
    tread: new THREE.MeshStandardMaterial({ color: PROPS.tread, roughness: 0.6, metalness: 0.15 }),
  };
}

function buildBlockade(g: THREE.Group) {
  const st = STRUCT!;
  const W = BLOCKADE_W, H = BLOCKADE_H, D = BLOCKADE_D;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, BLOCKADE_R), st.body);
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W - 0.7, 0.05, D - 0.7), st.top);
  top.position.y = H - 0.025 + PAINT;
  g.add(body, top);
  const sides: [x: number, z: number, yaw: number, len: number][] = [
    [0, D / 2, 0, W], [0, -D / 2, Math.PI, W], [W / 2, 0, Math.PI / 2, D], [-W / 2, 0, -Math.PI / 2, D],
  ];
  for (const [x, z, yaw, len] of sides) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.4, H - 0.4), st.panel);
    m.position.set(x + Math.sin(yaw) * PAINT * 0.8, H / 2, z + Math.cos(yaw) * PAINT * 0.8);
    m.rotation.y = yaw;
    g.add(m);
  }
}

// Editor only: in play a hole draws nothing itself, so this is what gets clicked.
const HOLE_MAT = new THREE.MeshBasicMaterial({ color: PROPS.cyan, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
const HOLE_LINE = new THREE.LineBasicMaterial({ color: PROPS.cyan });
function buildHoleMarker(g: THREE.Group, w: number, d: number) {
  const plane = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
  g.add(new THREE.Mesh(plane, HOLE_MAT), new THREE.LineSegments(new THREE.EdgesGeometry(plane), HOLE_LINE));
}

// Slatted column with a domed cap and a glowing base ring.
// Barrier: a rounded white pod on two legs with a cyan band along its bottom, a recessed
// instrument panel on each long face and a louvred grille on each end. The pod fills the
// collider exactly. Every detail is a box standing proud of the body, never a plane lying on it.
function buildBarrier(g: THREE.Group) {
  const st = STRUCT!, R = BARRIER_R;
  const W = BARRIER_W, D = BARRIER_D, H = BARRIER_H - BARRIER_LEG, y0 = BARRIER_LEG;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, R), st.body);
  body.position.y = y0 + H / 2;
  body.castShadow = body.receiveShadow = true;
  // The band, panels and grilles are painted on the pod's flat faces, no more than PAINT proud.
  const band = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * R, 0.1, D + 2 * PAINT), st.glow);
  band.position.y = y0 + R + 0.06;
  g.add(body, band);
  const panelGeo = new THREE.BoxGeometry(W * 0.6, H * 0.4, 0.08);
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(panelGeo, [st.top, st.top, st.top, st.top, st.barrierPanel, st.barrierPanel]);
    m.position.set(0, y0 + H * 0.62, s * (D / 2 - 0.04 + PAINT));
    g.add(m);
  }
  const grilleGeo = new THREE.BoxGeometry(0.08, H * 0.4, D - 2 * R);
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(grilleGeo, st.grille);
    m.position.set(s * (W / 2 - 0.04 + PAINT), y0 + H * 0.62, 0);
    g.add(m);
  }
  const legGeo = new THREE.CylinderGeometry(BARRIER_LEG_R, BARRIER_LEG_R, BARRIER_LEG + 0.1, 24);
  for (const x of [BARRIER_LEG_X, -BARRIER_LEG_X]) {
    const leg = new THREE.Mesh(legGeo, st.body);
    leg.position.set(x, (BARRIER_LEG + 0.1) / 2, 0);
    leg.castShadow = true;
    g.add(leg);
  }
}

// Start pad: a nest. A plain white side rounding onto a flat rim with the lit ring, and the centre
// carved into a bowl of rings. Each band is its own run of the revolved profile so each gets its own texture
// mapping: the skirt wrapped round, the rim and the bowl laid flat from above.
function buildStartPad(g: THREE.Group) {
  const st = STRUCT!, prof = startPadProfile(), SIDES = 48, E = START_PAD_EDGE_N;
  const bands: [profile: [number, number][], uv: (x: number, y: number, z: number, i: number) => [number, number]][] = [
    [prof.slice(0, E + 2), (_x, y, _z, i) => [(i % (SIDES + 1)) / SIDES, y / START_PAD_H]],
    [prof.slice(E + 1, E + 3), (x, _y, z) => [0.5 + x / (2 * START_PAD_R), 0.5 - z / (2 * START_PAD_R)]],
    [prof.slice(E + 2), (x, _y, z) => [0.5 + x / (2 * START_PAD_BOWL), 0.5 - z / (2 * START_PAD_BOWL)]],
  ];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [], geo = new THREE.BufferGeometry();
  for (const [band, map] of bands) {
    const m = revolveMesh(band, SIDES, true), base = pos.length / 3;
    for (let i = 0; i < m.positions.length / 3; i++) uv.push(...map(m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!, i));
    geo.addGroup(idx.length, m.indices.length, geo.groups.length);
    pos.push(...m.positions);
    idx.push(...m.indices.map((k) => k + base));
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const pad = new THREE.Mesh(geo, [st.padSkirt, st.padTop, st.padCentre]);
  pad.castShadow = pad.receiveShadow = true;
  g.add(pad);
}

// Bumper: the revolved profile in four bands, a white base, the red rubber band, a white rolled
// rim and the flat top carrying a round circuit board, laid flat from above to fill it.
const BUMPER_RUBBER = new THREE.MeshStandardMaterial({ color: BUMPER.rubber, roughness: 0.45 });
function buildBumper(g: THREE.Group) {
  const st = STRUCT!, bands = bumperProfile(), dish = bands[3]![0]![0], pos: number[] = [], uv: number[] = [], idx: number[] = [], geo = new THREE.BufferGeometry();
  for (const band of bands) {
    const m = revolveMesh(band, 48), base = pos.length / 3;
    geo.addGroup(idx.length, m.indices.length, geo.groups.length);
    for (let i = 0; i < m.positions.length; i += 3) uv.push(0.5 + m.positions[i]! / (2 * dish), 0.5 - m.positions[i + 2]! / (2 * dish));
    pos.push(...m.positions);
    idx.push(...m.indices.map((k) => k + base));
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, [st.body, BUMPER_RUBBER, st.body, st.bumperTop]);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

// Magnet: the revolved profile, a material per band (see magnetProfile), the top carrying the
// bumper's round circuit board, and the red aura lying on the surface out to its reach.
const MAGNET_GLOW = new THREE.MeshStandardMaterial({ color: MAGNET.glow, emissive: MAGNET.glow, emissiveIntensity: 0.9, roughness: 0.4 });
const MAGNET_LOWER = new THREE.MeshStandardMaterial({ color: MAGNET.lower, roughness: 0.35, metalness: 0.4 });
const MAGNET_GROOVE = new THREE.MeshStandardMaterial({ color: MAGNET.groove, roughness: 0.6 });
const MAGNET_UPPER = new THREE.MeshStandardMaterial({ color: MAGNET.upper, roughness: 0.35, metalness: 0.4 });
let AURA_MAT: THREE.MeshBasicMaterial | null = null;
function buildMagnet(g: THREE.Group) {
  const st = STRUCT!, bands = magnetProfile(), dish = bands[bands.length - 1]![0]![0], pos: number[] = [], uv: number[] = [], idx: number[] = [], geo = new THREE.BufferGeometry();
  for (const band of bands) {
    const m = revolveMesh(band, 48), base = pos.length / 3;
    geo.addGroup(idx.length, m.indices.length, geo.groups.length);
    for (let i = 0; i < m.positions.length; i += 3) uv.push(0.5 + m.positions[i]! / (2 * dish), 0.5 - m.positions[i + 2]! / (2 * dish));
    pos.push(...m.positions);
    idx.push(...m.indices.map((k) => k + base));
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, [MAGNET_GLOW, MAGNET_LOWER, MAGNET_GROOVE, MAGNET_UPPER, MAGNET_GLOW, st.body, st.bumperTop]));
  AURA_MAT ??= new THREE.MeshBasicMaterial({ map: magnetAuraTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(2 * MAGNET_REACH, 2 * MAGNET_REACH).rotateX(-Math.PI / 2), AURA_MAT);
  aura.position.y = PAINT;
  aura.raycast = () => {}; // never picked, so the floor under it stays clickable in the editor
  g.add(aura);
}

// Hanging bridge: each plank is a tiled slat with a green light strip round its rim and a hinge
// barrel across its near end, so a barrel sits in every gap; the far anchor carries the last one.
// Plank groups are returned in chain order for the physics to pose each frame; a fixed mount
// bracket at each end stays with the piece.
function buildBridge(g: THREE.Group, p: Bridge): THREE.Group[] {
  const st = STRUCT!;
  const chain = bridgeChain(p);
  // STRIP matches the knock-down plank's rim width.
  const T = BRIDGE_PLANK_T, W = p.w, STRIP = 0.1, LIP = PAINT;
  const barrel = () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(BRIDGE_BARREL.r, BRIDGE_BARREL.r, W - 2 * BRIDGE_BARREL.inset, 24), st.hinge);
    m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    return m;
  };
  const frameGeo = rimFrame(W - 0.08, chain.planks[0]!.len - 0.08, STRIP, LIP);
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
    const L = BRIDGE_LUG;
    for (const x of [W / 2 - L.x, -(W / 2 - L.x)]) {
      const lug = new THREE.Mesh(new RoundedBoxGeometry(L.w, L.h, L.d, 2, L.r), st.hinge);
      lug.position.set(x, h.y, h.z + dir * L.z);
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
// through its base that rests in a lit yoke at each side, or a wall bracket for a side plank.
// The panel group is centred on the physics body, like a crate, and is returned for the physics
// to pose; the yokes stay put.
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

// Support pillars: a white column per pillar, its outer face carrying a slate recessed slot with
// two pale bars and a cyan light line down each side, facing inward, slate bands every few layers, ear lugs on
// the sides, a foot that bends into the lower platform's wall on a lit flange, and a flared head
// under the upper one. Drawn only; the collider is the stem's box
// from pieceBoxes.
// Supports, columns and gates take the pillar's colours: its slate for the dark parts, its pale grey
// for the light ones, beside the props' white and cyan.
const CUBE_MAT = new THREE.MeshStandardMaterial({ color: GATE.cube, roughness: 0.5, metalness: 0.05 });
const SLATE = new THREE.MeshStandardMaterial({ color: PILLAR.slate, roughness: 0.5, metalness: 0.05 });
const PALE = new THREE.MeshStandardMaterial({ color: PILLAR.pale, roughness: 0.5, metalness: 0.05 });
// Column: a drum in the props' white with eight slate strips down it, a pale foot and head with a
// cyan band just inside each, and every 4 layers up a pale band between two cyan lines. The strips
// and bands are painted on, no more than PAINT proud.
function buildColumn(g: THREE.Group, h: number) {
  const st = STRUCT!, R = COLUMN_R;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, 48), [st.body, SLATE, SLATE]);
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const band = (y0: number, y1: number, mat: THREE.Material) => {
    if (y0 < 0 || y1 > h || y1 <= y0) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R + PAINT, R + PAINT, y1 - y0, 48, 1, true), mat);
    m.position.y = (y0 + y1) / 2;
    g.add(m);
  };
  const STRIPS = 8, sw = 0.08;
  for (let k = 0; k < STRIPS; k++) {
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(R + PAINT / 2, R + PAINT / 2, h, 2, 1, true, (k / STRIPS) * Math.PI * 2, sw), SLATE);
    strip.position.y = h / 2;
    g.add(strip);
  }
  band(0, 0.18, PALE); band(0.26, 0.36, st.glow);
  band(h - 0.18, h, PALE); band(h - 0.36, h - 0.26, st.glow);
  for (let m = 4; m <= h - 0.6; m += 4) { band(m - 0.24, m - 0.16, st.glow); band(m - 0.12, m + 0.12, PALE); band(m + 0.16, m + 0.24, st.glow); }
}

function buildSupport(g: THREE.Group, p: Piece & { type: "support" }) {
  const st = STRUCT!, W = SUPPORT_W, D = SUPPORT_D;
  for (const c of supportPillars(p)) {
    const col = new THREE.Group();
    col.position.set(c.x, 0, c.z);
    const body = new THREE.Mesh(supportBody(c.y1), st.body);
    body.castShadow = body.receiveShadow = true;
    col.add(body);
    supportTrim(col, c.y1);
    const head = new THREE.Mesh(new RoundedBoxGeometry(W + 0.2, 0.3, D + 0.16, 3, 0.08), st.body);
    head.position.y = c.y1 - 0.15;
    head.castShadow = true;
    const headBand = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, 0.06, D + 0.18), SLATE);
    headBand.position.y = c.y1 - 0.42;
    col.add(head, headBand);
    g.add(col);
  }
}

// A support pillar's trim up to `top`, in its column's frame (local -z toward the wall): the slot,
// the bands with their ears, the band where the bend begins and the lit flange on the wall.
function supportTrim(col: THREE.Group, top: number) {
  const st = STRUCT!, W = SUPPORT_W, D = SUPPORT_D;
  // The slot faces inward, toward the platforms, between the bend and the head.
  const s0 = 0.5, s1 = top - 0.7, sh = s1 - s0, sy = (s0 + s1) / 2, fz = -D / 2;
  const slot = new THREE.Mesh(new THREE.BoxGeometry(W * 0.46, sh, 0.06), SLATE);
  slot.position.set(0, sy, fz);
  col.add(slot);
  for (const x of [-0.08, 0.08]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, sh - 0.2, 0.08), PALE);
    bar.position.set(x, sy, fz - 0.01);
    col.add(bar);
  }
  for (const x of [-W * 0.33, W * 0.33]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.035, sh, 0.05), st.glow);
    line.position.set(x, sy, fz);
    col.add(line);
  }
  for (let y = s0 + 2.4; y < s1 - 0.8; y += 2.4) {
    const band = new THREE.Mesh(new RoundedBoxGeometry(W + 0.04, 0.16, D + 0.04, 2, 0.05), SLATE);
    band.position.y = y;
    col.add(band);
    for (const x of [W / 2 + 0.06, -(W / 2 + 0.06)]) {
      const ear = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.7, D * 0.55, 2, 0.04), st.body);
      ear.position.set(x, y + 0.5, 0);
      ear.castShadow = true;
      col.add(ear);
    }
  }
  // A slate band where the bend begins, and a slate flange with a cyan rim where the foot meets
  // the lower platform's wall.
  const T = PLATFORM_THICKNESS, wallZ = -(SUPPORT_GAP + D / 2);
  const band = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, 0.16, D + 0.06, 2, 0.05), SLATE);
  band.position.y = -T / 2 + D / 2 + SUPPORT_BEND_R + 0.1;
  const flange = new THREE.Mesh(new RoundedBoxGeometry(W + 0.24, D + 0.24, 0.08, 2, 0.03), SLATE);
  flange.position.set(0, -T / 2, wallZ + 0.04);
  const rim = new THREE.Mesh(rimFrame(W + 0.24, D + 0.24, 0.04, 0.02), st.glow);
  rim.position.set(0, -T / 2, wallZ + 0.08);
  col.add(band, flange, rim);
}

// Gate: each arch is one white extrusion of gateStrip, bevelled like a support's pillar. Each leg
// wears a support's trim, its slot facing the platform, and each beam a row of circuit-board
// panels front and back. A fence rail's rod
// joins the beams; each link and the cube hang from it in a group of their own, returned for the
// physics to pose.
// A chain link's middle line, a "0" in the x-y plane, long along y: up the right side, over the
// top, down the left, under the bottom.
class LinkPath extends THREE.Curve<THREE.Vector3> {
  constructor() { super(); }
  override getPoint(u: number, out = new THREE.Vector3()): THREE.Vector3 {
    const { r, straight: s } = GATE_LINK;
    let d = u * (4 * s + 2 * Math.PI * r);
    if (d < 2 * s) return out.set(r, -s + d, 0);
    if ((d -= 2 * s) < Math.PI * r) return out.set(r * Math.cos(d / r), s + r * Math.sin(d / r), 0);
    if ((d -= Math.PI * r) < 2 * s) return out.set(-r, s - d, 0);
    const a = Math.PI + (d - 2 * s) / r;
    return out.set(r * Math.cos(a), -s + r * Math.sin(a), 0);
  }
}
const linkGeometry = () => new THREE.TubeGeometry(new LinkPath(), 64, GATE_LINK.t, 10, true);

function buildGate(g: THREE.Group, p: Gate): THREE.Group[] {
  const st = STRUCT!, b = GATE_ROUND, W = SUPPORT_W, D = SUPPORT_D;
  const strip = gateStrip(p, b), shape = new THREE.Shape();
  shape.setFromPoints([...strip.map(([o]) => o), ...strip.map(([, i]) => i).reverse()].map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 });
  geo.translate(0, 0, -(W - 2 * b) / 2);
  const cy = p.h - D - GATE_CORNER, xi = p.w / 2 + SUPPORT_GAP;
  // Circuit-board panels along each beam's straight, front and back, like a barrier's.
  const cx = xi - GATE_CORNER, gap = 0.25, n = Math.max(1, Math.round(cx)), pw = (2 * cx - gap * (n + 1)) / n, panel = new THREE.BoxGeometry(pw, D * 0.6, 0.08);
  for (const z of [p.d / 2, -p.d / 2]) {
    const arch = new THREE.Group();
    arch.position.z = z;
    const body = new THREE.Mesh(geo, st.body);
    body.castShadow = body.receiveShadow = true;
    arch.add(body);
    for (const side of [1, -1]) {
      const col = new THREE.Group();
      col.position.x = side * (xi + D / 2);
      col.rotation.y = (side * Math.PI) / 2;
      supportTrim(col, cy + 0.4);
      arch.add(col);
    }
    for (const s of [1, -1]) for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(panel, [SLATE, SLATE, SLATE, SLATE, st.barrierPanel, st.barrierPanel]);
      m.position.set(-cx + gap + pw / 2 + k * (pw + gap), p.h - D / 2, s * (W / 2 - 0.04 + PAINT));
      arch.add(m);
    }
    g.add(arch);
  }
  const hang = gateHang(p);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(RAIL_R, RAIL_R, p.d, 24).rotateX(Math.PI / 2), RAIL_MAT);
  bar.position.y = hang.pivot;
  g.add(bar);

  // A group per link and one for the cube, in the physics' order, each centred on its body.
  const out: THREE.Group[] = [];
  const link = linkGeometry();
  gateLinks(p).forEach((y, k) => {
    const lg = new THREE.Group();
    lg.position.y = hang.pivot + y;
    const m = new THREE.Mesh(link, st.body);
    m.rotation.y = (k % 2) * (Math.PI / 2);
    lg.add(m);
    g.add(lg);
    out.push(lg);
  });
  const C = GATE_CUBE, cube = new THREE.Group();
  cube.position.y = hang.cube;
  cube.add(new THREE.Mesh(new RoundedBoxGeometry(C, C, C, 3, propRound(C, C, C)), CUBE_MAT));
  const rim = rimFrame(C - 0.18, C - 0.18, 0.08, PAINT), ring = new THREE.RingGeometry(C / 2 - 0.32, C / 2 - 0.25, 40), outer = new THREE.RingGeometry(C / 2 - 0.22, C / 2 - 0.19, 40);
  // A pale rim on every face; a lit ring in a grey one on every face but the top, which takes the eye.
  const faces: [x: number, y: number][] = [[0, 0], [0, Math.PI / 2], [0, Math.PI], [0, -Math.PI / 2], [Math.PI / 2, 0], [-Math.PI / 2, 0]];
  for (const [rx, ry] of faces) {
    const f = new THREE.Group();
    f.rotation.set(rx, ry, 0, "YXZ");
    const r = new THREE.Mesh(rim, st.body);
    r.position.z = C / 2;
    f.add(r);
    if (rx >= 0) {
      for (const [geo, mat] of [[ring, st.glow], [outer, PALE]] as const) {
        const m = new THREE.Mesh(geo, mat);
        m.position.z = C / 2 + PAINT;
        f.add(m);
      }
    }
    cube.add(f);
  }
  const eye = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.1, 0.24, 2, 0.03), SLATE);
  eye.position.y = C / 2 + 0.05;
  cube.add(eye);
  g.add(cube);
  out.push(cube);
  return out;
}

const SLIDE_TREAD = new THREE.MeshStandardMaterial({ color: KICKER.slideTread, roughness: 0.6, metalness: 0.15 });
const KICKER_ORANGE = new THREE.MeshStandardMaterial({ color: KICKER.light, emissive: KICKER.glow, emissiveIntensity: 0.6, roughness: 0.45 });

// Kicker: a white wedge with a dark tread inset on its slope, pale slats across the tread and an
// orange light strip along each side of it; a deck past the high edge carries the same tread, flat.
// A sliding kicker's strips are green like the stool's, with < > chevrons at the foot of its slope;
// its track is invisible in play and outlined in the editor, and its wedge group is returned for
// the physics to pose.
function buildKicker(g: THREE.Group, p: Piece & { type: "kicker" }, editor: boolean): THREE.Group | undefined {
  const st = STRUCT!, f = p.flat ?? 0, D = p.d + f, sliding = isSliding(p), slide = kickerSlide(p);
  if (sliding && editor) {
    const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, p.h, D));
    for (const s of [slide.lo, slide.hi]) {
      const o = new THREE.LineSegments(box, ROUTE_MAT);
      o.position.set(s, p.h / 2 + 0.02, 0);
      o.renderOrder = 9;
      g.add(o);
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(slide.lo, 0.05, 0), new THREE.Vector3(slide.hi, 0.05, 0)]), ROUTE_MAT);
    line.renderOrder = 9;
    g.add(line);
  }
  const outer = g;
  if (sliding) { g = new THREE.Group(); g.position.x = slide.at; outer.add(g); }
  const stripMat = sliding ? st.plankGlow : KICKER_ORANGE;
  // The rounded solid: the hull of a small sphere at each pulled-in corner.
  const hull = kickerHull(p), ball = new THREE.SphereGeometry(hull.r, 16, 8).getAttribute("position");
  const pts: THREE.Vector3[] = [];
  for (const [x, y, z] of hull.corners) for (let i = 0; i < ball.count; i++) pts.push(new THREE.Vector3(x + ball.getX(i), y + ball.getY(i), z + ball.getZ(i)));
  const body = new THREE.Mesh(new ConvexGeometry(pts), st.body);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // A tread `len` long down a group's local z. Stacked within PAINT so paint() keeps the dark
  // plate in view: plate, then stripes, then strips. `at(z)` is the height fraction (see kickerSpan)
  // of the slope at tread z, so on a side kicker it narrows with the solid. The orange strips run the
  // whole length near each edge; between them, a dark plate with well-rounded corners fills most of the
  // middle, striped across in thick light and dark bands. `marks` keeps the plate's
  // low end (local +z) clear of stripes for the < > chevrons.
  const tread = (len: number, at: (z: number) => number, marks = false) => {
    const t = new THREE.Group(), tl = len - 0.5, pl = tl * 0.88, ml = marks ? Math.min(0.8, pl * 0.35) : 0;
    // Margins are a standard kicker's (2.5 wide), shrunk in proportion where the solid is narrower.
    const edge = (z: number, k: number): [number, number] => { const [a, b] = kickerSpan(p, at(z)), m = k * Math.min(1, (b - a) / KICKER_W); return [a + m, b - m]; };
    const M = 0.42, [a0, b0] = edge(-pl / 2, M), [a1, b1] = edge(pl / 2, M), r = Math.max(0, Math.min(0.35, (b0 - a0) * 0.45, (b1 - a1) * 0.45, pl * 0.45));
    // The plate's outline in shape coordinates (x, -z), every corner rounded by r.
    const corners = [new THREE.Vector2(a0, pl / 2), new THREE.Vector2(b0, pl / 2), new THREE.Vector2(b1, -pl / 2), new THREE.Vector2(a1, -pl / 2)], shape = new THREE.Shape();
    corners.forEach((c, k) => {
      const prev = corners[(k + 3) % 4]!, next = corners[(k + 1) % 4]!;
      const from = c.clone().addScaledVector(prev.clone().sub(c).normalize(), r), to = c.clone().addScaledVector(next.clone().sub(c).normalize(), r);
      if (k === 0) shape.moveTo(from.x, from.y); else shape.lineTo(from.x, from.y);
      shape.quadraticCurveTo(c.x, c.y, to.x, to.y);
    });
    shape.closePath();
    const plate = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2), sliding ? SLIDE_TREAD : st.tread);
    plate.position.y = LAYER;
    t.add(plate);
    // Light stripes as thick as the dark between them, each kept inside the plate's rounded corners.
    const sl = pl - ml - 0.1, n = Math.max(3, Math.round(sl / 0.22)), pitch = sl / n;
    for (let i = 0; i < n; i++) {
      const z = -pl / 2 + 0.05 + (i + 0.5) * pitch, end = pl / 2 - Math.abs(z) - pitch / 4;
      const round = end < r ? r - Math.sqrt(Math.max(0, r * r - (r - end) ** 2)) : 0;
      const [a, b] = edge(z, M + 0.05);
      if (b - a - 2 * round < 0.05) continue;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(b - a - 2 * round, 0.001, pitch / 2), PALE);
      stripe.position.set((a + b) / 2, 2 * LAYER, z);
      t.add(stripe);
    }
    if (marks) {
      const a = 0.16, tip = 0.42, z = pl / 2 - ml / 2;
      for (const dir of [-1, 1]) for (const up of [1, -1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(a * Math.SQRT2 + 0.05, 0.001, 0.07), st.plankGlow);
        arm.position.set(dir * tip - (dir * a) / 2, 2 * LAYER, z + (up * a) / 2);
        arm.rotation.y = (dir * up * Math.PI) / 4;
        t.add(arm);
      }
    }
    // A strip along each edge the whole length, slanting with a side kicker's narrowing side.
    for (const side of [0, 1] as const) {
      const x0 = edge(-tl / 2, 0.24)[side], x1 = edge(tl / 2, 0.24)[side], l = Math.hypot(x1 - x0, tl);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.001, l), stripMat);
      strip.position.set((x0 + x1) / 2, 3 * LAYER, 0);
      strip.rotation.y = Math.atan2(x1 - x0, tl);
      t.add(strip);
    }
    return t;
  };
  // The slope's tread at the slope's centre, tilted down toward local +z.
  const along = Math.hypot(p.d, p.h);
  const slope = tread(along, (z) => 0.5 - z / along, sliding);
  slope.position.set(0, p.h / 2, f / 2);
  slope.rotation.x = Math.atan2(p.h, p.d);
  g.add(slope);
  paint(slope, "y");
  if (f > 0.5) {
    const deck = tread(f, () => 1);
    deck.position.set(0, p.h, -p.d / 2);
    g.add(deck);
    paint(deck, "y");
  }
  // The back panel fits the back face where it is narrowest, under the top edge.
  const [ba, bb] = kickerSpan(p, (p.h - 0.15) / p.h);
  if (bb - ba > 0.6) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(bb - ba - 0.4, Math.max(0.1, p.h - 0.3), 0.08), [st.top, st.top, st.top, st.top, st.barrierPanel, st.barrierPanel]);
    back.position.set((ba + bb) / 2, p.h / 2, -(D / 2 - 0.04 + PAINT));
    g.add(back);
  }
  return sliding ? g : undefined;
}

function buildPlank(g: THREE.Group, p: Piece & { type: "plank" }): THREE.Group {
  const st = STRUCT!, w = p.w, h = p.h, pose = plankPose(p);
  const panel = new THREE.Group();
  panel.position.set(0, pose.y, pose.z);
  panel.rotation.x = (-pose.tilt * Math.PI) / 180;
  const body = new THREE.Mesh(roundedBox(w, h, PLANK_T, PLANK_T / 2 - 0.01), st.plank);
  body.castShadow = body.receiveShadow = true;
  panel.add(body);
  const rim = rimFrame(w - 0.3, h - 0.3, 0.1, PAINT);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(rim, st.plankGlow);
    m.position.z = side * PLANK_T / 2;
    if (side < 0) m.rotation.y = Math.PI;
    panel.add(m);
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(PLANK_T / 2, PLANK_T / 2, w + 2 * PLANK_BARREL, 16), st.body);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.y = -h / 2;
  barrel.castShadow = true;
  panel.add(barrel);
  g.add(panel);
  // The mounts: white rounded blocks, a green band round a wall bracket near its top and bottom,
  // round a yoke near its top. The bands stand 0.004 proud, a painted line rather than a ledge.
  for (const m of plankMounts(p)) {
    const block = new THREE.Mesh(new RoundedBoxGeometry(m.w, m.h, m.d, 2, PLANK_MOUNT_R), st.body);
    block.position.set(m.x, m.y, m.z);
    block.castShadow = block.receiveShadow = true;
    g.add(block);
    for (const dy of p.side ? [m.h / 2 - 0.08, -(m.h / 2 - 0.08)] : [m.h / 2 - 0.06]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(m.w + 0.008, 0.04, m.d + 0.008), st.plankGlow);
      band.position.set(m.x, m.y + dy, m.z);
      g.add(band);
    }
  }
  return panel;
}

// Seesaw: a tiled board with a green rim on both faces and a dark hub under its middle, on an
// axle between two rounded white posts that carry a dark slotted face and a lit cap. The board
// group is centred on the physics body and returned for the physics to pose; the posts stay.
function buildSeesaw(g: THREE.Group, p: Piece & { type: "seesaw" }): THREE.Group {
  const st = STRUCT!, W = p.w, D = p.d, T = SEESAW_T, H = seesawPivot(p);
  const board = new THREE.Group();
  board.position.y = H;
  board.rotation.x = (seesawTilt(p) * Math.PI) / 180;
  const body = new THREE.Mesh(roundedBox(W, T, D, T / 2 - 0.01), st.plank);
  body.castShadow = body.receiveShadow = true;
  board.add(body);
  const rim = rimFrame(W - 0.2, D - 0.2, 0.1, PAINT);
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(rim, st.plankGlow);
    m.rotation.x = -side * Math.PI / 2;
    m.position.y = side * T / 2;
    board.add(m);
  }
  const hb = SEESAW_HUB, hub = new THREE.Mesh(new RoundedBoxGeometry(W - 2 * hb.inset, hb.h, hb.d, 2, hb.r), st.hinge);
  hub.position.y = -T / 2 - hb.drop;
  board.add(hub);
  g.add(board);
  // The axle shows only as a stub from each post into the board's edge: the board is thinner than
  // the axle, so one rod straight across would stick out through its top.
  const sb = SEESAW_STUB;
  for (const side of [1, -1]) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(sb.r, sb.r, sb.l, 24), st.hinge);
    stub.rotation.z = Math.PI / 2;
    stub.position.set(side * (W / 2 + sb.l / 2 - sb.into), H, 0);
    g.add(stub);
  }
  const postH = seesawPostH(p), face = SEESAW_POST_W / 2;
  for (const side of [1, -1]) {
    const x = side * (W / 2 + SEESAW_POST_W / 2 + 0.05);
    const post = new THREE.Mesh(new RoundedBoxGeometry(SEESAW_POST_W, postH, SEESAW_POST_D, 4, SEESAW_POST_R), st.body);
    post.position.set(x, postH / 2, 0);
    post.castShadow = post.receiveShadow = true;
    // Slot, bars and cap are painted on the post's flat faces, no more than PAINT proud.
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH - 0.6, SEESAW_POST_D * 0.5), st.hinge);
    slot.position.set(x + side * (face - 0.03 + PAINT * 0.6), postH / 2 - 0.05, 0);
    for (const z of [-0.08, 0.08]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH - 0.8, 0.06), st.top);
      bar.position.set(x + side * (face - 0.03 + PAINT), postH / 2 - 0.05, z);
      g.add(bar);
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(SEESAW_POST_W - 2 * SEESAW_POST_R, 0.03, SEESAW_POST_D - 2 * SEESAW_POST_R), st.glow);
    cap.position.set(x, postH - 0.015 + PAINT, 0);
    g.add(post, slot, cap);
  }
  return board;
}

const TUBE_GLASS = new THREE.MeshPhysicalMaterial({
  color: TUBE.glass, roughness: 0.12, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1,
});

// Tube: one thin glass skin (the physics keeps a solid wall behind it) with a ring of rail round each mouth; both mouths
// alike, since the tube runs either way.
function buildTube(g: THREE.Group, p: Tube) {
  const rings = tubeRings(p);
  if (rings.length < 2) return;
  // One glass skin, the bore the ball rolls in, on the physics' own facets.
  const skin = sweepTube(rings, TUBE_R, true, TUBE_SKIN_SIDES), skinGeo = new THREE.BufferGeometry();
  skinGeo.setAttribute("position", new THREE.Float32BufferAttribute(skin.positions, 3));
  skinGeo.setIndex(skin.indices);
  skinGeo.computeVertexNormals();
  const glass = new THREE.Mesh(skinGeo, TUBE_GLASS);
  glass.renderOrder = 1;
  g.add(glass);
  for (const m of mouthRings(rings)) g.add(railRing(m.c, m.d));
}

// A ring of the fences' and rails' own rail round centre c, axis d (a tube mouth's, or a hoop), with
// the rails' light strip round its outside.
function railRing(c: [number, number, number], d: [number, number, number]): THREE.Group {
  const ring = new THREE.Group();
  for (const [R, r, sides, mat] of [[RING_R, RING_T, RING_SIDES, RAIL_MAT], [RING_R + RING_T * 0.85, 0.022, 6, STRIPE_MAT]] as const) {
    const t = ringMesh(c, d, R, r, sides, RING_SEGMENTS), geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(t.positions, 3));
    geo.setIndex(t.indices);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    ring.add(m);
  }
  return ring;
}

// Hoop: a tube mouth's ring standing alone on the surface, where a tube mouth there would be.
function buildHoop(g: THREE.Group) {
  g.add(railRing([0, TUBE_R, 0], [0, 0, 1]));
}

// Barrel: a white rounded drum with a green ring near its foot and its head, and four circuit
// panels round its side, each in a dark frame. Rings and panels are painted on, PAINT proud at most.
// Like a crate, the group is centred on the physics body and placed by it each frame.
function buildBarrel(g: THREE.Group, r: number, h: number) {
  const st = STRUCT!, rr = propRound(2 * r, h, 2 * r);
  const m = revolveMesh(barrelProfile(r, h), 48), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
  geo.setIndex(m.indices);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, st.body);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  for (const y of [-h / 2 + rr + 0.08, h / 2 - rr - 0.08]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + PAINT, r + PAINT, 0.08, 48, 1, true), st.plankGlow);
    ring.position.y = y;
    g.add(ring);
  }
  const ph = h - 2 * rr - 0.42, arc = Math.min(1.1, 0.5 / r);
  if (ph <= 0.1) return;
  for (let k = 0; k < 4; k++) {
    const a = (k + 0.5) * (Math.PI / 2);
    const frame = new THREE.Mesh(new THREE.CylinderGeometry(r + PAINT / 2, r + PAINT / 2, ph + 0.08, 12, 1, true, a - arc / 2 - 0.06, arc + 0.12), st.hinge);
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(r + PAINT, r + PAINT, ph, 12, 1, true, a - arc / 2, arc), st.barrelPanel);
    g.add(frame, panel);
  }
}

// Bean: one capsule lying across its track, wrapped in its own texture (beanTexture): its uv runs
// tip to tip along the capsule, so the bands sit where the straight part meets the caps whatever the
// size. The bean group is returned for the physics to pose; it starts where its schedule has it at
// time 0, and in the editor its track is drawn on the surface, like a stool's slide.
const BEAN_MATS = new Map<string, THREE.MeshStandardMaterial>();
function beanGeometry(r: number, len: number): THREE.BufferGeometry {
  const h = len / 2 - r, pts: THREE.Vector2[] = [];
  for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + (k / 12) * (Math.PI / 2); pts.push(new THREE.Vector2(r * Math.cos(a), -h + r * Math.sin(a))); }
  for (let k = 0; k <= 12; k++) { const a = (k / 12) * (Math.PI / 2); pts.push(new THREE.Vector2(r * Math.cos(a), h + r * Math.sin(a))); }
  const geo = new THREE.LatheGeometry(pts, 48), pos = geo.attributes.position!, uv = geo.attributes.uv!;
  for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) + len / 2) / len);
  return geo;
}
function buildBean(g: THREE.Group, p: Bean, editor: boolean): THREE.Group {
  const track = beanTrack(p), key = `${p.r},${p.len}`;
  let mat = BEAN_MATS.get(key);
  if (!mat) { mat = new THREE.MeshStandardMaterial({ map: beanTexture(p.r, p.len), roughness: 0.5, metalness: 0.08 }); BEAN_MATS.set(key, mat); }
  if (editor && track.pts.length > 1) {
    const pts = track.pts.map((v) => { const l = rotXZ(v[0] - p.x, v[2] - p.z, -p.rot); return new THREE.Vector3(l.x, v[1] - p.y - p.r - BEAN_LIFT + 0.05, l.z); });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ROUTE_MAT);
    line.renderOrder = 9;
    g.add(line);
  }
  const bean = new THREE.Group();
  const body = new THREE.Mesh(beanGeometry(p.r, p.len), mat);
  body.castShadow = body.receiveShadow = true;
  bean.add(body);
  g.add(bean);
  const at = beanAt(p, track, 0);
  posePlank(g, bean, at, at.q);
  return bean;
}

// Pushable crate: one textured cube, placed by the physics body each frame.
function buildCrate(g: THREE.Group, w: number, h: number, d: number) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 6, crateRound(w, h, d)), STRUCT!.crate);
  m.castShadow = m.receiveShadow = true;
  g.add(m);
}

const STOOL_SCREEN = new THREE.MeshStandardMaterial({ color: STOOL.screen, roughness: 0.35, metalness: 0.2 });

// A flat rounded rectangle in the xy plane, facing +z.
function roundRectPlane(w: number, h: number, r: number): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return new THREE.ShapeGeometry(s, 4);
}

// Stool: a white block with a green ring round its base and a circuit board inset in its top. The
// two faces it is pushed on (square to its slide) carry a tall screen with ^ v chevrons; the two it
// slides past carry a screen with < > chevrons between two dark slots. Its track is invisible in
// play; the editor outlines the block at both ends of its slide, like a mover's stops. The block
// group is returned for the physics to pose.
function buildStool(g: THREE.Group, p: Piece & { type: "stool" }, editor: boolean): THREE.Group {
  const st = STRUCT!, { w, h, d } = p, slide = stoolSlide(p), alongZ = stoolAxis(p) === "z";
  const on = (s: number) => (alongZ ? [0, s] : [s, 0]) as [number, number];
  if (editor) {
    const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d));
    for (const s of [slide.lo, slide.hi]) {
      const o = new THREE.LineSegments(box, ROUTE_MAT);
      o.position.set(on(s)[0], h / 2 + 0.02, on(s)[1]);
      o.renderOrder = 9;
      g.add(o);
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([slide.lo, slide.hi].map((s) => new THREE.Vector3(on(s)[0], 0.05, on(s)[1]))), ROUTE_MAT);
    line.renderOrder = 9;
    g.add(line);
  }
  const block = new THREE.Group();
  block.position.set(on(slide.at)[0], h / 2 + 0.02, on(slide.at)[1]);
  const sr = propRound(w, h, d);
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, sr), st.body);
  body.castShadow = body.receiveShadow = true;
  block.add(body);
  // The base ring and top board are painted on the block's flat faces, clear of its rounding.
  const ring = new THREE.Mesh(new THREE.BoxGeometry(w - 2 * sr, 0.1, d + 2 * PAINT), st.plankGlow);
  ring.position.y = -h / 2 + sr + 0.06;
  const ring2 = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * PAINT, 0.1, d - 2 * sr), st.plankGlow);
  ring2.position.y = ring.position.y;
  block.add(ring, ring2);
  const board = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.02, d - 0.2), [st.top, st.top, st.stoolTop, st.top, st.top, st.top]);
  board.position.y = h / 2 - 0.01 + PAINT;
  block.add(board);
  // Face details are layered within PAINT: dark screens and slots flat just off the body, the
  // chevrons and slot bars on top of them, so paint() leaves them all in view. Each chevron is
  // sized from its tip's distance, so a pair always keeps a clear gap and never reads as a diamond.
  const chevrons = (face: THREE.Object3D, tip: number) => {
    const a = Math.min(0.13, tip * 0.4), t = Math.min(0.045, a * 0.4);
    for (const dir of [-1, 1]) for (const up of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(a * Math.SQRT2 + t * 0.7, t, 0.002), st.plankGlow);
      arm.position.set(dir * tip - (dir * a) / 2, (up * a) / 2, PAINT - 0.001);
      arm.rotation.z = (-dir * up * Math.PI) / 4;
      face.add(arm);
    }
  };
  // Each face: x, z, yaw, width; the two x faces first, then the two z faces.
  const faces: [number, number, number, number][] = [
    [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, -Math.PI / 2, d], [0, d / 2, 0, w], [0, -d / 2, Math.PI, w],
  ];
  faces.forEach(([x, z, yaw, fw], i) => {
    const face = new THREE.Group();
    face.position.set(x, h * 0.06, z);
    face.rotation.y = yaw;
    if ((i < 2) !== alongZ) {
      // Pushed on: a tall screen whose chevrons, turned a quarter, read ^ over v.
      const ew = Math.min(fw * 0.5, 0.6), eh = Math.min(h * 0.6, 0.8);
      const screen = new THREE.Mesh(roundRectPlane(ew, eh, 0.04), STOOL_SCREEN);
      screen.position.z = 0.002;
      face.add(screen);
      const marks = new THREE.Group();
      marks.rotation.z = Math.PI / 2;
      chevrons(marks, eh * 0.3);
      face.add(marks);
    } else {
      // Slid past: < > pointing along the slide, between two dark slots.
      const sw = Math.min(fw * 0.36, 0.9), sh = Math.min(h * 0.4, 0.6);
      const screen = new THREE.Mesh(roundRectPlane(sw, sh, 0.04), STOOL_SCREEN);
      screen.position.z = 0.002;
      face.add(screen);
      chevrons(face, sw * 0.36);
      for (const sx of [sw / 2 + 0.16, -(sw / 2 + 0.16)]) {
        const slot = new THREE.Mesh(roundRectPlane(0.12, sh * 0.85, 0.03), st.hinge);
        slot.position.set(sx, 0, 0.002);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, sh * 0.5, 0.002), st.top);
        bar.position.set(sx, 0, PAINT - 0.001);
        face.add(slot, bar);
      }
    }
    block.add(face);
    paint(face, "z");
  });
  g.add(block);
  return block;
}

// The jump pad shares the kicker's white (body), dark (tread), pale slats (top) and orange; the
// hovering squares are unlit and faint, in a soft amber.
const JUMP_HOLO_COLOR = EFFECTS.jumpHolo;
const JUMP_HOLO = new THREE.MeshBasicMaterial({ color: JUMP_HOLO_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
const JUMP_HOLO_FILL = new THREE.MeshBasicMaterial({ color: JUMP_HOLO_COLOR, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
// The squares breathe in and out on x / z, each a little behind the one below, so they ripple upward.
const JUMP_PULSE = { period: 1.6, amp: 0.12, lag: 0.55, taper: 0.07 };

// A dark slatted vent lying flat.
function vent(w: number, d: number): THREE.Group {
  const g = new THREE.Group(), st = STRUCT!;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.001, d), st.tread);
  base.position.y = LAYER;
  g.add(base);
  const n = Math.max(2, Math.round(d / 0.14));
  for (let k = 0; k < n; k++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.001, 0.05), st.top);
    slat.position.set(0, 2 * LAYER, -d / 2 + ((k + 0.5) * d) / n);
    g.add(slat);
  }
  return g;
}

// Jump pad: a low white platform with a grey ramp all round up to its flat top, the launch square
// in the middle of the top, a dark grille with an orange rim, under three hovering amber squares.
// The platform's collider is the hull of the same two outlines.
function buildJump(g: THREE.Group, p: Piece & { type: "jump" }) {
  const st = STRUCT!, H = JUMP_H, { base, top } = jumpRings(p), n = base.length;
  const tw = p.w - 2 * JUMP_RUN, td = p.d - 2 * JUMP_RUN, s = jumpPadSize(p), rt = Math.max(0.05, Math.min(p.w, p.d) * 0.28 - JUMP_RUN);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i < n; i++) pos.push(base[i]![0], 0, base[i]![1], top[i]![0], H, top[i]![1]);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(2 * i, 2 * i + 1, 2 * j, 2 * j, 2 * i + 1, 2 * j + 1); }
  const rampGeo = new THREE.BufferGeometry();
  rampGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  rampGeo.setIndex(idx);
  rampGeo.computeVertexNormals();
  const ramp = new THREE.Mesh(rampGeo, st.body);
  ramp.receiveShadow = true;
  g.add(ramp);
  const cap = new THREE.Shape(top.map(([x, z]) => new THREE.Vector2(x, -z)));
  const capGeo = new THREE.ShapeGeometry(cap);
  capGeo.rotateX(-Math.PI / 2);
  const plate = new THREE.Mesh(capGeo, st.body);
  plate.position.y = H;
  plate.receiveShadow = true;
  g.add(plate);
  const deck = new THREE.Group();
  deck.position.y = H;
  g.add(deck);
  // Launch square: a light frame, the dark grille, an orange rim, all painted on the top.
  const square = new THREE.Group();
  deck.add(square);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(s + 0.3, 0.001, s + 0.3), st.body);
  frame.position.y = LAYER / 2;
  square.add(frame);
  square.add(vent(s, s));
  for (const [x, z, a, b] of [[0, -s / 2, s + 0.1, 0.05], [0, s / 2, s + 0.1, 0.05], [-s / 2, 0, 0.05, s + 0.1], [s / 2, 0, 0.05, s + 0.1]] as const) {
    const rim = new THREE.Mesh(new THREE.BoxGeometry(a, 0.001, b), KICKER_ORANGE);
    rim.position.set(x, 3 * LAYER, z);
    square.add(rim);
  }
  paint(square, "y");
  // Three hovering squares, the jump's sign: amber frames with a faint fill, pulsing.
  const bar = 0.06;
  for (let k = 1; k <= 3; k++) {
    const sq = new THREE.Group();
    sq.position.y = (k * JUMP_REACH) / 3;
    for (const [x, z, a, b] of [[0, -s / 2, s, bar], [0, s / 2, s, bar], [-s / 2, 0, bar, s - bar], [s / 2, 0, bar, s - bar]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(a, bar, b), JUMP_HOLO);
      m.position.set(x, 0, z);
      sq.add(m);
    }
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(s - bar, s - bar), JUMP_HOLO_FILL);
    fill.rotation.x = -Math.PI / 2;
    fill.onBeforeRender = () => {
      const t = performance.now() / 1000, { period, amp, lag, taper } = JUMP_PULSE;
      const k1 = 1 - taper * (k - 1) + amp * Math.sin((2 * Math.PI * t) / period - lag * (k - 1));
      sq.scale.set(k1, 1, k1);
    };
    sq.add(fill);
    deck.add(sq);
  }
  // The four ramp faces are alike: each gets a vent over most of its straight part, its group
  // tilted to the slope with local +z pointing out and down it. Each corner gets an orange arc over
  // the middle half of its curve.
  const slope = Math.atan2(H, JUMP_RUN), slopeLen = Math.hypot(H, JUMP_RUN);
  for (let k = 0; k < 4; k++) {
    const o = new THREE.Group(), f = new THREE.Group(), along = k % 2 ? td : tw;
    o.rotation.y = (k * Math.PI) / 2;
    f.position.set(0, H / 2, (k % 2 ? tw : td) / 2 + JUMP_RUN / 2);
    f.rotation.x = slope;
    f.add(vent(Math.max(0.3, (along - 2 * rt) * 0.9), slopeLen * 0.72));
    o.add(f);
    g.add(o);
    paint(f, "y");
  }
  // Shape angle a lands at (cos(a + phi), -sin(a + phi)) in x / z, so phi centres the arc on the corner.
  const arc = Math.PI / 4, rr = Math.max(0.1, rt + JUMP_RUN / 2);
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    const light = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.035, 6, 16, arc), KICKER_ORANGE);
    light.rotation.x = -Math.PI / 2;
    light.rotation.z = Math.atan2(-sz, sx) - arc / 2;
    // Sunk into the corner's slope until only a sliver of the tube shows, a painted arc.
    light.position.set(sx * (tw / 2 - rt), H / 2 - 0.035 + PAINT, sz * (td / 2 - rt));
    g.add(light);
  }
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
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GOAL_DISC_H, 64), [st.top, st.disc, st.top]);
  disc.position.y = GOAL_DISC_H / 2;
  const t = torusMesh(r + GOAL_RING.gap, GOAL_RING.tube), ringGeo = new THREE.BufferGeometry();
  ringGeo.setAttribute("position", new THREE.Float32BufferAttribute(t.positions, 3));
  ringGeo.setIndex(t.indices);
  ringGeo.computeVertexNormals();
  const ring = new THREE.Mesh(ringGeo, st.glow);
  ring.position.y = GOAL_RING.y;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, GOAL_BEAM_H, 32, 1, true), BEAM_MAT);
  beam.position.y = GOAL_BEAM_H / 2;
  beam.frustumCulled = false;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, GOAL_BEAM_H, 16, 1, true), BEAM_MAT);
  core.position.y = GOAL_BEAM_H / 2;
  g.add(disc, ring, beam, core);
}

function buildPillar(g: THREE.Group) {
  const st = STRUCT!;
  const R = PILLAR_R, H = PILLAR_H, capH = PILLAR_CAP, C = PILLAR_COLLAR, RG = PILLAR_RING;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - capH, 64), st.pillar);
  body.position.y = (H - capH) / 2;
  body.castShadow = body.receiveShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R + C.r, R + C.r, C.h, 64), st.body);
  collar.position.y = H - capH + C.h / 2;
  collar.castShadow = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R + C.r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), st.body);
  dome.scale.y = (capH - C.h) / (R + C.r);
  dome.position.y = H - capH + C.h;
  dome.castShadow = true;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + RG.r, R + RG.r, RG.h, 64), st.glow);
  ring.position.y = RG.h / 2;
  g.add(body, collar, dome, ring);
}

// Sinks details built on a face (the group's local `axis` pointing out of it, 0 on the face) until
// none stands more than PAINT proud, so they read as paint and the body's collider is all there is.
function paint(face: THREE.Object3D, axis: "y" | "z"): void {
  face.updateMatrixWorld(true);
  const inv = face.matrixWorld.clone().invert(), box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4();
  face.traverse((o) => {
    const geo = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!geo || o === face) return;
    geo.computeBoundingBox();
    box.union(b.copy(geo.boundingBox!).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
  });
  const lift = box.isEmpty() ? 0 : box.max[axis] - PAINT;
  if (lift > 0) for (const c of face.children) c.position[axis] -= lift;
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

// Distance haze: squared-exponential, so what is near stays clear and only the far reaches fade
// (in play, a tenth hazed 45 out and over a third 90 out). The editor's is lighter, to see across its whole grid.
export const FOG_PLAY = 0.0075, FOG_EDITOR = 0.0018;
export function createScene(fog = FOG_PLAY): SceneEnv {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_HORIZON);
  scene.fog = new THREE.FogExp2(SKY_HORIZON, fog);
  const sky = makeSky(), ocean = makeOcean();
  sky.layers.set(SKY_LAYER);
  scene.add(sky, ocean);
  // The sun carries most of the light, so what it can't reach (shadows) reads clearly darker.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7ea0c8, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const c = sun.shadow.camera;
  c.left = -36; c.right = 36; c.top = 36; c.bottom = -36; c.near = 1; c.far = 150;
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
  // Plank groups per bridge piece, in chain order, local to the piece group; a gate's links, then its cube.
  bridges: Map<number, THREE.Group[]>;
  // The moving part of each knock-down plank, seesaw and stool, local to the piece group, posed from its body.
  planks: Map<number, THREE.Group>;
  // Each moving platform's piece group, placed by its schedule every frame in play.
  movers: Map<number, THREE.Group>;
  // Every treadmill rod, local to its piece group, with its z and radius (turnBelts).
  beltRods: { mesh: THREE.Mesh; z: number; r: number }[];
  goal: { index: number; mesh: THREE.Object3D } | null;
}

const UP = new THREE.Vector3(0, 1, 0);
// Pose a bridge plank from its physics body: the plank group lives under the piece group, which
// only yaws and translates, so the world pose is pulled back into the piece's local frame.
export function posePlank(piece: THREE.Group, plank: THREE.Group, t: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): void {
  plank.position.set(t.x, t.y, t.z).sub(piece.position).applyAxisAngle(UP, -piece.rotation.y);
  plank.quaternion.set(q.x, q.y, q.z, q.w).premultiply(piece.quaternion.clone().invert());
}

// Points the sun's shadow at the whole level, so every piece casts its shadow however far it is
// from the camera: the shadow box is the level's bounds (the goal's beam aside) plus room for
// moving platforms to travel. Level pieces stay put, so this is done once per build.
export function fitSun(sun: THREE.DirectionalLight, built: Built) {
  const box = new THREE.Box3(), part = new THREE.Box3();
  built.group.updateMatrixWorld(true);
  built.group.traverse((o) => { if (o instanceof THREE.Mesh && !(o.material instanceof THREE.ShaderMaterial)) box.union(part.setFromObject(o)); });
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 12;
  sun.target.position.copy(c);
  sun.position.copy(c).addScaledVector(SUN_DIR, r + 10);
  const cam = sun.shadow.camera;
  cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 2 * r + 20;
  cam.updateProjectionMatrix();
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
  const movers = new Map<number, THREE.Group>();
  const beltRodMeshes: Built["beltRods"] = [];
  let goal: Built["goal"] = null;

  level.pieces.forEach((p, index) => {
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.order = "YXZ"; // roll about the piece's own z axis, tilt about its x axis, then yaw
    g.rotation.y = (pieceRot(p) * Math.PI) / 180;
    if (p.type === "slab") { g.rotation.x = (p.tilt * Math.PI) / 180; g.rotation.z = ((p.roll ?? 0) * Math.PI) / 180; }
    if (p.type === "kicker" || p.type === "jump") g.rotation.z = ((p.roll ?? 0) * Math.PI) / 180;
    else if (pieceRoll(p)) g.rotation.z = (pieceRoll(p) * Math.PI) / 180;
    g.userData.pieceIndex = index;
    if (p.type === "blockade") buildBlockade(g);
    if (p.type === "barrier") buildBarrier(g);
    if (p.type === "pillar") buildPillar(g);
    if (p.type === "bumper") buildBumper(g);
    if (p.type === "magnet") buildMagnet(g);
    if (p.type === "column") buildColumn(g, p.h);
    if (p.type === "crate") { buildCrate(g, p.w, p.h, p.d); g.position.y += propLift(p) + 0.02; crates.set(index, g); }
    if (p.type === "barrel") { buildBarrel(g, p.r, p.h); g.position.y += propLift(p) + 0.02; crates.set(index, g); }
    if (p.type === "bridge") bridges.set(index, buildBridge(g, p));
    if (p.type === "plank") planks.set(index, buildPlank(g, p));
    if (p.type === "seesaw") planks.set(index, buildSeesaw(g, p));
    if (p.type === "stool") planks.set(index, buildStool(g, p, editor));
    if (p.type === "bean") planks.set(index, buildBean(g, p, editor));
    if (p.type === "jump") buildJump(g, p);
    if (p.type === "support") buildSupport(g, p);
    if (p.type === "gate") bridges.set(index, buildGate(g, p));
    if (p.type === "kicker") { const k = buildKicker(g, p, editor); if (k) planks.set(index, k); }
    if (p.type === "tube") buildTube(g, p);
    if (p.type === "hoop") buildHoop(g);
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
        ? platformGeometry(p.w, p.d, PLATFORM_THICKNESS, LIP, TILE, undefined, undefined, cuts, p.twist ? (z) => twistAt(p, z) : undefined, isBelt(p), isShaped(p) ? slabOutline(p) : undefined)
        : curveGeometry(p);
      const m = new THREE.Mesh(geo, [mat.platform, mat.edge, mat.rim, mat.border]);
      m.receiveShadow = true;
      g.add(m);
      if (isBelt(p)) beltRodMeshes.push(...buildBelt(g, p));
      if (isMoving(p)) {
        m.castShadow = true;
        if (editor) buildMoverRoute(g, p);
        movers.set(index, g);
      }
    }
    if (p.type === "hole" && editor) buildHoleMarker(g, p.w, p.d);
    if (p.type === "ramp") {
      const geo = platformGeometry(p.d, p.w, PLATFORM_THICKNESS, LIP, TILE, undefined, (t) => rampHeight(p, t));
      geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, [mat.platform, mat.edge, mat.rim, mat.border]);
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);
    }
    if (p.type === "fence") buildFence(p, g);
    if (p.type === "rails") buildRailsPiece(p, g, level);
    if (p.type === "spinner") {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(p.length, SPINNER_HEIGHT, SPINNER_WIDTH), SPINNER_MAT);
      bar.position.y = SPINNER_HEIGHT / 2;
      bar.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(SPINNER_HUB_R, SPINNER_HUB_R, SPINNER_HEIGHT + 0.05, 48), mat.block);
      hub.position.y = (SPINNER_HEIGHT + 0.05) / 2;
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
        m.position.y = START_PAD_REST;
        g.add(m);
      }
    }
    group.add(g);
    pieceGroups.push(g);
  });

  // Everything solid casts and takes shadows; glows, the beam, holograms and editor guides don't.
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.every((m) => m instanceof THREE.MeshStandardMaterial)) return;
    o.receiveShadow = true;
    o.castShadow = !mats.every((m) => !m.map && m.emissiveIntensity > 0 && m.emissive.getHex() === m.color.getHex());
  });
  return { group, pieceGroups, spinnerBars, crates, bridges, planks, movers, beltRods: beltRodMeshes, goal };
}

const ROUTE_MAT = new THREE.LineBasicMaterial({ color: 0x5dffa8, transparent: true, opacity: 0.9, depthTest: false });
// Editor only: an outline of the platform at each stop and a line along its route (closing back
// to the start for a loop), in the piece's own frame like the stops.
function buildMoverRoute(g: THREE.Group, p: Mover) {
  const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(p.w, PLATFORM_THICKNESS, p.d));
  for (const s of p.move.stops) {
    const o = new THREE.LineSegments(box, ROUTE_MAT);
    o.position.set(s.x, s.y - PLATFORM_THICKNESS / 2, s.z);
    o.renderOrder = 9;
    g.add(o);
  }
  const pts = [{ x: 0, y: 0, z: 0 }, ...p.move.stops, ...(p.move.loop === "loop" ? [{ x: 0, y: 0, z: 0 }] : [])].map((s) => new THREE.Vector3(s.x, s.y + 0.05, s.z));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ROUTE_MAT);
  line.renderOrder = 9;
  g.add(line);
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

// Treadmill: the opening's walls (a dark box seen from inside, so it looks the same from below) and
// its rods. Each rod starts turned back by its own z over its radius, so the chevrons on the rods'
// tops line up into one pattern, and turned on as the belt runs (turnBelts) the pattern runs with
// them: forward over the tops, back under the bottoms.
let BELT: { rod: THREE.MeshStandardMaterial; bed: THREE.MeshStandardMaterial } | null = null;
function buildBelt(g: THREE.Group, p: Slab): Built["beltRods"] {
  if (!BELT) {
    const t = beltTextures();
    BELT = {
      rod: new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.glow, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.05 }),
      bed: new THREE.MeshStandardMaterial({ color: TREADMILL.bed, roughness: 0.8, side: THREE.BackSide }),
    };
  }
  const b = beltRods(p), mats = BELT;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(2 * b.ox, PLATFORM_THICKNESS, 2 * b.oz), mats.bed);
  walls.position.y = -PLATFORM_THICKNESS / 2;
  g.add(walls);
  // Turned so the axis runs along x with u going round the way the rod turns (see beltTextures).
  const geo = new THREE.CylinderGeometry(b.r, b.r, 2 * b.half, 48).rotateZ(-Math.PI / 2), uv = geo.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * 2 * b.half) / BELT_TILE);
  return b.z.map((z) => {
    const m = new THREE.Mesh(geo, mats.rod);
    m.position.set(0, -PLATFORM_THICKNESS / 2, z);
    m.rotation.x = -z / b.r;
    g.add(m);
    return { mesh: m, z, r: b.r };
  });
}
// Turns every treadmill rod for its tops having run `travel` along the belt (the sim's beltTravel).
export function turnBelts(built: Built, travel: number): void {
  for (const r of built.beltRods) r.mesh.rotation.x = -(r.z + travel) / r.r;
}