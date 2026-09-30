import RAPIER from "@dimforge/rapier3d-compat";

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -20, z: 0 });
world.timestep = 1 / 120;
world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.5, 6).setTranslation(0, -0.5, 0));
const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 2, 0).setCcdEnabled(true));
world.createCollider(RAPIER.ColliderDesc.ball(0.5), ball);
for (let i = 0; i < 240; i++) world.step();
const y = ball.translation().y;
if (Math.abs(y - 0.5) > 0.05) {
  console.error(`ball did not settle on the slab: y=${y.toFixed(3)}`);
  process.exit(1);
}
console.log(`ok: ball rests at y=${y.toFixed(3)}`);
