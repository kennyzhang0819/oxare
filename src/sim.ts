import RAPIER from "@dimforge/rapier3d-compat";
import { sectorMesh } from "./geometry.ts";
import { BALL_RADIUS, SPINNER_HEIGHT, SPINNER_WIDTH, pieceBoxes, pieceRot, pieceSectors, startOf, type Level } from "./level.ts";
import { TUNING } from "./tuning.ts";

export const STEP = 1 / 120;

export interface SimSpinner { index: number; body: RAPIER.RigidBody; angle: number; speed: number }
export interface Sim {
  world: RAPIER.World;
  ball: RAPIER.RigidBody;
  spinners: SimSpinner[];
  step(throttle: number, fx: number, fz: number): void;
  respawn(): void;
  free(): void;
}

export function yQuat(deg: number): { x: number; y: number; z: number; w: number } {
  const h = (deg * Math.PI) / 360;
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
}

export function rotXZ(x: number, z: number, deg: number): { x: number; z: number } {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return { x: x * c + z * s, z: -x * s + z * c };
}

let ready: Promise<void> | null = null;
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init().then(() => undefined);
  return ready;
}

export async function createSim(level: Level): Promise<Sim> {
  await initPhysics();
  const world = new RAPIER.World({ x: 0, y: -TUNING.gravity, z: 0 });
  world.timestep = STEP;

  for (const p of level.pieces) {
    const rot = pieceRot(p);
    for (const b of pieceBoxes(p)) {
      const o = rotXZ(b.x, b.z, rot);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2)
          .setTranslation(p.x + o.x, p.y + b.y, p.z + o.z)
          .setRotation(yQuat(rot))
          .setFriction(1),
      );
    }
    for (const s of pieceSectors(p)) {
      const m = sectorMesh(s.inner, s.outer, s.y0, s.y1);
      world.createCollider(
        RAPIER.ColliderDesc.trimesh(m.positions, m.indices)
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

  const start = startOf(level);
  const spawn = { x: start.x, y: start.y + BALL_RADIUS + 0.3, z: start.z };
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setCcdEnabled(true),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setMass(1).setFriction(1).setRestitution(0.05), ball);

  return {
    world,
    ball,
    spinners,
    step(throttle, fx, fz) {
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
