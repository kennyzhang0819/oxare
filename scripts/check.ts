import { readFileSync, readdirSync } from "node:fs";
import type RAPIER from "@dimforge/rapier3d-compat";
import RAPIER_RT from "@dimforge/rapier3d-compat";
import { BALL_RADIUS, fenceRailPath, fenceRuns, plankMounts, SIDE_PLANK_HINGE_Z, FENCE_RAIL_INSET, FENCE_RAIL_Y, JUMP_H, RAIL_R, railsRingsWorld, type Rails, PLANK_HINGE_H, PLANK_T, PLATFORM_EDGE_DROP, moverOffset, type Mover, TUBE_COLLAR_L, TUBE_SOLID_WALL, holeFootprint, TUBE_R, TUBE_COLLAR_T, tubeRings, type Tube, platformFootprint, fenceSides, CURVE_STRAIGHT, curveStrip, type Curve, PLATFORM_LIP, PLATFORM_THICKNESS, rampHeight, type Level, type Piece, BRIDGE_HINGE_DROP, LAYER_H, RAMP_RISE, START_PAD_REST, START_PAD_R, bridgeChain, levelProblems, startOf, validateLevel, type Bridge } from "../src/level.ts";
import { STEP, createSim } from "../src/sim.ts";
import { platformMesh } from "../src/platform.ts";
import { DEFAULT_TUNING, TUNING } from "../src/tuning.ts";

// A hand-built test level: its goal is solid like everything else, so it is moved far off to the
// side, out of the path the test rolls the ball along.
function testLevel(raw: unknown): Level {
  const level = validateLevel(raw);
  for (const p of level.pieces) if (p.type === "goal") p.x += 1000;
  return level;
}
const dir = new URL("../src/levels/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
if (!files.length) throw new Error("no levels");
let failed = false;

for (const f of files) {
  const level = validateLevel(JSON.parse(readFileSync(new URL(f, dir), "utf8")));
  const problems = levelProblems(level);
  const sim = await createSim(level);
  const start = startOf(level);
  for (let i = 0; i < 240; i++) sim.step(0, 0, -1);
  const rest = sim.ball.translation();
  if (Math.abs(rest.y - (start.y + START_PAD_REST)) > 0.02) problems.push(`ball does not rest in the start pad's bowl (y=${rest.y.toFixed(2)})`);
  let peak = 0;
  for (let i = 0; i < 2 * 120; i++) {
    sim.step(1, 0, -1);
    const v = sim.ball.linvel();
    peak = Math.max(peak, Math.hypot(v.x, v.z));
  }
  const after = sim.ball.translation();
  if (after.z >= rest.z - 1) problems.push(`ball did not roll forward under throttle (z ${rest.z.toFixed(2)} -> ${after.z.toFixed(2)})`);
  if (peak > TUNING.maxSpeed + 0.01) problems.push(`speed cap broken (${peak.toFixed(2)} > ${TUNING.maxSpeed})`);
  sim.free();
  if (problems.length) { failed = true; console.error(`FAIL ${f}: ${problems.join("; ")}`); }
  else console.log(`ok ${f}: ${level.pieces.length} pieces, peak ${peak.toFixed(2)} m/s over ${(2 * 120 * STEP).toFixed(0)}s`);
}
// The ball must cross platform seams with only a small hop and roll around a curve flat.
const seamLevel = testLevel({ id: "seam", name: "seam", pieces: [
  { type: "start", x: 0, y: 0, z: 0 },
  { type: "slab", x: 0, y: 0, z: 0, w: 10, d: 10, rot: 0, fences: {} },
  { type: "slab", x: 0, y: 0, z: -15, w: 10, d: 20, rot: 0, fences: {} },
  { type: "slab", x: 0, y: 0, z: -30, w: 10, d: 10, rot: 0, fences: {} },
  { type: "goal", x: 0, y: 0, z: -30, r: 2 },
] });
const curveLevel = testLevel({ id: "curve", name: "curve", pieces: [
  { type: "start", x: 15, y: 0, z: -1.2 },
  { type: "curve", x: 0, y: 0, z: 0, inner: 10, outer: 20, rot: 0, fences: {} },
  { type: "goal", x: 0, y: 0, z: -15, r: 2 },
] });
const teeLevel = testLevel({ id: "tee", name: "tee", pieces: [
  { type: "start", x: 0, y: 0, z: 0 },
  { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 20, rot: 0, fences: {} },
  { type: "slab", x: 5, y: 0, z: -25, w: 30, d: 20, rot: 0, fences: {} },
  { type: "goal", x: 5, y: 0, z: -30, r: 2 },
] });
// The floor is checked under fixed physics, so the result is about the floor's shape and not the
// feel tuning: a faster or lighter ball skims the seam grooves without settling into them.
const FLOOR_CHECK = { gravity: 5, throttleForce: 9, maxSpeed: 6.5 };
for (const [level, steer] of [[seamLevel, "line"], [teeLevel, "line"], [curveLevel, "arc"]] as const) {
  Object.assign(TUNING, FLOOR_CHECK);
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let maxDy = 0, dip = 0;
  for (let i = 0; i < 120 * 5; i++) {
    const p = sim.ball.translation();
    if (steer === "line") { if (p.z < -33) break; sim.step(1, 0, -1); }
    else {
      const a = Math.atan2(-p.z, p.x), r = Math.hypot(p.x, p.z);
      if (a > 1.45) break;
      const k = (15 - r) * 0.2;
      sim.step(1, -Math.sin(a) + Math.cos(a) * k, -Math.cos(a) - Math.sin(a) * k);
    }
    const q = sim.ball.translation(), s0 = startOf(level);
    if (Math.hypot(q.x - s0.x, q.z - s0.z) < START_PAD_R + 5) continue; // still on, or settling after stepping off, the start pad
    const dy = q.y - BALL_RADIUS;
    maxDy = Math.max(maxDy, Math.abs(dy));
    dip = Math.max(dip, -dy);
  }
  sim.free();
  // The ball settles a little into the groove at each seam; a single curve has none and stays flat.
  const hasSeams = steer === "line";
  // Seams are a faint groove (PLATFORM_SEAM_DROP): the ball must dip into it, but never hop or
  // sink more than a few hundredths, which is what costs it speed.
  if (maxDy > 0.05 || (hasSeams ? dip < 0.01 : maxDy > 0.02)) { failed = true; console.error(`FAIL ${level.id}: floor deviation ${maxDy.toFixed(3)}, dip ${dip.toFixed(3)} (${hasSeams ? "expected a seam groove" : "expected flat"})`); }
  else console.log(`ok ${level.id}: floor deviation ${maxDy.toFixed(4)}, groove dip ${dip.toFixed(3)}`);
}
Object.assign(TUNING, { gravity: DEFAULT_TUNING.gravity, throttleForce: DEFAULT_TUNING.throttleForce, maxSpeed: DEFAULT_TUNING.maxSpeed });
// A fence is exactly its drawn rail: straight down onto a fenced span's rail line the first hit is
// the rail's top (FENCE_RAIL_Y + RAIL_R above the surface), across it at rail height the hit is the
// tube's side, and just above the rail there is nothing; where a span stops there is no rail at all.
// Nothing guarantees the ball stays in: it can roll over a rail.
{
  // A probe on a 10..20 curve's arc side at `s` along it, facing out over that side.
  const arcProbe = (fences: object, key: string, s: number) => {
    const piece = { type: "curve", x: 0, y: 0, z: 0, inner: 10, outer: 20, rot: 0, fences } as Piece & { type: "curve" };
    const side = fenceSides(piece as Piece & { type: "curve" }).find((q) => q.key === key)!, a = side.at(s, FENCE_RAIL_INSET), b = side.at(s, FENCE_RAIL_INSET + 0.1), l = Math.hypot(a.x - b.x, a.z - b.z);
    return { piece: piece as unknown as Record<string, unknown>, at: [a.x, a.z] as [number, number], surface: 0, out: [(a.x - b.x) / l, (a.z - b.z) / l] as [number, number] };
  };
  const cases: { name: string; piece: Record<string, unknown>; at: [number, number]; surface: number; out: [number, number]; fenced: boolean }[] = [
    { name: "slab-n", piece: { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: { n: [[0, 5]] } }, at: [-2.5, -10 + FENCE_RAIL_INSET], surface: 0, out: [0, -1], fenced: true },
    { name: "slab-n-gap", piece: { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: { n: [[0, 5]] } }, at: [2.5, -10 + FENCE_RAIL_INSET], surface: 0, out: [0, -1], fenced: false },
    // Arc probes sit on a vertex of the rail's polyline (7.5 degree steps), where it meets the arc.
    { name: "outer", ...arcProbe({ outer: [[0, 45]] }, "outer", 22.5), fenced: true },
    { name: "outer-gap", ...arcProbe({ outer: [[0, 45]] }, "outer", 70), fenced: false },
    { name: "inner", ...arcProbe({ inner: [[0, 45]] }, "inner", 22.5), fenced: true },
    { name: "ramp-e", piece: { type: "ramp", x: 0, y: 0, z: -12, w: 8, d: 24, rot: 0, rise: 4, fences: { e: [[0, 12]] } }, at: [4 - FENCE_RAIL_INSET, -18], surface: 4, out: [1, 0], fenced: true },
    { name: "ramp-e-gap", piece: { type: "ramp", x: 0, y: 0, z: -12, w: 8, d: 24, rot: 0, rise: 4, fences: { e: [[0, 12]] } }, at: [4 - FENCE_RAIL_INSET, -6], surface: 0, out: [1, 0], fenced: false },
  ];
  for (const c of cases) {
    const level = testLevel({ id: `fence-${c.name}`, name: c.name, pieces: [
      c.piece,
      { type: "start", x: -40, y: 0, z: 40 },
      { type: "slab", x: -40, y: 0, z: 40, w: 4, d: 4, rot: 0, fences: {} },
      { type: "goal", x: -40, y: 0, z: 39, r: 1 },
    ] });
    const sim = await createSim(level, { x: -40, y: 0, z: 40 });
    sim.step(0, 0, 0);
    const ray = (o: [number, number, number], d: [number, number, number], len: number) =>
      sim.world.castRay(new RAPIER_RT.Ray({ x: o[0], y: o[1], z: o[2] }, { x: d[0], y: d[1], z: d[2] }), len, true, undefined, undefined, undefined, sim.ball)?.timeOfImpact ?? null;
    // On a curve a fenced probe sits on the nearest vertex of the rail's own line, where it is centred.
    const line = fenceRuns(level.pieces[0]!).flatMap(fenceRailPath).filter((v) => Math.abs(v[1] - c.surface - FENCE_RAIL_Y) < 0.01);
    const near = c.fenced && level.pieces[0]!.type === "curve" ? line.reduce((b, v) => (Math.hypot(v[0] - c.at[0], v[2] - c.at[1]) < Math.hypot(b[0] - c.at[0], b[2] - c.at[1]) ? v : b), line[0]!) : null;
    const [x, z] = near ? [near[0], near[2]] : c.at, top = c.surface + FENCE_RAIL_Y + RAIL_R;
    const down = ray([x, c.surface + 3, z], [0, -1, 0], 6), hitY = down === null ? null : c.surface + 3 - down;
    const across = ray([x - c.out[0], c.surface + FENCE_RAIL_Y, z - c.out[1]], [c.out[0], 0, c.out[1]], 2);
    const above = ray([x - c.out[0], top + 0.02, z - c.out[1]], [c.out[0], 0, c.out[1]], 2);
    sim.free();
    const ok = c.fenced
      ? hitY !== null && Math.abs(hitY - top) < 0.01 && across !== null && Math.abs(across - (1 - RAIL_R)) < 0.01 && above === null
      : (hitY === null || hitY < c.surface + 0.01) && across === null;
    if (!ok) { failed = true; console.error(`FAIL fence-${c.name}: top hit ${hitY?.toFixed(3)} (rail top ${top.toFixed(3)}), across ${across?.toFixed(3)}, above ${above?.toFixed(3)}`); }
    else console.log(`ok fence-${c.name}: ${c.fenced ? `rail top at ${hitY!.toFixed(3)}, side at ${across!.toFixed(3)}, nothing above it` : "no rail where the fence stops"}`);
  }
}
// A curve's ends run dead straight for CURVE_STRAIGHT before its arc, in its footprint (and so its
// floor) and in its drawn mesh, whose walls break exactly where the straights meet the arc.
{
  const S = CURVE_STRAIGHT, piece = { type: "curve", x: 0, y: 0, z: 0, inner: 10, outer: 20, rot: 0, fences: {} } as unknown as Curve;
  const fp = platformFootprint(piece), same = (q: [number, number][], r: [number, number][]) => q.every((v, i) => Math.hypot(v[0] - r[i]![0], v[1] - r[i]![1]) < 1e-9);
  const ends = same(fp[0]!, [[10, 0], [20, 0], [20, -S], [10, -S]]) && same(fp[fp.length - 1]!, [[S, -10], [S, -20], [0, -20], [0, -10]]);
  const c = curveStrip(piece), m = platformMesh(c.len, 10, PLATFORM_THICKNESS, PLATFORM_LIP, 1, { at: (u, z) => c.at(u, 15 + z), knots: [c.s, c.len - c.s] });
  const has = (x: number, z: number) => { for (let i = 0; i < m.positions.length; i += 3) if (Math.hypot(m.positions[i]! - x, m.positions[i + 2]! - z) < 1e-6) return true; return false; };
  const drawn = has(20, -S) && has(10, -S) && has(S, -20) && has(S, -10);
  if (!ends || !drawn) { failed = true; console.error(`FAIL curve-straight: footprint ends straight ${ends}, drawn walls break at the arc ${drawn}`); }
  else console.log(`ok curve-straight: both ends run ${S} straight before the arc`);
}
// A stool slides along its track when pushed that way and stops at the track's end; pushed from
// the side it does not move at all and stops the ball like a wall. `slide` "z" turns the track to
// run front and back, across the block's depth.
for (const [name, rot, slide, from, dir, expect] of [
  ["along", 0, "x", [-6, -6], [1, 0], { x: 3, z: -6, slid: true }],
  ["across", 0, "x", [0, -2], [0, -1], { x: 0, z: -6, slid: false }],
  ["rotated", 90, "x", [0, -2], [0, -1], { x: 0, z: -9, slid: true }],
  ["front-back", 0, "z", [0, -2], [0, -1], { x: 0, z: -9.5, slid: true }],
  ["front-back-across", 0, "z", [-6, -6], [1, 0], { x: 0, z: -6, slid: false }],
] as const) {
  const level = testLevel({ id: `stool-${name}`, name, pieces: [
    { type: "start", x: -6, y: 0, z: -14 },
    { type: "slab", x: 0, y: 0, z: -8, w: 16, d: 16, rot: 0, fences: {} },
    { type: "stool", x: 0, y: 0, z: -6, w: 2, h: 1.2, d: 1, rot, track: 8, offset: 0, ...(slide === "z" ? { slide } : {}) },
    { type: "goal", x: 6, y: 0, z: -14, r: 1 },
  ] });
  const sim = await createSim(level, { x: from[0], y: 0, z: from[1] });
  const stool = sim.planks[0]!.body, y0 = stool.translation().y;
  // The world axis the track runs along; any motion off it is drift.
  const trackZ = (rot === 90) !== (slide === "z");
  let ball = sim.ball.translation(), drift = 0;
  for (let i = 0; i < 120 * 4; i++) {
    sim.step(1, dir[0], dir[1]);
    ball = sim.ball.translation();
    const t = stool.translation(), q = stool.rotation();
    drift = Math.max(drift, Math.abs(t.y - y0), !expect.slid ? Math.abs(t.z + 6) + Math.abs(t.x) : trackZ ? Math.abs(t.x) : Math.abs(t.z + 6), Math.hypot(q.x, q.z));
  }
  const t = stool.translation();
  sim.free();
  const atEnd = Math.abs(t.x - expect.x) < 0.05 && Math.abs(t.z - expect.z) < 0.05;
  const blocked = expect.slid || (dir[0] ? ball.x < -1 - BALL_RADIUS + 0.1 : ball.z > -6 + 0.5 + BALL_RADIUS - 0.1);
  if (!atEnd || drift > 0.01 || !blocked) { failed = true; console.error(`FAIL stool-${name}: stool at x ${t.x.toFixed(3)} z ${t.z.toFixed(3)}, off-track drift ${drift.toFixed(4)}, ball z ${ball.z.toFixed(2)}`); }
  else console.log(`ok stool-${name}: ${expect.slid ? "slid to the track end" : "held still and stopped the ball"} (x ${t.x.toFixed(3)} z ${t.z.toFixed(3)}, off-track drift ${drift.toFixed(4)})`);
}
// A jump pad's launch square throws the ball its rise (4 layers) up from the pad's top, keeping its
// speed and heading over the ground; rolling up the ramp and over the top beside the square does nothing.
for (const [name, from, push] of [
  ["rest", [0, -10], 0],
  ["rolling", [0, -2], 1],
  ["beside", [1, -2], 1],
] as const) {
  const level = testLevel({ id: `jump-${name}`, name, pieces: [
    { type: "start", x: -4, y: 0, z: 0 },
    { type: "slab", x: 0, y: 0, z: -12, w: 12, d: 30, rot: 0, fences: {} },
    { type: "jump", x: 0, y: 0, z: -10, w: 4, d: 4, rot: 0, rise: 4 },
    { type: "goal", x: 4, y: 0, z: 0, r: 1 },
  ] });
  const sim = await createSim(level, { x: from[0], y: name === "rest" ? JUMP_H : 0, z: from[1] });
  // The launch is the step with the biggest upward kick; bumping onto the ramp gives a smaller one.
  let peak = -Infinity, before = { x: 0, z: 0 }, after = { x: 0, z: 0 }, kick = 0, prevY = 0;
  for (let i = 0; i < 120 * 6; i++) {
    const v0 = sim.ball.linvel();
    sim.step(push, 0, -1);
    const v = sim.ball.linvel(), y = sim.ball.translation().y - BALL_RADIUS - JUMP_H;
    if (v.y - prevY > kick) { kick = v.y - prevY; before = { x: v0.x, z: v0.z }; after = { x: v.x, z: v.z }; }
    prevY = v.y;
    peak = Math.max(peak, y);
    if (peak > 2 && v.y < 0) break;
  }
  sim.free();
  const launched = peak > 2, sb = Math.hypot(before.x, before.z), sa = Math.hypot(after.x, after.z);
  const turn = sb > 0.1 ? Math.abs(Math.atan2(after.x, after.z) - Math.atan2(before.x, before.z)) : 0;
  const ok = name === "beside" ? !launched && peak < 0.5 : launched && Math.abs(peak - 4) < 0.1 && (sb < 0.1 || (Math.abs(sa - sb) / sb < 0.03 && turn < 0.01));
  if (!ok) { failed = true; console.error(`FAIL jump-${name}: peak ${peak.toFixed(3)}, launched ${launched}, ground speed ${sb.toFixed(2)} -> ${sa.toFixed(2)}, turn ${turn.toFixed(4)}`); }
  else console.log(`ok jump-${name}: ${launched ? `peaked ${peak.toFixed(3)} above the pad, ground speed ${sb.toFixed(2)} -> ${sa.toFixed(2)}` : `not launched (peak ${peak.toFixed(3)})`}`);
}
// A blockade and a pillar in the lane must stop the ball, not let it through or pop it up.
for (const piece of [{ type: "blockade", x: 0, y: 0, z: -8, rot: 0 }, { type: "pillar", x: 0, y: 0, z: -8 }]) {
  const level = testLevel({ id: `stop-${piece.type}`, name: piece.type, pieces: [
    { type: "start", x: 0, y: 0, z: 0 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 30, rot: 0, fences: {} },
    piece,
    { type: "goal", x: 0, y: 0, z: -18, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let minZ = 0, maxY = 0;
  for (let i = 0; i < 120 * 4; i++) {
    sim.step(1, 0, -1);
    const p = sim.ball.translation();
    minZ = Math.min(minZ, p.z); maxY = Math.max(maxY, p.y);
  }
  sim.free();
  if (minZ < -8 || maxY > 1.2) { failed = true; console.error(`FAIL stop-${piece.type}: ball passed the ${piece.type} (z ${minZ.toFixed(2)}, y ${maxY.toFixed(2)})`); }
  else console.log(`ok stop-${piece.type}: ${piece.type} holds the ball`);
}
// A ramp must carry the ball a whole layer up or down and leave it resting on the far slab.
for (const rise of [RAMP_RISE, -RAMP_RISE]) {
  const y0 = rise > 0 ? 0 : LAYER_H, y1 = y0 + rise * LAYER_H;
  const level = testLevel({ id: `ramp-${rise > 0 ? "up" : "down"}`, name: "ramp", pieces: [
    { type: "start", x: 0, y: y0, z: -3 },
    { type: "slab", x: 0, y: y0, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "ramp", x: 0, y: y0, z: -20, w: 10, d: 20, rot: 0, rise, fences: { e: true, w: true } },
    { type: "slab", x: 0, y: y1, z: -40, w: 10, d: 20, rot: 0, fences: {} },
    { type: "goal", x: 0, y: y1, z: -45, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 12 && p.z > -42; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  sim.free();
  if (p.z > -42 || Math.abs(p.y - (y1 + BALL_RADIUS)) > 0.1) { failed = true; console.error(`FAIL ramp ${rise}: ball ended at z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}, expected y ${y1 + BALL_RADIUS}`); }
  else console.log(`ok ramp-${rise > 0 ? "up" : "down"}: ball rides the ramp to y ${p.y.toFixed(2)}`);
}
// A hole swallows the ball; the floor beside it still carries one. A hole across the slab's
// edge notches it: the ball falls through the notch and rolls past it.
for (const [name, x, hx, falls] of [["through", 0, 0, true], ["beside", 4, 0, false], ["notch", 4, 5, true], ["past-notch", -1, 5, false]] as const) {
  const level = testLevel({ id: `hole-${name}`, name, pieces: [
    { type: "start", x, y: 0, z: 0 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 30, rot: 0, fences: {} },
    { type: "hole", x: hx, y: 0, z: -9, w: 4, d: 6, rot: 0 },
    { type: "goal", x: 0, y: 0, z: -18, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let minY = Infinity;
  for (let i = 0; i < 120 * 4; i++) { sim.step(1, 0, -1); minY = Math.min(minY, sim.ball.translation().y); }
  sim.free();
  const fell = minY < -2;
  if (fell !== falls) { failed = true; console.error(`FAIL hole-${name}: ball ${fell ? "fell" : "stayed up"} (min y ${minY.toFixed(2)})`); }
  else console.log(`ok hole-${name}: ball ${fell ? "falls through the hole" : "rolls past the hole"}`);
}
// A raised slab's side wall must stop a ball rolling along the slab beneath it.
{
  const level = testLevel({ id: "side", name: "side", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -15, w: 10, d: 30, rot: 0, fences: {} },
    { type: "slab", x: 0, y: 2, z: -20, w: 10, d: 20, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 2, z: -25, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let minZ = 0;
  for (let i = 0; i < 120 * 4; i++) { sim.step(1, 0, -1); minZ = Math.min(minZ, sim.ball.translation().z); }
  sim.free();
  if (minZ < -10) { failed = true; console.error(`FAIL side: ball went through a slab's side wall (z ${minZ.toFixed(2)})`); }
  else console.log(`ok side: slab side wall holds (stopped at z ${minZ.toFixed(2)})`);
}
// A barrier stops the ball; a crate gets shoved along and stays on the floor.
{
  const level = testLevel({ id: "push", name: "push", pieces: [
    { type: "start", x: 0, y: 0, z: 0 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 30, rot: 0, fences: {} },
    { type: "crate", x: 0, y: 0, z: -6, w: 1.2, h: 1.2, d: 1.2, rot: 0 },
    { type: "barrier", x: 0, y: 0, z: -16, rot: 0 },
    { type: "goal", x: 0, y: 0, z: -19, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let minZ = 0;
  for (let i = 0; i < 120 * 5; i++) { sim.step(1, 0, -1); minZ = Math.min(minZ, sim.ball.translation().z); }
  const c = sim.crates[0]!.body.translation();
  sim.free();
  if (c.z > -8 || c.y < 0.3 || c.z < -15.6) { failed = true; console.error(`FAIL push: crate ended at z ${c.z.toFixed(2)} y ${c.y.toFixed(2)}`); }
  else if (minZ < -15) { failed = true; console.error(`FAIL push: ball passed the barrier (z ${minZ.toFixed(2)})`); }
  else console.log(`ok push: crate shoved to z ${c.z.toFixed(2)}, barrier holds at z ${minZ.toFixed(2)}`);
}
// A slab tilted 90 degrees is a wall: solid from the side.
{
  const level = testLevel({ id: "wall", name: "wall", pieces: [
    { type: "start", x: 0, y: 0, z: 0 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 30, rot: 0, fences: {} },
    { type: "slab", x: 0, y: 1, z: -12, w: 10, d: 2, rot: 0, tilt: 90, fences: {} },
    { type: "goal", x: 0, y: 0, z: -18, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let minZ = 0;
  for (let i = 0; i < 120 * 4; i++) { sim.step(1, 0, -1); minZ = Math.min(minZ, sim.ball.translation().z); }
  sim.free();
  if (minZ < -11.6) { failed = true; console.error(`FAIL wall: ball went through a tilted slab (z ${minZ.toFixed(2)})`); }
  else console.log(`ok wall: tilted slab stops the ball at z ${minZ.toFixed(2)}`);
}
// A hanging bridge: at rest it sags a little below its hinge line; the ball rolls down onto it,
// across the planks and back up the far platform's lip, and the chain never comes apart.
{
  const level = testLevel({ id: "bridge", name: "bridge", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "bridge", x: 0, y: 0, z: -15, w: 4, d: 10, rot: 0 },
    { type: "slab", x: 0, y: 0, z: -25, w: 10, d: 10, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 0, z: -28, r: 2 },
  ] });
  const sim = await createSim(level);
  const planks = sim.bridges[0]!.planks;
  const half = bridgeChain(level.pieces[2] as Bridge).seg / 2;
  // World position of a plank's hinge point, a half link along its own z axis.
  const hinge = (b: RAPIER.RigidBody, s: number) => {
    const q = b.rotation(), t = b.translation();
    const x = 2 * (q.x * q.z + q.w * q.y) * s, y = 2 * (q.y * q.z - q.w * q.x) * s, z = (1 - 2 * (q.x * q.x + q.y * q.y)) * s;
    return { x: t.x + x, y: t.y + y, z: t.z + z };
  };
  const gaps = () => {
    let worst = 0;
    for (let k = 1; k < planks.length; k++) {
      const a = hinge(planks[k - 1]!, -half), b = hinge(planks[k]!, half);
      worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
    }
    return worst;
  };
  for (let i = 0; i < 240; i++) sim.step(0, 0, -1);
  const restSag = Math.min(...planks.map((b) => b.translation().y)) + BRIDGE_HINGE_DROP;
  let minY = Infinity, maxGap = 0, p = sim.ball.translation();
  for (let i = 0; i < 120 * 10 && p.z > -24; i++) {
    sim.step(1, 0, -1);
    p = sim.ball.translation();
    if (p.z < -10 && p.z > -20) minY = Math.min(minY, p.y);
    maxGap = Math.max(maxGap, gaps());
  }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  const loadedSag = Math.min(...planks.map((b) => b.translation().y)) + BRIDGE_HINGE_DROP;
  sim.free();
  const crossed = p.z < -22 && Math.abs(p.y - BALL_RADIUS) < 0.1;
  if (!crossed || restSag > -0.05 || restSag < -2 || minY < -2 || maxGap > 0.08) {
    failed = true;
    console.error(`FAIL bridge: ball ended at z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}, rest sag ${restSag.toFixed(3)}, lowest ball y ${minY.toFixed(2)}, worst hinge gap ${maxGap.toFixed(3)}`);
  } else console.log(`ok bridge: crossed (lowest ball y ${minY.toFixed(2)}), sag ${(-restSag).toFixed(3)} at rest, ${(-loadedSag).toFixed(3)} after, hinge gap ${maxGap.toFixed(4)}`);
}
// Rails down a gap: the ball rolls off a higher platform onto rails fixed into its wall (side end),
// rides them down, and drops off their top end (standing at fence height over the lower platform)
// onto that platform. At half throttle (full throttle flies it off the edge past the start of a
// curve), on two rails or one, straight or round a curve (pushed along the rails' heading, as a
// player steers), it never kicks upward while riding them.
const railsRide = async (lines: 1 | 2, end: { x: number; z: number }, mid?: { x: number; z: number }) => {
  const ya = 2, yb = 0;
  const level = testLevel({ id: "rails", name: "rails", pieces: [
    { type: "start", x: 0, y: 2, z: -2 },
    { type: "slab", x: 0, y: 2, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "rails", x: 0, y: ya, z: -10, rot: 0, lines, a: "side", b: "top",
      path: [{ x: end.x, y: yb - ya, z: end.z + 10, bend: 0, ...(mid ? { mid: { x: mid.x, y: (yb - ya) / 2, z: mid.z + 10 } } : {}) }] },
    { type: "slab", x: end.x, y: 0, z: -25, w: 10, d: 10, rot: 0, fences: {} },
    { type: "goal", x: end.x, y: 0, z: -28, r: 2 },
  ] });
  const sim = await createSim(level);
  const rings = railsRingsWorld(level.pieces[2] as Rails, level);
  let kick = 0, p = sim.ball.translation();
  for (let i = 0; i < 120 * 12 && p.z > -23; i++) {
    // Steer along the nearest ring's heading, or straight on (-z) off the rails.
    let best = 9, dx = 0, dz = -1;
    for (const r of rings) {
      const dist = Math.hypot(r.c[0] - p.x, r.c[2] - p.z), l = Math.hypot(r.d[0], r.d[2]);
      if (dist < best && l > 1e-3) { best = dist; dx = r.d[0] / l; dz = r.d[2] / l; }
    }
    if (best > 1.5) { dx = 0; dz = -1; }
    sim.step(0.5, dx, dz);
    p = sim.ball.translation();
    if (p.z < -11 && p.z > end.z + 1) kick = Math.max(kick, sim.ball.linvel().y);
  }
  for (let i = 0; i < 60; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  sim.free();
  return { p, kick };
};
for (const [name, lines, end, mid] of [
  ["straight, 2 rails", 2, { x: 0, z: -21 }, undefined],
  ["straight, 1 rail", 1, { x: 0, z: -21 }, undefined],
  ["curved, 2 rails", 2, { x: 3, z: -21 }, { x: 1, z: -15.6 }],
] as const) {
  const { p, kick } = await railsRide(lines, end, mid);
  if (p.z > -22 || Math.abs(p.x - end.x) > 4 || Math.abs(p.y - BALL_RADIUS) > 0.05 || kick > 0.3) {
    failed = true;
    console.error(`FAIL rails (${name}): ball ended at x ${p.x.toFixed(2)} z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}, biggest upward kick on the rails ${kick.toFixed(2)}`);
  } else console.log(`ok rails (${name}): rode down onto the far platform (x ${p.x.toFixed(2)}), biggest upward kick ${kick.toFixed(2)}`);
}
// Rails meet platforms square, even sloping down a gap and coming in at an angle: a side end goes
// level into the middle of the wall, square to it, and a top end turns straight down into the top;
// next to each, a level stub at least 0.5 long points square away from the platform, and only past
// it does the rail slope or turn.
{
  const level = testLevel({ id: "ends", name: "ends", pieces: [
    { type: "start", x: 0, y: 0, z: 0 },
    { type: "slab", x: 0, y: 0, z: 0, w: 8, d: 8, rot: 0, fences: {} },
    { type: "slab", x: 0, y: -2, z: -20, w: 8, d: 8, rot: 0, fences: {} },
    { type: "rails", x: 1, y: 0, z: -4, rot: 0, path: [{ x: -1, y: -2, z: -13, bend: 0 }], lines: 2, a: "side", b: "top" },
    { type: "goal", x: 0, y: 0, z: -20, r: 1 },
  ] });
  const rings = railsRingsWorld(level.pieces[3] as Rails, level);
  const c = rings.map((r) => r.c);
  // The longest level straight run (between consecutive rings) within `reach` of (x, z), heading `dir`.
  const stub = (x: number, z: number, dir: [number, number], reach: number) => {
    let best = 0;
    for (let k = 1; k < c.length; k++) {
      const [u, v] = [c[k - 1]!, c[k]!], dx = v[0] - u[0], dz = v[2] - u[2], len = Math.hypot(dx, dz);
      const near = Math.hypot(u[0] - x, u[2] - z) < reach && Math.hypot(v[0] - x, v[2] - z) < reach;
      if (near && len > 1e-6 && Math.abs(v[1] - u[1]) < 1e-6 && Math.abs(Math.abs(dx * dir[0] + dz * dir[1]) / len - 1) < 1e-6) best = Math.max(best, len);
    }
    return best;
  };
  // Side end a, on slab 1's south wall (z = -4): goes in along +z, level, at the wall's middle (y -0.5).
  const inZ = c[0]![2] - c[1]![2], wallMid = Math.abs(c[1]![1] - (-0.5)) < 1e-6;
  const square = Math.abs(c[0]![0] - c[1]![0]) < 1e-6 && Math.abs(c[0]![1] - c[1]![1]) < 1e-6 && inZ > 0.3 && wallMid;
  const sideStub = stub(1, -4, [0, 1], 1.2);
  // Top end b, over slab 2 at (0, -17): its last run goes straight down under the surface (y -2).
  const [bl, l] = [c[c.length - 2]!, c[c.length - 1]!];
  const down = Math.hypot(l[0] - bl[0], l[2] - bl[2]) < 1e-6 && l[1] < bl[1] && l[1] < -2;
  const topStub = stub(0, -17, [1 / Math.hypot(1, 13), 13 / Math.hypot(1, 13)], 1.2);
  if (!square || !down || sideStub < 0.5 || topStub < 0.5) {
    failed = true;
    console.error(`FAIL rails ends: side end square ${square} (axis y ${c[1]![1].toFixed(3)}), level stub ${sideStub.toFixed(2)}; top end down ${down}, level stub ${topStub.toFixed(2)}`);
  } else console.log(`ok rails ends: side end level into the wall's middle, top end straight down, level stubs ${sideStub.toFixed(2)} and ${topStub.toFixed(2)} long`);
}
// A knock-down plank stands balanced on its hinge until the ball touches it, then falls across
// the gap, and the ball can roll over it onto the far platform.
{
  const level = testLevel({ id: "plank", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -10, w: 4, h: 10, rot: 0, freeze: true },
    { type: "slab", x: 0, y: 0, z: -24.5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 0, z: -27, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  for (let i = 0; i < 120 * 3; i++) sim.step(0, 0, -1);
  const standing = plank.translation(), frozen = sim.planks[0]!.frozen !== undefined;
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 12 && p.z > -24; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  const fallen = plank.translation();
  sim.free();
  if (!frozen || Math.abs(standing.y - (PLANK_HINGE_H + 5)) > 0.05 || Math.abs(standing.z + 10) > 0.05) { failed = true; console.error(`FAIL plank: did not hold still (frozen ${frozen}, centre y ${standing.y.toFixed(2)} z ${standing.z.toFixed(2)})`); }
  else if (fallen.y > 0.6 || fallen.z > -14) { failed = true; console.error(`FAIL plank: did not fall (centre y ${fallen.y.toFixed(2)} z ${fallen.z.toFixed(2)})`); }
  else if (p.z > -22 || Math.abs(p.y - BALL_RADIUS) > 0.1) { failed = true; console.error(`FAIL plank: ball ended at z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}`); }
  else console.log(`ok plank: stood frozen until touched, fell to centre y ${fallen.y.toFixed(2)} z ${fallen.z.toFixed(2)}, ball crossed to z ${p.z.toFixed(2)}`);
}
// A point on a body, from its local frame to world.
function bodyPoint(b: RAPIER.RigidBody, x: number, y: number, z: number) {
  const t = b.translation(), q = b.rotation();
  const ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z, iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z;
  return { x: t.x + ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: t.y + iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: t.z + iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
}
// A side plank hinged to a platform's wall stands until touched, then swings freely and rests on
// whatever it hits: down onto a lower platform, across onto a far one, or back onto its own.
{
  const level = testLevel({ id: "plank-side-down", name: "plank", pieces: [
    { type: "start", x: 0, y: 4, z: -2 },
    { type: "slab", x: 0, y: 4, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 4, z: -10, w: 4, h: 8, rot: 0, side: true, freeze: true },
    { type: "slab", x: 0, y: 0, z: -20.5, w: 10, d: 20, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 0, z: -28, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  for (let i = 0; i < 120 * 2; i++) sim.step(0, 0, -1);
  const standing = plank.translation();
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 12 && p.z > -24; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  const tip = Math.min(bodyPoint(plank, 0, 4, PLANK_T / 2).y, bodyPoint(plank, 0, 4, -PLANK_T / 2).y);
  sim.free();
  if (Math.abs(standing.y - (4 - PLATFORM_EDGE_DROP - PLANK_T / 2 + 4)) > 0.05) { failed = true; console.error(`FAIL plank-side-down: did not stand on the wall (centre y ${standing.y.toFixed(2)})`); }
  else if (tip < -0.05 || tip > 0.3) { failed = true; console.error(`FAIL plank-side-down: tip did not come to rest on the lower platform (tip y ${tip.toFixed(3)})`); }
  else if (p.z > -24 || Math.abs(p.y - BALL_RADIUS) > 0.1) { failed = true; console.error(`FAIL plank-side-down: ball ended at z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}`); }
  else console.log(`ok plank-side-down: swung down onto the lower platform (tip y ${tip.toFixed(3)}), ball rolled down it to z ${p.z.toFixed(2)}`);
}
{
  const level = testLevel({ id: "plank-side", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -10, w: 4, h: 10, rot: 0, side: true, freeze: true },
    { type: "slab", x: 0, y: 0, z: -24.5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 0, z: -27, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 12 && p.z > -24; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  const tip = Math.min(bodyPoint(plank, 0, 5, PLANK_T / 2).y, bodyPoint(plank, 0, 5, -PLANK_T / 2).y);
  sim.free();
  if (tip < -0.05 || tip > 0.1) { failed = true; console.error(`FAIL plank-side: tip did not rest on the far platform (tip y ${tip.toFixed(3)})`); }
  else if (p.z > -22 || Math.abs(p.y - BALL_RADIUS) > 0.1) { failed = true; console.error(`FAIL plank-side: ball ended at z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}`); }
  else console.log(`ok plank-side: rested across on the far platform (tip y ${tip.toFixed(3)}), ball crossed to z ${p.z.toFixed(2)}`);
}
{
  const level = testLevel({ id: "plank-side-in", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -10, w: 4, h: 6, rot: 0, side: true, freeze: true },
    { type: "goal", x: 0, y: 0, z: -4, r: 2 },
  ] });
  const sim = await createSim(level);
  const pl = sim.planks[0]!;
  pl.body.setBodyType(0 as RAPIER.RigidBodyType, true);
  pl.frozen = undefined;
  pl.body.setAngvel({ x: 2, y: 0, z: 0 }, true);
  for (let i = 0; i < 120 * 10; i++) sim.step(0, 0, 0);
  const top = bodyPoint(pl.body, 0, 3, 0), spin = Math.abs(pl.body.angvel().x);
  sim.free();
  if (top.z < -9.9 || top.y < 0.2 || spin > 0.05) { failed = true; console.error(`FAIL plank-side-in: pushed inward it did not come to rest leaning on its platform (top y ${top.y.toFixed(2)} z ${top.z.toFixed(2)}, spin ${spin.toFixed(3)})`); }
  else console.log(`ok plank-side-in: pushed inward it rests leaning over its platform (top y ${top.y.toFixed(2)} z ${top.z.toFixed(2)})`);
}
// A side plank can start past level, down to hanging straight down: frozen at 135° it holds there,
// and a tilt past 180° clamps to hanging straight down.
for (const [tilt, want] of [[135, 135], [200, 180]] as const) {
  const level = testLevel({ id: "plank-side-tilt", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 10, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -10, w: 4, h: 6, rot: 0, tilt, side: true, freeze: true },
    { type: "goal", x: 0, y: 0, z: -4, r: 1 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, 0);
  const body = sim.planks[0]!.body, t = body.translation(), q = body.rotation();
  sim.free();
  const a = (want * Math.PI) / 180, hy = -(PLATFORM_EDGE_DROP + PLANK_T / 2), hz = -10 + SIDE_PLANK_HINGE_Z;
  const ey = hy + 3 * Math.cos(a), ez = hz - 3 * Math.sin(a), got = (2 * Math.atan2(-q.x, q.w) * 180) / Math.PI;
  if (Math.abs(t.y - ey) > 0.01 || Math.abs(t.z - ez) > 0.01 || Math.abs(((got - want + 540) % 360) - 180) > 0.5) { failed = true; console.error(`FAIL plank-side-tilt ${tilt}: centre y ${t.y.toFixed(3)} z ${t.z.toFixed(3)} (want ${ey.toFixed(3)} ${ez.toFixed(3)}), angle ${got.toFixed(1)} (want ${want})`); }
  else console.log(`ok plank-side-tilt ${tilt}: held at ${got.toFixed(1)} degrees, centre y ${t.y.toFixed(3)} z ${t.z.toFixed(3)}`);
}
// Level 5's setup: a side plank lying level on a stool, over a fenced platform below. Pushed away,
// the stool takes the plank's support with it; the plank must wake and swing down until its tip is
// on the floor, clear of the fence's low rail.
{
  const level = testLevel({ id: "plank-stool", name: "plank", pieces: [
    { type: "start", x: -3.5, y: 4, z: -60 },
    { type: "slab", x: 0, y: 4, z: -62, w: 16, d: 16, rot: 0, fences: { n: true } },
    { type: "stool", x: 0, y: 4, z: -66.5, w: 2, h: 1.2, d: 1, rot: 0, track: 12, offset: 0 },
    { type: "slab", x: 0, y: 6, z: -78, w: 8, d: 8, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 6, z: -74, w: 4, h: 8, rot: 180, tilt: 90, side: true },
    { type: "goal", x: 6, y: 4, z: -56, r: 1 },
  ] });
  const sim = await createSim(level, { x: -3.5, y: 4, z: -66.5 });
  const plank = sim.planks.find((p) => level.pieces[p.index]!.type === "plank")!.body;
  const tip = () => Math.min(bodyPoint(plank, 0, 4, PLANK_T / 2).y, bodyPoint(plank, 0, 4, -PLANK_T / 2).y);
  for (let i = 0; i < 240; i++) sim.step(0, 0, 0);
  const onStool = tip();
  for (let i = 0; i < 600; i++) sim.step(1, 1, 0);
  for (let i = 0; i < 600; i++) sim.step(0, 0, 0);
  const down = tip();
  sim.free();
  if (onStool < 5 || down < 3.95 || down > 4.05) { failed = true; console.error(`FAIL plank-stool: tip at ${onStool.toFixed(3)} on the stool, ${down.toFixed(3)} after it was pushed away (floor at 4)`); }
  else console.log(`ok plank-stool: tip rested on the stool at ${onStool.toFixed(3)}, then fell to the floor at ${down.toFixed(3)}`);
}
// A plank's mounts are solid exactly as drawn: straight down onto a top plank's yoke the first hit
// is the yoke's top, and level into a side plank's wall bracket from outside it is the bracket's face.
for (const side of [false, true]) {
  const plank = { type: "plank", x: 0, y: 0, z: -8, w: 4, h: 6, rot: 0, tilt: 0, side, freeze: true } as const;
  const level = testLevel({ id: "plank-mounts", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: side ? -4 : -5, w: 10, d: side ? 8 : 10, rot: 0, fences: {} },
    plank,
    { type: "goal", x: 3, y: 0, z: -3, r: 1 },
  ] });
  const sim = await createSim(level);
  sim.step(0, 0, 0);
  const m = plankMounts(level.pieces[2] as Piece & { type: "plank" })[0]!, z0 = -8;
  const cast = (o: [number, number, number], d: [number, number, number]) =>
    sim.world.castRay(new RAPIER_RT.Ray({ x: o[0], y: o[1], z: o[2] }, { x: d[0], y: d[1], z: d[2] }), 5, true, undefined, undefined, undefined, sim.ball)?.timeOfImpact ?? null;
  // A top yoke from above; a side bracket from out beyond the wall (local -z), level with its middle.
  const hit = side ? cast([m.x, m.y, z0 - 3], [0, 0, 1]) : cast([m.x, 3, z0 + m.z], [0, -1, 0]);
  const want = side ? 3 + (m.z - m.d / 2) : 3 - (m.y + m.h / 2);
  sim.free();
  if (hit === null || Math.abs(hit - want) > 0.005) { failed = true; console.error(`FAIL plank-mounts ${side ? "side" : "top"}: hit at ${hit?.toFixed(4)}, drawn surface at ${want.toFixed(4)}`); }
  else console.log(`ok plank-mounts ${side ? "side" : "top"}: the ${side ? "bracket's face" : "yoke's top"} is solid where it is drawn (${hit.toFixed(4)} vs ${want.toFixed(4)})`);
}
// A plank standing in the middle of a platform, with floor in front of it, must still topple.
{
  const level = testLevel({ id: "plank-mid", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -10, w: 10, d: 20, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -7, w: 4, h: 6, rot: 0, freeze: true },
    { type: "goal", x: 0, y: 0, z: -18, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 8 && p.z > -16; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  const fallen = plank.translation();
  sim.free();
  if (fallen.y > 0.5 || fallen.z > -9.5) { failed = true; console.error(`FAIL plank-mid: plank on a platform did not fall flat (centre y ${fallen.y.toFixed(2)} z ${fallen.z.toFixed(2)})`); }
  else console.log(`ok plank-mid: plank on a platform fell flat (centre y ${fallen.y.toFixed(2)} z ${fallen.z.toFixed(2)}), ball at z ${p.z.toFixed(2)}`);
}
// Hit from its other face, a plank follows through and falls the other way.
{
  const level = testLevel({ id: "plank-back", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -14 },
    { type: "slab", x: 0, y: 0, z: -10, w: 10, d: 20, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -8, w: 4, h: 6, rot: 0, freeze: true },
    { type: "goal", x: 0, y: 0, z: -1, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  for (let i = 0; i < 120; i++) sim.step(0, 0, 1);
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 8 && p.z < -2; i++) { sim.step(1, 0, 1); p = sim.ball.translation(); }
  const fallen = plank.translation();
  sim.free();
  if (fallen.y > 0.5 || fallen.z < -6) { failed = true; console.error(`FAIL plank-back: plank hit from the front did not fall backward (centre y ${fallen.y.toFixed(2)} z ${fallen.z.toFixed(2)})`); }
  else console.log(`ok plank-back: plank hit from the front fell backward (centre y ${fallen.y.toFixed(2)} z ${fallen.z.toFixed(2)}), ball at z ${p.z.toFixed(2)}`);
}
// Support pillars beside a platform edge are solid: a ball pushed at one stops on the platform.
{
  const level = testLevel({ id: "support", name: "support", pieces: [
    { type: "start", x: 0, y: 0, z: -10 },
    { type: "slab", x: 0, y: 0, z: -10, w: 10, d: 20, rot: 0, fences: {} },
    { type: "support", x: 5, y: 0, z: -10, w: 6, h: 8, rot: 90 },
    { type: "slab", x: 7, y: 8, z: -10, w: 4, d: 8, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 0, z: -18, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let maxX = 0, minY = Infinity;
  for (let i = 0; i < 120 * 4; i++) { sim.step(1, 1, 0); const q = sim.ball.translation(); maxX = Math.max(maxX, q.x); minY = Math.min(minY, q.y); }
  sim.free();
  if (maxX > 5 || minY < 0) { failed = true; console.error(`FAIL support: ball went through the support pillar (x ${maxX.toFixed(2)}, min y ${minY.toFixed(2)})`); }
  else console.log(`ok support: pillar stops the ball at x ${maxX.toFixed(2)}`);
}
// A kicker is rolled straight over at any speed: the ball rides up, leaves the high edge and
// lands beyond it on the platform. The long kicker (a 6 long deck past a 1.5 high slope) is ridden
// up, along its deck and off its end the same way.
for (const [cap, kicker] of [
  [2.5, { type: "kicker", x: 0, y: 0, z: -9, w: 3, d: 4, h: 0.7, rot: 0 }],
  [6.5, { type: "kicker", x: 0, y: 0, z: -9, w: 3, d: 4, h: 0.7, rot: 0 }],
  [2.5, { type: "kicker", x: 0, y: 0, z: -10, w: 2.5, d: 3, h: 1.5, flat: 6, rot: 0 }],
  [6.5, { type: "kicker", x: 0, y: 0, z: -10, w: 2.5, d: 3, h: 1.5, flat: 6, rot: 0 }],
] as const) {
  TUNING.maxSpeed = cap;
  const level = testLevel({ id: "kicker", name: "kicker", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -12, w: 10, d: 30, rot: 0, fences: {} },
    kicker,
    { type: "goal", x: 0, y: 0, z: -24, r: 2 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let p = sim.ball.translation(), maxY = 0;
  for (let i = 0; i < 120 * 10 && p.z > -18; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); maxY = Math.max(maxY, p.y); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  sim.free();
  const name = "flat" in kicker ? "long kicker" : "kicker";
  if (p.z > -16 || Math.abs(p.y - BALL_RADIUS) > 0.1 || maxY < kicker.h + BALL_RADIUS - 0.1) { failed = true; console.error(`FAIL ${name} at ${cap}: ball ended z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}, peak y ${maxY.toFixed(2)}`); }
  else console.log(`ok ${name} at ${cap} m/s: rolled over (peak y ${maxY.toFixed(2)}) and landed at z ${p.z.toFixed(2)}`);
}
TUNING.maxSpeed = DEFAULT_TUNING.maxSpeed;
// A seesaw starts at its set angle, near end down; the ball rolls up it, tips it past level so
// the far end comes down, and rolls off onto the platform beyond.
{
  const level = testLevel({ id: "seesaw", name: "seesaw", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -14, w: 8, d: 32, rot: 0, fences: {} },
    { type: "seesaw", x: 0, y: 0, z: -12, w: 4, d: 8, rot: 0, tilt: 10 },
    { type: "goal", x: 0, y: 0, z: -28, r: 2 },
  ] });
  const sim = await createSim(level);
  const board = sim.planks[0]!.body;
  // Board tilt about local x in degrees, positive when the -z end is up.
  const tilt = () => { const q = board.rotation(); return (2 * Math.atan2(q.x, q.w) * 180) / Math.PI; };
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  const start = tilt();
  let p = sim.ball.translation(), peak = 0;
  for (let i = 0; i < 120 * 10 && p.z > -22; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); peak = Math.max(peak, p.y); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  const end = tilt();
  sim.free();
  if (Math.abs(start - 10) > 0.5 || end > -5 || p.z > -20 || Math.abs(p.y - BALL_RADIUS) > 0.1 || peak < 1.5) { failed = true; console.error(`FAIL seesaw: start ${start.toFixed(1)} deg, end ${end.toFixed(1)} deg, ball z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}, peak ${peak.toFixed(2)}`); }
  else console.log(`ok seesaw: held ${start.toFixed(1)} deg, tipped to ${end.toFixed(1)} deg, ball rode over (peak y ${peak.toFixed(2)}) to z ${p.z.toFixed(2)}`);
}
// Freeze: a frozen seesaw or plank holds its start pose untouched; without freeze both are live
// from the start, and a leaning plank falls on its own.
for (const freeze of [true, false]) {
  const level = testLevel({ id: "freeze", name: "freeze", pieces: [
    { type: "start", x: 0, y: 0, z: 6 },
    { type: "slab", x: 0, y: 0, z: -4, w: 24, d: 24, rot: 0, fences: {} },
    { type: "seesaw", x: -6, y: 0, z: -8, w: 4, d: 8, rot: 0, tilt: 10, freeze },
    { type: "plank", x: 6, y: 0, z: -8, w: 4, h: 6, rot: 0, tilt: 30, freeze },
    { type: "goal", x: 0, y: 0, z: -14, r: 2 },
  ] });
  const sim = await createSim(level);
  const [seesaw, plank] = [sim.planks.find((q) => q.index === 2)!, sim.planks.find((q) => q.index === 3)!];
  const angle = (b: RAPIER.RigidBody) => { const q = b.rotation(); return Math.abs((2 * Math.atan2(q.x, q.w) * 180) / Math.PI); };
  for (let i = 0; i < 120 * 2; i++) sim.step(0, 0, 0);
  const board = angle(seesaw.body), lean = angle(plank.body), live = seesaw.body.isDynamic() && plank.body.isDynamic();
  sim.free();
  const ok = freeze ? !live && Math.abs(board - 10) < 0.1 && Math.abs(lean - 30) < 0.1 : live && lean > 60;
  if (!ok) { failed = true; console.error(`FAIL freeze ${freeze}: seesaw at ${board.toFixed(1)} deg, plank at ${lean.toFixed(1)} deg, live ${live}`); }
  else console.log(`ok freeze ${freeze}: seesaw at ${board.toFixed(1)} deg, plank at ${lean.toFixed(1)} deg after 2 s untouched`);
}
// A plank set to start lying flat (tilt 90) stays flat and the ball rolls straight over it.
{
  const level = testLevel({ id: "plank-flat", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -10, w: 8, d: 24, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -7, w: 4, h: 6, rot: 0, tilt: 90, freeze: true },
    { type: "goal", x: 0, y: 0, z: -20, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  const lying = plank.translation();
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 8 && p.z > -18; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  const after = plank.translation();
  sim.free();
  if (Math.abs(lying.y - PLANK_HINGE_H) > 0.03 || Math.abs(lying.z + 10) > 0.05 || after.y > 0.3 || p.z > -16) { failed = true; console.error(`FAIL plank-flat: started at y ${lying.y.toFixed(2)} z ${lying.z.toFixed(2)}, after y ${after.y.toFixed(2)}, ball z ${p.z.toFixed(2)}`); }
  else console.log(`ok plank-flat: started flat at z ${lying.z.toFixed(2)}, ball rolled over to z ${p.z.toFixed(2)}`);
}
// A plank set to start leaning at 45 degrees holds that angle untouched, then falls flat once the
// ball reaches it.
{
  const level = testLevel({ id: "plank-lean", name: "plank", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -10, w: 8, d: 24, rot: 0, fences: {} },
    { type: "plank", x: 0, y: 0, z: -7, w: 4, h: 6, rot: 0, tilt: 45, freeze: true },
    { type: "goal", x: 0, y: 0, z: -20, r: 2 },
  ] });
  const sim = await createSim(level);
  const plank = sim.planks[0]!.body;
  const lean = () => { const q = plank.rotation(); return (-2 * Math.atan2(q.x, q.w) * 180) / Math.PI; };
  for (let i = 0; i < 120 * 3; i++) sim.step(0, 0, -1);
  const held = lean();
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 8 && p.z > -18; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  const fell = lean();
  sim.free();
  if (Math.abs(held - 45) > 0.5 || Math.abs(fell - 90) > 3) { failed = true; console.error(`FAIL plank-lean: held ${held.toFixed(1)} deg (want 45), after the ball ${fell.toFixed(1)} deg (want 90)`); }
  else console.log(`ok plank-lean: held ${held.toFixed(1)} deg untouched, fell to ${fell.toFixed(1)} deg once hit`);
}
// Held forward, the ball climbs a tube four layers up and out onto the upper platform, or runs
// down one, through smooth and sharp elbows alike. Nothing pumps it: the push does the work.
for (const [name, bend, y0, y1] of [["up-smooth", 1.5, 0, 4], ["up-sharp", 0, 0, 4], ["down-sharp", 0, 4, 0], ["down-smooth", 1.5, 4, 0]] as const) {
  const level = testLevel({ id: `tube-${name}`, name, pieces: [
    { type: "start", x: 0, y: y0, z: -2 },
    { type: "slab", x: 0, y: y0, z: -5, w: 8, d: 10, rot: 0, fences: {} },
    { type: "tube", x: 0, y: y0, z: -7, rot: 0, path: [
      { x: 0, y: 0, z: -6, bend }, { x: 0, y: y1 - y0, z: -6, bend }, { x: 0, y: y1 - y0, z: -17, bend: 0 },
    ] },
    { type: "slab", x: 0, y: y1, z: -30, w: 8, d: 24, rot: 0, fences: {} },
    { type: "goal", x: 0, y: y1, z: -38, r: 1 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let p = sim.ball.translation(), minY = Infinity;
  for (let i = 0; i < 120 * 15 && p.z > -26; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); minY = Math.min(minY, p.y); }
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  p = sim.ball.translation();
  sim.free();
  if (p.z > -24 || Math.abs(p.y - (y1 + BALL_RADIUS)) > 0.1 || minY < Math.min(y0, y1)) { failed = true; console.error(`FAIL tube-${name}: ball ended at z ${p.z.toFixed(2)} y ${p.y.toFixed(2)}, lowest y ${minY.toFixed(2)}`); }
  else console.log(`ok tube-${name}: ball came out at y ${p.y.toFixed(2)} z ${p.z.toFixed(2)}`);
}
// Two-way and manual: let go halfway up the climb and the ball slides back out the bottom; a
// tube laid exit-first (the climb entered at its exit mouth) climbs just the same.
for (const reversed of [false, true]) {
  const path = [{ x: 0, y: 0, z: -6 }, { x: 0, y: 4, z: -6 }, { x: 0, y: 4, z: -17 }];
  // Reversed: the same pipe, its entrance on the upper platform and its exit at the bottom.
  const tube = reversed
    ? { type: "tube", x: 0, y: 4, z: -24, rot: 0, path: [{ x: 0, y: 0, z: 11, bend: 1.5 }, { x: 0, y: -4, z: 11, bend: 1.5 }, { x: 0, y: -4, z: 17, bend: 0 }] }
    : { type: "tube", x: 0, y: 0, z: -7, rot: 0, path: path.map((n, k) => ({ ...n, bend: k < 2 ? 1.5 : 0 })) };
  const level = testLevel({ id: "tube-manual", name: "tube-manual", pieces: [
    { type: "start", x: 0, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -5, w: 8, d: 10, rot: 0, fences: {} },
    tube,
    { type: "slab", x: 0, y: 4, z: -30, w: 8, d: 24, rot: 0, fences: {} },
    { type: "goal", x: 0, y: 4, z: -38, r: 1 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let p = sim.ball.translation();
  for (let i = 0; i < 120 * 10 && p.y < 2.5; i++) { sim.step(1, 0, -1); p = sim.ball.translation(); }
  const reached = p.y;
  for (let i = 0; i < 120 * 6; i++) sim.step(0, 0, -1);
  const back = sim.ball.translation();
  sim.free();
  const name = reversed ? "tube-reversed" : "tube-manual";
  if (reached < 2.5 || back.y > 0.6 + 0.1 || back.z < -14) { failed = true; console.error(`FAIL ${name}: climbed to y ${reached.toFixed(2)}, after letting go at y ${back.y.toFixed(2)} z ${back.z.toFixed(2)}`); }
  else console.log(`ok ${name}: climbed to y ${reached.toFixed(2)} under push, slid back to z ${back.z.toFixed(2)} on release`);
}
// The tube's outside is solid: a ball rolled at it from the side stops against it.
{
  const level = testLevel({ id: "tube-side", name: "tube-side", pieces: [
    { type: "start", x: -3, y: 0, z: -8 },
    { type: "slab", x: 0, y: 0, z: -8, w: 8, d: 16, rot: 0, fences: {} },
    { type: "tube", x: 0, y: 0, z: -2, rot: 0, path: [{ x: 0, y: 0, z: -12, bend: 0 }] },
    { type: "goal", x: 3, y: 0, z: -14, r: 1 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let maxX = -Infinity;
  for (let i = 0; i < 120 * 4; i++) { sim.step(1, 1, 0); maxX = Math.max(maxX, sim.ball.translation().x); }
  sim.free();
  if (maxX > 0) { failed = true; console.error(`FAIL tube-side: ball went through the tube wall (x ${maxX.toFixed(2)})`); }
  else console.log(`ok tube-side: tube wall stops the ball at x ${maxX.toFixed(2)}`);
}
// A tube mouth's collar is solid: rolled at it from the side, the ball stops against the collar's
// outside, not the thinner glass under it.
{
  const level = testLevel({ id: "tube-collar", name: "tube-collar", pieces: [
    { type: "start", x: 4, y: 0, z: -7.2 },
    { type: "slab", x: 0, y: 0, z: -10, w: 12, d: 16, rot: 0, fences: {} },
    { type: "tube", x: 0, y: 0, z: -7, rot: 0, path: [{ x: 0, y: 0, z: -8, bend: 0 }] },
    { type: "goal", x: 4, y: 0, z: -16, r: 1 },
  ] });
  const sim = await createSim(level);
  let near = Infinity;
  for (let i = 0; i < 120 * 4; i++) {
    sim.step(1, -1, 0);
    const b = sim.ball.translation();
    near = Math.min(near, Math.hypot(b.x, b.y - TUBE_R));
  }
  sim.free();
  const want = TUBE_R + TUBE_COLLAR_T + BALL_RADIUS - 0.05;
  if (near < want) { failed = true; console.error(`FAIL tube-collar: ball got within ${near.toFixed(2)} of the tube axis at the mouth (collar keeps it at ${(want + 0.05).toFixed(2)})`); }
  else console.log(`ok tube-collar: ball stopped ${near.toFixed(2)} from the axis, against the collar`);
}
// A segment with a curve point is a smooth arc: a half circle from y 0 to y 1 with its curve
// point at the apex is round all the way and climbs steadily, not at the nodes. And on the flat,
// the ball rolls in one mouth, round the half circle and out the other.
{
  const half = { type: "tube", x: -4, y: 0, z: -6, rot: 0, path: [{ x: 8, y: 1, z: 0, bend: 0, mid: { x: 4, y: 0.5, z: -4 } }] };
  const rings = tubeRings(testLevel({ id: "c", name: "c", pieces: [
    { type: "start", x: 0, y: 0, z: 0 }, { type: "slab", x: 0, y: 0, z: -4, w: 16, d: 16, rot: 0, fences: {} }, half, { type: "goal", x: 0, y: 0, z: -2, r: 1 },
  ] }).pieces[2] as Tube);
  const ys = rings.map((q) => q.c[1] - TUBE_R), radii = rings.map((q) => Math.hypot(q.c[0] - 4, q.c[2]));
  const steps = ys.slice(1).map((y, i) => y - ys[i]!);
  const round = Math.max(...radii) - Math.min(...radii) < 1e-6 && Math.abs(Math.min(...rings.map((q) => q.c[2])) + 4) < 1e-6;
  if (!round || Math.min(...steps) < -1e-9 || Math.max(...steps) > 0.1 || Math.abs(ys.at(-1)! - 1) > 1e-9) { failed = true; console.error(`FAIL tube-curve: round ${round}, height steps ${Math.min(...steps).toFixed(3)} to ${Math.max(...steps).toFixed(3)}, ends at y ${ys.at(-1)!.toFixed(2)}`); }
  else console.log(`ok tube-curve: half circle stays radius 4 and climbs 0 to 1 in ${steps.length} steps of at most ${Math.max(...steps).toFixed(3)}`);

  const level = testLevel({ id: "tube-u", name: "tube-u", pieces: [
    { type: "start", x: -4, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -6, w: 16, d: 16, rot: 0, fences: {} },
    { type: "tube", x: -4, y: 0, z: -6, rot: 0, path: [{ x: 8, y: 0, z: 0, bend: 0, mid: { x: 4, y: 0, z: -4 } }] },
    { type: "goal", x: 6, y: 0, z: -12, r: 1 },
  ] });
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  // Steer like a player following the tube: push the way the ball is already heading.
  let dir: [number, number] = [0, -1], p = sim.ball.translation();
  for (let i = 0; i < 120 * 12 && !(p.x > 3 && p.z > -3); i++) {
    const v = sim.ball.linvel(), hv = Math.hypot(v.x, v.z);
    if (hv > 0.5) dir = [v.x / hv, v.z / hv];
    sim.step(1, dir[0], dir[1]);
    p = sim.ball.translation();
  }
  sim.free();
  if (!(p.x > 3 && p.z > -3) || Math.abs(p.y - BALL_RADIUS) > 0.1) { failed = true; console.error(`FAIL tube-u: ball ended at ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`); }
  else console.log(`ok tube-u: ball rolled round the curved tube and out at ${p.x.toFixed(2)},${p.z.toFixed(2)}`);
}
// Tubes are rigid: the ball, fired at a tube's side, top and mouth collars from rolling height to
// airborne, fast and slow, square on and glancing, never ends up inside the wall or a collar.
{
  const level = testLevel({ id: "tube-phase", name: "tube-phase", pieces: [
    { type: "start", x: 6, y: 0, z: -2 },
    { type: "slab", x: 0, y: 0, z: -10, w: 16, d: 20, rot: 0, fences: {} },
    { type: "tube", x: 0, y: 0, z: -6, rot: 0, path: [{ x: 0, y: 0, z: -10, bend: 0 }] },
    { type: "goal", x: 6, y: 0, z: -18, r: 1 },
  ] });
  const z0 = -6, z1 = -16;
  // Inside the wall: off the axis by more than a ball in the bore can be, closer than the solid allows.
  const inWall = (b: { x: number; y: number; z: number }) => {
    if (b.z > z0 + 0.05 || b.z < z1 - 0.05) return false;
    const r = Math.hypot(b.x, b.y - TUBE_R);
    const collar = b.z > z0 - TUBE_COLLAR_L + 0.05 || b.z < z1 + TUBE_COLLAR_L - 0.05;
    return r > 0.1 && r < (collar ? TUBE_R + TUBE_COLLAR_T : TUBE_R + TUBE_SOLID_WALL) + BALL_RADIUS - 0.05;
  };
  const shots: { from: [number, number, number]; v: [number, number, number] }[] = [];
  for (const speed of [3, 6, 10]) {
    for (const y of [0.55, 0.9, 1.3, 1.8]) for (const deg of [-50, 0, 50]) {
      const a = (deg * Math.PI) / 180;
      shots.push({ from: [2.5, y, -11 - 2.5 * Math.sin(a)], v: [-Math.cos(a) * speed, 0, Math.sin(a) * speed] });
    }
    for (const x of [0.75, 0.95, 1.2]) for (const y of [0.55, 1.0, 1.5]) shots.push({ from: [x, y, z0 + 2.5], v: [0, 0, -speed] });
    shots.push({ from: [0, 3, -11], v: [0, -speed, 0] }, { from: [0.5, 3, z0 - 0.2], v: [0, -speed, 0] });
  }
  const bad: string[] = [];
  for (const sh of shots) {
    const sim = await createSim(level, { x: sh.from[0], y: 0, z: sh.from[2] });
    sim.ball.setTranslation({ x: sh.from[0], y: sh.from[1], z: sh.from[2] }, true);
    sim.ball.setLinvel({ x: sh.v[0], y: sh.v[1], z: sh.v[2] }, true);
    const hv = Math.hypot(sh.v[0], sh.v[2]) || 1;
    for (let i = 0; i < 240; i++) {
      sim.step(sh.v[1] ? 0 : 1, sh.v[0] / hv, sh.v[2] / hv);
      const b = sim.ball.translation();
      if (inWall(b)) { bad.push(`from ${sh.from.join(",")} at ${sh.v.join(",")}: ball inside at ${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}`); break; }
    }
    sim.free();
  }
  if (bad.length) { failed = true; console.error(`FAIL tube-phasing: ${bad.length} of ${shots.length} shots got inside the tube wall: ${bad.slice(0, 6).join("; ")}`); }
  else console.log(`ok tube-phasing: ${shots.length} shots at the tube's side, top and collars, none got inside the wall`);
}
// Moving platforms keep their schedule (waits, eased legs, ping-pong and loop), carry a ball
// parked on them out and back without it sliding off, and lift it up layers.
{
  const mover = (extra: object) => ({ type: "mover", x: 0, y: 0, z: -8, w: 8, d: 8, rot: 0, speed: 2, wait: 1, offset: 0, loop: "pingpong", stops: [{ x: 0, y: 0, z: -16, wait: 2 }], ...extra });
  const levelWith = (m: object) => testLevel({ id: "mover", name: "mover", pieces: [
    { type: "start", x: 0, y: 0, z: 2 }, { type: "slab", x: 0, y: 0, z: 2, w: 8, d: 4, rot: 0, fences: {} },
    m, { type: "goal", x: 0, y: 0, z: 1, r: 1 },
  ] });
  const travel = (16 / 2) * (Math.PI / 2);
  const pp = levelWith(mover({})).pieces[2] as Mover, lp = levelWith(mover({ loop: "loop", stops: [{ x: 8, y: 0, z: 0, wait: 0 }, { x: 8, y: 0, z: -8, wait: 0 }] })).pieces[2] as Mover;
  const expect: [Mover, number, [number, number, number]][] = [
    [pp, 0.5, [0, 0, 0]], [pp, 1 + travel / 2, [0, 0, -8]], [pp, 1 + travel + 1, [0, 0, -16]], [pp, 1 + travel + 2 + travel / 2, [0, 0, -8]],
    [pp, 1 + 2 * travel + 2 + 0.5, [0, 0, 0]], [pp, 1 + 2 * travel + 2 + 1 + travel / 2, [0, 0, -8]],
    [lp, 1 + (8 / 2) * (Math.PI / 2) * 1.5, [8, 0, -4]],
  ];
  const off = expect.map(([m, t, want]) => { const o = moverOffset(m, t); return Math.hypot(o.x - want[0], o.y - want[1], o.z - want[2]); });
  if (Math.max(...off) > 1e-6) { failed = true; console.error(`FAIL mover-schedule: positions off by up to ${Math.max(...off).toFixed(3)}`); }
  else console.log(`ok mover-schedule: waits, eased legs, ping-pong and loop land where expected`);

  for (const [name, m, out, leg] of [["mover-ride", mover({}), [0, 0, -24], travel], ["mover-lift", mover({ stops: [{ x: 0, y: 4, z: 0, wait: 2 }] }), [0, 4, -8], (4 / 2) * (Math.PI / 2)]] as const) {
    const level = levelWith(m);
    const sim = await createSim(level, { x: 0, y: 0, z: -8 });
    let at = { x: 0, y: 0, z: 0 };
    // Ride out to the stop and halfway through its wait, then all the way back home.
    for (let i = 0; i < Math.round((1 + leg + 1) / STEP); i++) sim.step(0, 0, -1);
    const there = sim.ball.translation();
    for (let i = 0; i < Math.round((1 + leg + 0.5) / STEP); i++) sim.step(0, 0, -1);
    at = sim.ball.translation();
    sim.free();
    const dOut = Math.hypot(there.x - out[0], there.y - (out[1] + BALL_RADIUS), there.z - out[2]);
    const dHome = Math.hypot(at.x, at.y - BALL_RADIUS, at.z + 8);
    if (dOut > 0.6 || dHome > 0.6) { failed = true; console.error(`FAIL ${name}: ball at the stop ${dOut.toFixed(2)} off the platform centre, back home ${dHome.toFixed(2)} off`); }
    else console.log(`ok ${name}: ball rode to the stop (${dOut.toFixed(2)} off centre) and back (${dHome.toFixed(2)} off)`);
  }
}
// No phasing: the ball is fired at the side of a platform one layer up (slab, holed slab, curve
// end and arc, ramp side) from rolling height to airborne, fast and slow, square on and glancing,
// and its centre must never end up inside a platform's body.
{
  const raised: Record<string, { pieces: object[]; at: [number, number]; out: [number, number]; ground?: object }[]> = {
    slab: [{ pieces: [{ type: "slab", x: 0, y: 1, z: 9, w: 8, d: 8, rot: 0, fences: {} }], at: [0, 5], out: [0, -1] }],
    holed: [{ pieces: [{ type: "slab", x: 0, y: 1, z: 9, w: 8, d: 8, rot: 0, fences: {} }, { type: "hole", x: 0, y: 1, z: 7, w: 2, d: 2, rot: 0 }], at: [0, 5], out: [0, -1] }],
    curve: [
      { pieces: [{ type: "curve", x: -4, y: 1, z: 5, inner: 2, outer: 10, rot: 270, fences: {} }], at: [2, 5], out: [0, -1] },
      { pieces: [{ type: "curve", x: -4, y: 1, z: 5, inner: 2, outer: 10, rot: 270, fences: {} }], at: [-4 + CURVE_STRAIGHT + (10 - CURVE_STRAIGHT) * 0.7071, 5 + CURVE_STRAIGHT + (10 - CURVE_STRAIGHT) * 0.7071], out: [0.7071, 0.7071] },
    ],
    ramp: [15, 17].map((z) => ({ pieces: [{ type: "ramp", x: 0, y: 0, z: 12, w: 8, d: 24, rot: 0, rise: 4, fences: {} }], at: [4, z] as [number, number], out: [1, 0] as [number, number], ground: { type: "slab", x: 12, y: 0, z: 12, w: 16, d: 40, rot: 0, fences: {} } })),
  };
  const inside = (level: Level, b: { x: number; y: number; z: number }) => level.pieces.some((p: Piece) => {
    if (p.type !== "slab" && p.type !== "curve" && p.type !== "ramp") return false;
    if (p.y === 0 && p.type === "slab") return false; // the ground slab the ball starts on
    const top = p.type === "ramp" ? p.y + rampHeight(p, (p.d / 2 - (b.z - p.z)) / p.d) : p.y;
    if (b.y > top - 0.05 || b.y < top - 1 + 0.05) return false;
    const inPoly = (poly: [number, number][]) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i]!, [xj, zj] = poly[j]!;
        if ((zi > b.z) !== (zj > b.z) && b.x < ((xj - xi) * (b.z - zi)) / (zj - zi) + xi) c = !c;
      }
      return c;
    };
    // A ball dropping through a hole is not inside the slab.
    if (level.pieces.some((h) => h.type === "hole" && Math.abs(h.y - p.y) < 1e-6 && inPoly(holeFootprint(h)))) return false;
    return platformFootprint(p).some(inPoly);
  });
  let runs = 0;
  const bad: string[] = [];
  for (const [name, targets] of Object.entries(raised)) for (const t of targets) {
    const level = testLevel({ id: `phase-${name}`, name, pieces: [
      ...(t.ground ? [{ type: "start", x: 12, y: 0, z: 0 }, t.ground, { type: "goal", x: 12, y: 0, z: 28, r: 1 }]
        : [{ type: "start", x: 0, y: 0, z: -12 }, { type: "slab", x: 0, y: 0, z: 0, w: 40, d: 40, rot: 0, fences: {} }, { type: "goal", x: 0, y: 0, z: -16, r: 1 }]),
      ...t.pieces,
    ] });
    for (const y0 of [0.55, 0.75, 0.95, 1.3]) for (const speed of [3, 6, 10]) for (const deg of [-50, 0, 50]) {
      const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      // Heading into the edge: the inward normal turned by `deg`.
      const hx = -(t.out[0] * c - t.out[1] * sn), hz = -(t.out[0] * sn + t.out[1] * c);
      const sx = t.at[0] - hx * 1.2, sz = t.at[1] - hz * 1.2;
      const sim = await createSim(level, { x: sx, y: 0, z: sz });
      sim.ball.setTranslation({ x: sx, y: y0, z: sz }, true);
      sim.ball.setLinvel({ x: hx * speed, y: 0, z: hz * speed }, true);
      runs++;
      for (let i = 0; i < 240; i++) {
        sim.step(1, hx, hz);
        const b = sim.ball.translation();
        if (inside(level, b)) { bad.push(`${name} at ${t.at.map((v) => v.toFixed(1)).join(",")} from y ${y0} at ${speed} m/s, ${deg} deg: ball inside at ${b.x.toFixed(2)},${b.y.toFixed(2)},${b.z.toFixed(2)}`); break; }
      }
      sim.free();
    }
  }
  if (bad.length) { failed = true; console.error(`FAIL phasing: ${bad.length} of ${runs} shots ended inside a platform: ${bad.slice(0, 8).join("; ")}`); }
  else console.log(`ok phasing: ${runs} shots at raised slab, holed slab, curve and ramp edges, none got inside`);
}
if (failed) process.exit(1);
