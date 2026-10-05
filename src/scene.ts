import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { APPLE, BALL_RADIUS, BEAN_LIFT, BUTTON, buttonBase, CUBE_S, holeCuts, isTilted, curveRollPoint, supportOver, supportReach, supportBend, beltLoop, beltOutline, isBelt, isCurled, isGlass, curlPoint, isShaped, slabOutline, type Slab, crateRound, GATE_CORNER, GATE_GAP, GATE_BEND_R, GATE_ROUND, gateStrip, type Gate, pieceRoll, pieceTilt, propLift, barrelProfile, pufferProfile, puffRing, PUFFER_VENT, PUFF_REACH, type Puffer, magnetProfile, MAGNET_REACH, BRIDGE_BARREL, BRIDGE_LUG, PILLAR_CAP, PILLAR_COLLAR, PILLAR_RING, propRound, SPINNER_HUB_R, startPadProfile, START_PAD_BOWL, START_PAD_EDGE_N, START_PAD_REST, BARRIER_D, BARRIER_LEG, BARRIER_LEG_R, BARRIER_R, barrierSize, BLOCK_R, BLOCKADE_R, BRIDGE_PLANK_T, PLANK_HINGE_H, PLANK_T, seesawPivot, seesawPostH, boardLift, SEESAW_POST_D, SEESAW_POST_R, SEESAW_POST_W, SEESAW_STUB, SEESAW_T, PAINT, SUPPORT_D, SUPPORT_W, START_PAD_H, START_PAD_R, type Cylinder, PILLAR_H, PILLAR_R, PLATFORM_EDGE_DROP, PLATFORM_EDGE_INSET, PLATFORM_LIP, PLATFORM_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, TUBE_R, TUBE_SKIN_SIDES, tubeRings, mouthRings, exitMouth, RING_R, RING_T, RING_SIDES, RING_SEGMENTS, RAIL_R, type Tube, type TubeRing, bridgeChain, holesOn, pieceBoxes, kickerHull, kickerSpan, KICKER_W, KICKER_SINK, kickerSlide, isSliding, isMoving, twistAt, type Mover, pieceRot, plankMounts, plankPose, PLANK_BARREL, PLANK_MOUNT_R, rampHeight, seesawTilt, stoolAxis, stoolSlide, jumpPadSize, jumpHull, jumpCorner, JUMP_H, JUMP_REACH, JUMP_RUN, supportPillars, pillarStretches, pillarEar, PILLAR_EAR, gateLegTop, rotXZ, curveStrip, type Curve, type Bridge, beanAt, beanTrack, type Bean, type Level, type Piece, type XZ } from "./level.ts";
import { BELT_TILE, METAL_TILE, TILE, airTexture, beanTexture, beltTextures, edgeTextures, floorTexture, magnetAuraTexture, metalTexture, structTextures, tileTexture } from "./textures.ts";
import { RAIL_MAT, STRIPE_MAT, buildFence, buildRailsPiece } from "./rails.ts";
import { APPLE as APPLE_COLORS, CAUTION, GOLDEN as GOLDEN_COLORS, BUMPER, EFFECTS, ENV, GOAL, KICKER, RUIN, MAGNET, PILLAR, PLATFORM, PROPS, PUFFER, STOOL, TREADMILL, TUBE } from "./palette.ts";
import { platformMesh, type PlatformJoins } from "./platform.ts";
import { platformSeams } from "./floor.ts";
import { DECOR_TIME, buildDecor, buildTree, fadePlantsOn } from "./decor.ts";
import { FADE, INK_FADE, fadeAt } from "./fade.ts";
import { PATCH_GLSL, PATCH_KINDS, patchSeed } from "./patches.ts";
import { LAMP, floorOf, gateFrames, isPlatform, pieceCapsules, type Capsule, type FloorKind } from "./level.ts";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { revolveMesh, ringMesh, sweepTube, torusMesh } from "./geometry.ts";

export const EDGE_RADIUS = BLOCK_R;

export const SKY_TOP = ENV.skyTop;
export const SKY_HORIZON = ENV.skyHorizon;
// Far enough out that the shadow camera sits above everything a level stacks over the ball.
export const SUN_OFFSET = new THREE.Vector3(24, 42, 18);
export const SUN_DIR = SUN_OFFSET.clone().normalize();
export const OCEAN_Y = -45;
export const CLOUD_Y = 40, CLOUD_TOP = 75;

let MAT: Record<"platform" | "block" | "edge" | "rim" | "border" | "glass", THREE.MeshStandardMaterial> | null = null;
const LIP = PLATFORM_LIP;
// Spacing of stacked paint layers (dark base, slats, light strips), three of them fitting in PAINT.
const LAYER = PAINT / 3.5;
// A curve's strip laid round its straight ends and arc, breaking at the arc's ends.
function curveGeometry(p: Curve, seams: XZ[][] = []): THREE.BufferGeometry {
  const c = curveStrip(p), rmid = (p.inner + p.outer) / 2;
  // A seam point back onto the strip: how far along it, and how far across (the strip is straight across at any u).
  const strip = (x: number, z: number): XZ => {
    const l = pieceLocal(p, x, z), u = c.param(l[0], l[1]), a = c.at(u, rmid), b = c.at(u, rmid + 1);
    return [u - c.len / 2, (l[0] - a[0]) * (b[0] - a[0]) + (l[1] - a[1]) * (b[1] - a[1])];
  };
  return platformGeometry(c.len, p.outer - p.inner, PLATFORM_THICKNESS, LIP, TILE, { at: (u, z) => c.at(u, rmid + z), knots: c.s > 0 ? [c.s, c.len - c.s] : [] },
    undefined, [], undefined, false, undefined, undefined, { joins: seams.map((q) => q.map(([x, z]) => strip(x, z))), uvFrame: tileFrame(p) });
}
// A world point in a piece's own frame, before its turn.
function pieceLocal(p: Piece, x: number, z: number): XZ {
  const o = rotXZ(x - p.x, z - p.z, -pieceRot(p));
  return [o.x, o.z];
}
// The tile frame for a platform's own (x, z): the level's, turned back by the piece's turn past the nearest
// quarter turn, so the tiles run straight on across a join and stay square to a platform turned 15.
function tileFrame(p: Piece): (x: number, z: number) => XZ {
  const rot = pieceRot(p), off = rot - 90 * Math.round(rot / 90);
  return (x, z) => { const w = rotXZ(x, z, rot), o = rotXZ(p.x + w.x, p.z + w.z, -off); return [o.x, o.z]; };
}
// A glass slab's tiled faces, moved off the slab's geometry onto a see-through pane of their own
// that casts no shadow; the rim, lips and walls stay on the slab's mesh and keep its shadow.
function glassPane(geo: THREE.BufferGeometry): THREE.Mesh {
  const pane = new THREE.BufferGeometry();
  for (const name of ["position", "uv", "normal"]) pane.setAttribute(name, geo.getAttribute(name));
  pane.setIndex(geo.getIndex());
  for (const grp of geo.groups.filter((q) => q.materialIndex === 0)) pane.addGroup(grp.start, grp.count, 0);
  geo.groups = geo.groups.filter((q) => q.materialIndex !== 0);
  // A list, not the material alone: a mesh with one material ignores its groups and would glaze every face.
  const m = new THREE.Mesh(pane, [MAT!.glass]);
  m.receiveShadow = true;
  m.renderOrder = 1;
  m.userData.noShadow = true;
  return m;
}
// The drawn platform mesh (platform.ts) as a three geometry with its material groups.
function platformGeometry(...args: Parameters<typeof platformMesh>): THREE.BufferGeometry {
  const m = platformMesh(...args), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(m.positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(m.uv, 2));
  geo.setIndex(m.indices);
  for (const [start, count, mat] of m.groups) geo.addGroup(start, count, mat);
  geo.computeVertexNormals();
  const n = geo.getAttribute("normal") as THREE.BufferAttribute, v = new THREE.Vector3(), w = new THREE.Vector3();
  for (const [a, b] of m.seams) {
    v.fromBufferAttribute(n, a).add(w.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  return geo;
}
let STRUCT: Record<"body" | "top" | "panel" | "pillar" | "glow" | "crate" | "padTop" | "padCentre" | "padSkirt" | "barrierPanel" | "grille" | "plank" | "plankGlow" | "hinge" | "tread" | "stoolTop" | "bumperTop" | "barrelPanel" | "cubeFace" | "cubeTop", THREE.MeshStandardMaterial> | null = null;

// Each floor's top material (FLOORS), made the first time a platform wears it; grass is MAT.platform. The
// mixed floor is one per level seed (patchSeed): grass's material with the patches (patches.ts) worked out
// per pixel from the tile frame, each patch sampling its own floor's texture, a darker line where two meet.
const FLOOR_MATS = new Map<string, THREE.MeshStandardMaterial>();
let FLOOR_ANISO = 1;
function floorMat(kind: FloorKind, seed: number): THREE.MeshStandardMaterial {
  const key = kind === "mixed" ? `mixed-${seed}` : kind;
  let m = FLOOR_MATS.get(key);
  if (m) return m;
  if (kind !== "mixed") m = new THREE.MeshStandardMaterial({ map: floorTexture(kind, FLOOR_ANISO), roughness: kind === "metal" ? 0.7 : ENV.floorRoughness, metalness: kind === "metal" ? 0.1 : 0 });
  else {
    const maps = PATCH_KINDS.map(([k]) => floorMat(k, seed).map!);
    m = new THREE.MeshStandardMaterial({ map: maps[0], roughness: ENV.floorRoughness });
    m.onBeforeCompile = (shader) => {
      maps.forEach((t, k) => { shader.uniforms[`patchMap${k}`] = { value: t }; });
      shader.uniforms.patchSeed = { value: seed };
      shader.fragmentShader = `uniform float patchSeed;\n${maps.map((_, k) => `uniform sampler2D patchMap${k};`).join("\n")}\n${PATCH_GLSL}\n` + shader.fragmentShader.replace("#include <map_fragment>", `
        bool patchLine;
        int patchK = patchKind(vMapUv * ${TILE.toFixed(1)}, uint(patchSeed), patchLine);
        vec4 patchTexel = ${maps.map((_, k) => `patchK == ${k} ? texture2D(patchMap${k}, vMapUv) : `).join("")}vec4(1.0);
        diffuseColor *= patchTexel * (patchLine ? 0.72 : 1.0);`);
    };
    m.customProgramCacheKey = () => "floor-mixed";
  }
  FLOOR_MATS.set(key, m);
  return m;
}
const isFloorMat = (m: THREE.Material): boolean => [...FLOOR_MATS.values()].includes(m as THREE.MeshStandardMaterial);
export function initMaterials(renderer: THREE.WebGLRenderer): void {
  if (MAT) return;
  const tiles = tileTexture(renderer.capabilities.getMaxAnisotropy()), propTiles = tileTexture(renderer.capabilities.getMaxAnisotropy(), false);
  const edge = edgeTextures();
  MAT = {
    platform: new THREE.MeshStandardMaterial({ map: tiles, roughness: ENV.floorRoughness }),
    block: new THREE.MeshStandardMaterial({ map: propTiles, color: PLATFORM.block, roughness: 0.8 }),
    edge: new THREE.MeshStandardMaterial({ map: edge.map, emissiveMap: edge.glow, emissive: 0xffffff, emissiveIntensity: 0.9 * ENV.glow, roughness: 0.6 }),
    rim: new THREE.MeshStandardMaterial({ color: PLATFORM.rim, roughness: Math.min(0.35, ENV.bodyRoughness), metalness: 0.05 }),
    border: new THREE.MeshStandardMaterial({ color: PLATFORM.border, roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: PLATFORM.glass, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.34, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.08 }),
  };
  FLOOR_ANISO = renderer.capabilities.getMaxAnisotropy();
  FLOOR_MATS.set("grass", MAT.platform);
  // The ruin style's platforms: steel lips round the steel wall, a darker line inside them.
  if (ENV.style === "ruin") {
    MAT.rim = new THREE.MeshStandardMaterial({ color: RUIN.paint, roughness: 0.75 });
    MAT.border = new THREE.MeshStandardMaterial({ color: RUIN.seam, roughness: 0.8 });
  }
  METAL = new THREE.MeshStandardMaterial({ map: metalTexture(renderer.capabilities.getMaxAnisotropy()), roughness: 0.75, metalness: 0.15 });
  METAL.map!.repeat.set(1 / METAL_TILE, 1 / METAL_TILE);
  const st = structTextures();
  STRUCT = {
    body: new THREE.MeshStandardMaterial({ color: PROPS.white, roughness: ENV.bodyRoughness, metalness: 0.05 }),
    top: new THREE.MeshStandardMaterial({ color: PROPS.grey, roughness: 0.7 }),
    panel: new THREE.MeshStandardMaterial({ map: st.panel, emissiveMap: st.panelGlow, emissive: 0xffffff, emissiveIntensity: 0.9 * ENV.glow, roughness: 0.5 }),
    pillar: new THREE.MeshStandardMaterial({ map: st.pillar, roughness: 0.5, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({ color: PROPS.cyan, emissive: PROPS.cyan, emissiveIntensity: 0.9 * ENV.glow, roughness: ENV.lightRoughness, metalness: ENV.lightMetal }),
    crate: new THREE.MeshStandardMaterial({ map: st.crate, emissiveMap: st.crateGlow, emissive: 0xffffff, emissiveIntensity: 0.8 * ENV.glow, roughness: 0.6 }),
    padTop: new THREE.MeshStandardMaterial({ map: st.padTop, emissiveMap: st.padGlow, emissive: 0xffffff, emissiveIntensity: 0.9 * ENV.glow, roughness: 0.5 }),
    padCentre: new THREE.MeshStandardMaterial({ map: st.padCentre, roughness: 0.6 }),
    padSkirt: new THREE.MeshStandardMaterial({ map: st.padSkirt, roughness: 0.7 }),
    barrierPanel: new THREE.MeshStandardMaterial({ map: st.barrierPanel, roughness: 0.55 }),
    grille: new THREE.MeshStandardMaterial({ map: st.grille, roughness: 0.7 }),
    plank: new THREE.MeshStandardMaterial({ map: propTiles, color: PLATFORM.plank, roughness: 0.85 }),
    plankGlow: new THREE.MeshStandardMaterial({ color: PROPS.movable, emissive: PROPS.movable, emissiveIntensity: 0.8 * ENV.glow, roughness: 0.4 }),
    stoolTop: new THREE.MeshStandardMaterial({ map: st.stoolTop, roughness: 0.55 }),
    barrelPanel: new THREE.MeshStandardMaterial({ map: st.barrelPanel, roughness: 0.55 }),
    bumperTop: new THREE.MeshStandardMaterial({ map: st.bumperTop, roughness: 0.55 }),
    cubeFace: new THREE.MeshStandardMaterial({ map: st.cubeFace, emissiveMap: st.cubeFaceGlow, emissive: 0xffffff, emissiveIntensity: 0.8 * ENV.glow, roughness: 0.55 }),
    cubeTop: new THREE.MeshStandardMaterial({ map: st.cubeTop, emissiveMap: st.cubeTopGlow, emissive: 0xffffff, emissiveIntensity: 0.8 * ENV.glow, roughness: 0.55 }),
    hinge: new THREE.MeshStandardMaterial({ color: PROPS.hinge, roughness: 0.5, metalness: 0.3 }),
    // The kicker's tread and the jump pad's vents: a shade lighter and less metallic than hinge.
    tread: new THREE.MeshStandardMaterial({ color: PROPS.tread, roughness: 0.6, metalness: 0.15 }),
  };
  // The ruin style's props are the old structure's machines: their bodies in rusting steel.
  if (ENV.style === "ruin") STRUCT.body = propSteel(METAL.map!);
}

function buildBlockade(g: THREE.Group, p: Piece & { type: "blockade" }) {
  const W = p.w, H = p.h, D = p.d, R = Math.min(BLOCKADE_R, W / 2, H / 2, D / 2);
  if (ruin()) { g.add(steel(new RoundedBoxGeometry(W, H, D, 4, R).translate(0, H / 2, 0))); return; }
  const st = STRUCT!;
  const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, R), st.body);
  body.position.y = H / 2;
  body.castShadow = body.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.1, W - 0.7), 0.05, Math.max(0.1, D - 0.7)), st.top);
  top.position.y = H - 0.025 + PAINT;
  g.add(body, top);
  const sides: [x: number, z: number, yaw: number, len: number][] = [
    [0, D / 2, 0, W], [0, -D / 2, Math.PI, W], [W / 2, 0, Math.PI / 2, D], [-W / 2, 0, -Math.PI / 2, D],
  ];
  for (const [x, z, yaw, len] of sides) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.1, len - 0.4), Math.max(0.1, H - 0.4)), st.panel);
    m.position.set(x + Math.sin(yaw) * PAINT * 0.8, H / 2, z + Math.cos(yaw) * PAINT * 0.8);
    m.rotation.y = yaw;
    g.add(m);
  }
}

// Editor only: in play a hole draws nothing itself, so this is what gets clicked.
const HOLE_MAT = new THREE.MeshBasicMaterial({ color: PROPS.cyan, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
const HOLE_LINE = new THREE.LineBasicMaterial({ color: PROPS.cyan });
function buildHoleMarker(g: THREE.Group, p: Piece & { type: "hole" }) {
  const deg = Math.PI / 180, turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((p.tilt ?? 0) * deg, p.rot * deg, (p.roll ?? 0) * deg, "YXZ"));
  const plane = new THREE.PlaneGeometry(p.w, p.d).rotateX(-Math.PI / 2).translate(0, 0.03, 0).applyMatrix4(turn);
  g.add(new THREE.Mesh(plane, HOLE_MAT), new THREE.LineSegments(new THREE.EdgesGeometry(plane), HOLE_LINE));
}

// Editor only: a no-trees platform washed orange, over its own geometry.
const NO_TREES_MAT = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
function noTreesWash(g: THREE.Group, geo: THREE.BufferGeometry) {
  const m = new THREE.Mesh(geo, NO_TREES_MAT);
  m.userData.noShadow = true;
  g.add(m);
}

// Slatted column with a domed cap and a glowing base ring.
// Barrier: a rounded white pod on two legs with a cyan band along its bottom, a recessed
// instrument panel on each long face and a louvred grille on each end. The pod fills the
// collider exactly. Every detail is a box standing proud of the body, never a plane lying on it.
function buildBarrier(g: THREE.Group, p: Piece & { type: "barrier" }) {
  const size = barrierSize(p);
  if (ruin()) {
    const H = size.h - BARRIER_LEG, y0 = BARRIER_LEG;
    g.add(steel(new RoundedBoxGeometry(size.w, H, BARRIER_D, 4, BARRIER_R).translate(0, y0 + H / 2, 0)));
    for (const y of [y0 + 0.05, size.h - 0.05]) g.add(steel(new RoundedBoxGeometry(size.w + 0.02, 0.1, BARRIER_D + 0.04, 2, 0.04).translate(0, y, 0), SEAM_MAT));
    for (const x of [size.legX, -size.legX]) g.add(steel(new THREE.CylinderGeometry(BARRIER_LEG_R, BARRIER_LEG_R, BARRIER_LEG + 0.1, 16).translate(x, (BARRIER_LEG + 0.1) / 2, 0), SEAM_MAT));
    return;
  }
  const st = STRUCT!, R = BARRIER_R;
  const W = size.w, D = BARRIER_D, H = size.h - BARRIER_LEG, y0 = BARRIER_LEG;
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
  for (const x of [size.legX, -size.legX]) {
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
  const pad = new THREE.Mesh(geo, ruin() ? [st.body, st.body, SEAM_MAT] : [st.padSkirt, st.padTop, st.padCentre]);
  pad.castShadow = pad.receiveShadow = true;
  g.add(pad);
  // The origin's wormhole across the bowl, just under the rim, so the resting ball sits half in it.
  const mat = WORMHOLE_MAT.clone();
  mat.uniforms.time = PORTAL_TIME;
  const face = new THREE.Mesh(new THREE.CircleGeometry(START_PAD_BOWL - 0.01, 48).rotateX(-Math.PI / 2), mat);
  face.position.y = START_PAD_H - 0.02;
  face.userData.noShadow = true;
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(MOTES * 3), 3));
  moteGeo.setAttribute("seed", new THREE.Float32BufferAttribute(Array.from({ length: MOTES }, (_, i) => (i * 0.618034) % 1), 1));
  const motes = new THREE.Points(moteGeo, MOTE_MAT);
  motes.position.y = START_PAD_H;
  motes.scale.setScalar(START_PAD_BOWL);
  motes.frustumCulled = false;
  motes.visible = false;
  g.add(face, motes);
  g.userData.origin = (open: number) => { mat.uniforms.open!.value = open; motes.visible = open > 0.6; };
}

// An apple floating APPLE.float over the spot it is placed on: a round body (red, or golden), a stem and a leaf.
// Its group is what the game spins, bobs and takes away.
const APPLE_MATS = { body: new THREE.MeshStandardMaterial({ color: APPLE_COLORS.body, roughness: 0.45 }), stem: new THREE.MeshStandardMaterial({ color: APPLE_COLORS.stem, roughness: 0.8 }), leaf: new THREE.MeshStandardMaterial({ color: APPLE_COLORS.leaf, roughness: 0.7 }) };
const GOLDEN_MATS = { body: new THREE.MeshStandardMaterial({ color: GOLDEN_COLORS.body, emissive: GOLDEN_COLORS.glow, roughness: 0.3 }), stem: new THREE.MeshStandardMaterial({ color: GOLDEN_COLORS.stem, roughness: 0.8 }), leaf: new THREE.MeshStandardMaterial({ color: GOLDEN_COLORS.leaf, roughness: 0.7 }) };
function buildApple(g: THREE.Group, golden: boolean): void {
  const a = new THREE.Group(), r = APPLE.r, mats = golden ? GOLDEN_MATS : APPLE_MATS;
  a.position.y = APPLE.float;
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16).scale(1, 0.92, 1), mats.body);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.08, r * 0.11, r * 0.62, 6).rotateZ(-0.25).translate(r * 0.06, r * 0.95, 0), mats.stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(r * 0.31, 12, 8).scale(1.5, 0.3, 0.75).rotateZ(-0.45).translate(r * 0.4, r * 0.98, 0), mats.leaf);
  a.add(body, stem, leaf);
  g.add(a);
  g.userData[golden ? "golden" : "apple"] = a;
}

// Button: a steel base (buttonBase's hull) with a cap in the movables' paint on top, raised until pressed.
function buildButton(g: THREE.Group) {
  const pts = buttonBase(), idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 5, 1, 0, 4, 5, 1, 6, 2, 1, 5, 6, 2, 7, 3, 2, 6, 7, 3, 4, 0, 3, 7, 4];
  const base = new THREE.BufferGeometry();
  base.setAttribute("position", new THREE.Float32BufferAttribute(idx.flatMap((k) => pts[k]!), 3));
  base.computeVertexNormals();
  g.add(steel(base));
  const cap = steel(new THREE.CylinderGeometry(BUTTON.capR, BUTTON.capR, BUTTON.capH, 32), ruin() ? ruinPaint().move : STRUCT!.glow);
  const up = BUTTON.baseH + BUTTON.capH / 2;
  cap.position.y = up;
  g.add(cap);
  g.userData.press = (down: boolean) => { cap.position.y = down ? up - BUTTON.press : up; };
}

// Puffer: the revolved profile in its bands (pufferProfile), steel with the vent recess dark, the collar in
// red paint and louvres across the vents; and its air ring, a soft band run out and faded by puffRings.
const BUMPER_RUBBER = new THREE.MeshStandardMaterial({ color: BUMPER.rubber, roughness: 0.45 });
const AIR_H = 0.75, AIR_Y = 0.6, AIR_OPACITY = 0.75;
let AIR_GEO: THREE.BufferGeometry | null = null;
function buildPuffer(g: THREE.Group) {
  const st = STRUCT!, bands = pufferProfile(), dish = PUFFER_VENT, pos: number[] = [], uv: number[] = [], idx: number[] = [], geo = new THREE.BufferGeometry();
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
  const body = new THREE.Mesh(geo, ruin() ? [st.body, st.body, SEAM_MAT, ruinPaint().hazard, st.body] : [st.body, st.body, SEAM_MAT, BUMPER_RUBBER, st.bumperTop]);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const vent = bands[2]!, y0 = vent[1]![1], y1 = vent[2]![1], depth = vent[0]![0] - vent[1]![0];
  const louvres = Array.from({ length: 16 }, (_, k) =>
    new THREE.BoxGeometry(depth, y1 - y0, 0.06).translate(PUFFER_VENT - depth / 2, (y0 + y1) / 2, 0).rotateY((k / 16) * Math.PI * 2));
  g.add(steel(mergeGeometries(louvres)));
  AIR_GEO ??= new THREE.CylinderGeometry(1, 1, AIR_H, 64, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: PUFFER.air, alphaMap: airTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(AIR_GEO, mat);
  ring.position.y = AIR_Y;
  ring.visible = false;
  ring.userData.air = true;
  ring.raycast = () => {};
  g.add(ring);
  g.userData.puff = (r: number | null) => {
    ring.visible = r !== null;
    if (r === null) return;
    ring.scale.set(r, 1, r);
    mat.opacity = AIR_OPACITY * (1 - (r - PUFFER_VENT) / (PUFF_REACH - PUFFER_VENT));
  };
}
// Runs every puffer's air ring out to where it is at time t (the sim's time), the ring running at `speed`.
export function puffRings(built: Built, level: Level, t: number, speed: number): void {
  for (const [i, set] of built.puffers) set(puffRing(level.pieces[i] as Puffer, t, speed));
}

// Magnet: the revolved profile, a material per band (see magnetProfile), the top carrying the
// round circuit board, and the red aura lying on the surface out to its reach.
const MAGNET_GLOW = new THREE.MeshStandardMaterial({ color: MAGNET.glow, emissive: MAGNET.glow, emissiveIntensity: 0.9 * ENV.glow, roughness: 0.4 });
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
  const hz = ruinPaint().hazard;
  g.add(new THREE.Mesh(geo, ruin() ? [hz, st.body, SEAM_MAT, st.body, hz, st.body, SEAM_MAT] : [MAGNET_GLOW, MAGNET_LOWER, MAGNET_GROOVE, MAGNET_UPPER, MAGNET_GLOW, st.body, st.bumperTop]));
  addAura(g);
}
function addAura(g: THREE.Group) {
  AURA_MAT ??= new THREE.MeshBasicMaterial({ map: magnetAuraTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(2 * MAGNET_REACH, 2 * MAGNET_REACH).rotateX(-Math.PI / 2), AURA_MAT);
  aura.position.y = PAINT;
  aura.raycast = () => {}; // never picked, so the floor under it stays clickable in the editor
  g.add(aura);
}

// Hanging bridge: each plank is a tiled slat with an orange light strip round its rim and a hinge
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
    const body = new THREE.Mesh(roundedBox(W, T, pl.len, 0.04), ruin() ? st.body : st.plank);
    body.castShadow = body.receiveShadow = true;
    const rim = new THREE.Mesh(frameGeo, st.plankGlow);
    rim.position.y = T / 2;
    const b = barrel();
    b.position.z = chain.seg / 2;
    pg.add(body, b);
    if (!ruin()) pg.add(rim);
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

// Knock-down plank: a tall tiled panel with an orange rim on both faces, on a hinge barrel
// through its base that rests in a lit yoke at each side, or a wall bracket for a side plank.
// The panel group is centred on the physics body, like a crate, and is returned for the physics
// to pose; the yokes stay put.
// One support pillar's body in the column's local frame (centred on the stem, x across it): the
// stem from the upper platform's underside `top` straight down, a quarter bend toward local -z,
// and a short foot running into the lower platform's side wall at mid-thickness. Extruded across
// x with a soft bevel so every edge catches light.
function supportBody(top: number, reach: number, ri: number): THREE.BufferGeometry {
  const W = SUPPORT_W, D = SUPPORT_D, ro = ri + D, b = 0.07, T = PLATFORM_THICKNESS;
  const yl1 = -T / 2 + D / 2, yl0 = -T / 2 - D / 2, zc = -D / 2 - ri, yc = yl1 + ri;
  const wall = -reach - 0.05; // a hair inside the wall, so no seam shows
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

// The soft stem: one round tube down the middle of the J the lab stem makes, as thick as fits in it.
const SOFT_STEM_R = Math.min(SUPPORT_W, SUPPORT_D) / 2 - 0.02;
function softSupportBody(top: number, reach: number, ri: number): THREE.BufferGeometry {
  const D = SUPPORT_D, T = PLATFORM_THICKNESS, yl1 = -T / 2 + D / 2, zc = -D / 2 - ri, yc = yl1 + ri, rm = ri + D / 2;
  const pts: THREE.Vector3[] = [new THREE.Vector3(0, top - 0.02, 0), new THREE.Vector3(0, yc, 0)];
  for (let k = 1; k <= 8; k++) { const a = -(k / 8) * (Math.PI / 2); pts.push(new THREE.Vector3(0, yc + rm * Math.sin(a), zc + rm * Math.cos(a))); }
  pts.push(new THREE.Vector3(0, -T / 2, -reach - 0.05));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), 48, SOFT_STEM_R, 20, false);
}

// Support pillars: a white column per pillar wearing supportTrim, its foot curving straight into the
// lower platform's wall. The stem collides as the box from pieceBoxes, the foot and bend as
// supportHulls and the ears as supportEarHulls.
// Supports, columns and arches take the pillar's colours: its slate for the dark parts, its pale grey
// for the light ones, beside the props' white and cyan.
const SLATE = new THREE.MeshStandardMaterial({ color: PILLAR.slate, roughness: 0.5, metalness: 0.05 });
const PALE = new THREE.MeshStandardMaterial({ color: PILLAR.pale, roughness: 0.5, metalness: 0.05 });
// Column: a drum in the props' white with eight slate strips down it, a pale foot and head with a
// cyan band just inside each, and every 4 layers up a pale band between two cyan lines. The strips
// and bands are painted on, no more than PAINT proud.
function buildColumn(g: THREE.Group, h: number, R: number) {
  if (ENV.style === "ruin") return metalColumn(g, h, R);
  const st = STRUCT!;
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

// The ruin style's column and support: the old structure's painted steel flaking to rust (metalTexture),
// its texture laid in world units. Plants grow over them (decor.ts).
let METAL: THREE.MeshStandardMaterial | null = null;
const SEAM_MAT = new THREE.MeshStandardMaterial({ color: RUIN.seam, roughness: 0.8 });
// The ruin style's props are a set of their own: each a plain steel body and at most a band or two of
// old paint: caution stripes on what the ball can push or move, red on what is dangerous, nothing on the rest.
let RUIN_PAINT: Record<"move" | "hazard", THREE.MeshStandardMaterial> | null = null;
const ruinPaint = () => (RUIN_PAINT ??= {
  move: cautionPaint(),
  hazard: new THREE.MeshStandardMaterial({ color: BUMPER.rubber, roughness: 0.7 }),
});
// Caution paint: yellow and dark in diagonal stripes CAUTION_STRIPE apart, laid from the mesh's own
// coordinates so they ride with the prop, the yellow lit a little from within so it stays bright in shade.
const CAUTION_STRIPE = 0.24;
function cautionPaint(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: CAUTION.yellow, emissiveIntensity: 0.22, roughness: 0.6 });
  const v = (hex: number) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vCaution;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vCaution = position;");
    shader.fragmentShader = "varying vec3 vCaution;\n" + shader.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>
  float cautionS = (vCaution.x + vCaution.y + vCaution.z) / ${CAUTION_STRIPE.toFixed(3)};
  float cautionW = fwidth(cautionS) * 2.0;
  float cautionDark = smoothstep(0.5 - cautionW, 0.5 + cautionW, abs(fract(cautionS) - 0.5) * 2.0);
  diffuseColor.rgb *= mix(${v(CAUTION.yellow)}, ${v(CAUTION.dark)}, cautionDark);`)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 - cautionDark;");
  };
  m.customProgramCacheKey = () => "caution-paint";
  return m;
}
const ruin = () => ENV.style === "ruin";
const steel = (geo: THREE.BufferGeometry, mat: THREE.Material = STRUCT!.body): THREE.Mesh => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
};
// A band of paint `t` tall round a w x d box whose upright edges are rounded r, centred at height y.
function paintBand(w: number, d: number, r: number, y: number, t: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundRect(new THREE.Shape(), w + 0.012, d + 0.012, r + 0.006), { depth: t, bevelEnabled: false, curveSegments: 6 }).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y - t / 2;
  return m;
}
// A ring of paint `t` tall round a drum of radius r, centred at height y.
function paintRing(r: number, y: number, t: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.006, r + 0.006, t, 48, 1, true), mat);
  m.position.y = y;
  return m;
}
// Where a piece's rust falls on the shared texture, picked from where it stands so neighbours differ.
const rustShift = (at: THREE.Vector3): [number, number] => {
  const h = Math.abs(Math.sin(at.x * 12.9898 + at.y * 4.1414 + at.z * 78.233) * 43758.5453);
  return [(h % 1) * METAL_TILE, ((h * 7.13) % 1) * METAL_TILE];
};
// Steel for the props' bodies, which have no texture coordinates to speak of: the rust texture is laid
// on each face from the piece's own frame, from whichever side the face looks most, so it stays put on a
// prop that moves and never stretches on a rounded one.
function propSteel(map: THREE.Texture): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.75, metalness: 0.15 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vSteelP;\nvarying vec3 vSteelN;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vSteelP = position; vSteelN = normal;");
    shader.fragmentShader = "varying vec3 vSteelP;\nvarying vec3 vSteelN;\n" + shader.fragmentShader.replace("#include <map_fragment>", `
      vec3 sw = pow(abs(normalize(vSteelN)), vec3(4.0)); sw /= sw.x + sw.y + sw.z;
      vec3 sp = vSteelP / ${METAL_TILE.toFixed(1)};
      diffuseColor *= texture2D(map, sp.zy) * sw.x + texture2D(map, sp.xz) * sw.y + texture2D(map, sp.xy) * sw.z;`);
  };
  m.customProgramCacheKey = () => "prop-steel";
  return m;
}
// A steel post, a flange round its foot and its head.
function metalColumn(g: THREE.Group, h: number, R: number): void {
  const geo = new THREE.CylinderGeometry(R, R, h, 32, 1, false), [du, dv] = rustShift(g.position);
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * R + du, uv.getY(i) * h + dv);
  const body = new THREE.Mesh(geo, METAL!);
  body.position.y = h / 2;
  g.add(body);
  for (const y of [0.09, h - 0.09]) {
    if (y < 0.09 || y > h - 0.09) continue;
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.18, 32), SEAM_MAT);
    flange.position.y = y;
    g.add(flange);
  }
}
// A pillar's ears (pillarEar, solid as drawn) along its stretches, in dark steel.
function steelEars(col: THREE.Group, stretches: { ym: number; ph: number }[]): void {
  const ball = new THREE.SphereGeometry(PILLAR_EAR.r, 10, 6).getAttribute("position");
  for (const stretch of stretches) for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (const [x, y, z] of pillarEar(stretch, side)) for (let i = 0; i < ball.count; i++) pts.push(new THREE.Vector3(x + ball.getX(i), y + ball.getY(i), z + ball.getZ(i)));
    col.add(steel(new ConvexGeometry(pts), SEAM_MAT));
  }
}
// Each pillar: the lab support's bent stem and ears (solid as drawn), in steel.
function metalSupport(g: THREE.Group, p: Piece & { type: "support" }): void {
  const ball = new THREE.SphereGeometry(PILLAR_EAR.r, 10, 6).getAttribute("position");
  for (const c of supportPillars(p)) {
    const col = new THREE.Group();
    col.position.set(c.x, 0, c.z);
    const body = supportBody(c.y1, supportReach(p), supportBend(p)), uv = body.getAttribute("uv") as THREE.BufferAttribute, [du, dv] = rustShift(new THREE.Vector3(p.x + c.x, p.y, p.z + c.z));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
    col.add(new THREE.Mesh(body, METAL!));
    steelEars(col, pillarStretches(c.y0, c.y1));
    g.add(col);
  }
}

function buildSupport(parent: THREE.Group, p: Piece & { type: "support" }) {
  const st = STRUCT!, g = new THREE.Group();
  if (supportOver(p)) { g.rotation.z = Math.PI; g.position.y = -PLATFORM_THICKNESS; }
  parent.add(g);
  if (ENV.style === "ruin") return metalSupport(g, p);
  for (const c of supportPillars(p)) {
    const col = new THREE.Group();
    col.position.set(c.x, 0, c.z);
    const body = new THREE.Mesh(ENV.props === "soft" ? softSupportBody(c.y1, supportReach(p), supportBend(p)) : supportBody(c.y1, supportReach(p), supportBend(p)), st.body);
    body.castShadow = body.receiveShadow = true;
    col.add(body);
    supportTrim(col, c.y1, supportBend(p));
    g.add(col);
  }
}

// A support pillar's trim up to `top`, in its column's frame (local -z toward the wall). Near each
// end of the straight stem a slate collar runs round it, dipping on the front and back faces with
// its ends turned toward that end of the stem. Each stretch of stem between them carries, front and
// back, a slate panel ribbed in pale grey inside a pale border between two cyan lines, and an ear
// out each side (pillarEar), narrowing toward its tip, with a slate pad on its front and back.
function supportTrim(col: THREE.Group, top: number, bend: number) {
  if (ENV.props === "soft") return softSupportTrim(col, top, bend);
  const st = STRUCT!, W = SUPPORT_W, D = SUPPORT_D, T = PLATFORM_THICKNESS, b = 0.07, yb = -T / 2 + D / 2 + bend;
  // Paint on the faces at ±z, drawn in each face's own x / y with +z out of it.
  const faces = (z: number, add: (f: THREE.Group) => void) => {
    for (const s of [-1, 1]) {
      const f = new THREE.Group();
      f.position.z = s * z;
      if (s < 0) f.rotation.y = Math.PI;
      add(f);
      col.add(f);
    }
  };
  const flat = (shape: THREE.Shape | THREE.Shape[], mat: THREE.Material, layer: number) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 6), mat);
    m.position.z = PAINT / 2 + layer * LAYER;
    return m;
  };
  const t = 0.07, c = 0.1, hw = W / 2 - b;
  for (const [y0, dir] of [[top - 0.45, 1], [yb + 0.25, -1]] as const) {
    const ye = y0 + dir * c, line: [number, number][] = [[-hw, ye], [-hw + c, y0], [hw - c, y0], [hw, ye]];
    const collar = new THREE.Shape([...line, ...[...line].reverse().map(([x, y]): [number, number] => [x, y - dir * t])].map(([x, y]) => new THREE.Vector2(x, y)));
    faces(D / 2, (f) => f.add(flat(collar, SLATE, 0)));
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.002, t, D - 2 * b), SLATE);
      side.position.set(sx * (W / 2 + PAINT / 2), ye - (dir * t) / 2, 0);
      col.add(side);
    }
  }
  const pw = W * 0.42, ball = new THREE.SphereGeometry(PILLAR_EAR.r, 10, 6).getAttribute("position");
  for (const stretch of pillarStretches(yb, top)) {
    const { ym, ph } = stretch, nr = Math.max(3, Math.round((ph - 0.16) / 0.11)), pitch = (ph - 0.16) / nr;
    const ribs = Array.from({ length: nr }, (_, i) => roundRect(new THREE.Shape(), pw - 0.12, pitch * 0.45, 0.015, 0, ym - (ph - 0.16) / 2 + (i + 0.5) * pitch));
    faces(D / 2, (f) => {
      f.add(flat(roundRect(new THREE.Shape(), pw + 0.08, ph + 0.08, 0.12, 0, ym), PALE, 0));
      f.add(flat(roundRect(new THREE.Shape(), pw, ph, 0.09, 0, ym), SLATE, 1));
      f.add(flat(ribs, PALE, 2));
      for (const x of [-1, 1]) f.add(flat(roundRect(new THREE.Shape(), 0.035, ph * 0.9, 0.0175, x * (pw / 2 + 0.1), ym), st.glow, 0));
    });
    // The ears: the hull of a small ball at each of pillarEar's points, as the physics rounds it.
    for (const side of [-1, 1]) {
      const pts: THREE.Vector3[] = [];
      for (const [x, y, z] of pillarEar(stretch, side)) for (let i = 0; i < ball.count; i++) pts.push(new THREE.Vector3(x + ball.getX(i), y + ball.getY(i), z + ball.getZ(i)));
      const ear = new THREE.Mesh(new ConvexGeometry(pts), st.body);
      ear.castShadow = ear.receiveShadow = true;
      col.add(ear);
    }
    faces(PILLAR_EAR.d / 2, (f) => { for (const sx of [-1, 1]) f.add(flat(roundRect(new THREE.Shape(), 0.11, ph * 0.37, 0.05, sx * (W / 2 + 0.08), ym), SLATE, 0)); });
  }
}

// Soft support trim: the stem stays plain; each stretch gets two light rings round it and keeps
// its ears (they are solid), in the soft tint, with a round dot on each.
function softSupportTrim(col: THREE.Group, top: number, bend: number) {
  const st = STRUCT!, sm = softMats(), W = SUPPORT_W, D = SUPPORT_D, T = PLATFORM_THICKNESS, yb = -T / 2 + D / 2 + bend;
  const ball = new THREE.SphereGeometry(PILLAR_EAR.r, 10, 6).getAttribute("position");
  const ringGeo = new THREE.TorusGeometry(1, 0.05, 10, 48);
  for (const stretch of pillarStretches(yb, top)) {
    const { ym, ph } = stretch;
    for (const dy of [-ph * 0.32, ph * 0.32]) {
      const ring = new THREE.Mesh(ringGeo, st.glow);
      ring.rotation.x = Math.PI / 2;
      ring.scale.set(SOFT_STEM_R + 0.03, SOFT_STEM_R + 0.03, 1);
      ring.position.y = ym + dy;
      col.add(ring);
    }
    // The ears as beads: a squashed sphere inside the ear's solid, in the tint, with a light dot.
    for (const side of [-1, 1]) {
      const box = new THREE.Box3();
      for (const [x, y, z] of pillarEar(stretch, side)) box.expandByPoint(new THREE.Vector3(x, y, z));
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), sm.tint);
      ear.scale.set(size.x + 2 * PILLAR_EAR.r, size.y + 2 * PILLAR_EAR.r, size.z + 2 * PILLAR_EAR.r);
      ear.position.copy(c);
      ear.castShadow = ear.receiveShadow = true;
      col.add(ear);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), st.glow);
      dot.position.set(c.x + side * (size.x / 2 + PILLAR_EAR.r - 0.03), c.y, 0);
      col.add(dot);
    }
    void ball;
  }
}

// Arch: each frame is one white extrusion of gateStrip, bevelled like a support's pillar. Each leg
// wears a support's trim, its slot facing the platform, and each beam a row of circuit-board
// panels front and back.
// The soft arch: one round tube along the middle of the strip, as thick as fits in it.
function archTube(strip: [[number, number], [number, number]][]): THREE.BufferGeometry {
  const pts = strip.map(([o, i]) => new THREE.Vector3((o[0] + i[0]) / 2, (o[1] + i[1]) / 2, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.1), 96, SOFT_STEM_R, 20, false);
}
function buildArch(g: THREE.Group, p: Gate): void {
  const st = STRUCT!, b = GATE_ROUND, W = SUPPORT_W, D = SUPPORT_D;
  const strip = gateStrip(p, b), shape = new THREE.Shape();
  shape.setFromPoints([...strip.map(([o]) => o), ...strip.map(([, i]) => i).reverse()].map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 });
  geo.translate(0, 0, -(W - 2 * b) / 2);
  const xi = p.w / 2 + GATE_GAP;
  // Circuit-board panels along each beam's straight, front and back, like a barrier's.
  const cx = xi - GATE_CORNER, gap = 0.25, n = Math.max(1, Math.round(cx)), pw = (2 * cx - gap * (n + 1)) / n, panel = new THREE.BoxGeometry(pw, D * 0.6, 0.08);
  for (const z of gateFrames(p)) {
    const arch = new THREE.Group();
    arch.position.z = z;
    const body = new THREE.Mesh(ENV.props === "soft" ? archTube(strip) : geo, st.body);
    body.castShadow = body.receiveShadow = true;
    arch.add(body);
    if (ruin()) {
      for (const side of [1, -1]) {
        const col = new THREE.Group();
        col.position.x = side * (xi + D / 2);
        col.rotation.y = (side * Math.PI) / 2;
        steelEars(col, pillarStretches(-PLATFORM_THICKNESS / 2 + D / 2 + GATE_BEND_R, gateLegTop(p)));
        arch.add(col);
      }
      g.add(arch);
      continue;
    }
    for (const side of [1, -1]) {
      const col = new THREE.Group();
      col.position.x = side * (xi + D / 2);
      col.rotation.y = (side * Math.PI) / 2;
      supportTrim(col, gateLegTop(p), GATE_BEND_R);
      arch.add(col);
    }
    if (ENV.props === "soft") {
      // A row of round dots along each beam, front and back, alternating the light and tint colours.
      const nd = Math.max(2, Math.round(2 * cx / 0.6)), dot = new THREE.CircleGeometry(0.11, 20);
      for (const s of [1, -1]) for (let k = 0; k < nd; k++) {
        const m = new THREE.Mesh(dot, k % 2 ? softMats().tint : st.glow);
        m.position.set(-cx + (k + 0.5) * (2 * cx / nd), p.h - D / 2, s * (W / 2 + PAINT * 0.6));
        if (s < 0) m.rotation.y = Math.PI;
        arch.add(m);
      }
    } else for (const s of [1, -1]) for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(panel, [SLATE, SLATE, SLATE, SLATE, st.barrierPanel, st.barrierPanel]);
      m.position.set(-cx + gap + pw / 2 + k * (pw + gap), p.h - D / 2, s * (W / 2 - 0.04 + PAINT));
      arch.add(m);
    }
    g.add(arch);
  }
}

// Lamp posts and signal masts: every part pieceCapsules lists, drawn as it collides, in one steel mesh;
// the lit parts glow on their own. A lamp's bulb sits under its hood (a box from pieceBoxes); a mast's
// beacon blinks.
let LIT: { lamp: THREE.MeshBasicMaterial; beacon: THREE.MeshBasicMaterial } | null = null;
const litMats = () => (LIT ??= {
  lamp: new THREE.MeshBasicMaterial({ color: RUIN.lamp }),
  beacon: (() => {
    const m = new THREE.MeshBasicMaterial({ color: RUIN.beacon });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.time = PORTAL_TIME;
      shader.fragmentShader = "uniform float time;\n" + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= 0.35 + 0.65 * step(0.55, fract(time * 0.8));");
    };
    m.customProgramCacheKey = () => "beacon-blink";
    return m;
  })(),
});
function capsuleGeometry(c: Capsule): THREE.BufferGeometry {
  const A = new THREE.Vector3(...c.a), d = new THREE.Vector3(...c.b).sub(A), len = d.length(), r1 = c.end ?? c.r;
  const geo = len < 1e-6 ? new THREE.SphereGeometry(c.r, 12, 8) : c.end === undefined ? new THREE.CapsuleGeometry(c.r, len, 4, 10) : new THREE.CylinderGeometry(r1, c.r, len, 10);
  if (len >= 1e-6) geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return geo.translate((c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2, (c.a[2] + c.b[2]) / 2);
}
function buildFrame(g: THREE.Group, p: Piece & { type: "lamp" | "mast" }): void {
  const parts = pieceCapsules(p), steelParts = parts.filter((c) => !c.lit).map((c) => capsuleGeometry(c).toNonIndexed());
  for (const geo of steelParts) geo.deleteAttribute("uv");
  g.add(steel(mergeGeometries(steelParts)!));
  for (const c of parts.filter((c) => c.lit)) g.add(new THREE.Mesh(capsuleGeometry(c), litMats().beacon));
  if (p.type === "lamp") {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.55, 1), litMats().lamp);
    bulb.position.set(LAMP.reach - 0.04, p.h + LAMP.rise + 0.05 - LAMP.hood.h, 0);
    bulb.userData.noShadow = true;
    g.add(bulb);
  }
}

// The pushable cube, `C` a side and centred on its body: a slate
// rounded box wearing the ribbed octagon face on every side (the top face its white, solid-bordered
// one on a plate over it), and on every face a pale rim with an orange lit line just inside it.
function buildCube(g: THREE.Group, C: number): void {
  if (ruin()) { const r = propRound(C, C, C); g.add(steel(new RoundedBoxGeometry(C, C, C, 3, r)), paintBand(C, C, r, 0, C * 0.22, ruinPaint().move)); return; }
  const st = STRUCT!;
  const body = new THREE.Mesh(new RoundedBoxGeometry(C, C, C, 3, propRound(C, C, C)), st.cubeFace);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const rim = rimFrame(C * 0.9, C * 0.9, C * 0.05, PAINT), lit = rimFrame(C * 0.8, C * 0.8, C * 0.02, PAINT);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(C * 0.8, C * 0.8), st.cubeTop);
  top.position.z = C / 2 + PAINT;
  const faces: [x: number, y: number][] = [[0, 0], [0, Math.PI / 2], [0, Math.PI], [0, -Math.PI / 2], [Math.PI / 2, 0], [-Math.PI / 2, 0]];
  for (const [rx, ry] of faces) {
    const f = new THREE.Group();
    f.rotation.set(rx, ry, 0, "YXZ");
    for (const [geo, mat] of [[rim, PALE], [lit, st.plankGlow]] as const) {
      const m = new THREE.Mesh(geo, mat);
      m.position.z = C / 2;
      f.add(m);
    }
    if (rx < 0) f.add(top);
    g.add(f);
  }
}

const SLIDE_TREAD = new THREE.MeshStandardMaterial({ color: KICKER.slideTread, roughness: 0.6, metalness: 0.15 });
const KICKER_LIGHT = new THREE.MeshStandardMaterial({ color: KICKER.light, emissive: KICKER.glow, emissiveIntensity: 0.6 * ENV.glow, roughness: 0.45 });

// Kicker: a white wedge with a dark tread inset on its slope, pale slats across the tread and an
// yellow light strip along each side of it; a deck past the high edge carries the same tread, flat.
// A sliding kicker's strips are orange like the stool's, with < > chevrons at the foot of its slope;
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
  const stripMat = sliding ? st.plankGlow : KICKER_LIGHT;
  // The rounded solid: the hull of a small sphere at each pulled-in corner.
  const soft = ENV.props === "soft";
  // Soft: the same wedge drawn with fatter rounding (kickerHull insets it, so it stays inside the solid).
  const hull = kickerHull(p, soft ? Math.min(0.2, p.h * 0.28, p.w * 0.28, D * 0.28) : undefined), ball = new THREE.SphereGeometry(hull.r, 16, 8).getAttribute("position");
  // The buried toe (the first corner pair) is drawn sharp: a fat round there pokes above the surface as a lip.
  const toe = D / 2 + (KICKER_SINK * p.d) / p.h, [ta, tb] = kickerSpan(p, 0);
  const pts: THREE.Vector3[] = [new THREE.Vector3(ta, -KICKER_SINK, toe), new THREE.Vector3(tb, -KICKER_SINK, toe)];
  for (const [x, y, z] of hull.corners.slice(2)) for (let i = 0; i < ball.count; i++) pts.push(new THREE.Vector3(x + ball.getX(i), y + ball.getY(i), z + ball.getZ(i)));
  const body = new THREE.Mesh(new ConvexGeometry(pts), soft ? softMats().tint : st.body);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  if (ruin()) {
    body.material = st.body;
    const along = Math.hypot(p.d, p.h), slope = new THREE.Group(), [a, b] = kickerSpan(p, 0.5), m = Math.min(0.35, (b - a) * 0.15);
    slope.position.set(0, p.h / 2, f / 2);
    slope.rotation.x = Math.atan2(p.h, p.d);
    for (const x of sliding ? [a + m + 0.1, b - m - 0.1] : []) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.001, along * 0.8), ruinPaint().move);
      stripe.position.set(x, LAYER, 0);
      slope.add(stripe);
    }
    g.add(slope);
    paint(slope, "y");
    return sliding ? g : undefined;
  }
  // A tread `len` long down a group's local z. Stacked within PAINT so paint() keeps the dark
  // plate in view: plate, then stripes, then strips. `at(z)` is the height fraction (see kickerSpan)
  // of the slope at tread z, so on a side kicker it narrows with the solid. The yellow strips run the
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
    const plate = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8).rotateX(-Math.PI / 2), soft ? stripMat : sliding ? SLIDE_TREAD : st.tread);
    plate.position.y = LAYER;
    t.add(plate);
    if (soft) {
      // The tongue: the coloured plate alone, with a row of round white dots down its middle.
      const n = Math.max(2, Math.round(pl / 0.5));
      for (let i = 0; i < n; i++) {
        const z = -pl / 2 + (i + 0.5) * (pl / n), [a, b] = edge(z, M + 0.05);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.1, (b - a) * 0.15), 20).rotateX(-Math.PI / 2), st.body);
        dot.position.set((a + b) / 2, 2 * LAYER, z);
        t.add(dot);
      }
      return t;
    }
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
  if (bb - ba > 0.6 && !soft) {
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
  const body = new THREE.Mesh(roundedBox(w, h, PLANK_T, PLANK_T / 2 - 0.01), ruin() ? st.body : st.plank);
  body.castShadow = body.receiveShadow = true;
  panel.add(body);
  if (ruin()) for (const y of [h / 2 - 0.25, -h / 2 + 0.3]) panel.add(paintBand(w, PLANK_T, PLANK_T / 2 - 0.01, y, 0.2, ruinPaint().move));
  else {
    const rim = rimFrame(w - 0.3, h - 0.3, 0.1, PAINT);
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(rim, st.plankGlow);
      m.position.z = side * PLANK_T / 2;
      if (side < 0) m.rotation.y = Math.PI;
      panel.add(m);
    }
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(PLANK_T / 2, PLANK_T / 2, w + 2 * PLANK_BARREL, 16), st.body);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.y = -h / 2;
  barrel.castShadow = true;
  panel.add(barrel);
  g.add(panel);
  // The mounts: white rounded blocks, an orange band round a wall bracket near its top and bottom,
  // round a yoke near its top. The bands stand 0.004 proud, a painted line rather than a ledge.
  for (const m of plankMounts(p)) {
    const block = new THREE.Mesh(new RoundedBoxGeometry(m.w, m.h, m.d, 2, PLANK_MOUNT_R), st.body);
    block.position.set(m.x, m.y, m.z);
    block.castShadow = block.receiveShadow = true;
    g.add(block);
    if (ruin()) continue;
    for (const dy of p.side || p.base ? [m.h / 2 - 0.08, -(m.h / 2 - 0.08)] : [m.h / 2 - 0.06]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(m.w + 0.008, 0.04, m.d + 0.008), st.plankGlow);
      band.position.set(m.x, m.y + dy, m.z);
      g.add(band);
    }
  }
  return panel;
}

// Board: the seesaw's tiled board with its orange rim on both faces, loose, PLANK_T thick. The group is
// centred on the physics body and returned for the physics to pose.
function buildBoard(g: THREE.Group, p: Piece & { type: "board" }): THREE.Group {
  const st = STRUCT!, board = new THREE.Group();
  board.position.y = boardLift(p);
  board.rotation.order = "YXZ"; // roll about its own z, then tilt about its own x
  board.rotation.set((p.tilt * Math.PI) / 180, 0, ((p.roll ?? 0) * Math.PI) / 180);
  const body = new THREE.Mesh(roundedBox(p.w, PLANK_T, p.d, PLANK_T / 2 - 0.01), ruin() ? st.body : st.plank);
  body.castShadow = body.receiveShadow = true;
  board.add(body);
  if (ruin()) for (const s of [-1, 1]) board.add(steel(new THREE.BoxGeometry(p.w + 0.012, PLANK_T + 0.012, 0.25).translate(0, 0, s * (p.d / 2 - 0.35)), ruinPaint().move));
  else {
    const rim = rimFrame(p.w - 0.2, p.d - 0.2, 0.1, PAINT);
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(rim, st.plankGlow);
      m.rotation.x = -side * Math.PI / 2;
      m.position.y = side * PLANK_T / 2;
      board.add(m);
    }
  }
  g.add(board);
  return board;
}

// Seesaw: a tiled board with an orange rim on both faces, on an
// axle between two rounded white posts that carry a dark slotted face and a lit cap. The board
// group is centred on the physics body and returned for the physics to pose; the posts stay.
function buildSeesaw(g: THREE.Group, p: Piece & { type: "seesaw" }, editor: boolean): THREE.Group {
  const st = STRUCT!, W = p.w, D = p.d, T = SEESAW_T, H = seesawPivot(p);
  const board = new THREE.Group();
  board.position.y = H;
  board.rotation.x = (seesawTilt(p) * Math.PI) / 180;
  const body = new THREE.Mesh(roundedBox(W, T, D, T / 2 - 0.01), ruin() ? st.body : st.plank);
  body.castShadow = body.receiveShadow = true;
  board.add(body);
  if (ruin()) for (const s of [-1, 1]) board.add(steel(new THREE.BoxGeometry(W + 0.012, T + 0.012, 0.3).translate(0, 0, s * (D / 2 - 0.4)), ruinPaint().move));
  else {
    const rim = rimFrame(W - 0.2, D - 0.2, 0.1, PAINT);
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(rim, st.plankGlow);
      m.rotation.x = -side * Math.PI / 2;
      m.position.y = side * T / 2;
      board.add(m);
    }
  }
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
    if (ruin()) { g.add(post); continue; }
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
  // Editor only: a one-way seesaw's dipping end, marked by an arrow pointing down over it.
  if (editor && p.dips) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 12).rotateX(Math.PI), START_MAT);
    arrow.position.set(0, H + 1.2, ((p.dips === "+z" ? 1 : -1) * D) / 2 - 0.6);
    g.add(arrow);
  }
  return board;
}

// The pipe's plating and windows, drawn in its shader from vPipe = (distance along, distance round from
// the top, length): a seam round it every PIPE_PLATE with rivets beside it, and a small framed window on top
// every PIPE_WINDOW, none within a unit of a mouth.
const PIPE_PLATE = 2, PIPE_WINDOW = 4, PIPE_CIRC = 2 * Math.PI * TUBE_R;
const PIPE_GLSL = `varying vec3 vPipe;
float pipeArc() { float a = vPipe.y; return a > ${(PIPE_CIRC / 2).toFixed(4)} ? a - ${PIPE_CIRC.toFixed(4)} : a; }
float pipeWindow() {
  float c = (floor(vPipe.x / ${PIPE_WINDOW.toFixed(1)}) + 0.5) * ${PIPE_WINDOW.toFixed(1)};
  if (c < 1.0 || c > vPipe.z - 1.0) return 1e3;
  vec2 q = abs(vec2(vPipe.x - c, pipeArc())) - vec2(0.4 - 0.15, 0.3 - 0.15);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.15;
}
`;
function pipeShader(m: THREE.Material, body: (shader: { fragmentShader: string }) => void, key: string): void {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = "attribute vec3 pipe;\nvarying vec3 vPipe;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vPipe = pipe;");
    shader.fragmentShader = PIPE_GLSL + shader.fragmentShader;
    body(shader);
  };
  m.customProgramCacheKey = () => key;
}
let PIPE_MATS: { steel: THREE.MeshStandardMaterial; glass: THREE.MeshPhysicalMaterial } | null = null;
function pipeMats() {
  if (PIPE_MATS) return PIPE_MATS;
  const steel = new THREE.MeshStandardMaterial({ map: METAL!.map, roughness: 0.75, metalness: 0.15, side: THREE.DoubleSide });
  pipeShader(steel, (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (pipeWindow() < 0.0) discard;").replace("#include <map_fragment>", `#include <map_fragment>
      float w = pipeWindow(), ds = abs(fract(vPipe.x / ${PIPE_PLATE.toFixed(1)}) - 0.5) * ${PIPE_PLATE.toFixed(1)};
      float step8 = ${(PIPE_CIRC / 8).toFixed(4)}, da = (fract(vPipe.y / step8) - 0.5) * step8;
      if (w < 0.07 || ds < 0.035) diffuseColor.rgb = ${glslColor(RUIN.seam)};
      else if (length(vec2(abs(ds - 0.12), da)) < 0.04) diffuseColor.rgb = ${glslColor(RUIN.rivet)};`);
  }, "pipe-steel");
  const glass = new THREE.MeshPhysicalMaterial({ color: TUBE.glass, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.1 });
  pipeShader(glass, (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\n  if (pipeWindow() >= 0.0) discard;");
  }, "pipe-glass");
  return (PIPE_MATS = { steel, glass });
}

// Pipe (the "tube" piece): a rust-steel skin with small glass windows (the physics keeps a solid wall behind
// it) and a ring of rail round each mouth. A one-way pipe's exit-only mouth is painted red like the puffer's
// collar: its ring, and a red band round the pipe just inside it.
function buildTube(g: THREE.Group, p: Tube) {
  const rings = tubeRings(p);
  if (rings.length < 2) return;
  // One skin, the bore the ball rolls in, on the physics' own facets.
  const skin = sweepTube(rings, TUBE_R, false, TUBE_SKIN_SIDES), welded = new THREE.BufferGeometry();
  welded.setAttribute("position", new THREE.Float32BufferAttribute(skin.positions, 3));
  welded.setIndex(skin.indices);
  welded.computeVertexNormals();
  // Unwelded down one side, normals kept, so the distance round the pipe doesn't wrap mid-face.
  const S = TUBE_SKIN_SIDES, P = welded.getAttribute("position"), N = welded.getAttribute("normal");
  const along = [0];
  for (let i = 1; i < rings.length; i++) { const a = rings[i - 1]!.c, b = rings[i]!.c; along.push(along[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  const L = along[along.length - 1]!, [du, dv] = rustShift(new THREE.Vector3(p.x, p.y, p.z));
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], pipe: number[] = [], idx: number[] = [];
  rings.forEach((_, i) => {
    for (let j = 0; j <= S; j++) {
      const k = i * S + (j % S), arc = (j / S) * PIPE_CIRC;
      pos.push(P.getX(k), P.getY(k), P.getZ(k));
      nor.push(N.getX(k), N.getY(k), N.getZ(k));
      // One whole rust tile round, so the texture meets itself at the top.
      uv.push(along[i]! + du, (j / S) * METAL_TILE + dv);
      pipe.push(along[i]!, arc, L);
    }
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * (S + 1) + j, b = a + 1, c = a + S + 1, e = b + S + 1;
      idx.push(a, b, c, b, e, c);
    }
  }
  welded.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("pipe", new THREE.Float32BufferAttribute(pipe, 3));
  geo.setIndex(idx);
  const mats = pipeMats();
  g.add(new THREE.Mesh(geo, mats.steel));
  const glass = new THREE.Mesh(geo, mats.glass);
  glass.renderOrder = 1;
  glass.userData.noShadow = true;
  g.add(glass);
  const exit = exitMouth(p, rings);
  for (const m of mouthRings(rings)) g.add(railRing(m.c, m.d, exit && m.c === exit.c ? ruinPaint().hazard : undefined));
  if (exit) {
    // A closed band (a lathed rectangle) round the pipe's end, inside the mouth's ring.
    const L = 0.45, r0 = TUBE_R + 0.005, r1 = TUBE_R + 0.045, n = new THREE.Vector3(...exit.n);
    const band = new THREE.LatheGeometry([new THREE.Vector2(r0, -L / 2), new THREE.Vector2(r1, -L / 2), new THREE.Vector2(r1, L / 2), new THREE.Vector2(r0, L / 2), new THREE.Vector2(r0, -L / 2)], 40);
    band.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n));
    band.translate(exit.c[0] - n.x * (RING_T + L / 2), exit.c[1] - n.y * (RING_T + L / 2), exit.c[2] - n.z * (RING_T + L / 2));
    g.add(steel(band, ruinPaint().hazard));
  }
}

// A ring of the fences' and rails' own rail round centre c, axis d (a tube mouth's, or a hoop), with
// the rails' light strip round its outside.
function railRing(c: [number, number, number], d: [number, number, number], paint: THREE.Material = RAIL_MAT): THREE.Group {
  const ring = new THREE.Group();
  for (const [R, r, sides, mat] of (ruin() ? [[RING_R, RING_T, RING_SIDES, paint]] : [[RING_R, RING_T, RING_SIDES, paint], [RING_R + RING_T * 0.85, 0.022, 6, STRIPE_MAT]]) as [number, number, number, THREE.Material][]) {
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

// Barrel: a white rounded drum with an orange ring near its foot and its head, and four circuit
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
  if (ruin()) {
    const rib = new THREE.TorusGeometry(r, 0.035, 8, 48).rotateX(Math.PI / 2);
    for (const y of [-h / 6, h / 6]) g.add(steel(rib.clone().translate(0, y, 0), SEAM_MAT));
    g.add(paintRing(r, 0, Math.min(0.25, h * 0.15), ruinPaint().move));
    return;
  }
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
  const body = new THREE.Mesh(beanGeometry(p.r, p.len), ruin() ? STRUCT!.body : mat);
  body.castShadow = body.receiveShadow = true;
  bean.add(body);
  if (ruin()) for (const s of [-1, 1]) bean.add(paintRing(p.r, s * Math.max(0, p.len / 2 - p.r - 0.12), 0.16, ruinPaint().hazard));
  g.add(bean);
  const at = beanAt(p, track, 0);
  posePlank(g, bean, at, at.q);
  return bean;
}

// Pushable crate: one textured cube, placed by the physics body each frame.
function buildCrate(g: THREE.Group, w: number, h: number, d: number) {
  if (ruin()) { const r = crateRound(w, h, d); g.add(steel(new RoundedBoxGeometry(w, h, d, 4, r)), paintBand(w, d, r, 0, Math.min(0.3, h * 0.25), ruinPaint().move)); return; }
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

// Stool: a white block with an orange ring round its base and a circuit board inset in its top. The
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
  const sr = ENV.props === "soft" ? Math.min(w, h, d) * 0.3 : propRound(w, h, d);
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, ENV.props === "soft" ? 6 : 3, sr), st.body);
  body.castShadow = body.receiveShadow = true;
  block.add(body);
  if (ruin()) { block.add(paintBand(w, d, sr, 0, Math.min(0.3, h * 0.25), ruinPaint().move)); g.add(block); return block; }
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

// The jump pad shares the kicker's white (body), dark tread, pale stripes and yellow; the
// hovering squares are unlit and faint, in a soft amber.
const JUMP_HOLO_COLOR = EFFECTS.jumpHolo;
const JUMP_HOLO = new THREE.MeshBasicMaterial({ color: JUMP_HOLO_COLOR, transparent: true, opacity: 0.45, depthWrite: false });
const JUMP_HOLO_FILL = new THREE.MeshBasicMaterial({ color: JUMP_HOLO_COLOR, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
// The squares breathe in and out on x / z, each a little behind the one below, so they ripple upward.
const JUMP_PULSE = { period: 1.6, amp: 0.12, lag: 0.55, taper: 0.07 };

// A `w` by `d` rectangle centred on (x0, y0) with its corners rounded by r, traced into a shape or hole.
function roundRect<T extends THREE.Path>(s: T, w: number, d: number, r: number, x0 = 0, y0 = 0): T {
  const x = w / 2 - r, y = d / 2 - r;
  s.moveTo(x0 + x, y0 - d / 2);
  s.absarc(x0 + x, y0 - y, r, -Math.PI / 2, 0, false);
  s.absarc(x0 + x, y0 + y, r, 0, Math.PI / 2, false);
  s.absarc(x0 - x, y0 + y, r, Math.PI / 2, Math.PI, false);
  s.absarc(x0 - x, y0 - y, r, Math.PI, 1.5 * Math.PI, false);
  return s;
}
// A polygon with every corner rounded off `r` along its edges, traced into a shape or hole.
function roundPoly<T extends THREE.Path>(s: T, pts: [number, number][], r: number): T {
  pts.forEach(([x, y], k) => {
    const [px, py] = pts[(k + pts.length - 1) % pts.length]!, [nx, ny] = pts[(k + 1) % pts.length]!;
    const lp = Math.hypot(px - x, py - y), ln = Math.hypot(nx - x, ny - y);
    if (k === 0) s.moveTo(x + ((px - x) * r) / lp, y + ((py - y) * r) / lp); else s.lineTo(x + ((px - x) * r) / lp, y + ((py - y) * r) / lp);
    s.quadraticCurveTo(x, y, x + ((nx - x) * r) / ln, y + ((ny - y) * r) / ln);
  });
  s.closePath();
  return s;
}
const flatShape = (s: THREE.Shape): THREE.BufferGeometry => new THREE.ShapeGeometry(s, 8).rotateX(-Math.PI / 2);
const ventRound = (w: number, d: number): number => Math.min(0.35, 0.3 * Math.min(w, d));

// A kicker's tread lying flat: a dark plate with well-rounded corners, striped across in thick
// light and dark bands, each band kept inside the corners.
function vent(w: number, d: number): THREE.Group {
  const g = new THREE.Group(), st = STRUCT!, r = ventRound(w, d);
  const base = new THREE.Mesh(flatShape(roundRect(new THREE.Shape(), w, d, r)), st.tread);
  base.position.y = LAYER;
  g.add(base);
  const sl = d - 0.1, n = Math.max(3, Math.round(sl / 0.22)), pitch = sl / n;
  for (let k = 0; k < n; k++) {
    const z = -sl / 2 + (k + 0.5) * pitch, end = d / 2 - Math.abs(z) - pitch / 4;
    const round = end < r ? r - Math.sqrt(Math.max(0, r * r - (r - end) ** 2)) : 0, len = w - 0.1 - 2 * round;
    if (len < 0.05) continue;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len, 0.001, pitch / 2), PALE);
    stripe.position.set(0, 2 * LAYER, z);
    g.add(stripe);
  }
  return g;
}

// The launch square's grille: the vent's dark plate, dotted in a grid of pale dots kept inside the corners.
function dotGrille(w: number): THREE.Group {
  const g = new THREE.Group(), r = ventRound(w, w);
  const base = new THREE.Mesh(flatShape(roundRect(new THREE.Shape(), w, w, r)), STRUCT!.tread);
  base.position.y = LAYER;
  g.add(base);
  const n = Math.max(3, Math.round((w - 0.12) / 0.15)), pitch = (w - 0.12) / n, dr = pitch * 0.28, inner = w / 2 - r, dots: THREE.Shape[] = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
    const x = (i + 0.5 - n / 2) * pitch, y = (k + 0.5 - n / 2) * pitch;
    if (Math.hypot(Math.max(0, Math.abs(x) - inner), Math.max(0, Math.abs(y) - inner)) > r - 0.06 - dr) continue;
    dots.push(new THREE.Shape().absarc(x, y, dr, 0, 2 * Math.PI, false));
  }
  const dot = new THREE.Mesh(new THREE.ShapeGeometry(dots, 4).rotateX(-Math.PI / 2), PALE);
  dot.position.y = 2 * LAYER;
  g.add(dot);
  return g;
}

// Paint wrapped onto a jump pad's rounded corner, a cone round (cx, cz) whose top radius is rt.
// Shape x runs across the corner, as arc length at the middle of the slope and fanning out with the
// radius; shape y runs down the slope from its middle. `facing` is the corner's direction (radians
// from +x toward +z). Each triangle is split small so the paint follows the curve.
function cornerDecal(shape: THREE.Shape, mat: THREE.Material, cx: number, cz: number, facing: number, rt: number, lift: number): THREE.Mesh {
  const a = Math.atan2(JUMP_H, JUMP_RUN), L = Math.hypot(JUMP_H, JUMP_RUN), rm = rt + JUMP_RUN / 2;
  const flat = new THREE.ShapeGeometry(shape, 8), src = flat.getAttribute("position"), idx = flat.getIndex()!, pos: number[] = [], nor: number[] = [];
  const put = (x: number, y: number) => {
    const th = facing + x / rm, d = L / 2 + y, rho = rt + d * Math.cos(a);
    const nx = Math.cos(th) * Math.sin(a), ny = Math.cos(a), nz = Math.sin(th) * Math.sin(a);
    pos.push(cx + rho * Math.cos(th) + nx * lift, JUMP_H - d * Math.sin(a) + ny * lift, cz + rho * Math.sin(th) + nz * lift);
    nor.push(nx, ny, nz);
  };
  for (let i = 0; i < idx.count; i += 3) {
    const [v0, v1, v2] = [0, 1, 2].map((j) => new THREE.Vector2(src.getX(idx.getX(i + j)), src.getY(idx.getX(i + j)))) as [THREE.Vector2, THREE.Vector2, THREE.Vector2];
    const n = Math.max(1, Math.ceil(Math.max(v0.distanceTo(v1), v1.distanceTo(v2), v2.distanceTo(v0)) / 0.04));
    const at = (u: number, w: number) => put(v0.x + ((v1.x - v0.x) * u + (v2.x - v0.x) * w) / n, v0.y + ((v1.y - v0.y) * u + (v2.y - v0.y) * w) / n);
    for (let u = 0; u < n; u++) for (let w = 0; w < n - u; w++) {
      at(u, w); at(u + 1, w); at(u, w + 1);
      if (w < n - u - 1) { at(u + 1, w); at(u + 1, w + 1); at(u, w + 1); }
    }
  }
  flat.dispose();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return new THREE.Mesh(geo, mat);
}

// How far a jump pad's spring is stretched (0 at rest, `peak` times its rest height at full), `t` seconds
// after it launched something: it shoots up after what it threw, then bounces back and settles.
const SPRING = { peak: 3, attack: 0.07, decay: 0.16, period: 0.3, settle: 1.2 };
function springStretch(t: number): number {
  if (!(t >= 0) || t >= SPRING.settle) return 0;
  if (t < SPRING.attack) { const k = t / SPRING.attack; return SPRING.peak * (1 - (1 - k) * (1 - k)); }
  const u = t - SPRING.attack;
  return Math.max(-0.6, SPRING.peak * Math.exp(-u / SPRING.decay) * Math.cos((2 * Math.PI * u) / SPRING.period));
}

// Jump pad: a low white platform with a grey ramp all round up to its flat top, the launch square
// in the middle of the top, a dark grille with a yellow rim, under three hovering amber squares.
// The body is jumpHull rounded like the kicker's, and is its collider too.
function buildJump(g: THREE.Group, p: Piece & { type: "jump" }) {
  const st = STRUCT!, H = JUMP_H;
  const tw = p.w - 2 * JUMP_RUN, td = p.d - 2 * JUMP_RUN, s = jumpPadSize(p), rt = jumpCorner(p) - JUMP_RUN;
  const soft = ENV.props === "soft";
  const hull = jumpHull(p, soft ? 0.15 : undefined), ball = new THREE.SphereGeometry(hull.r, 12, 6).getAttribute("position");
  const pts: THREE.Vector3[] = [];
  for (const [x, y, z] of hull.corners) for (let i = 0; i < ball.count; i++) pts.push(new THREE.Vector3(x + ball.getX(i), y + ball.getY(i), z + ball.getZ(i)));
  const body = new THREE.Mesh(new ConvexGeometry(pts), soft ? softMats().tint : st.body);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const deck = new THREE.Group();
  deck.position.y = H;
  g.add(deck);
  // The rings (or hovering squares) are its spring, posed by the game from the pad's last launch.
  const rungs: THREE.Object3D[] = [];
  g.userData.spring = (t: number) => {
    const e = springStretch(t);
    rungs.forEach((r, k) => { r.position.y = ((k + 1) * JUMP_REACH * (1 + e)) / 3; });
  };
  if (ruin()) {
    body.material = st.body;
    const ringGeo = new THREE.TorusGeometry(s * 0.62, 0.05, 10, 48).rotateX(Math.PI / 2);
    for (let k = 1; k <= 3; k++) {
      const ring = new THREE.Mesh(ringGeo, PALE);
      ring.position.y = (k * JUMP_REACH) / 3;
      deck.add(ring);
      rungs.push(ring);
    }
    return;
  }
  if (soft) {
    // The launch button under its three light rings.
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), KICKER_LIGHT);
    button.position.y = 0.02;
    deck.add(button);
    const ringGeo = new THREE.TorusGeometry(s * 0.62, 0.05, 10, 48).rotateX(Math.PI / 2);
    for (let k = 1; k <= 3; k++) {
      const ring = new THREE.Mesh(ringGeo, st.glow);
      ring.position.y = (k * JUMP_REACH) / 3;
      deck.add(ring);
      rungs.push(ring);
    }
    return;
  }
  // Launch square: a light frame, the dark grille, a yellow rim, all painted on the top, their
  // corners rounded alike.
  const square = new THREE.Group(), rs = ventRound(s, s);
  deck.add(square);
  const frame = new THREE.Mesh(flatShape(roundRect(new THREE.Shape(), s + 0.3, s + 0.3, rs + 0.15)), st.body);
  frame.position.y = LAYER / 2;
  square.add(frame);
  square.add(dotGrille(s));
  const rimShape = roundRect(new THREE.Shape(), s + 0.05, s + 0.05, rs + 0.025);
  rimShape.holes.push(roundRect(new THREE.Path(), s - 0.05, s - 0.05, rs - 0.025));
  const rim = new THREE.Mesh(flatShape(rimShape), KICKER_LIGHT);
  rim.position.y = 3 * LAYER;
  square.add(rim);
  paint(square, "y");
  // Three hovering squares, the jump's sign: amber rounded frames with a faint fill, pulsing.
  const bar = 0.06, ring = roundRect(new THREE.Shape(), s + bar, s + bar, rs + bar / 2);
  ring.holes.push(roundRect(new THREE.Path(), s - bar, s - bar, rs - bar / 2));
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: bar, bevelEnabled: false, curveSegments: 8 }).rotateX(-Math.PI / 2).translate(0, -bar / 2, 0);
  const fillGeo = flatShape(roundRect(new THREE.Shape(), s - bar, s - bar, rs - bar / 2));
  for (let k = 1; k <= 3; k++) {
    const sq = new THREE.Group();
    sq.position.y = (k * JUMP_REACH) / 3;
    sq.add(new THREE.Mesh(ringGeo, JUMP_HOLO));
    const fill = new THREE.Mesh(fillGeo, JUMP_HOLO_FILL);
    fill.onBeforeRender = () => {
      const t = performance.now() / 1000, { period, amp, lag, taper } = JUMP_PULSE;
      const k1 = 1 - taper * (k - 1) + amp * Math.sin((2 * Math.PI * t) / period - lag * (k - 1));
      sq.scale.set(k1, 1, k1);
    };
    sq.add(fill);
    deck.add(sq);
    rungs.push(sq);
  }
  // The four ramp faces are alike: each gets a vent over most of its straight part, its group
  // tilted to the slope with local +z pointing out and down it.
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
  // Each corner: a light grey panel holding a white triangle outlined in dark grey, pointing up
  // the slope, and a yellow arc near the foot. Shape y runs down the slope (see cornerDecal).
  // The fill is the outline's triangle shrunk about its incentre, so the dark border is even.
  const t0 = -0.06, tb = 0.2, th = 0.31, e = 0.045, yb = t0 + 0.14, inc = (tb * th) / (tb + Math.hypot(tb, th)), k = (inc - e) / inc;
  const tri = (q: number): [number, number][] => ([[0, yb - th], [tb, yb], [-tb, yb]] as [number, number][]).map(([x, y]) => [x * q, yb - inc + (y - yb + inc) * q]);
  const shapes: [THREE.Shape, THREE.Material, number][] = [
    [roundRect(new THREE.Shape(), 0.6, 0.46, 0.1, 0, t0), PALE, PAINT],
    [roundPoly(new THREE.Shape(), tri(1), 0.05), st.tread, PAINT + LAYER],
    [roundPoly(new THREE.Shape(), tri(k), 0.03), st.body, PAINT + 2 * LAYER],
    [roundRect(new THREE.Shape(), 0.64, 0.08, 0.04, 0, 0.29), KICKER_LIGHT, PAINT],
  ];
  for (const [sx, sz] of [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const) {
    for (const [shape, mat, lift] of shapes) g.add(cornerDecal(shape, mat, sx * (tw / 2 - rt), sz * (td / 2 - rt), Math.atan2(sz, sx), rt, lift));
  }
}

// Shared clock for the wormhole's swirl and motes, advanced by the scene's tick.
const PORTAL_TIME = { value: 0 };
// The origin's wormhole. Closed (`open` 0) it is a steel iris of six blades turning in to the middle;
// opening, the portal grows from the middle out to the rim: a black event horizon ringed by a thin
// white photon ring, inside an accretion disc whose spiral arms wind inward, hot lemon near the hole
// cooling to blue at the rim.
const WORMHOLE_MAT = new THREE.ShaderMaterial({
  fog: false,
  uniforms: { time: PORTAL_TIME, open: { value: 0 }, hot: { value: new THREE.Color(PROPS.cyan) }, cool: { value: new THREE.Color(GOAL.disc) }, steel: { value: new THREE.Color(RUIN.paint) }, seam: { value: new THREE.Color(RUIN.seam) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float time, open; uniform vec3 hot, cool, steel, seam; varying vec2 vUv;
    void main(){
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p), a = atan(p.y, p.x);
      float blade = fract(a / 6.2832 * 6.0 + r * 0.8 + open * 0.4);
      vec3 col = mix(seam, steel, smoothstep(0.0, 0.06, blade) * (1.0 - smoothstep(0.86, 0.94, blade))) * (0.75 + 0.25 * r);
      float q = r / max(open, 0.001), hole = 0.34;
      if (q < 1.0) {
        float arms = 0.5 + 0.5 * sin(3.0 * a - 9.0 * log(max(q, 0.01)) - time * 2.6);
        float fine = 0.5 + 0.5 * sin(7.0 * a - 16.0 * log(max(q, 0.01)) - time * 4.1 + 1.3);
        float heat = exp(-max(q - hole, 0.0) * 3.2);
        vec3 c = mix(cool * 0.25, mix(cool * 1.3, hot, heat), 0.15 + 0.85 * pow(arms, 2.0) * (0.55 + 0.45 * fine));
        c *= 0.4 + 1.2 * heat + 0.2 * (1.0 - smoothstep(0.85, 1.0, q));
        c = mix(c, vec3(1.0), exp(-pow((q - hole) / 0.025, 2.0)));
        col = mix(vec3(0.015, 0.02, 0.05), c, smoothstep(hole - 0.03, hole + 0.005, q));
        col = mix(col, seam * 0.5, smoothstep(0.92, 1.0, q));
      }
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }`,
});
// Motes: sparks that drift in from past the rim, circling ever faster as they fall into the hole.
const MOTES = 28;
const MOTE_MAT = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  uniforms: { time: PORTAL_TIME, tint: { value: new THREE.Color(PROPS.cyan) } },
  vertexShader: `attribute float seed; uniform float time; varying float vFade;
    void main(){
      float life = fract(time * (0.18 + 0.1 * fract(seed * 7.3)) + seed);
      float r = mix(1.35, 0.34, pow(life, 0.8));
      float a = seed * 6.2832 + 2.2 / (r + 0.15) - time * 0.4;
      vec3 pos = vec3(cos(a) * r, 0.12 + 0.55 * (1.0 - life) * fract(seed * 3.7), sin(a) * r);
      vFade = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.7, 1.0, life));
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = 9.0 * (0.5 + 0.5 * (1.0 - life)) * projectionMatrix[1][1] * 4.0 / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform vec3 tint; varying float vFade;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = vFade * smoothstep(0.5, 0.1, d);
      gl_FragColor = vec4(mix(tint, vec3(1.0), 0.5) * a, a);
      #include <colorspace_fragment>
    }`,
});

function buildPillar(g: THREE.Group): void {
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
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + RG.r, R + RG.r, RG.h, 64), ruin() ? SEAM_MAT : st.glow);
  ring.position.y = RG.h / 2;
  g.add(body, collar, dome, ring);
}

// The soft look's plain tint for its rounder kicker and jump pad bodies.
let SOFT: { tint: THREE.MeshStandardMaterial; glaze: THREE.MeshStandardMaterial; eyes: THREE.MeshStandardMaterial } | null = null;
function softMats() {
  SOFT ??= {
    tint: new THREE.MeshStandardMaterial({ color: PILLAR.pale, roughness: ENV.bodyRoughness }),
    glaze: new THREE.MeshStandardMaterial({ color: BUMPER.rubber, roughness: 0.35 }),
    eyes: new THREE.MeshStandardMaterial({ color: PLATFORM.block, roughness: 0.5 }),
  };
  return SOFT;
}

// Sinks details built on a face (the group's local `axis` pointing out of it, 0 on the face) until
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
const SPINNER_MAT = new THREE.MeshStandardMaterial({ color: KICKER.light, flatShading: true, roughness: 0.6 });
const START_MAT = new THREE.MeshBasicMaterial({ color: 0xffd23f, wireframe: true });

// The sky dome lives on this layer: the main camera skips it and sees the low-res sky
// buffer as the background instead; the ball's cube camera draws it directly.
export const SKY_LAYER = 1;
// Cel clouds have crisp edges, so they get a finer buffer than the soft ones need.
const SKY_SCALE = ENV.toon ? 1 / 2 : 1 / 3;

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
// Shadow look, patched into three's shaders (docs/platforms.md "Shadows"): a fixed 4x4 PCF instead of
// three's per-pixel noisy one, and no shadow test on faces turned from the sun.
function patchChunk(name: "shadowmap_pars_fragment" | "lights_fragment_begin", from: RegExp, to: string) {
  const src = THREE.ShaderChunk[name];
  if (!from.test(src)) throw new Error(`three's ${name} changed; redo the shadow patch`);
  THREE.ShaderChunk[name] = src.replace(from, to);
}
patchChunk("shadowmap_pars_fragment", /float phi = interleavedGradientNoise[\s\S]*?\) \* 0\.2;/,
  `shadow = 0.0;
				for ( int sy = 0; sy < 4; sy ++ ) for ( int sx = 0; sx < 4; sx ++ ) {
					shadow += texture( shadowMap, vec3( shadowCoord.xy + ( vec2( sx, sy ) - 1.5 ) * radius, shadowCoord.z ) );
				}
				shadow /= 16.0;`);
patchChunk("lights_fragment_begin", /\( directLight\.visible && receiveShadow \) \? getShadow\( directionalShadowMap/,
  "( directLight.visible && receiveShadow && dot( geometryNormal, directLight.direction ) > 0.0 ) ? getShadow( directionalShadowMap");

// Mist (ENV.mist): no sea or clouds, a plain void from mistBottom below to mistTop above, and fog in
// the void's colour in the direction looked, so whatever fades out fades into the background behind it.
const glslColor = (hex: number) => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`; };
const MIST_GLSL = `vec3 mistAt(float y) { return mix(${glslColor(ENV.mistBottom)}, ${glslColor(ENV.mistTop)}, smoothstep(-0.55, 0.45, y)); }`;
if (ENV.mist) {
  THREE.ShaderChunk.fog_pars_vertex += "\n#ifdef USE_FOG\n  varying vec3 vFogDir;\n#endif";
  THREE.ShaderChunk.fog_vertex += "\n#ifdef USE_FOG\n  vFogDir = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;\n#endif";
  THREE.ShaderChunk.fog_pars_fragment += `\n#ifdef USE_FOG\n  varying vec3 vFogDir;\n  ${MIST_GLSL}\n#endif`;
  const mix = "gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );";
  if (!THREE.ShaderChunk.fog_fragment.includes(mix)) throw new Error("three's fog_fragment changed; redo the mist patch");
  THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace(mix, "gl_FragColor.rgb = mix( gl_FragColor.rgb, mistAt( normalize( vFogDir ).y ), fogFactor );");
}

// The sky light and the shadow-casting sun, shared by play, the editor and the thumbnails; point the
// sun's shadow at a level with fitSun.
export function addLights(scene: THREE.Scene): THREE.DirectionalLight {
  // The sun carries most of the light, so what it can't reach (shadows) reads clearly darker.
  scene.add(new THREE.HemisphereLight(ENV.hemiSky, ENV.hemiGround, ENV.hemi));
  const sun = new THREE.DirectionalLight(ENV.sun, ENV.sunPower);
  sun.position.copy(SUN_OFFSET);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const c = sun.shadow.camera;
  c.left = -36; c.right = 36; c.top = 36; c.bottom = -36; c.near = 1; c.far = 150;
  sun.shadow.bias = -SHADOW_OFFSET / (c.far - c.near);
  // Kept tiny: any more lifts the shadow off where the ball or a prop touches the floor (see SHADOW_OFFSET).
  sun.shadow.normalBias = ENV.toon ? 0.03 : 0.005;
  scene.add(sun, sun.target);
  return sun;
}

export function createScene(fog = FOG_PLAY * ENV.fog): SceneEnv {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(ENV.mist ? ENV.mistTop : SKY_HORIZON);
  scene.fog = new THREE.FogExp2(SKY_HORIZON, fog);
  const sky = ENV.mist ? makeMist() : makeSky(), ocean = ENV.mist ? null : makeOcean();
  sky.layers.set(SKY_LAYER);
  scene.add(sky);
  if (ocean) scene.add(ocean);
  const sun = addLights(scene);
  const rain = ENV.rain > 0 ? makeRain(ENV.rain) : null;
  if (rain) scene.add(rain.lines);
  const bubbles = ENV.bubbles > 0 ? makeBubbles(ENV.bubbles) : null;
  if (bubbles) scene.add(bubbles.points);
  const t0 = performance.now();
  // Sky and sea ride along with the camera; their shaders work in world space so nothing swims.
  const tick = (camera: THREE.Camera) => {
    const t = (performance.now() - t0) / 1000;
    rain?.tick(camera, t);
    bubbles?.tick(camera, t);
    sky.position.copy(camera.position);
    (sky.material as THREE.ShaderMaterial).uniforms.time!.value = t;
    if (ocean) {
      ocean.position.set(camera.position.x, OCEAN_Y, camera.position.z);
      (ocean.material as THREE.ShaderMaterial).uniforms.time!.value = t;
    }
    PORTAL_TIME.value = t;
    DECOR_TIME.value = t;
  };
  const setDetail = (full: boolean) => {
    (sky.material as THREE.ShaderMaterial).uniforms.detail!.value = full ? 1 : 0;
    if (ocean) (ocean.material as THREE.ShaderMaterial).uniforms.detail!.value = full ? 1 : 0;
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
  float cloudCover(vec2 xz, float time) { return smoothstep(0.42 - cover, 0.68 - cover, fbm(xz * 0.025 + vec2(time * 0.01, time * 0.004))); }
  float cloudCoverLow(vec2 xz, float time) { return smoothstep(0.42 - cover, 0.68 - cover, fbmLow(xz * 0.025 + vec2(time * 0.01, time * 0.004))); }
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // Cartoon cumulus: one cloud in some cells of a large grid, each a cluster of seven balls (a
  // big one, a ring of five round it turned by a random angle, one on top) merged smoothly and
  // lumped by low noise, standing on the deck's base. A cloud never leaves its own cell, so the
  // march only ever asks the cell it is in. The sea reads the same balls from above.
  const float CLOUD_CELL = 68.0;
  bool cloudIn(vec2 g, float cover) { return hash21(g) < 0.4 + cover * 1.5; }
  // Ball k of the cloud in cell g: xyz its centre (xz inside the cell, y above cloudY), w its radius.
  vec4 cloudBall(vec2 g, int k, float cover) {
    float R = (5.5 + 3.0 * hash21(g + 9.1)) * (1.0 + cover * 0.4);
    vec2 c = (g + 0.5 + 0.4 * (vec2(hash21(g + 5.2), hash21(g + 1.3)) - 0.5)) * CLOUD_CELL;
    float a = hash21(g + 3.7) * 6.2832;
    float ang = a + float(k) * 1.2566, sr = 0.0, h = 0.0, r = 0.0;
    if (k == 0) { r = R; h = 0.0; sr = 0.0; }
    else if (k == 6) { r = 0.6 * R; h = 0.72 * R; sr = 0.22 * R; }
    else { r = (0.5 + 0.12 * hash21(g + float(k) * 2.1)) * R; h = (0.02 + 0.16 * hash21(g + float(k) * 4.3)) * R; sr = 1.02 * R; }
    return vec4(c.x + cos(ang) * sr, r * 0.92 + h, c.y + sin(ang) * sr, r);
  }
  float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
  // Signed distance to the cloud in cell g (a huge distance for an empty cell).
  float cloudSdf(vec3 p, vec2 g, float cloudY, float cover, float time) {
    if (!cloudIn(g, cover)) return 1e4;
    float d = 1e4, R = cloudBall(g, 0, cover).w;
    for (int k = 0; k < 7; k++) {
      vec4 b = cloudBall(g, k, cover);
      d = smin(d, length(p - vec3(b.x, cloudY + b.y, b.z)) - b.w, 0.3 * R);
    }
    return d + (noise3(p * 0.11 + vec3(time * 0.03, 0.0, 0.0)) - 0.5) * R * 0.3;
  }
  // The cloud deck seen from straight above: 1 under a cloud's balls, with a short soft rim.
  float deckAbove(vec2 p, float cover) {
    vec2 g = floor(p / CLOUD_CELL);
    if (!cloudIn(g, cover)) return 0.0;
    float best = 0.0;
    for (int k = 0; k < 7; k++) {
      vec4 b = cloudBall(g, k, cover);
      best = max(best, 1.0 - smoothstep(b.w * 0.95 - 0.4, b.w * 0.95, length(p - b.xz)));
    }
    return best;
  }
`;

// Gradient dome under a volumetric cloud deck between CLOUD_Y and CLOUD_TOP. Each sky pixel
// marches its view ray through the deck: coverage decides where clouds stand, coverage also
// sets how tall they billow, 3D noise erodes the edges into puffs, and one step toward the sun
// shades their undersides. Distant clouds melt into the horizon haze.
// The mist's void (ENV.mist): the same colour the fog takes, looking that way.
function makeMist(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, detail: { value: 1 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = c.xyww; }`,
    fragmentShader: `varying vec3 vP; ${MIST_GLSL}
      void main(){ gl_FragColor = vec4(mistAt(normalize(vP).y), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat);
  m.frustumCulled = false;
  return m;
}
function makeSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(SKY_TOP) }, bottom: { value: new THREE.Color(SKY_HORIZON) }, cloud: { value: new THREE.Color(ENV.cloud) }, cloudShade: { value: new THREE.Color(ENV.cloudShade) },
      time: { value: 0 }, cloudY: { value: CLOUD_Y }, cloudTop: { value: CLOUD_TOP }, sunDir: { value: SUN_DIR }, detail: { value: 1 }, cover: { value: ENV.cloudCover }, toon: { value: ENV.toon ? 1 : 0 },
    },
    // Pinned to the far plane: anything in the scene draws in front, and covered pixels skip the march.
    vertexShader: `varying vec3 vP; void main(){ vP = position; vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = c.xyww; }`,
    fragmentShader: `uniform vec3 top, bottom, sunDir, cloud, cloudShade; uniform float time, cloudY, cloudTop, detail, cover, toon; varying vec3 vP;
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
        if (toon > 0.5 && d.y > 0.01 && detail < 0.5) {
          // Reflection passes: the deck flat, seen from below.
          float t = (cloudY - cameraPosition.y) / d.y;
          vec2 p = cameraPosition.xz + d.xz * t + vec2(time * 0.6, time * 0.25);
          col = mix(sky, cloudShade, deckAbove(p, cover) * exp(-t * 0.007));
        } else if (toon > 0.5 && d.y > 0.01) {
          // Cartoon cumulus: the ray walks the deck cell by cell (each step no further than the
          // cell's wall, so no cloud is skipped), sphere-traces the cell's cloud, and a hit is
          // cel-lit in three bands from its surface normal, with a dark rim at its silhouette.
          vec3 drift = vec3(time * 0.6, 0.0, time * 0.25);
          float t = (cloudY - cameraPosition.y) / d.y, fade = exp(-t * 0.0045) * smoothstep(0.03, 0.1, d.y);
          bool hit = false;
          vec3 p = vec3(0.0);
          if (fade > 0.02) for (int i = 0; i < 48; i++) {
            p = cameraPosition + d * t + drift;
            if (p.y > cloudTop || t > 520.0) break;
            vec2 g = floor(p.xz / CLOUD_CELL);
            float sd = cloudSdf(p, g, cloudY, cover, time);
            if (sd < 0.12) { hit = true; break; }
            vec2 f = p.xz - g * CLOUD_CELL;
            float tx = d.x > 0.0 ? (CLOUD_CELL - f.x) / d.x : d.x < 0.0 ? -f.x / d.x : 1e4;
            float tz = d.z > 0.0 ? (CLOUD_CELL - f.y) / d.z : d.z < 0.0 ? -f.y / d.z : 1e4;
            t += min(sd * 0.7, min(tx, tz) + 0.15);
          }
          if (hit) {
            vec2 g = floor(p.xz / CLOUD_CELL);
            float e = 0.35;
            vec3 n = normalize(vec3(
              cloudSdf(p + vec3(e, 0, 0), g, cloudY, cover, time) - cloudSdf(p - vec3(e, 0, 0), g, cloudY, cover, time),
              cloudSdf(p + vec3(0, e, 0), g, cloudY, cover, time) - cloudSdf(p - vec3(0, e, 0), g, cloudY, cover, time),
              cloudSdf(p + vec3(0, 0, e), g, cloudY, cover, time) - cloudSdf(p - vec3(0, 0, e), g, cloudY, cover, time)));
            float lit = dot(n, sunDir);
            float band = lit > 0.3 ? 1.0 : lit > -0.2 ? 0.55 : 0.1;
            // The underside sits in its own shade.
            band *= 0.75 + 0.25 * clamp((p.y - cloudY) / 6.0, 0.0, 1.0);
            vec3 c = mix(cloudShade, cloud, band);
            float rim = 1.0 - abs(dot(n, d));
            c = mix(c, cloudShade * 0.7, step(0.86, rim) * 0.7);
            fade = exp(-t * 0.0045) * smoothstep(0.03, 0.1, d.y);
            col = mix(sky, c, fade);
          }
        } else if (d.y > 0.01 && detail < 0.5) {
          // Flat deck for reflection passes.
          float t = max((cloudY - cameraPosition.y) / d.y, 0.0);
          vec2 p = cameraPosition.xz + d.xz * t;
          col = mix(sky, cloud, cloudCoverLow(p, time) * exp(-t * 0.0016));
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
                vec3 light = mix(cloudShade, cloud, shade) * (0.86 + 0.14 * h);
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

// Rain: n short slanted streaks in a box that rides with the camera, each falling and wrapping to
// the top of the box, so the camera is always inside the shower.
const RAIN_BOX = { w: 40, h: 34, d: 40 }, RAIN_SPEED = 18, RAIN_LEN = 1.1;
function makeRain(n: number): { lines: THREE.LineSegments; tick(camera: THREE.Camera, t: number): void } {
  const seeds = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) seeds[i] = Math.random();
  const pos = new Float32Array(n * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xf6fafd, transparent: true, opacity: 0.6, depthWrite: false, fog: true });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.userData.noShadow = true;
  const slant = new THREE.Vector3(0.12, -1, 0.05).normalize().multiplyScalar(RAIN_LEN);
  return {
    lines,
    tick(camera, t) {
      const c = camera.position;
      for (let i = 0; i < n; i++) {
        const x = c.x + (seeds[i * 3]! - 0.5) * RAIN_BOX.w;
        const z = c.z + (seeds[i * 3 + 2]! - 0.5) * RAIN_BOX.d;
        const y = c.y + RAIN_BOX.h * 0.6 - ((seeds[i * 3 + 1]! * RAIN_BOX.h + t * RAIN_SPEED) % RAIN_BOX.h);
        pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + slant.x; pos[i * 6 + 4] = y + slant.y; pos[i * 6 + 5] = z + slant.z;
      }
      (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

// Bubbles: n soap bubbles (a drawn ring with a highlight) of mixed sizes drifting slowly up and
// sideways through a box that rides with the camera.
const BUBBLE_BOX = { w: 50, h: 30, d: 50 }, BUBBLE_RISE = 0.9;
function makeBubbles(n: number): { points: THREE.Object3D; tick(camera: THREE.Camera, t: number): void } {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.48);
  g.addColorStop(0, "rgba(255,255,255,0.05)"); g.addColorStop(0.8, "rgba(255,255,255,0.18)"); g.addColorStop(1, "rgba(255,255,255,0.0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.44, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath(); ctx.ellipse(S * 0.36, S * 0.34, S * 0.09, S * 0.055, -0.7, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Three sizes of bubble, each its own point cloud (a point cloud has one size).
  const sizes = [0.45, 0.9, 1.6], points = new THREE.Group(), clouds: { pos: Float32Array; seeds: Float32Array; geo: THREE.BufferGeometry; size: number }[] = [];
  for (const size of sizes) {
    const m = Math.round(n / sizes.length), seeds = new Float32Array(m * 3), pos = new Float32Array(m * 3);
    for (let i = 0; i < m * 3; i++) seeds[i] = Math.random();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ map: tex, size, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true, fog: true });
    const cloud = new THREE.Points(geo, mat);
    cloud.frustumCulled = false;
    cloud.userData.noShadow = true;
    points.add(cloud);
    clouds.push({ pos, seeds, geo, size });
  }
  return {
    points: points as unknown as THREE.Points,
    tick(camera, t) {
      const cp = camera.position;
      for (const { pos, seeds, geo, size } of clouds) {
        for (let i = 0; i < seeds.length / 3; i++) {
          pos[i * 3] = cp.x + (seeds[i * 3]! - 0.5) * BUBBLE_BOX.w + Math.sin(t * 0.3 + i) * 0.6;
          pos[i * 3 + 1] = cp.y - BUBBLE_BOX.h * 0.45 + ((seeds[i * 3 + 1]! * BUBBLE_BOX.h + t * BUBBLE_RISE * size) % BUBBLE_BOX.h);
          pos[i * 3 + 2] = cp.z + (seeds[i * 3 + 2]! - 0.5) * BUBBLE_BOX.d + Math.cos(t * 0.23 + i * 1.7) * 0.6;
        }
        (geo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      }
    },
  };
}

// Endless sea: slow noise ripples, sky fresnel, a soft sun glint, and the shadows of the
// cloud deck drifting over it (same coverage the sky marches, sampled straight below).
function makeOcean(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, sunDir: { value: SUN_DIR },
      deep: { value: new THREE.Color(ENV.seaDeep) }, shallow: { value: new THREE.Color(ENV.seaShallow) }, sky: { value: new THREE.Color(ENV.seaSky) },
      grid: { value: new THREE.Color(ENV.seaGrid ?? 0) }, ruled: { value: ENV.seaGrid === null ? 0 : 1 }, cover: { value: ENV.cloudCover }, toon: { value: ENV.toon ? 1 : 0 },
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
      uniform float time, detail, ruled, cover, toon; uniform vec3 sunDir, deep, shallow, sky, grid; varying vec3 vWorld;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vWorld.xz;
        if (ruled > 0.5) {
          // A ruled mat: a line every unit, a heavier one every fifth, fading with distance.
          float dist = length(cameraPosition - vWorld);
          float w = 0.03 + dist * 0.0012;
          vec2 f1 = min(fract(p), 1.0 - fract(p)), f5 = min(fract(p / 5.0), 1.0 - fract(p / 5.0)) * 5.0;
          float l1 = 1.0 - smoothstep(w, w * 2.0, min(f1.x, f1.y));
          float l5 = 1.0 - smoothstep(w * 1.5, w * 3.0, min(f5.x, f5.y));
          vec3 col = mix(deep, grid, max(l1 * 0.45, l5 * 0.9) * exp(-dist * 0.004));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
          #include <fog_fragment>
          return;
        }
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
        vec3 col;
        float spec = pow(max(dot(n, normalize(sunDir + V)), 0.0), 140.0);
        float shadow = toon > 0.5 ? deckAbove(p + vec2(time * 0.6, time * 0.25), cover) : detail > 0.5 ? cloudCover(p, time) : cloudCoverLow(p, time);
        if (toon > 0.5) {
          // Cel sea: two flat bands of water, a flat band of sky at the grazing angle, hard white glints
          // and hard-edged cloud shadows.
          col = mix(deep, shallow, step(0.5, tone));
          col = mix(col, sky, step(0.55, fres) * 0.6);
          col += vec3(1.0) * step(0.25, spec) * 0.35;
          col *= 1.0 - 0.14 * step(0.5, shadow);
        } else {
          col = mix(mix(deep, shallow, smoothstep(0.3, 0.7, tone)), sky, fres);
          col += vec3(1.0, 0.99, 0.95) * spec * 0.12;
          col *= 1.0 - 0.16 * shadow;
        }
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
  // The moving part of each knock-down plank, seesaw and stool, local to the piece group, posed from its body.
  planks: Map<number, THREE.Group>;
  // Each jump pad's spring pose, by piece index: `t` seconds since it launched something.
  springs: Map<number, (t: number) => void>;
  // Each moving platform's piece group, placed by its schedule every frame in play.
  movers: Map<number, THREE.Group>;
  // Each puffer's air ring by piece index: shown that far out, or hidden for null (puffRings).
  puffers: Map<number, (r: number | null) => void>;
  // Each button's cap by piece index: down once pressed.
  buttons: Map<number, (down: boolean) => void>;
  // The scattered overgrowth (decor.ts), kept apart so the editor can carry it over a rebuild.
  decor: THREE.Group;
  // Each apple's floating group, by piece index, the golden ones apart; and the origin's wormhole, opened
  // `open` (0 to 1) of the way.
  apples: Map<number, THREE.Group>;
  golden: Map<number, THREE.Group>;
  origin: ((open: number) => void) | null;
  // Each piece group's ink hulls (stylize) with the group's bounds in its own frame, hidden while the
  // camera is near the piece (hideHullsAround).
  hulls: { group: THREE.Group; index: number; box: THREE.Box3; hulls: THREE.Mesh[]; meshes: THREE.Mesh[]; platform: boolean; shown?: number }[];
}

const UP = new THREE.Vector3(0, 1, 0);
// Pose a bridge plank from its physics body: the plank group lives under the piece group, which
// only yaws and translates, so the world pose is pulled back into the piece's local frame.
export function posePlank(piece: THREE.Group, plank: THREE.Group, t: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): void {
  plank.position.set(t.x, t.y, t.z).sub(piece.position).applyAxisAngle(UP, -piece.rotation.y);
  plank.quaternion.set(q.x, q.y, q.z, q.w).premultiply(piece.quaternion.clone().invert());
}

// Points the sun's shadow at the whole level, so every piece casts its shadow however far it is
// from the camera: the shadow box is the level's bounds (shader effects aside) plus room for
// moving platforms to travel. Level pieces stay put, so this is done once per build.
// The shadow's depth offset in world units. bias is a share of the shadow camera's depth, so it is set
// from this whenever that depth changes: a fixed share grows with the level and lifts contact shadows off the floor.
const SHADOW_OFFSET = ENV.toon ? 0.03 : 0.005;
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
  sun.shadow.bias = -SHADOW_OFFSET / (cam.far - cam.near);
  cam.updateProjectionMatrix();
}

// `reuse` is the last build of the same level (the editor's): a piece that has not changed keeps its group
// from it, so an edit rebuilds only what it touched. The groups left over are disposed. `plants` false
// leaves the overgrowth out (the editor grows it only on request).
export function buildLevel(level: Level, editor: boolean, reuse?: Built, plants = true): Built {
  if (!MAT) throw new Error("initMaterials first");
  const mat = MAT;
  const group = new THREE.Group();
  const pieceGroups: THREE.Group[] = [];
  const spinnerBars = new Map<number, THREE.Mesh>();
  const crates = new Map<number, THREE.Group>();
  const bridges = new Map<number, THREE.Group[]>();
  const planks = new Map<number, THREE.Group>();
  const movers = new Map<number, THREE.Group>();
  const pool = new Map<string, number[]>(), kept = new Set<THREE.Group>();
  reuse?.pieceGroups.forEach((g, i) => { const k = g.userData.buildKey as string | undefined; if (k) pool.set(k, [...(pool.get(k) ?? []), i]); });

  const seams = platformSeams(level);
  level.pieces.forEach((p, index) => {
    // A piece is rebuilt when it or anything else it is drawn from changes: a platform's holes and joins; rails
    // follow the platforms round them, so they are always rebuilt.
    const key = p.type === "rails" ? "" : JSON.stringify(p) + (isPlatform(p) ? floorOf(level, p) : "") + (p.type === "slab" || p.type === "curve" ? JSON.stringify(isTilted(p) ? holeCuts(level, p) : holesOn(level, p)) : "") + JSON.stringify(seams.get(index) ?? []);
    const was = key ? pool.get(key)?.shift() : undefined;
    if (reuse && was !== undefined) {
      const g = reuse.pieceGroups[was]!;
      g.userData.pieceIndex = index;
      for (const [from, to] of [[reuse.spinnerBars, spinnerBars], [reuse.crates, crates], [reuse.bridges, bridges], [reuse.planks, planks], [reuse.movers, movers]] as [Map<number, unknown>, Map<number, unknown>][]) {
        if (from.has(was)) to.set(index, from.get(was));
      }
      kept.add(g);
      group.add(g);
      pieceGroups.push(g);
      return;
    }
    const g = new THREE.Group();
    g.userData.buildKey = key;
    g.position.set(p.x, p.y, p.z);
    g.rotation.order = "YXZ"; // roll about the piece's own z axis, tilt about its x axis, then yaw
    g.rotation.y = (pieceRot(p) * Math.PI) / 180;
    if (p.type === "slab") { g.rotation.x = (p.tilt * Math.PI) / 180; g.rotation.z = ((p.roll ?? 0) * Math.PI) / 180; }
    if (p.type === "kicker" || p.type === "jump") { g.rotation.z = ((p.roll ?? 0) * Math.PI) / 180; g.rotation.x = ((p.tilt ?? 0) * Math.PI) / 180; }
    else if (pieceRoll(p) || pieceTilt(p)) { g.rotation.z = (pieceRoll(p) * Math.PI) / 180; g.rotation.x = (pieceTilt(p) * Math.PI) / 180; }
    g.userData.pieceIndex = index;
    if (p.type === "blockade") buildBlockade(g, p);
    if (p.type === "barrier") buildBarrier(g, p);
    if (p.type === "pillar") buildPillar(g);
    if (p.type === "puffer") buildPuffer(g);
    if (p.type === "button") buildButton(g);
    if (p.type === "magnet") buildMagnet(g);
    if (p.type === "column") buildColumn(g, p.h, p.r);
    if (p.type === "crate") { buildCrate(g, p.w, p.h, p.d); g.position.y += propLift(p) + 0.02; crates.set(index, g); }
    if (p.type === "barrel") { buildBarrel(g, p.r, p.h); g.position.y += propLift(p) + 0.02; crates.set(index, g); }
    if (p.type === "cube") { buildCube(g, CUBE_S); g.position.y += propLift(p) + 0.02; crates.set(index, g); }
    if (p.type === "bridge") bridges.set(index, buildBridge(g, p));
    if (p.type === "plank") planks.set(index, buildPlank(g, p));
    if (p.type === "seesaw") planks.set(index, buildSeesaw(g, p, editor));
    if (p.type === "board") planks.set(index, buildBoard(g, p));
    if (p.type === "stool") planks.set(index, buildStool(g, p, editor));
    if (p.type === "bean") planks.set(index, buildBean(g, p, editor));
    if (p.type === "jump") buildJump(g, p);
    if (p.type === "support") buildSupport(g, p);
    if (p.type === "arch") buildArch(g, p);
    if (p.type === "lamp" || p.type === "mast") buildFrame(g, p);
    if (p.type === "tree") g.add(buildTree(p));
    if (p.type === "kicker") { const k = buildKicker(g, p, editor); if (k) planks.set(index, k); }
    if (p.type === "tube") buildTube(g, p);
    if (p.type === "hoop") buildHoop(g);
    for (const b of pieceBoxes(p)) {
      if (b.kind !== "block" || p.type === "blockade" || p.type === "barrier" || p.type === "support") continue; // these props draw themselves; the box is only their collider
      const m = new THREE.Mesh(roundedBox(b.w, b.h, b.d, EDGE_RADIUS), ruin() ? STRUCT!.body : mat.block);
      m.position.set(b.x, b.y, b.z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    if (p.type === "slab" || p.type === "curve") {
      const rot = pieceRot(p);
      const cuts: XZ[][] = isTilted(p) ? holeCuts(level, p) : holesOn(level, p).map((h) => h.map((v) => { const o = rotXZ(v[0] - p.x, v[1] - p.z, -rot); return [o.x, o.z] as XZ; }));
      const joins: PlatformJoins = { joins: (seams.get(index) ?? []).map((q) => q.map(([x, z]) => pieceLocal(p, x, z))), uvFrame: tileFrame(p) };
      const geo = p.type === "slab"
        ? platformGeometry(p.w, p.d, PLATFORM_THICKNESS, LIP, TILE, undefined, undefined, cuts, p.twist ? (z) => twistAt(p, z) : undefined, isBelt(p), isShaped(p) ? slabOutline(p) : undefined, isCurled(p) ? (v) => curlPoint(p, v) : undefined, joins)
        : curveGeometry(p, seams.get(index));
      if (p.type === "curve" && p.roll) {
        const a = geo.getAttribute("position");
        for (let i = 0; i < a.count; i++) a.setXYZ(i, ...curveRollPoint(p, [a.getX(i), a.getY(i), a.getZ(i)]));
        geo.computeVertexNormals();
      }
      const m = new THREE.Mesh(geo, [floorMat(floorOf(level, p), patchSeed(level.id)), mat.edge, mat.rim, mat.border]);
      m.receiveShadow = true;
      g.add(m);
      if (isGlass(p) && !isBelt(p)) g.add(glassPane(geo));
      if (editor && p.noTrees) noTreesWash(g, geo);
      if (isBelt(p)) buildBelt(g, p);
      if (isMoving(p)) {
        m.castShadow = true;
        if (editor) buildMoverRoute(g, p);
        movers.set(index, g);
      }
    }
    if (p.type === "hole" && editor) buildHoleMarker(g, p);
    if (p.type === "ramp") {
      // The strip runs along the ramp, turned a quarter into place after.
      const strip = (x: number, z: number): XZ => { const l = pieceLocal(p, x, z); return [-l[1], l[0]]; }, frame = tileFrame(p);
      const geo = platformGeometry(p.d, p.w, PLATFORM_THICKNESS, LIP, TILE, undefined, (t) => rampHeight(p, t), [], undefined, false, undefined, undefined,
        { joins: (seams.get(index) ?? []).map((q) => q.map(([x, z]) => strip(x, z))), uvFrame: (x, z) => frame(z, -x) });
      geo.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(geo, [floorMat(floorOf(level, p), patchSeed(level.id)), mat.edge, mat.rim, mat.border]);
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);
      if (editor && p.noTrees) noTreesWash(g, geo);
    }
    if (p.type === "fence") buildFence(p, g);
    if (p.type === "rails") buildRailsPiece(p, g, level);
    if (p.type === "spinner") {
      const bar = new THREE.Mesh(ENV.props === "soft" ? new RoundedBoxGeometry(p.length, SPINNER_HEIGHT, SPINNER_WIDTH, 6, SPINNER_WIDTH * 0.48) : new THREE.BoxGeometry(p.length, SPINNER_HEIGHT, SPINNER_WIDTH), ruin() ? STRUCT!.body : SPINNER_MAT);
      bar.position.y = SPINNER_HEIGHT / 2;
      bar.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(SPINNER_HUB_R, SPINNER_HUB_R, SPINNER_HEIGHT + 0.05, 48), mat.block);
      hub.position.y = (SPINNER_HEIGHT + 0.05) / 2;
      g.add(bar, hub);
      spinnerBars.set(index, bar);
    }
    if (p.type === "apple") buildApple(g, !!p.golden);
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
  const decor = plants ? buildDecor(level) : new THREE.Group();
  group.add(decor);

  // Everything solid casts and takes shadows; glows, the portal, holograms and editor guides don't.
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.noShadow) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.every((m) => m instanceof THREE.MeshStandardMaterial)) return;
    o.receiveShadow = true;
    o.castShadow = !mats.every((m) => !m.map && m.emissiveIntensity > 0 && m.emissive.getHex() === m.color.getHex());
  });
  if (ENV.toon || ENV.outline > 0) stylize(group);
  for (const g of reuse?.pieceGroups ?? []) {
    if (!kept.has(g)) g.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
  group.updateMatrixWorld(true);
  const hulls = pieceGroups.flatMap((g, i) => {
    const box = new THREE.Box3(), inv = g.matrixWorld.clone().invert(), list: THREE.Mesh[] = [], meshes: THREE.Mesh[] = [], m = new THREE.Matrix4();
    g.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o.userData.air) return;
      meshes.push(o);
      if (o.userData.outline) { if (o.parent instanceof THREE.Mesh) list.push(o); return; }
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox!.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)));
    });
    return list.length && !box.isEmpty() ? [{ group: g, index: i, box, hulls: list, meshes, platform: isPlatform(level.pieces[i]!) }] : [];
  });
  return { group, pieceGroups, spinnerBars, crates, bridges, planks, movers, decor, hulls,
    puffers: new Map(pieceGroups.flatMap((g, i) => (g.userData.puff ? [[i, g.userData.puff as (r: number | null) => void]] : []))),
    buttons: new Map(pieceGroups.flatMap((g, i) => (g.userData.press ? [[i, g.userData.press as (down: boolean) => void]] : []))),
    springs: new Map(pieceGroups.flatMap((g, i) => (g.userData.spring ? [[i, g.userData.spring as (t: number) => void]] : []))),
    apples: new Map(pieceGroups.flatMap((g, i) => (g.userData.apple ? [[i, g.userData.apple as THREE.Group]] : []))),
    golden: new Map(pieceGroups.flatMap((g, i) => (g.userData.golden ? [[i, g.userData.golden as THREE.Group]] : []))),
    origin: (pieceGroups.find((g) => g.userData.origin)?.userData.origin as Built["origin"] | undefined) ?? null };
}

// Cel shading: every standard material becomes a toon material with the same maps and glow, lit
// in three steps; and an ink outline: an inside-out copy of each solid mesh pushed out along its
// normals by ENV.outline. Shared materials convert once, so meshes keep sharing.
let TOON_RAMP: THREE.DataTexture | null = null;
const TOON_CACHE = new Map<THREE.Material, THREE.Material>();
let OUTLINE_MAT: THREE.MeshBasicMaterial | null = null;
export function toonRamp(): THREE.DataTexture {
  if (!TOON_RAMP) {
    TOON_RAMP = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1);
    TOON_RAMP.minFilter = TOON_RAMP.magFilter = THREE.NearestFilter;
    TOON_RAMP.needsUpdate = true;
  }
  return TOON_RAMP;
}
function toonOf(m: THREE.Material): THREE.Material {
  if (!(m instanceof THREE.MeshStandardMaterial) || m instanceof THREE.MeshPhysicalMaterial) return m;
  const hit = TOON_CACHE.get(m);
  if (hit) return hit;
  const t = new THREE.MeshToonMaterial({
    color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity,
    transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite, gradientMap: toonRamp(),
  });
  t.onBeforeCompile = m.onBeforeCompile;
  t.customProgramCacheKey = m.customProgramCacheKey;
  TOON_CACHE.set(m, t);
  return t;
}
// In the game's view a prop near the eye turns see-through as a whole (fade.ts), by its nearest mesh's
// bounds (in the mesh's frame): its meshes swap to see-through copies of their materials while it is
// faded, its ink hull fading faster (INK_FADE) so the hull's inside never tints through. A mesh's hull
// is drawn inside out, so from inside the mesh its faces fill the view with ink: it is hidden while the
// eye is inside its mesh. Platforms that meet have no wall where they join, so from inside one the next
// one's open end shows its hull: while the eye is inside any platform, every platform's hull is hidden.
// A platform never fades by distance (the floor under the ball is always near the eye); it fades to
// FADE.min, eased over a few frames, while it lies between the eye and the ball.
const EYE = new THREE.Vector3(), INV = new THREE.Matrix4(), RAY = new THREE.Ray(), HIT = new THREE.Vector3(), CAST = new THREE.Raycaster();
const eyeIn = (o: THREE.Object3D, eye: THREE.Vector3) => EYE.copy(eye).applyMatrix4(INV.copy(o.matrixWorld).invert());
const PLATFORM_EASE = 0.15;
// Whether platform `r` crosses the line from `eye` to `ball`: its bounds first, then its meshes.
function blocks(r: Built["hulls"][number], eye: THREE.Vector3, ball: THREE.Vector3): boolean {
  INV.copy(r.group.matrixWorld).invert();
  RAY.origin.copy(eye).applyMatrix4(INV);
  RAY.direction.copy(ball).applyMatrix4(INV).sub(RAY.origin);
  const len = RAY.direction.length();
  if (len < 1e-6) return false;
  RAY.direction.divideScalar(len);
  if (!RAY.intersectBox(r.box, HIT) || HIT.distanceTo(RAY.origin) > len) return false;
  CAST.set(eye, HIT.copy(ball).sub(eye).normalize());
  CAST.far = eye.distanceTo(ball);
  return CAST.intersectObjects(r.meshes.filter((m) => !m.userData.outline), false).length > 0;
}
// `ball` is where the ball is drawn; without it no platform fades.
export function hideHullsAround(built: Built, eye: THREE.Vector3, ball?: THREE.Vector3): void {
  const inside = built.hulls.some((r) => r.platform && r.box.containsPoint(eyeIn(r.group, eye)));
  const dist = (h: THREE.Mesh) => { const m = h.parent as THREE.Mesh; return m.geometry.boundingBox!.distanceToPoint(eyeIn(m, eye)); };
  const faded: [number, number][] = [];
  for (const r of built.hulls) {
    const d = r.hulls.map(dist);
    r.hulls.forEach((h, k) => { h.visible = !(r.platform && inside) && d[k]! > ENV.outline; });
    let o: number;
    if (r.platform) {
      const want = ball && blocks(r, eye, ball) ? FADE.min : 1, was = r.shown ?? 1;
      o = r.shown = was + Math.max(-PLATFORM_EASE, Math.min(PLATFORM_EASE, want - was));
    } else o = fadeAt(Math.min(...d));
    fadePiece(r, o);
    if (o < 1) faded.push([r.index, o]);
  }
  // The plants growing on a faded piece fade with it.
  fadePlantsOn(faded);
}

// A see-through copy of a material, keeping its shader changes, its own opacity kept in userData.
function seeThrough(m: THREE.Material): THREE.Material {
  const c = m.clone();
  c.onBeforeCompile = m.onBeforeCompile;
  c.customProgramCacheKey = m.customProgramCacheKey;
  c.transparent = true;
  c.userData.opacity = m.opacity;
  return c;
}
// Draws a prop `o` solid (1 is its own materials again).
function fadePiece(r: Built["hulls"][number], o: number): void {
  for (const m of r.meshes) {
    const ud = m.userData;
    if (o >= 1) { if (ud.solid) { m.material = ud.solid; ud.solid = undefined; } continue; }
    if (!ud.solid) { ud.solid = m.material; ud.faded ??= Array.isArray(m.material) ? m.material.map(seeThrough) : seeThrough(m.material); m.material = ud.faded; }
    const k = ud.outline ? o ** INK_FADE : o;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.opacity = mat.userData.opacity * k;
  }
}
// Every prop solid again, every hull shown (a view that doesn't fade, after one that did).
export function unfadeAll(built: Built): void {
  for (const r of built.hulls) { r.shown = undefined; fadePiece(r, 1); for (const h of r.hulls) h.visible = true; }
  fadePlantsOn([]);
}

// The props' steel (rusting under the ruin look), for the title picture.
export const steelMaterial = (): THREE.MeshStandardMaterial => STRUCT!.body;
export function stylize(root: THREE.Object3D): void {
  const hulls: [THREE.Mesh, THREE.Mesh][] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.outline) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const solid = mats.every((m) => m instanceof THREE.MeshStandardMaterial && !m.transparent && !(m instanceof THREE.MeshPhysicalMaterial));
    if (ENV.toon) {
      // Cel-lit bodies take no shadows: on a curved body the shadow map's terminator breaks the flat
      // bands into jagged steps. Floors, planks and blocks (anything wearing the floor texture) keep
      // them, so drop shadows stay.
      const floorLike = mats.some((m) => m instanceof THREE.MeshStandardMaterial && m.map !== null && (isFloorMat(m) || m.map === MAT!.block.map));
      if (!floorLike) o.receiveShadow = false;
      o.material = Array.isArray(o.material) ? o.material.map(toonOf) : toonOf(o.material);
    }
    if (ENV.outline > 0 && solid && !o.userData.noShadow) {
      OUTLINE_MAT ??= outlineMaterial(ENV.outline, ENV.outlineColor);
      // A live mesh is bent every frame, so its outline shares its geometry.
      const geo = o.userData.live ? o.geometry : o.geometry.clone();
      geo.clearGroups();
      const hull = new THREE.Mesh(geo, OUTLINE_MAT);
      hull.userData.outline = true;
      hull.userData.noShadow = true;
      hulls.push([o, hull]);
    }
  });
  for (const [o, hull] of hulls) o.add(hull);
}
// The shared ink outline material, for meshes drawn outside stylize (the hedgehog).
export const inkMaterial = (): THREE.MeshBasicMaterial => (OUTLINE_MAT ??= outlineMaterial(ENV.outline, ENV.outlineColor));
export function outlineMaterial(width: number, color: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `vec3 transformed = vec3(position) + normal * ${width.toFixed(4)};`);
  };
  return m;
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

// Treadmill: the opening's walls (a dark box seen from inside, so it looks the same from below) and
// the belt loop in it (beltOutline), its texture laid along the loop in world units so every belt shares
// it, and run along as the belt runs (turnBelts): forward over the top, back under the bottom.
let BELT: { belt: THREE.MeshStandardMaterial; bed: THREE.MeshStandardMaterial; side: THREE.MeshStandardMaterial } | null = null;
function buildBelt(g: THREE.Group, p: Slab): void {
  if (!BELT) {
    const t = beltTextures();
    BELT = {
      belt: new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.glow, emissive: 0xffffff, emissiveIntensity: 0.6 * ENV.glow, roughness: 0.75 }),
      bed: new THREE.MeshStandardMaterial({ color: TREADMILL.bed, roughness: 0.8, side: THREE.BackSide }),
      side: new THREE.MeshStandardMaterial({ color: TREADMILL.bed, roughness: 0.8 }),
    };
  }
  const b = beltLoop(p), mats = BELT;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(2 * b.ox, PLATFORM_THICKNESS, 2 * b.oz), mats.bed);
  walls.position.y = -PLATFORM_THICKNESS / 2;
  g.add(walls);
  const pts = beltOutline(p), n = pts.length, pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const [z, y] = pts[i % n]!, round = Math.abs(z) > b.end + 1e-6, c = z < 0 ? -b.end : b.end;
    if (i) { const [pz, py] = pts[i - 1]!; s += Math.hypot(z - pz, y - py); }
    const nz = round ? (z - c) / b.r : 0, ny = round ? (y - b.cy) / b.r : Math.sign(y - b.cy);
    for (const x of [-b.half, b.half]) { pos.push(x, y, z); nrm.push(0, ny, nz); uv.push(s / BELT_TILE, x / BELT_TILE); }
    if (i) { const k = 2 * i; idx.push(k - 2, k - 1, k + 1, k - 2, k + 1, k); }
  }
  const run = idx.length;
  for (const sx of [-1, 1]) {
    const base = pos.length / 3;
    pos.push(sx * b.half, b.cy, 0); nrm.push(sx, 0, 0); uv.push(0, 0);
    for (const [z, y] of pts) { pos.push(sx * b.half, y, z); nrm.push(sx, 0, 0); uv.push(0, 0); }
    for (let i = 0; i < n; i++) {
      const [z0, y0] = pts[i]!, [z1, y1] = pts[(i + 1) % n]!, cx = (y0 - b.cy) * z1 - z0 * (y1 - b.cy);
      const a = base + 1 + i, c = base + 1 + ((i + 1) % n);
      idx.push(...(cx * sx > 0 ? [base, a, c] : [base, c, a]));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.addGroup(0, run, 0);
  geo.addGroup(run, idx.length - run, 1);
  const belt = new THREE.Mesh(geo, [mats.belt, mats.side]);
  belt.receiveShadow = true;
  g.add(belt);
}
// Runs every belt's pattern along for the belts having run `travel` (the sim's beltTravel).
export function turnBelts(travel: number): void {
  if (!BELT) return;
  BELT.belt.map!.offset.x = BELT.belt.emissiveMap!.offset.x = -travel / BELT_TILE;
}