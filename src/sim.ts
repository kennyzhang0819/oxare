import RAPIER from "@dimforge/rapier3d-compat";
import { floorMesh } from "./floor.ts";
import { sectorMesh } from "./geometry.ts";
import { BALL_RADIUS, BRIDGE_PLANK_T, CURVE_SEGMENTS, PLANK_T, FENCE_HEIGHT, FENCE_THICKNESS, SPINNER_HEIGHT, SPINNER_WIDTH, START_PAD_H, START_PAD_R, bridgeChain, isTilted, pieceBoxes, pieceCylinders, pieceRot, pieceSectors, rampHeight, rotXZ, startOf, type Level } from "./level.ts";
import { TUNING } from "./tuning.ts";

export const STEP = 1 / 120;
// Bridge planks: a fraction of the ball's mass each, so the ball's weight dents the chain
// under it, and lightly damped so the bridge swings and settles rather than snapping back.
// Planks collide only with dynamic bodies (never each other, never the floor), so a bridge
// end sitting a hair inside a platform cannot jitter the chain.
const PLANK_MASS = 0.08;
const PLANK_DAMPING = 0.4;
// Knock-down plank: a light panel, since the ball pushes it over right at the hinge where it
// has almost no leverage; a heavy panel would just stop the ball.
const KNOCK_PLANK_MASS = 0.1;
const PLANK_GROUPS = (0x0002 << 16) | 0xfffd;

export interface SimSpinner { index: number; body: RAPIER.RigidBody; angle: number; speed: number }
export interface SimCrate { index: number; body: RAPIER.RigidBody }
export interface SimBridge { index: number; planks: RAPIER.RigidBody[] }
export interface SimPlank { index: number; body: RAPIER.RigidBody }
export interface Sim {
  world: RAPIER.World;
  ball: RAPIER.RigidBody;
  spinners: SimSpinner[];
  crates: SimCrate[];
  bridges: SimBridge[];
  planks: SimPlank[];
  step(throttle: number, fx: number, fz: number): void;
  respawn(): void;
  free(): void;
}

export function yQuat(deg: number): { x: number; y: number; z: number; w: number } {
  const h = (deg * Math.PI) / 360;
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
}
type Quat = { x: number; y: number; z: number; w: number };
const xQuat = (deg: number): Quat => { const h = (deg * Math.PI) / 360; return { x: Math.sin(h), y: 0, z: 0, w: Math.cos(h) }; };
const qrot = (q: Quat, v: { x: number; y: number; z: number }) => {
  // v' = q v q*
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
};
const qmul = (a: Quat, b: Quat): Quat => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
});

let ready: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init().then(() => undefined);
  return ready;
}

// `from` overrides the spawn: the ball starts (and respawns) resting on the surface at that point.
export async function createSim(level: Level, from?: { x: number; y: number; z: number }): Promise<Sim> {
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -TUNING.gravity, z: 0 });
  world.timestep = STEP;

  const floor = floorMesh(level);
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(floor.positions, floor.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES).setFriction(1),
  );
  // Platform sides and undersides, so nothing clips through a slab from the side or below.
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(floor.body.positions, floor.body.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES).setFriction(0.6),
  );
  for (const p of level.pieces) {
    const rot = pieceRot(p);
    if (p.type === "slab" && isTilted(p)) {
      // Tilt about local x, then yaw: the slab body and its fences as one rigid arrangement.
      const q = qmul(yQuat(rot), xQuat(p.tilt));
      for (const b of pieceBoxes(p)) {
        const o = qrot(q, { x: b.x, y: b.y, z: b.z });
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2).setTranslation(p.x + o.x, p.y + o.y, p.z + o.z).setRotation(q).setFriction(1),
        );
      }
      continue;
    }
    for (const b of pieceBoxes(p)) {
      if (b.kind === "platform") continue;
      const o = rotXZ(b.x, b.z, rot);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2)
          .setTranslation(p.x + o.x, p.y + b.y, p.z + o.z)
          .setRotation(yQuat(rot))
          .setFriction(1),
      );
    }
    if (p.type === "ramp") {
      const n = Math.max(1, Math.ceil(p.d));
      for (const side of [p.fences.e ? 1 : 0, p.fences.w ? -1 : 0]) {
        if (!side) continue;
        const lx = side * (p.w / 2 - FENCE_THICKNESS / 2);
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const z0 = p.d / 2 - t0 * p.d, z1 = p.d / 2 - t1 * p.d, y0 = rampHeight(p, t0), y1 = rampHeight(p, t1);
          // Box local z runs down the segment (toward +z), local y is the slope normal.
          const len = Math.hypot(z1 - z0, y1 - y0);
          const phi = Math.atan2(y1 - y0, z0 - z1);
          const ny = Math.cos(phi), nz = Math.sin(phi);
          const cz = (z0 + z1) / 2 + nz * (FENCE_HEIGHT / 2), cy = (y0 + y1) / 2 + ny * (FENCE_HEIGHT / 2);
          const o = rotXZ(lx, cz, rot);
          world.createCollider(
            RAPIER.ColliderDesc.cuboid(FENCE_THICKNESS / 2, FENCE_HEIGHT / 2, len / 2)
              .setTranslation(p.x + o.x, p.y + cy, p.z + o.z)
              .setRotation(qmul(yQuat(rot), { x: Math.sin(phi / 2), y: 0, z: 0, w: Math.cos(phi / 2) }))
              .setFriction(1),
          );
        }
      }
    }
    for (const c of pieceCylinders(p)) {
      world.createCollider(RAPIER.ColliderDesc.cylinder(c.h / 2, c.r).setTranslation(p.x, p.y + c.h / 2, p.z).setFriction(1));
    }
    for (const sec of pieceSectors(p)) {
      if (sec.kind === "platform") continue;
      const m = sectorMesh(sec.inner, sec.outer, sec.y0, sec.y1, { segments: CURVE_SEGMENTS });
      world.createCollider(
        RAPIER.ColliderDesc.trimesh(m.positions, m.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
          .setTranslation(p.x, p.y, p.z)
          .setRotation(yQuat(rot))
          .setFriction(1),
      );
    }
  }

  const spinners: SimSpinner[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "spinner") return;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + SPINNER_HEIGHT / 2, p.z),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(p.length / 2, SPINNER_HEIGHT / 2, SPINNER_WIDTH / 2).setFriction(0.5), body);
    spinners.push({ index, body, angle: 0, speed: p.speed });
  });

  // Crates are free bodies under the same gravity as the ball; one that falls off the world
  // comes back to where it started.
  const crates: SimCrate[] = [];
  const crateHome = new Map<number, { x: number; y: number; z: number; rot: number }>();
  level.pieces.forEach((p, index) => {
    if (p.type !== "crate") return;
    const home = { x: p.x, y: p.y + p.s / 2 + 0.02, z: p.z, rot: p.rot };
    crateHome.set(index, home);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(home.x, home.y, home.z).setRotation(yQuat(p.rot)).setCcdEnabled(true),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(p.s / 2, p.s / 2, p.s / 2).setMass(0.2).setFriction(0.35).setRestitution(0.1), body);
    crates.push({ index, body });
  });

  // A bridge is a chain of plank bodies on revolute hinges, its two ends hinged to fixed
  // anchors. Bodies are placed in the rest pose from level.ts so every joint starts satisfied.
  const bridges: SimBridge[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "bridge") return;
    const rot = pieceRot(p), yaw = yQuat(rot);
    const chain = bridgeChain(p);
    const at = (z: number, y: number) => { const o = rotXZ(0, z, rot); return { x: p.x + o.x, y: p.y + y, z: p.z + o.z }; };
    const [near, far] = [chain.hinges[0]!, chain.hinges[chain.hinges.length - 1]!].map((h) => {
      const w = at(h.z, h.y);
      return world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(w.x, w.y, w.z).setRotation(yaw));
    }) as [RAPIER.RigidBody, RAPIER.RigidBody];
    const r = 0.04;
    const planks = chain.planks.map((pl) => {
      const w = at(pl.z, pl.y);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(w.x, w.y, w.z).setRotation(qmul(yaw, xQuat(pl.tilt)))
          .setLinearDamping(PLANK_DAMPING).setAngularDamping(PLANK_DAMPING),
      );
      world.createCollider(
        RAPIER.ColliderDesc.roundCuboid(p.w / 2 - r, BRIDGE_PLANK_T / 2 - r, pl.len / 2 - r, r).setMass(PLANK_MASS).setFriction(1)
          .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DYNAMIC_DYNAMIC).setCollisionGroups(PLANK_GROUPS),
        body,
      );
      return body;
    });
    const axis = { x: 1, y: 0, z: 0 }, h = chain.seg / 2, O = { x: 0, y: 0, z: 0 };
    planks.forEach((b, k) => {
      const prev = k === 0 ? near : planks[k - 1]!;
      world.createImpulseJoint(RAPIER.JointData.revolute(k === 0 ? O : { x: 0, y: 0, z: -h }, { x: 0, y: 0, z: h }, axis), prev, b, true);
    });
    world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0, z: -h }, O, axis), planks[planks.length - 1]!, far, true);
    bridges.push({ index, planks });
  });

  // A knock-down plank is a dynamic panel hinged along its bottom edge, created asleep in its
  // upright pose: Rapier leaves a sleeping body untouched until an awake body contacts it, so the
  // plank stays balanced until the ball (or a crate) pushes it, then topples under gravity.
  const planks: SimPlank[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "plank") return;
    const yaw = yQuat(p.rot);
    const pivot = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation(yaw));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y + p.h / 2, p.z).setRotation(yaw).setSleeping(true).setAngularDamping(0.02),
    );
    const r = 0.06;
    world.createCollider(RAPIER.ColliderDesc.roundCuboid(p.w / 2 - r, p.h / 2 - r, PLANK_T / 2 - r, r).setMass(KNOCK_PLANK_MASS).setFriction(0.6).setRestitution(0.05), body);
    world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: -p.h / 2, z: 0 }, { x: 1, y: 0, z: 0 }), pivot, body, false);
    body.sleep();
    planks.push({ index, body });
  });

  const start = startOf(level);
  world.createCollider(RAPIER.ColliderDesc.cylinder(START_PAD_H / 2, START_PAD_R - 0.05).setTranslation(start.x, start.y + START_PAD_H / 2, start.z).setFriction(1));
  const spawn = from
    ? { x: from.x, y: from.y + BALL_RADIUS + 0.05, z: from.z }
    : { x: start.x, y: start.y + START_PAD_H + BALL_RADIUS + 0.3, z: start.z };
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setCcdEnabled(true),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setMass(1).setFriction(1).setRestitution(0.05), ball);

  return {
    world,
    ball,
    spinners,
    crates,
    bridges,
    planks,
    step(throttle, fx, fz) {
      for (const c of crates) {
        if (c.body.translation().y >= TUNING.respawnY) continue;
        const home = crateHome.get(c.index)!;
        c.body.setTranslation({ x: home.x, y: home.y, z: home.z }, true);
        c.body.setRotation(yQuat(home.rot), true);
        c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      world.gravity = { x: 0, y: -TUNING.gravity, z: 0 };
      ball.setLinearDamping(TUNING.linearDamping);
      ball.setAngularDamping(TUNING.angularDamping);
      const f = throttle * TUNING.throttleForce;
      ball.addForce({ x: fx * f, y: 0, z: fz * f }, true);
      for (const s of spinners) {
        s.angle += s.speed * STEP;
        body_rot(s.body, s.angle);
      }
      world.step();
      ball.resetForces(true);
      const v = ball.linvel();
      const h = Math.hypot(v.x, v.z);
      if (h > TUNING.maxSpeed) {
        const k = TUNING.maxSpeed / h;
        ball.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
      }
    },
    respawn() {
      ball.setTranslation(spawn, true);
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
    free() {
      world.free();
    },
  };
}

function body_rot(body: RAPIER.RigidBody, angle: number) {
  body.setNextKinematicRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });
}
