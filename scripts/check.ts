import { readFileSync, readdirSync } from "node:fs";
import { levelProblems, startOf, validateLevel } from "../src/level.ts";
import { STEP, createSim } from "../src/sim.ts";
import { TUNING } from "../src/tuning.ts";

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
  if (Math.abs(rest.y - (start.y + 0.5)) > 0.1) problems.push(`ball does not rest on the start pad (y=${rest.y.toFixed(2)})`);
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
// The ball must cross platform seams and roll around a curve without leaving the floor.
const seamLevel = validateLevel({ id: "seam", name: "seam", pieces: [
  { type: "start", x: 0, y: 0, z: 0 },
  { type: "slab", x: 0, y: 0, z: 0, w: 10, d: 10, rot: 0, fences: {} },
  { type: "slab", x: 0, y: 0, z: -15, w: 10, d: 20, rot: 0, fences: {} },
  { type: "slab", x: 0, y: 0, z: -30, w: 10, d: 10, rot: 0, fences: {} },
  { type: "goal", x: 0, y: 0, z: -30, r: 2 },
] });
const curveLevel = validateLevel({ id: "curve", name: "curve", pieces: [
  { type: "start", x: 15, y: 0, z: -1.2 },
  { type: "curve", x: 0, y: 0, z: 0, inner: 10, outer: 20, rot: 0, fences: {} },
  { type: "goal", x: 0, y: 0, z: -15, r: 2 },
] });
const teeLevel = validateLevel({ id: "tee", name: "tee", pieces: [
  { type: "start", x: 0, y: 0, z: 0 },
  { type: "slab", x: 0, y: 0, z: -5, w: 10, d: 20, rot: 0, fences: {} },
  { type: "slab", x: 5, y: 0, z: -25, w: 30, d: 20, rot: 0, fences: {} },
  { type: "goal", x: 5, y: 0, z: -30, r: 2 },
] });
for (const [level, steer] of [[seamLevel, "line"], [teeLevel, "line"], [curveLevel, "arc"]] as const) {
  const sim = await createSim(level);
  for (let i = 0; i < 120; i++) sim.step(0, 0, -1);
  let maxDy = 0;
  for (let i = 0; i < 120 * 5; i++) {
    const p = sim.ball.translation();
    if (steer === "line") { if (p.z < -33) break; sim.step(1, 0, -1); }
    else {
      const a = Math.atan2(-p.z, p.x), r = Math.hypot(p.x, p.z);
      if (a > 1.45) break;
      const k = (15 - r) * 0.2;
      sim.step(1, -Math.sin(a) + Math.cos(a) * k, -Math.cos(a) - Math.sin(a) * k);
    }
    maxDy = Math.max(maxDy, Math.abs(sim.ball.translation().y - 0.5));
  }
  sim.free();
  if (maxDy > 0.02) { failed = true; console.error(`FAIL ${level.id}: ball left the floor by ${maxDy.toFixed(3)}`); }
  else console.log(`ok ${level.id}: floor deviation ${maxDy.toFixed(4)}`);
}
if (failed) process.exit(1);
