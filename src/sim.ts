import RAPIER from "@dimforge/rapier3d-compat";

export const STEP = 1 / 120;
export const BALL_RADIUS = 0.5;

export interface Sim {
  world: RAPIER.World;
  ball: RAPIER.RigidBody;
  step(tiltX: number, tiltZ: number): void;
}

export async function createSim(): Promise<Sim> {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
  world.timestep = STEP;

  world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.5, 6).setTranslation(0, -0.5, 0));

  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0).setCcdEnabled(true),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setFriction(1).setRestitution(0.1), ball);

  return {
    world,
    ball,
    step(tiltX, tiltZ) {
      ball.addForce({ x: tiltX * 30, y: 0, z: tiltZ * 30 }, true);
      world.step();
      ball.resetForces(true);
    },
  };
}
