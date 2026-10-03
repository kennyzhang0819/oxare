import RAPIER from "@dimforge/rapier3d-compat";
import { floorMesh } from "./floor.ts";
import { platformMesh } from "./platform.ts";
import { railSweep, revolveMesh, revolvePoints, ringMesh, sectorMesh, sweepTube, torusMesh, tubeWallBlocks } from "./geometry.ts";
import { BALL_RADIUS, beltRods, isBelt, crateRound, SUPPORT_W, GATE_CHAIN_R, GATE_CUBE, GATE_LINK, GATE_ROUND, gateHang, gateHulls, gateLinks, BUMPER_H, BUMPER_R, bumperProfile, MAGNET_H, MAGNET_R, MAGNET_REACH, magnetProfile, BRIDGE_BARREL, BRIDGE_LUG, GOAL_RING, PILLAR_CAP, PILLAR_COLLAR, PILLAR_H, PILLAR_R, propRound, startPadProfile, BRIDGE_PLANK_T, CURVE_SEGMENTS, PLANK_T, SPINNER_HEIGHT, SPINNER_WIDTH, START_PAD_REST, START_PAD_R, TUBE_R, TUBE_SOLID_WALL, TUBE_SKIN_SIDES, TUBE_WALL_SIDES, PLATFORM_LIP, PLATFORM_THICKNESS, RAIL_R, railsContact, railsLines, railsRingsWorld, moverAt, moverShift, isMoving, riders, type Mover, tubeRingsWorld, mouthRings, hoopRing, RING_R, RING_T, RING_SIDES, RING_SEGMENTS, bridgeChain, fenceRings, isTilted, plankHinge, plankMounts, plankPose, PLANK_BARREL, PLANK_MOUNT_R, seesawTilt, stoolAxis, stoolSlide, jumpPadSize, jumpRings, JUMP_H, JUMP_REACH, seesawPivot, seesawPostH, SEESAW_HUB, SEESAW_POST_D, SEESAW_POST_R, SEESAW_POST_W, SEESAW_STUB, SEESAW_T, kickerHull, kickerSlide, isSliding, rollPoint, respawnY, pieceBoxes, pieceCylinders, pieceRot, pieceRoll, propLift, pieceSectors, rampHeight, rotXZ, startOf, beanAt, beanTrack, type Bean, type BeanTrack, quatMul as qmul, quatYTo as yTo, type Quat, type Level, type Piece } from "./level.ts";
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
// Seesaw board: half the ball's mass, so the ball tips it decisively but it still swings with weight.
const SEESAW_MASS = 0.5;
// Stool: as heavy as the ball, so it gives way to a roll but not to a tap, and damped so it stops
// soon after the ball stops pushing.
const STOOL_MASS = 1.5, STOOL_DAMPING = 3, STOOL_LIFT = 0.02;
// Crates and barrels: one light, slippery, barely bouncy body each; a gate's cube shares the feel.
const PROP_MASS = 0.2, PROP_FRICTION = 0.35, PROP_RESTITUTION = 0.1;
// A bean's skin: slippery, so it shoves the ball on rather than dragging it round with its roll.
const BEAN_FRICTION = 0.3;
// A gate's chain link: light beside the cube it holds.
const GATE_LINK_MASS = 0.02;
// A gate's cube: heavier than a barrel, and dragged by a force against its speed each step (a body's
// own damping, and impulses, do nothing on a multibody link), which slows its swing and its slide
// along the bar alike.
const GATE_CUBE_MASS = 0.5, GATE_CUBE_DRAG = 1;
// Facets round a rail in the physics; a flat one faces the ball (see railSweep).
const RAILS_SIDES = 24;
const PLANK_GROUPS = (0x0002 << 16) | 0xfffd;
// The platforms' own colliders, and a bridge plank's hinge barrel, which never meets them: the end
// barrels sit on the hinges at the platform walls, half inside them.
const FLOOR_GROUPS = (0x0004 << 16) | 0xffff, BARREL_GROUPS = (0x0002 << 16) | 0xfff9;
// A sliding kicker's wedge, which reaches below the surface it stands on and so never meets the floor.
const OFF_FLOOR_GROUPS = (0x0008 << 16) | 0xfffb;
// A gate's parts all meet the arches, the bar and everything else, except: the links never meet each
// other or the cube (each hangs in the next), and the top link, which hangs round the bar, never
// meets the bar.
const ARCH_GROUPS = (0x0010 << 16) | 0xffff, BAR_GROUPS = (0x0040 << 16) | 0xffff;
const CUBE_GROUPS = (0x0080 << 16) | 0xffdf, LINK_GROUPS = (0x0020 << 16) | 0xff5f, TOP_LINK_GROUPS = (0x0020 << 16) | 0xff1f;

export interface SimSpinner { index: number; body: RAPIER.RigidBody; angle: number; speed: number }
export interface SimCrate { index: number; body: RAPIER.RigidBody }
export interface SimBridge { index: number; planks: RAPIER.RigidBody[] }
// Planks, seesaws, stools, sliding kickers and beans: one body each, drawn by its piece group. `frozen` is set while a plank
// or seesaw with `freeze` waits to be touched: its collider, checked each step.
export interface SimPlank { index: number; body: RAPIER.RigidBody; frozen?: RAPIER.Collider }
// `chord` is the horizontal unit direction from entrance to exit (zero if they share x and z).
export interface SimTube { index: number; centre: [number, number, number][]; chord: [number, number] }
export interface SimMover { index: number; body: RAPIER.RigidBody; piece: Mover }
export interface Sim {
  world: RAPIER.World;
  // Pieces carried by a moving platform (see riders in level.ts), by index.
  riders: Map<number, SimMover>;
  ball: RAPIER.RigidBody;
  spinners: SimSpinner[];
  crates: SimCrate[];
  bridges: SimBridge[];
  planks: SimPlank[];
  tubes: SimTube[];
  movers: SimMover[];
  // Seconds of play stepped so far: the clock moving platforms run their schedules on.
  readonly time: number;
  // How far every treadmill's rod tops have run along it so far.
  readonly beltTravel: number;
  // Below this a fallen ball respawns and a fallen crate goes home (respawnY in level.ts).
  readonly respawnY: number;
  step(throttle: number, fx: number, fz: number): void;
  respawn(): void;
  free(): void;
}

export function yQuat(deg: number): { x: number; y: number; z: number; w: number } {
  const h = (deg * Math.PI) / 360;
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
}
// v turned by q (v' = q v q*), and by q's inverse.
const qrot = (q: Quat, v: { x: number; y: number; z: number }) => {
  const ix = q.w * v.x + q.y * v.z - q.z * v.y, iy = q.w * v.y + q.z * v.x - q.x * v.z, iz = q.w * v.z + q.x * v.y - q.y * v.x, iw = -q.x * v.x - q.y * v.y - q.z * v.z;
  return { x: ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, y: iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, z: iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x };
};
const qunrot = (q: Quat, v: { x: number; y: number; z: number }) => qrot({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v);
const xQuat = (deg: number): Quat => { const h = (deg * Math.PI) / 360; return { x: Math.sin(h), y: 0, z: 0, w: Math.cos(h) }; };
const zQuat = (deg: number): Quat => { const h = (deg * Math.PI) / 360; return { x: 0, y: 0, z: Math.sin(h), w: Math.cos(h) }; };
// A moving or tilted slab's collider: the convex hull of its drawn mesh, rounded lip and all.
const platformHull = (w: number, d: number): RAPIER.ColliderDesc =>
  RAPIER.ColliderDesc.convexHull(new Float32Array(platformMesh(w, d, PLATFORM_THICKNESS, PLATFORM_LIP, 1).positions))!;
// A quarter turn about z: a cylinder's axis from y onto x; about x, from y onto z.
const Z90 = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }, X90 = { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 };

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
    RAPIER.ColliderDesc.trimesh(floor.positions, floor.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES).setFriction(1).setCollisionGroups(FLOOR_GROUPS),
  );
  // Platform sides and undersides, so nothing clips through a slab from the side or below.
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(floor.body.positions, floor.body.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES).setFriction(0.6).setCollisionGroups(FLOOR_GROUPS),
  );
  for (const pts of floor.solids) {
    const desc = RAPIER.ColliderDesc.convexHull(pts);
    if (desc) world.createCollider(desc.setFriction(0.6).setCollisionGroups(FLOOR_GROUPS));
  }
  // Moving platforms: a slab on a kinematic body (unturned: the slab's collider carries its turn),
  // set each step to where its schedule says. What rides one is fixed to it: its solid parts are
  // colliders on the platform's body, and the anchors its hinged and sliding parts hang from are
  // carried along each step.
  const movers: SimMover[] = [];
  const moverOf = new Map<number, SimMover>();
  // Tilted slabs: wall grip works only on their big faces, never their edges.
  const walls = new Set<number>();
  level.pieces.forEach((p, index) => {
    if (!isMoving(p)) return;
    const at = moverAt(p, 0);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y, at.z));
    walls.add(world.createCollider(platformHull(p.w, p.d).setRotation(qmul(yQuat(p.rot), qmul(xQuat(p.tilt), zQuat(p.roll ?? 0)))).setFriction(1), body).handle);
    const m = { index, body, piece: p };
    movers.push(m);
    moverOf.set(index, m);
  });
  const rides = new Map<number, SimMover>();
  for (const [pi, si] of riders(level)) rides.set(pi, moverOf.get(si)!);
  // The platform a piece is being built on, if it moves: its fixed colliders go on that body.
  let riding: SimMover | undefined;
  // A rolled prop being built (see pieceRoll): its colliders, laid out unrolled, are turned by `q`
  // about its base point `o` (the roll about its own front-to-back axis), as it is drawn.
  let rolled: { o: { x: number; y: number; z: number }; q: Quat } | null = null;
  const rollFrame = (p: Piece) => {
    const roll = pieceRoll(p), rot = pieceRot(p);
    return roll ? { o: { x: p.x, y: p.y, z: p.z }, q: qmul(yQuat(rot), qmul(zQuat(roll), yQuat(-rot))) } : null;
  };
  const fixed = (desc: RAPIER.ColliderDesc): RAPIER.Collider => {
    if (rolled) {
      const { o, q } = rolled, t = desc.translation, d = qrot(q, { x: t.x - o.x, y: t.y - o.y, z: t.z - o.z });
      desc.setTranslation(o.x + d.x, o.y + d.y, o.z + d.z).setRotation(qmul(q, desc.rotation));
    }
    if (!riding) return world.createCollider(desc);
    const t = desc.translation, o = riding.piece;
    return world.createCollider(desc.setTranslation(t.x - o.x, t.y - o.y, t.z - o.z), riding.body);
  };
  // Where a riding piece's free bodies start: shifted with its platform (an `offset` starts it part way along).
  const shifted = (index: number, v: { x: number; y: number; z: number }) => {
    const m = rides.get(index), d = m ? moverShift(m.piece, 0) : { x: 0, y: 0, z: 0 };
    return { x: v.x + d.x, y: v.y + d.y, z: v.z + d.z };
  };
  // Bodies carried with a platform each step: anchors, and frozen props while they wait.
  const carried: { body: RAPIER.RigidBody; base: { x: number; y: number; z: number }; mover: SimMover; active?: () => boolean }[] = [];
  const anchorBody = (index: number, at: { x: number; y: number; z: number }, rot: Quat): RAPIER.RigidBody => {
    const m = rides.get(index);
    if (!m) return world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(at.x, at.y, at.z).setRotation(rot));
    const w = shifted(index, at), body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(w.x, w.y, w.z).setRotation(rot));
    carried.push({ body, base: at, mover: m });
    return body;
  };
  const carryWhileFrozen = (index: number, pl: SimPlank) => {
    const m = rides.get(index);
    if (!m || !pl.frozen) return;
    const t = pl.body.translation(), d = moverShift(m.piece, 0);
    carried.push({ body: pl.body, base: { x: t.x - d.x, y: t.y - d.y, z: t.z - d.z }, mover: m, active: () => !!pl.frozen });
  };

  // A fence's rail is exactly the tube that is drawn: a capsule of the rail's radius along each
  // stretch of its centre line, with nothing above or below it.
  const fenceColliders = (p: Piece & { type: "fence" }) => {
    const pts = fenceRings(p).map((q) => { const o = rotXZ(q.c[0], q.c[2], p.rot); return { x: p.x + o.x, y: p.y + q.c[1], z: p.z + o.z }; });
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]!, b = pts[i + 1]!, d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, l = Math.hypot(d.x, d.y, d.z);
      if (l < 1e-6) continue;
      fixed(
        RAPIER.ColliderDesc.capsule(l / 2, RAIL_R).setTranslation((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2).setRotation(yTo(d.x / l, d.y / l, d.z / l)).setFriction(1),
      );
    }
  };
  const bumpers: RAPIER.Collider[] = [], magnets: RAPIER.Collider[] = [];
  const rods: { body: RAPIER.RigidBody; axis: { x: number; z: number }; r: number }[] = [];
  // Each rod's collider and the way its treadmill carries (local -z).
  const belts = new Map<number, { x: number; z: number }>();
  let beltSpeed = NaN, beltTravel = 0;
  level.pieces.forEach((p, index) => {
    const rot = pieceRot(p);
    riding = rides.get(index) ?? moverOf.get(index);
    rolled = rollFrame(p);
    if (isBelt(p) && !isTilted(p) && !isMoving(p)) {
      // Each rod spins on its own kinematic body.
      const b = beltRods(p), q = yQuat(rot), axis = rotXZ(1, 0, rot);
      for (const z of b.z) {
        const o = rotXZ(0, z, rot);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(p.x + o.x, p.y - PLATFORM_THICKNESS / 2, p.z + o.z).setRotation(qmul(q, Z90)));
        const c = world.createCollider(RAPIER.ColliderDesc.cylinder(b.half, b.r).setFriction(1), body);
        rods.push({ body, axis, r: b.r });
        belts.set(c.handle, { x: axis.z, z: -axis.x });
      }
    }
    if (p.type === "slab" && isTilted(p) && !isMoving(p)) {
      // Roll about local z, tilt about local x, then yaw.
      const q = qmul(yQuat(rot), qmul(xQuat(p.tilt), zQuat(p.roll ?? 0)));
      walls.add(fixed(platformHull(p.w, p.d).setTranslation(p.x, p.y, p.z).setRotation(q).setFriction(1)).handle);
      return;
    }
    for (const b of pieceBoxes(p)) {
      if (b.kind === "platform") continue;
      const o = rotXZ(b.x, b.z, rot), r = Math.min(b.r ?? 0, b.w / 2, b.h / 2, b.d / 2) * 0.999;
      fixed(
        (r > 0 ? RAPIER.ColliderDesc.roundCuboid(b.w / 2 - r, b.h / 2 - r, b.d / 2 - r, r) : RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, b.d / 2))
          .setTranslation(p.x + o.x, p.y + b.y, p.z + o.z)
          .setRotation(yQuat(rot))
          .setFriction(1),
      );
    }
    if (p.type === "gate") {
      for (const pts of gateHulls(p)) {
        const desc = RAPIER.ColliderDesc.roundConvexHull(new Float32Array(pts.flat()), GATE_ROUND);
        if (desc) fixed(desc.setTranslation(p.x, p.y, p.z).setRotation(yQuat(rot)).setFriction(0.6).setCollisionGroups(ARCH_GROUPS));
      }
      // The bar is the drawn rod, its rounded ends hidden in the beams.
      fixed(RAPIER.ColliderDesc.capsule(p.d / 2, RAIL_R).setTranslation(p.x, p.y + gateHang(p).pivot, p.z).setRotation(qmul(yQuat(rot), X90)).setFriction(0.6).setCollisionGroups(BAR_GROUPS));
    }
    if (p.type === "fence") fenceColliders(p);
    if (p.type === "rails") {
      // One welded mesh per rail, with a flat facet turned to where the ball touches it.
      const { lines, caps } = railsLines(p, railsRingsWorld(p, level));
      for (const { rings, off } of lines) {
        const m = railSweep(rings, off, RAIL_R, RAILS_SIDES, railsContact(p.lines));
        fixed(
          RAPIER.ColliderDesc.trimesh(new Float32Array(m.positions), new Uint32Array(m.indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES).setFriction(1),
        );
      }
      for (const c of caps) fixed(RAPIER.ColliderDesc.ball(RAIL_R).setTranslation(...c).setFriction(1));
    }
    for (const c of pieceCylinders(p)) {
      const o = rotXZ(c.x ?? 0, c.z ?? 0, rot);
      fixed(RAPIER.ColliderDesc.cylinder(c.h / 2, c.r).setTranslation(p.x + o.x, p.y + (c.y0 ?? 0) + c.h / 2, p.z + o.z).setFriction(1));
    }
    if (p.type === "pillar") {
      // The dome is the hull of the drawn half-sphere's own points, squashed the same way.
      const R = PILLAR_R + PILLAR_COLLAR.r, top = PILLAR_H - PILLAR_CAP + PILLAR_COLLAR.h, k = (PILLAR_CAP - PILLAR_COLLAR.h) / R;
      const prof: [number, number][] = [];
      for (let j = 0; j <= 12; j++) { const t = (j / 12) * (Math.PI / 2); prof.push([R * Math.sin(t), top + R * Math.cos(t) * k]); }
      const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(revolvePoints(prof, 32)));
      if (desc) fixed(desc.setTranslation(p.x, p.y, p.z).setFriction(1));
    }
    if (p.type === "bumper") {
      const m = revolveMesh(bumperProfile().flatMap((band, i) => (i ? band.slice(1) : band)), 48);
      bumpers.push(fixed(
        RAPIER.ColliderDesc.trimesh(new Float32Array(m.positions), new Uint32Array(m.indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES)
          .setTranslation(p.x, p.y, p.z).setFriction(1),
      ));
    }
    if (p.type === "magnet") {
      const m = revolveMesh(magnetProfile().flatMap((band, i) => (i ? band.slice(1) : band)), 48);
      magnets.push(fixed(
        RAPIER.ColliderDesc.trimesh(new Float32Array(m.positions), new Uint32Array(m.indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES)
          .setTranslation(p.x, p.y, p.z).setFriction(1),
      ));
    }
    if (p.type === "goal") {
      const t = torusMesh(p.r + GOAL_RING.gap, GOAL_RING.tube);
      fixed(RAPIER.ColliderDesc.trimesh(new Float32Array(t.positions), new Uint32Array(t.indices)).setTranslation(p.x, p.y + GOAL_RING.y, p.z).setFriction(1));
    }
    for (const sec of pieceSectors(p)) {
      if (sec.kind === "platform") continue;
      const a0 = sec.a0 ?? 0, a1 = sec.a1 ?? 90;
      const m = sectorMesh(sec.inner, sec.outer, sec.y0, sec.y1, { angle: ((a1 - a0) * Math.PI) / 180, segments: Math.max(1, Math.ceil((CURVE_SEGMENTS * (a1 - a0)) / 90)) });
      fixed(
        RAPIER.ColliderDesc.trimesh(m.positions, m.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
          .setTranslation(p.x, p.y, p.z)
          .setRotation(yQuat(rot + a0))
          .setFriction(1),
      );
    }
  });
  riding = undefined;
  rolled = null;

  const jumps = level.pieces.filter((p): p is Piece & { type: "jump" } => p.type === "jump");
  const spinners: SimSpinner[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "spinner") return;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y + SPINNER_HEIGHT / 2, p.z),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(p.length / 2, SPINNER_HEIGHT / 2, SPINNER_WIDTH / 2).setFriction(0.5), body);
    spinners.push({ index, body, angle: 0, speed: p.speed });
  });

  // Props never sleep: a sleeping prop is not woken when what it rests on moves away, and would hang
  // in the air. Crates and barrels are free bodies under the same gravity as the ball; one that falls
  // off the world comes back to where it started.
  const crates: SimCrate[] = [];
  const crateHome = new Map<number, { x: number; y: number; z: number; q: Quat }>();
  level.pieces.forEach((p, index) => {
    if (p.type !== "crate" && p.type !== "barrel") return;
    const home = { ...shifted(index, { x: p.x, y: p.y + propLift(p) + 0.02, z: p.z }), q: qmul(yQuat(p.rot), zQuat(pieceRoll(p))) };
    crateHome.set(index, home);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(home.x, home.y, home.z).setRotation(home.q).setCcdEnabled(true).setGravityScale(TUNING.propGravity).setCanSleep(false),
    );
    const cr = p.type === "crate" ? crateRound(p.w, p.h, p.d) : propRound(2 * p.r, p.h, 2 * p.r);
    const desc = p.type === "crate" ? RAPIER.ColliderDesc.roundCuboid(p.w / 2 - cr, p.h / 2 - cr, p.d / 2 - cr, cr) : RAPIER.ColliderDesc.roundCylinder(p.h / 2 - cr, p.r - cr, cr);
    world.createCollider(desc.setMass(PROP_MASS).setFriction(PROP_FRICTION).setRestitution(PROP_RESTITUTION), body);
    crates.push({ index, body });
  });

  // A bridge is a chain of plank bodies on revolute hinges, its two ends hinged to fixed
  // anchors. Bodies are placed in the rest pose from level.ts so every joint starts satisfied.
  const bridges: SimBridge[] = [];
  // Gates' cubes, dragged each step (see GATE_CUBE_DRAG).
  const gateCubes: RAPIER.RigidBody[] = [];
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
        RAPIER.RigidBodyDesc.dynamic().setTranslation(w.x, w.y, w.z).setRotation(qmul(yaw, xQuat(pl.tilt))).setGravityScale(TUNING.propGravity)
          .setLinearDamping(PLANK_DAMPING).setAngularDamping(PLANK_DAMPING),
      );
      world.createCollider(
        RAPIER.ColliderDesc.roundCuboid(p.w / 2 - r, BRIDGE_PLANK_T / 2 - r, pl.len / 2 - r, r).setMass(PLANK_MASS).setFriction(1)
          .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DYNAMIC_DYNAMIC).setCollisionGroups(PLANK_GROUPS),
        body,
      );
      // The hinge barrel across the plank's near end, drawn there and solid there.
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(p.w / 2 - BRIDGE_BARREL.inset, BRIDGE_BARREL.r).setTranslation(0, 0, chain.seg / 2).setRotation(Z90).setMass(0.001).setFriction(1)
          .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DYNAMIC_DYNAMIC).setCollisionGroups(BARREL_GROUPS),
        body,
      );
      return body;
    });
    // The anchors' barrel and lugs hold the end planks' hinges, so the bridge's planks pass through them.
    const ANCHOR_GROUPS = (0xffff << 16) | 0xfffd;
    world.createCollider(RAPIER.ColliderDesc.cylinder(p.w / 2 - BRIDGE_BARREL.inset, BRIDGE_BARREL.r).setRotation(Z90).setFriction(1).setCollisionGroups(ANCHOR_GROUPS), far);
    for (const [anchor, dir] of [[near, 1], [far, -1]] as const) {
      const L = BRIDGE_LUG;
      for (const x of [p.w / 2 - L.x, -(p.w / 2 - L.x)]) {
        world.createCollider(RAPIER.ColliderDesc.roundCuboid(L.w / 2 - L.r, L.h / 2 - L.r, L.d / 2 - L.r, L.r).setTranslation(x, 0, dir * L.z).setFriction(1).setCollisionGroups(ANCHOR_GROUPS), anchor);
      }
    }
    const axis = { x: 1, y: 0, z: 0 }, h = chain.seg / 2, O = { x: 0, y: 0, z: 0 };
    planks.forEach((b, k) => {
      const prev = k === 0 ? near : planks[k - 1]!;
      world.createImpulseJoint(RAPIER.JointData.revolute(k === 0 ? O : { x: 0, y: 0, z: -h }, { x: 0, y: 0, z: h }, axis), prev, b, true);
    });
    world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0, z: -h }, O, axis), planks[planks.length - 1]!, far, true);
    bridges.push({ index, planks });
  });

  // A knock-down plank is a free body like a crate, except its base is pinned: a revolute hinge
  // through the middle of the base, raised off the surface so the base corners clear the floor
  // whichever way it goes. It is dynamic from the start, or with `freeze` starts as a kinematic
  // body at its start angle, solid but unmoved by anything, and turns dynamic the first step a
  // moving body (the ball, a crate, another plank) touches it. Sleep can't do this: Rapier wakes a
  // jointed body on the first step, and a tilted plank would just fall.
  const planks: SimPlank[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "plank") return;
    const yaw = yQuat(p.rot), pose = plankPose(p), c = rotXZ(0, pose.z, p.rot), hinge = plankHinge(p), hc = rotXZ(0, hinge.z, p.rot);
    const pivot = anchorBody(index, { x: p.x + hc.x, y: p.y + hinge.y, z: p.z + hc.z }, yaw), at = shifted(index, { x: p.x + c.x, y: p.y + pose.y, z: p.z + c.z });
    const body = world.createRigidBody(
      (p.freeze ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic()).setTranslation(at.x, at.y, at.z).setRotation(qmul(yaw, xQuat(-pose.tilt)))
        .setAngularDamping(0.02).setGravityScale(TUNING.propGravity).setCcdEnabled(true).setCanSleep(false),
    );
    const r = PLANK_T / 2 - 0.01;
    const collider = world.createCollider(RAPIER.ColliderDesc.roundCuboid(p.w / 2 - r, p.h / 2 - r, PLANK_T / 2 - r, r).setMass(KNOCK_PLANK_MASS).setFriction(0.6).setRestitution(0.05), body);
    const barrel = Math.SQRT1_2;
    world.createCollider(RAPIER.ColliderDesc.cylinder(p.w / 2 + PLANK_BARREL, PLANK_T / 2).setTranslation(0, -p.h / 2, 0).setRotation({ x: 0, y: 0, z: barrel, w: barrel }).setMass(0.01).setFriction(0.6), body);
    for (const m of plankMounts(p)) {
      world.createCollider(
        RAPIER.ColliderDesc.roundCuboid(m.w / 2 - PLANK_MOUNT_R, m.h / 2 - PLANK_MOUNT_R, m.d / 2 - PLANK_MOUNT_R, PLANK_MOUNT_R).setTranslation(m.x, m.y - hinge.y, m.z - hinge.z).setFriction(0.6),
        pivot,
      );
    }
    // The barrel turns inside its mounts, so the plank and the mounts on the pivot must not collide.
    world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: -p.h / 2, z: 0 }, { x: 1, y: 0, z: 0 }), pivot, body, !p.freeze).setContactsEnabled(false);
    const pl: SimPlank = { index, body, frozen: p.freeze ? collider : undefined };
    planks.push(pl);
    carryWhileFrozen(index, pl);
  });

  // A seesaw is a board pinned at its middle on a revolute axle, awake from the start at its
  // start angle, or frozen there like a plank with `freeze`. Its centre of mass is on the axle, so
  // it stays put until something rolls onto it and the weight tips it. Its two posts are solid,
  // the board passes between them.
  level.pieces.forEach((p, index) => {
    if (p.type !== "seesaw") return;
    const yaw = yQuat(p.rot), H = p.y + seesawPivot(p), postH = seesawPostH(p);
    const pivot = anchorBody(index, { x: p.x, y: H, z: p.z }, yaw), at = shifted(index, { x: p.x, y: H, z: p.z });
    riding = rides.get(index);
    const body = world.createRigidBody(
      (p.freeze ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic()).setTranslation(at.x, at.y, at.z).setRotation(qmul(yaw, xQuat(seesawTilt(p))))
        .setAngularDamping(0.3).setGravityScale(TUNING.propGravity).setCanSleep(false),
    );
    const r = SEESAW_T / 2 - 0.01;
    const board = world.createCollider(RAPIER.ColliderDesc.roundCuboid(p.w / 2 - r, SEESAW_T / 2 - r, p.d / 2 - r, r).setMass(SEESAW_MASS).setFriction(1).setRestitution(0.02), body);
    const hub = SEESAW_HUB, hw = (p.w - 2 * hub.inset) / 2;
    world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(hw - hub.r, hub.h / 2 - hub.r, hub.d / 2 - hub.r, hub.r).setTranslation(0, -SEESAW_T / 2 - hub.drop, 0).setMass(0.01).setFriction(0.6), body,
    );
    // The stubs turn inside the board's edge, so the board and the pivot carrying them must not collide.
    world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), pivot, body, !p.freeze).setContactsEnabled(false);
    const stub = SEESAW_STUB, q = Math.SQRT1_2;
    for (const side of [1, -1]) {
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(stub.l / 2, stub.r).setTranslation(side * (p.w / 2 + stub.l / 2 - stub.into), 0, 0).setRotation({ x: 0, y: 0, z: q, w: q }).setFriction(0.5), pivot,
      );
      const o = rotXZ(side * (p.w / 2 + SEESAW_POST_W / 2 + 0.05), 0, p.rot), R = SEESAW_POST_R;
      fixed(
        RAPIER.ColliderDesc.roundCuboid(SEESAW_POST_W / 2 - R, postH / 2 - R, SEESAW_POST_D / 2 - R, R)
          .setTranslation(p.x + o.x, p.y + postH / 2, p.z + o.z).setRotation(yaw).setFriction(0.5),
      );
    }
    riding = undefined;
    const pl: SimPlank = { index, body, frozen: p.freeze ? board : undefined };
    planks.push(pl);
    carryWhileFrozen(index, pl);
  });

  // A gate's chain is a body per link, each on an exact joint (multibody, which cannot drift apart
  // under a push) to the next, the top one to a runner on the bar and the cube to the bottom one.
  // A joint bends any way but never twists about the chain, so neighbouring links stay crossed as
  // they hang in each other: every body keeps the gate's turn, the quarter turn of every other link
  // being only in its shape. The ball knocks the cube swinging; a hard knock stops it
  // against an arch's beam. It goes in `bridges`, links first and the cube last, each body drawn by
  // its own group.
  level.pieces.forEach((p, index) => {
    if (p.type !== "gate") return;
    const yaw = yQuat(p.rot), hang = gateHang(p), C = GATE_CUBE, r = propRound(C, C, C), links = gateLinks(p);
    const pivot = anchorBody(index, { x: p.x, y: p.y + hang.pivot, z: p.z }, yaw);
    const make = (y: number) => {
      const at = shifted(index, { x: p.x, y: p.y + hang.pivot + y, z: p.z });
      return world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z).setRotation(yaw).setGravityScale(TUNING.propGravity).setCcdEnabled(true).setCanSleep(false),
      );
    };
    const half = GATE_LINK.straight + GATE_CHAIN_R;
    const bodies = links.map((y, k) => {
      const b = make(y);
      world.createCollider(RAPIER.ColliderDesc.capsule(half - GATE_CHAIN_R, GATE_CHAIN_R).setMass(GATE_LINK_MASS).setFriction(0.3).setCollisionGroups(k ? LINK_GROUPS : TOP_LINK_GROUPS), b);
      return b;
    });
    const cube = make(hang.cube - hang.pivot);
    gateCubes.push(cube);
    world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(C / 2 - r, C / 2 - r, C / 2 - r, r).setMass(GATE_CUBE_MASS).setFriction(PROP_FRICTION).setRestitution(PROP_RESTITUTION).setCollisionGroups(CUBE_GROUPS), cube,
    );
    // Each joint at the point between the two it joins, as heights from the pivot: a hinge across x
    // into a massless knuckle there and a hinge across z out of it. A multibody joint can't free just
    // two turns (Rapier panics), so two one-turn hinges make the bend-any-way, never-twist joint.
    const join = (a: RAPIER.RigidBody, ay: number, b: RAPIER.RigidBody, by: number, at: number) => {
      const w = shifted(index, { x: p.x, y: p.y + hang.pivot + at, z: p.z }), O = { x: 0, y: 0, z: 0 };
      const knuckle = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(w.x, w.y, w.z).setRotation(yaw).setCanSleep(false)
          .setAdditionalMassProperties(1e-3, O, { x: 1e-5, y: 1e-5, z: 1e-5 }, { x: 0, y: 0, z: 0, w: 1 }),
      );
      world.createMultibodyJoint(RAPIER.JointData.revolute({ x: 0, y: at - ay, z: 0 }, O, { x: 1, y: 0, z: 0 }), a, knuckle, true).setContactsEnabled(false);
      world.createMultibodyJoint(RAPIER.JointData.revolute(O, { x: 0, y: at - by, z: 0 }, { x: 0, y: 0, z: 1 }), knuckle, b, true).setContactsEnabled(false);
    };
    // The top link rides the bar on a runner: an exact slide along it, stopped a link's width short
    // of each beam; only the cube's drag slows it, so a push carries the chain along by itself.
    const at = shifted(index, { x: p.x, y: p.y + hang.pivot, z: p.z }), reach = p.d / 2 - SUPPORT_W / 2 - GATE_CHAIN_R;
    const runner = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z).setRotation(yaw).setCanSleep(false)
        .setAdditionalMassProperties(GATE_LINK_MASS, { x: 0, y: 0, z: 0 }, { x: 1e-3, y: 1e-3, z: 1e-3 }, { x: 0, y: 0, z: 0, w: 1 }),
    );
    const slide = RAPIER.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    slide.limitsEnabled = true;
    slide.limits = [-reach, reach];
    world.createMultibodyJoint(slide, pivot, runner, true);
    join(runner, 0, bodies[0]!, links[0]!, 0);
    for (let k = 0; k + 1 < links.length; k++) join(bodies[k]!, links[k]!, bodies[k + 1]!, links[k + 1]!, (links[k]! + links[k + 1]!) / 2);
    join(bodies[links.length - 1]!, links[links.length - 1]!, cube, hang.cube - hang.pivot, -hang.chain);
    bridges.push({ index, planks: [...bodies, cube] });
  });

  // A stool slides along its track and nothing else: an exact prismatic link (a multibody joint,
  // which cannot drift sideways under a push) to a fixed anchor at its start, stopped at the track's
  // ends. It floats a hair above the surface so only its damping, not floor friction, slows it.
  level.pieces.forEach((p, index) => {
    if (p.type !== "stool") return;
    const yaw = yQuat(p.rot), slide = stoolSlide(p), y = p.y + p.h / 2 + STOOL_LIFT, alongZ = stoolAxis(p) === "z";
    const c = rotXZ(alongZ ? 0 : slide.at, alongZ ? slide.at : 0, p.rot);
    const anchor = anchorBody(index, { x: p.x + c.x, y, z: p.z + c.z }, yaw), at = shifted(index, { x: p.x + c.x, y, z: p.z + c.z });
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z).setRotation(yaw).setLinearDamping(STOOL_DAMPING).setCcdEnabled(true).setCanSleep(false),
    );
    const r = propRound(p.w, p.h, p.d);
    world.createCollider(RAPIER.ColliderDesc.roundCuboid(p.w / 2 - r, p.h / 2 - r, p.d / 2 - r, r).setMass(STOOL_MASS).setFriction(0.4).setRestitution(0.05), body);
    const joint = RAPIER.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, alongZ ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 });
    joint.limitsEnabled = true;
    joint.limits = [slide.lo - slide.at, slide.hi - slide.at];
    world.createMultibodyJoint(joint, anchor, body, true);
    planks.push({ index, body });
  });

  // A bean rolls its track on a kinematic body, set each step to where its schedule says, so it
  // shoves the ball and any free prop it meets aside with nothing to stop it. Its collider is the
  // capsule drawn, lying along its own y and turned to lie across its heading (beanAt).
  const beans: { body: RAPIER.RigidBody; piece: Bean; track: BeanTrack }[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "bean") return;
    const track = beanTrack(p), at = beanAt(p, track, 0);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, at.y, at.z).setRotation(at.q));
    world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(0, p.len / 2 - p.r), p.r).setFriction(BEAN_FRICTION), body);
    beans.push({ body, piece: p, track });
    planks.push({ index, body });
  });

  let time = 0;
  const fallY = respawnY(level);

  // Jump pads: a fixed convex hull each, base and top outlines, so the ramp all round is seamless.
  for (const p of jumps) {
    riding = rides.get(level.pieces.indexOf(p));
    const { base, top } = jumpRings(p);
    const pts = new Float32Array([...base.map((v) => [v, 0] as const), ...top.map((v) => [v, JUMP_H] as const)].flatMap(([[x, z], y]) => {
      const r = rollPoint(p.roll ?? 0, [x, y, z]), o = rotXZ(r[0], r[2], p.rot);
      return [p.x + o.x, p.y + r[1], p.z + o.z];
    }));
    const desc = RAPIER.ColliderDesc.convexHull(pts);
    if (desc) fixed(desc.setFriction(1));
  }

  // Kickers: a fixed rounded convex wedge each, so the slope is one flat face with no seams to catch on.
  // A sliding one is a stool's way: a body on a prismatic link along its x. Its slope reaches below
  // the surface (KICKER_SINK), so it never meets the floor; the link alone holds it up.
  level.pieces.forEach((p, index) => {
    if (p.type !== "kicker") return;
    if (isSliding(p)) {
      const yaw = yQuat(p.rot), slide = kickerSlide(p), c = rotXZ(slide.at, 0, p.rot);
      const anchor = anchorBody(index, { x: p.x + c.x, y: p.y, z: p.z + c.z }, yaw), at = shifted(index, { x: p.x + c.x, y: p.y, z: p.z + c.z });
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z).setRotation(yaw).setLinearDamping(STOOL_DAMPING).setCcdEnabled(true).setCanSleep(false),
      );
      const hull = kickerHull(p), desc = RAPIER.ColliderDesc.roundConvexHull(new Float32Array(hull.corners.flat()), hull.r);
      if (desc) world.createCollider(desc.setMass(STOOL_MASS).setFriction(1).setCollisionGroups(OFF_FLOOR_GROUPS), body);
      const joint = RAPIER.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      joint.limitsEnabled = true;
      joint.limits = [slide.lo - slide.at, slide.hi - slide.at];
      world.createMultibodyJoint(joint, anchor, body, true);
      planks.push({ index, body });
      return;
    }
    riding = rides.get(index);
    const hull = kickerHull(p);
    const pts = new Float32Array(hull.corners.flatMap((c) => { const r = rollPoint(p.roll ?? 0, c), o = rotXZ(r[0], r[2], p.rot); return [p.x + o.x, p.y + r[1], p.z + o.z]; }));
    const desc = RAPIER.ColliderDesc.roundConvexHull(pts, hull.r);
    if (desc) fixed(desc.setFriction(1));
  });
  riding = undefined;

  // Tubes: the inside is one smooth swept skin the ball rolls on. The wall behind it is solid
  // convex blocks: a zero-thickness surface only pushes from its front face, so a ball could slip
  // in from outside where a block never lets it. A ring of rail sits round each mouth. The blocks
  // start a little outside the skin so their flat inner faces never narrow the bore.
  // A ring of rail (a tube mouth's, or a hoop): the drawn torus as it is.
  const railRing = (m: { c: [number, number, number]; d: [number, number, number] }) => {
    const t = ringMesh(m.c, m.d, RING_R, RING_T, RING_SIDES, RING_SEGMENTS);
    fixed(RAPIER.ColliderDesc.trimesh(new Float32Array(t.positions), new Uint32Array(t.indices)).setFriction(1));
  };
  const tubes: SimTube[] = [];
  level.pieces.forEach((p, index) => {
    if (p.type !== "tube") return;
    const rings = tubeRingsWorld(p);
    if (rings.length < 2) return;
    const skin = sweepTube(rings, TUBE_R, true, TUBE_SKIN_SIDES);
    world.createCollider(
      RAPIER.ColliderDesc.trimesh(new Float32Array(skin.positions), new Uint32Array(skin.indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES).setFriction(0.6),
    );
    const rIn = TUBE_R / Math.cos(Math.PI / TUBE_WALL_SIDES) + 0.005;
    for (const pts of tubeWallBlocks(rings, rIn, TUBE_R + TUBE_SOLID_WALL, TUBE_WALL_SIDES)) {
      const desc = RAPIER.ColliderDesc.convexHull(pts);
      if (desc) world.createCollider(desc.setFriction(0.6));
    }
    for (const m of mouthRings(rings)) railRing(m);
    const a = rings[0]!.c, e = rings[rings.length - 1]!.c, cl = Math.hypot(e[0] - a[0], e[2] - a[2]);
    tubes.push({ index, centre: rings.map((q) => q.c), chord: cl > 1e-6 ? [(e[0] - a[0]) / cl, (e[2] - a[2]) / cl] : [0, 0] });
  });
  level.pieces.forEach((p, index) => {
    if (p.type !== "hoop") return;
    riding = rides.get(index);
    rolled = rollFrame(p);
    railRing(hoopRing(p));
    riding = undefined;
    rolled = null;
  });
  // Direction along the tube at the ball, when the ball is inside it between the two mouths.
  const tubeDir = (t: SimTube, b: { x: number; y: number; z: number }): [number, number, number] | null => {
    let best = TUBE_R, dir: [number, number, number] | null = null;
    for (let i = 0; i + 1 < t.centre.length; i++) {
      const a = t.centre[i]!, e = t.centre[i + 1]!;
      const dx = e[0] - a[0], dy = e[1] - a[1], dz = e[2] - a[2], L2 = dx * dx + dy * dy + dz * dz;
      if (L2 < 1e-9) continue;
      const u = ((b.x - a[0]) * dx + (b.y - a[1]) * dy + (b.z - a[2]) * dz) / L2;
      if ((i === 0 && u < 0) || (i + 2 === t.centre.length && u > 1)) continue;
      const k = Math.max(0, Math.min(1, u));
      const dist = Math.hypot(a[0] + dx * k - b.x, a[1] + dy * k - b.y, a[2] + dz * k - b.z);
      if (dist < best) { best = dist; const L = Math.sqrt(L2); dir = [dx / L, dy / L, dz / L]; }
    }
    return dir;
  };

  let props: RAPIER.RigidBody[] | null = null;
  let propGravity = TUNING.propGravity;

  const start = startOf(level);
  // The pad is dished, so it is a triangle mesh rather than a convex hull.
  const pad = revolveMesh(startPadProfile(), 48);
  world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(pad.positions), new Uint32Array(pad.indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES | RAPIER.TriMeshFlags.DELETE_DEGENERATE_TRIANGLES)
    .setTranslation(start.x, start.y, start.z).setFriction(1));
  const spawn = from
    ? { x: from.x, y: from.y + BALL_RADIUS + 0.05, z: from.z }
    : { x: start.x, y: start.y + START_PAD_REST + 0.3, z: start.z };
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(spawn.x, spawn.y, spawn.z).setCcdEnabled(true),
  );
  const ballCollider = world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setMass(1).setFriction(1).setRestitution(0.05), ball);
  const down = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  // The way the treadmill under the ball carries, if it is touching one's rods.
  const beltUnder = (): { x: number; z: number } | null => {
    let dir: { x: number; z: number } | null = null;
    if (belts.size) world.contactPairsWith(ballCollider, (other) => {
      const d = belts.get(other.handle);
      if (d && !dir) world.contactPair(ballCollider, other, (m) => { for (let i = 0; i < m.numContacts(); i++) if (m.contactDist(i) < 0.02) dir = d; });
    });
    return dir;
  };

  return {
    world,
    ball,
    spinners,
    crates,
    bridges,
    planks,
    tubes,
    movers,
    riders: rides,
    get time() { return time; },
    get beltTravel() { return beltTravel; },
    respawnY: fallY,
    step(throttle, fx, fz) {
      props ??= [...crates.map((c) => c.body), ...bridges.flatMap((b) => b.planks), ...planks.map((p) => p.body)];
      for (const c of crates) {
        if (c.body.translation().y >= fallY) continue;
        const home = crateHome.get(c.index)!;
        c.body.setTranslation({ x: home.x, y: home.y, z: home.z }, true);
        c.body.setRotation(home.q, true);
        c.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      world.gravity = { x: 0, y: -TUNING.gravity, z: 0 };
      // Movable props share one gravity scale, live-tunable; applying it never wakes a sleeping plank.
      if (propGravity !== TUNING.propGravity) {
        propGravity = TUNING.propGravity;
        for (const b of props) b.setGravityScale(propGravity, false);
      }
      ball.setLinearDamping(TUNING.linearDamping);
      ball.setAngularDamping(TUNING.angularDamping);
      const f = throttle * TUNING.throttleForce;
      // Inside a tube the push runs along the tube instead, so the player can drive the ball up a
      // climb (against gravity, which still pulls it back) or back out. Where the tube is level the
      // push counts by how well it lines up with the tube; on a steep run, where the tube's own
      // heading vanishes, it counts by the entrance-to-exit heading instead.
      const at = ball.translation();
      let d: [number, number, number] | null = null, tube: SimTube | undefined;
      for (const t of tubes) if ((d = tubeDir(t, at))) { tube = t; break; }
      // The push, the slope it is on (the tube's direction, or the ground's normal under the ball), and
      // the way the push heads along that slope.
      let push: [number, number, number], slope: [number, number, number] | null = null, heading: [number, number, number] | null = null;
      // A moving platform carrying the ball: its speed, and the drag on that speed given back.
      let carry: [number, number, number] = [0, 0, 0], extra: [number, number, number] = [0, 0, 0];
      if (d && tube) {
        const hl = Math.hypot(d[0], d[2]);
        const along = fx * d[0] + fz * d[2] + (1 - hl) * (fx * tube.chord[0] + fz * tube.chord[1]);
        push = [d[0] * f * along, d[1] * f * along, d[2] * f * along];
        slope = [-TUNING.gravity * d[1] * d[0], -TUNING.gravity * d[1] * d[1], -TUNING.gravity * d[1] * d[2]];
        if (f * along) heading = f * along < 0 ? [-d[0], -d[1], -d[2]] : d;
      } else {
        push = [fx * f, 0, fz * f];
        down.origin = at;
        const hit = world.castRayAndGetNormal(down, BALL_RADIUS * 1.6 + 0.1, true, undefined, undefined, ballCollider, ball);
        // Riding a moving platform: drag acts on the ball's speed over the ground, which would pull
        // it back off a platform carrying it, so give back the drag on the platform's own speed.
        const rode = hit ? movers.find((m) => m.body.handle === hit.collider.parent()?.handle) : undefined;
        if (rode) {
          const a = moverAt(rode.piece, time), b = moverAt(rode.piece, time + STEP);
          carry = [(b.x - a.x) / STEP, (b.y - a.y) / STEP, (b.z - a.z) / STEP];
        } else {
          // On a treadmill the rods' tops are the ground, moving: the same give-back makes the ball
          // ride at their speed without spinning, where friction alone would leave it at 2/7 of it.
          const belt = beltUnder();
          if (belt) carry = [belt.x * TUNING.beltSpeed, 0, belt.z * TUNING.beltSpeed];
        }
        extra = [carry[0] * TUNING.linearDamping, carry[1] * TUNING.linearDamping, carry[2] * TUNING.linearDamping];
        if (hit && TUNING.climbAssist > 0 && throttle !== 0 && hit.normal.y > 0.2 && hit.normal.y < 0.999) {
          // Gravity's pull along the slope: g minus its part into the surface.
          const n = hit.normal, gn = -TUNING.gravity * n.y;
          slope = [-gn * n.x, -TUNING.gravity - gn * n.y, -gn * n.z];
          const px = fx * f, pz = fz * f, pn = px * n.x + pz * n.z, ux = px - pn * n.x, uy = -pn * n.y, uz = pz - pn * n.z, ul = Math.hypot(ux, uy, uz);
          if (ul > 1e-6) heading = [ux / ul, uy / ul, uz / ul];
        }
      }
      // Climb assist: cancel a share of only the part of the slope's pull that works against the push,
      // so a slanted platform still pulls the ball sideways down it while it drives across.
      const back = slope && heading ? slope[0] * heading[0] + slope[1] * heading[1] + slope[2] * heading[2] : 0;
      if (heading && back < 0) {
        const k = TUNING.climbAssist * Math.min(1, Math.abs(throttle));
        push = [push[0] - heading[0] * back * k, push[1] - heading[1] * back * k, push[2] - heading[2] * back * k];
      }
      // Speed cap: the player's own push (throttle and climb assist) never takes the ball's level speed,
      // over the ground or the platform carrying it, past maxSpeed; bumpers, jump pads, slopes and props can.
      // At the cap the push still turns the ball, keeping its speed. Push is read as acceleration: the ball's mass is 1.
      const vb = ball.linvel(), rx = vb.x - carry[0], rz = vb.z - carry[2], cap = Math.max(TUNING.maxSpeed, Math.hypot(rx, rz));
      const wx = rx + push[0] * STEP, wz = rz + push[2] * STEP, wh = Math.hypot(wx, wz);
      if (wh > cap) push = [(wx * (cap / wh) - rx) / STEP, push[1], (wz * (cap / wh) - rz) / STEP];
      push = [push[0] + extra[0], push[1] + extra[1], push[2] + extra[2]];
      // Wall grip: off the ground, an upright slab's big face the ball is pressed against carries up to
      // wallGrip of its weight, no more than the press (friction 1) allows.
      if (TUNING.wallGrip > 0) {
        let press = 0, grounded = false;
        world.contactPairsWith(ballCollider, (other) => {
          world.contactPair(ballCollider, other, (m, flipped) => {
            const n = m.normal(), ny = flipped ? n.y : -n.y;
            const face = walls.has(other.handle) ? qrot(other.rotation(), { x: 0, y: 1, z: 0 }) : null;
            const big = !!face && Math.abs(n.x * face.x + n.y * face.y + n.z * face.z) > 0.9;
            for (let i = 0; i < m.numContacts(); i++) {
              if (m.contactDist(i) > 0.02) continue;
              if (ny > 0.3) grounded = true;
              else if (big && Math.abs(ny) < 0.3) press += m.contactImpulse(i) / STEP;
            }
          });
        });
        if (!grounded) push[1] += Math.min(TUNING.wallGrip * TUNING.gravity, press);
      }
      // Magnets: a pull toward each one's axis, fading out at its reach; its level part is capped below
      // the throttle so the ball can always be driven off.
      for (const c of magnets) {
        // In the magnet's own frame: toward its axis, so one rolled onto a wall pulls up or across.
        const o = c.translation(), q = c.rotation(), l = qunrot(q, { x: at.x - o.x, y: at.y - o.y, z: at.z - o.z });
        const d = Math.hypot(l.x, l.z), dy = l.y, w = qrot(q, { x: -l.x, y: 0, z: -l.z }), dx = w.x, dz = w.z, dyw = w.y;
        if (d < 1e-6 || d >= MAGNET_REACH || dy < -BALL_RADIUS || dy > MAGNET_H + 2 * BALL_RADIUS) continue;
        // The level part of the pull is held under magnetHold of the throttle, so driving away always
        // escapes; the throttle can't push up or down, so the upright part is only the magnet's own.
        const pull = TUNING.magnetForce * Math.min(1, (MAGNET_REACH - d) / (MAGNET_REACH - MAGNET_R - BALL_RADIUS)) / d;
        const level = Math.hypot(dx, dz) * pull, cap = Math.min(TUNING.magnetHold, 0.9) * TUNING.throttleForce, k = level > cap ? cap / level : 1;
        push = [push[0] + dx * pull * k, push[1] + dyw * pull, push[2] + dz * pull * k];
      }
      ball.addForce({ x: push[0], y: push[1], z: push[2] }, true);
      for (const m of movers) m.body.setNextKinematicTranslation(moverAt(m.piece, time + STEP));
      for (const b of beans) { const at = beanAt(b.piece, b.track, time + STEP); b.body.setNextKinematicTranslation(at); b.body.setNextKinematicRotation(at.q); }
      for (const c of carried) {
        if (c.active && !c.active()) continue;
        const d = moverShift(c.mover.piece, time + STEP);
        c.body.setNextKinematicTranslation({ x: c.base.x + d.x, y: c.base.y + d.y, z: c.base.z + d.z });
      }
      for (const s of spinners) {
        s.angle += s.speed * STEP;
        body_rot(s.body, s.angle);
      }
      for (const c of gateCubes) {
        const v = c.linvel(), k = -GATE_CUBE_DRAG * c.mass();
        c.resetForces(false);
        c.addForce({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
      // Treadmill rods turn backward about their local x, so their tops run toward local -z.
      if (beltSpeed !== TUNING.beltSpeed) {
        beltSpeed = TUNING.beltSpeed;
        for (const r of rods) { const w = -beltSpeed / r.r; r.body.setAngvel({ x: r.axis.x * w, y: 0, z: r.axis.z * w }, true); }
      }
      beltTravel += beltSpeed * STEP;
      const v0 = ball.linvel();
      world.step();
      time += STEP;
      // Bumpers: a ball that ran into one's side leaves straight out from its axis, at a share of the
      // speed it came in with but never slower than the kick; along the side its speed is kept.
      for (const c of bumpers) {
        // In the bumper's own frame (rolled or not): out from its axis, level in that frame.
        const o = c.translation(), q = c.rotation(), b = ball.translation(), l = qunrot(q, { x: b.x - o.x, y: b.y - o.y, z: b.z - o.z }), d = Math.hypot(l.x, l.z);
        if (d < 1e-6 || d > BUMPER_R + BALL_RADIUS + 0.05 || l.y < 0 || l.y > BUMPER_H) continue;
        const n = qrot(q, { x: l.x / d, y: 0, z: l.z / d }), vin = v0.x * n.x + v0.y * n.y + v0.z * n.z;
        if (vin >= 0) continue;
        const v = ball.linvel(), vn = v.x * n.x + v.y * n.y + v.z * n.z, out = Math.max(TUNING.bumperKick, -vin * TUNING.bumperBounce);
        if (vn < out) ball.setLinvel({ x: v.x + n.x * (out - vn), y: v.y + n.y * (out - vn), z: v.z + n.z * (out - vn) }, true);
      }
      for (const pl of planks) if (pl.frozen && touchedByMover(world, pl.frozen)) { pl.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); pl.frozen = undefined; }
      // Jump pads: in a launch zone the ball's speed out of the pad (straight up, or along a rolled
      // pad's own up) becomes what carries it the pad's rise above its top from where it is, so
      // setting it again on the way up adds nothing; its speed across the pad is left as it is.
      for (const j of jumps) {
        const b = ball.translation(), half = jumpPadSize(j) / 2, l = rotXZ(b.x - j.x, b.z - j.z, -j.rot);
        const u = rollPoint(-(j.roll ?? 0), [l.x, b.y - j.y, l.z]), up = u[1] - JUMP_H - BALL_RADIUS;
        if (Math.abs(u[0]) > half || Math.abs(u[2]) > half || up > JUMP_REACH || up < -0.3) continue;
        const nr = rollPoint(j.roll ?? 0, [0, 1, 0]), nh = rotXZ(nr[0], 0, j.rot), n = { x: nh.x, y: nr[1], z: nh.z };
        const v = ball.linvel(), vn = v.x * n.x + v.y * n.y + v.z * n.z, want = launchSpeed(j.rise - Math.max(0, up), TUNING.gravity, TUNING.linearDamping);
        if (vn < want) ball.setLinvel({ x: v.x + n.x * (want - vn), y: v.y + n.y * (want - vn), z: v.z + n.z * (want - vn) }, true);
      }
      ball.resetForces(true);
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

// The upward speed that carries the ball `rise` up before it stops climbing, under gravity `g`
// and linear damping `c`, stepped the way the physics steps it so the peak lands on the rise.
function launchSpeed(rise: number, g: number, c: number): number {
  const peak = (v0: number) => { let v = v0, y = 0; while (v > 0) { v = (v - g * STEP) / (1 + c * STEP); y += v * STEP; } return y; };
  let lo = 0, hi = 2 * Math.sqrt(2 * g * rise) + 10;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (peak(m) < rise) lo = m; else hi = m; }
  return hi;
}

// Whether a moving body (anything not fixed) is actually in contact with `c`, not just near it.
function touchedByMover(world: RAPIER.World, c: RAPIER.Collider): boolean {
  let hit = false;
  world.contactPairsWith(c, (other) => {
    if (hit || other.parent()?.isFixed() !== false) return;
    world.contactPair(c, other, (m) => { for (let i = 0; i < m.numContacts(); i++) if (m.contactDist(i) < 0.02) hit = true; });
  });
  return hit;
}

function body_rot(body: RAPIER.RigidBody, angle: number) {
  body.setNextKinematicRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) });
}

