import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BALL_RADIUS, KICKER_TRACK, isMoving, isShaped, type Slab, isSliding, PLANK_T, LAYER_H, HEIGHT_STEP, PIECE_TYPES, STRUCT_GRID, TUBE_BEND, TUBE_R, FENCE_RAIL_Y, FENCE_RAIL_CORNER, fenceSides, platformFence, cloneLevel, isTilted, pieceRot, pieceRoll, propLift, ROLLED_PROPS, rotXZ, type Platform, tubeNodeWorld, tubeTurns, type PathPiece, isPlatform, isStructure, levelProblems, newMove, PIECE_VARIANTS, railsEndYaw, midBounds, fitMid, newPiece, platformFootprint, platformHeightAt, platformOverlaps, surfaceAt, validateLevel, type Level, type Piece, type PieceType, type RailEnd, type XZ } from "./level.ts";
import { buildLevel, createScene, FOG_EDITOR, fitSun, markOverlapping, type Built, type SceneEnv } from "./scene.ts";
import { createSim } from "./sim.ts";
import { pieceThumbs, saveThumb } from "./thumbs.ts";
import { clear, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";
import type { PlayFrom } from "./game.ts";

const HITBOX_KEY = "balling.hitboxes";
const HITBOX_MAT = new THREE.LineBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.8, depthTest: false });

export function blankLevel(): Level {
  return { id: "new-level", name: "New Level", pieces: [
    newPiece("start", 0, 0, 0),
    { ...newPiece("slab", 0, 0, 0), w: 8, d: 8 } as Piece,
    newPiece("goal", 0, 0, -12),
    { ...newPiece("slab", 0, 0, -12), w: 8, d: 8 } as Piece,
  ] };
}

// The add palette's sections; a type not listed here and not retired lands in misc.
const PALETTE: [title: string, types: PieceType[]][] = [
  ["Platforms", ["slab", "curve", "ramp", "hole"]],
  ["Interactables", ["bridge", "kicker", "jump", "plank", "seesaw", "stool", "bean", "crate", "barrel", "bumper", "magnet", "blockade", "barrier", "gate", "pillar", "hoop"]],
  ["Connectors", ["tube", "rails", "fence"]],
  ["Misc", ["start", "goal", "support", "column"]],
];
// Still loaded from old level files, but no longer offered.
const RETIRED: PieceType[] = ["spinner", "block"];
function paletteGroups(): [string, PieceType[]][] {
  const listed = new Set(PALETTE.flatMap(([, ts]) => ts));
  const rest = PIECE_TYPES.filter((t) => !RETIRED.includes(t) && !listed.has(t));
  return PALETTE.map(([title, ts]): [string, PieceType[]] => [title, title === "Misc" ? [...ts, ...rest] : ts]);
}

const NUM_FIELDS: Record<PieceType, [key: string, step: number][]> = {
  start: [],
  slab: [["w", 0.5], ["d", 0.5], ["rot", 15], ["tilt", 15], ["roll", 15], ["twist", 15]],
  curve: [["inner", 0.5], ["outer", 0.5], ["rot", 15]],
  ramp: [["w", 0.5], ["d", 0.5], ["rot", 15], ["rise", 1]],
  bridge: [["w", 0.5], ["d", 0.5], ["rot", 15]],
  rails: [["rot", 15]],
  plank: [["w", 0.5], ["h", 0.5], ["rot", 15], ["tilt", 5]],
  seesaw: [["w", 0.5], ["d", 0.5], ["h", 0.1], ["rot", 15], ["tilt", 1]],
  support: [["w", 0.5], ["h", 1], ["rot", 15]],
  gate: [["w", 0.5], ["d", 0.5], ["h", 0.5], ["rot", 15]],
  kicker: [["w", 0.5], ["d", 0.5], ["h", 0.1], ["flat", 0.5], ["rot", 15], ["roll", 15]],
  block: [["w", 0.5], ["h", 0.5], ["d", 0.5], ["rot", 15]],
  blockade: [["rot", 15], ["roll", 15]],
  barrier: [["rot", 15], ["roll", 15]],
  crate: [["w", 0.1], ["h", 0.1], ["d", 0.1], ["rot", 15], ["roll", 15]],
  barrel: [["r", 0.1], ["h", 0.1], ["rot", 15], ["roll", 15]],
  stool: [["w", 0.5], ["h", 0.1], ["d", 0.5], ["rot", 15], ["track", 1], ["offset", 0.5]],
  bean: [["rot", 15], ["r", 0.1], ["len", 0.1], ["speed", 0.5], ["wait", 0.5], ["offset", 0.5]],
  jump: [["w", 0.5], ["d", 0.5], ["rot", 15], ["roll", 15], ["rise", 0.5]],
  hole: [["w", 0.5], ["d", 0.5], ["rot", 15]],
  pillar: [["rot", 15], ["roll", 15]],
  column: [["h", 0.5], ["rot", 15], ["roll", 15]],
  bumper: [["rot", 15], ["roll", 15]],
  magnet: [["rot", 15], ["roll", 15]],
  spinner: [["length", 0.5], ["speed", 0.1]],
  goal: [],
  tube: [["rot", 15]],
  hoop: [["rot", 15], ["roll", 15]],
  fence: [["rot", 15]],
};
// What the panels call each field; the level files keep the short keys.
const LABELS: Record<string, string> = {
  w: "width", d: "depth", h: "height", rot: "rotate (°)", tilt: "tilt (°)", roll: "roll (°)", twist: "twist (°)",
  rise: "rise (layers)", flat: "flat deck", inner: "inner radius", outer: "outer radius", r: "radius", length: "length",
  track: "track length", offset: "start offset", speed: "speed", wait: "wait (s)", bend: "bend radius", top: "top width",
};
const label = (key: string) => LABELS[key] ?? key;
// Snap increments for moving platforms and structures, chosen in the toolbar and remembered.
const SNAP_KEY = "balling.snap.v2";
const SNAP_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const SNAP = { platform: 4, structure: STRUCT_GRID };
try {
  const saved = JSON.parse(localStorage.getItem(SNAP_KEY) ?? "{}") as Partial<typeof SNAP>;
  for (const k of ["platform", "structure"] as const) { const v = saved[k]; if (typeof v === "number" && v > 0) SNAP[k] = v; }
} catch { /* keep defaults */ }
const to = (step: number) => (v: number) => Math.round(Math.round(v / step) * step * 1000) / 1000;
const snap = (v: number) => to(SNAP.platform)(v);
const gridSnap = (v: number) => to(SNAP.structure)(v);
const snapFor = (p: Piece) => (isStructure(p) ? gridSnap : snap);
// One arrow-key step of `n` grid lines in direction `dir`: an off-grid value first lands on the
// next grid line that way, and the axis not being moved (dir 0) snaps to its nearest line, so a
// nudge always corrects onto the grid.
function step(v: number, dir: number, grid: number, n: number): number {
  if (!dir) return to(grid)(v);
  const k = v / grid, on = Math.abs(k - Math.round(k)) < 1e-6;
  const first = on ? Math.round(k) + dir : dir > 0 ? Math.ceil(k) : Math.floor(k);
  return to(grid)((first + dir * (n - 1)) * grid);
}
const layerSnap = (v: number) => Math.round(v / HEIGHT_STEP) * HEIGHT_STEP;
// Platform sizes and heights step in fours, the unit every level is laid out in, unless "Fine
// sizes" is ticked. Zero is kept so a ramp can be flattened or a curve run from its centre.
const SIZE_GRID = 4;
const FINE_KEY = "balling.fineSizes";
let fineSizes = false;
// Height of the white ground grid, chosen in the toolbar and remembered; new pieces land on it.
const GRID_Y_KEY = "balling.gridY";
let gridY = 0;
try { gridY = Number(localStorage.getItem(GRID_Y_KEY)) || 0; } catch { /* on the ground */ }
try { fineSizes = localStorage.getItem(FINE_KEY) === "1"; } catch { /* coarse */ }
const COARSE_FIELDS: Partial<Record<PieceType, string[]>> = {
  slab: ["y", "w", "d"], curve: ["y", "inner", "outer"], ramp: ["y", "w", "d", "rise"], bridge: ["w", "d"],
};
const isCoarse = (t: PieceType, key: string) => !fineSizes && !!COARSE_FIELDS[t]?.includes(key);

// A tube's or rails' nodes in world space, first end first, and the inverse: rebuild the piece from them.
// `mid` is the curve point of the segment arriving at the node, if that segment is curved.
interface P3 { x: number; y: number; z: number }
interface WorldNode extends P3 { bend: number; mid?: P3 }
const toWorld = (p: PathPiece, l: P3): P3 => { const o = rotXZ(l.x, l.z, p.rot); return { x: p.x + o.x, y: p.y + l.y, z: p.z + o.z }; };
const tubeWorld = (p: PathPiece): WorldNode[] => [0, ...p.path.map((_, i) => i + 1)].map((k) => {
  const n = k ? p.path[k - 1]! : undefined;
  return { ...tubeNodeWorld(p, k), bend: n?.bend ?? 0, ...(n?.mid ? { mid: toWorld(p, n.mid) } : {}) };
});
const r3 = (v: number) => Math.round(v * 1000) / 1000;
function setTubeWorld(p: PathPiece, nodes: WorldNode[]) {
  const [o] = nodes;
  p.x = o!.x; p.y = o!.y; p.z = o!.z;
  const local = (w: P3) => { const l = rotXZ(w.x - p.x, w.z - p.z, -p.rot); return { x: r3(l.x), y: r3(w.y - p.y), z: r3(l.z) }; };
  p.path = nodes.slice(1).map((n) => ({ ...local(n), bend: n.bend, ...(n.mid ? { mid: local(n.mid) } : {}) }));
}
// Where a segment's midpoint dot sits: its curve point, or halfway along it while straight.
const midOf = (ns: WorldNode[], k: number): P3 => ns[k]!.mid ?? { x: (ns[k - 1]!.x + ns[k]!.x) / 2, y: (ns[k - 1]!.y + ns[k]!.y) / 2, z: (ns[k - 1]!.z + ns[k]!.z) / 2 };
// Curve points snap finer than nodes, so a curve can be shaped by hand.
const midSnap = (v: number) => to(Math.min(SNAP.structure, 0.5))(v);
// Pull every curve point back inside its segment's box (see fitMid), after any path edit.
const fitMids = (p: PathPiece) => p.path.forEach((n, k) => { if (n.mid) n.mid = fitMid(p, k, n.mid); });
// How far above its nodes a path piece's handles sit: at the rail, the bean's centre or the tube's.
const pathLift = (p: PathPiece): number => (p.type === "fence" ? FENCE_RAIL_Y : p.type === "bean" ? p.r : TUBE_R);

// Structures snap to the placement grid and drop onto whatever platform is under them; a tube's
// entrance drops onto the platform under it, the rest of the tube moving with it.
function settle(level: Level, p: Piece) {
  if (p.type === "tube") {
    const y = surfaceAt(level, p.x, p.z);
    if (y !== null && y !== p.y) { for (const n of p.path) n.y = r3(n.y - (y - p.y)); p.y = y; }
    return;
  }
  if (p.type === "plank" && p.side) { attachToEdge(level, p); return; }
  if (p.type === "rails") { attachRailEnds(level, p); return; }
  if (p.type === "fence" || p.type === "bean") {
    const y = surfaceAt(level, p.x, p.z);
    if (y !== null && y !== p.y) { for (const n of p.path) n.y = r3(n.y - (y - p.y)); p.y = y; }
    p.path.forEach((n, k) => {
      const w = tubeNodeWorld(p, k + 1), at = surfaceAt(level, w.x, w.z);
      if (at !== null) n.y = r3(at - p.y);
    });
    return;
  }
  if (!isStructure(p)) return;
  if (p.type === "kicker" && p.top !== undefined) {
    // A side kicker snaps by its wall side, which stands against a wall on a platform's edge.
    const o = rotXZ(p.wall === "left" ? -p.w / 2 : p.w / 2, 0, p.rot);
    p.x = r3(gridSnap(p.x + o.x) - o.x); p.z = r3(gridSnap(p.z + o.z) - o.z);
  } else { p.x = gridSnap(p.x); p.z = gridSnap(p.z); }
  // A column keeps the y it is given: it often stands under the platform it holds up.
  if (p.type === "column") return;
  // So does a rolled prop: one stood out of a wall is placed by hand.
  if (pieceRoll(p) % 360 !== 0) return;
  const y = surfaceAt(level, p.x, p.z);
  if (y !== null) p.y = y;
}

// Hang a side plank on the nearest open platform edge: on the edge line at the platform's top,
// facing in, so it falls out over the gap.
function attachToEdge(level: Level, p: Piece & { type: "plank" }) {
  const e = nearestOpenEdge(level, p.x, p.z, p.y, gridSnap);
  if (e) { p.x = e.x; p.z = e.z; p.y = e.y; p.rot = e.rot; }
}

// Snap each rails end onto its platform: a side end onto the nearest open edge's wall face, a top
// end over the platform beneath it, and either one's y to that platform's top. An `end` end stays put.
function attachRailEnds(level: Level, p: Piece & { type: "rails" }) {
  const ns = tubeWorld(p);
  for (const [end, n] of [[p.a, ns[0]!], [p.b, ns[ns.length - 1]!]] as const) {
    if (end === "end") continue;
    if (end === "side") {
      const e = nearestOpenEdge(level, n.x, n.z, n.y, (v) => v);
      if (e) { n.x = e.x; n.z = e.z; n.y = e.y; }
    } else {
      const top = surfaceAt(level, n.x, n.z);
      if (top !== null) n.y = top;
    }
  }
  setTubeWorld(p, ns);
}

// The point on an open platform edge (one with nothing level beyond it) nearest (x, z), preferring
// edges whose top is near `y`; `snap` places it along the edge. `y` is that edge's top there.
function nearestOpenEdge(level: Level, px: number, pz: number, py: number, snap: (v: number) => number): { x: number; z: number; y: number; rot: number } | null {
  let best: { d: number; x: number; z: number; y: number; rot: number } | null = null;
  for (const q of level.pieces) {
    if (!isPlatform(q)) continue;
    for (const poly of platformFootprint(q)) {
      const cx = poly.reduce((s, v) => s + v[0], 0) / poly.length, cz = poly.reduce((s, v) => s + v[1], 0) / poly.length;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!, b = poly[(i + 1) % poly.length]!, ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez);
        if (len < 1e-6) continue;
        let nx = -ez / len, nz = ex / len;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        if ((cx - mx) * nx + (cz - mz) * nz < 0) { nx = -nx; nz = -nz; }
        const top = platformHeightAt(q, mx, mz), beyond = surfaceAt(level, mx - nx * 0.25, mz - nz * 0.25);
        if (beyond !== null && beyond >= top - 0.01) continue;
        const s = Math.max(0, Math.min(len, snap(((px - a[0]) * ex + (pz - a[1]) * ez) / len)));
        const x = a[0] + (ex / len) * s, z = a[1] + (ez / len) * s;
        const d = Math.hypot(px - x, pz - z) + Math.abs(top - py) * 0.5;
        if (!best || d < best.d) best = { d, x: r3(x), z: r3(z), y: platformHeightAt(q, x, z), rot: r3((Math.atan2(nx, nz) * 180) / Math.PI) };
      }
    }
  }
  return best;
}

// Where the line {axis = v} crosses a convex polygon, as a [lo, hi] span on the other axis.
function clip(q: XZ[], axis: 0 | 1, v: number): [number, number] | null {
  const o = (1 - axis) as 0 | 1;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < q.length; i++) {
    const a = q[i]!, b = q[(i + 1) % q.length]!;
    if ((v - a[axis]) * (v - b[axis]) > 0) continue;
    if (a[axis] === b[axis]) { lo = Math.min(lo, a[o], b[o]); hi = Math.max(hi, a[o], b[o]); continue; }
    const t = (v - a[axis]) / (b[axis] - a[axis]);
    const w = a[o] + t * (b[o] - a[o]);
    lo = Math.min(lo, w); hi = Math.max(hi, w);
  }
  return hi - lo > 1e-6 ? [lo, hi] : null;
}

// Placement grid drawn over every platform top, following a ramp's slope.
function placementGrid(level: Level): THREE.LineSegments {
  const pos: number[] = [];
  for (const p of level.pieces) {
    if (!isPlatform(p)) continue;
    const at = (x: number, z: number) => pos.push(x, platformHeightAt(p, x, z) + 0.02, z);
    const line = (x0: number, z0: number, x1: number, z1: number) => {
      const n = p.type === "ramp" ? Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0))) : 1;
      for (let i = 0; i < n; i++) { at(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n); at(x0 + ((x1 - x0) * (i + 1)) / n, z0 + ((z1 - z0) * (i + 1)) / n); }
    };
    for (const q of platformFootprint(p)) {
      const xs = q.map((v) => v[0]), zs = q.map((v) => v[1]);
      const G = SNAP.structure;
      for (let x = Math.ceil(Math.min(...xs) / G) * G; x <= Math.max(...xs) + 1e-6; x += G) {
        const s = clip(q, 0, x);
        if (s) line(x, s[0], x, s[1]);
      }
      for (let z = Math.ceil(Math.min(...zs) / G) * G; z <= Math.max(...zs) + 1e-6; z += G) {
        const s = clip(q, 1, z);
        if (s) line(s[0], z, s[1], z);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x2ee8ff, transparent: true, opacity: 0.55 }));
}

export interface EditorOpts { onPlay(level: Level, from?: PlayFrom): void; onExit(): void }

export class Editor implements Mode {
  private scene: THREE.Scene;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1200);
  private controls: OrbitControls;
  private built: Built;
  private sel = new Set<number>();
  private helpers: (THREE.Object3D & { update(): void })[] = [];
  private clipboard: Piece[] = [];
  private cursor: { x: number; y: number } | null = null;
  private marquee: { x0: number; y0: number; el: HTMLElement; add: boolean } | null = null;
  private rightDown: { x: number; y: number; index: number } | null = null;
  // "Play here": while armed, a ghost ball follows the cursor over any upward face; a click plays from it.
  private dropping = false;
  private dropAt: THREE.Vector3 | null = null;
  private ghost = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f, wireframe: true }));
  private hereBtn!: HTMLButtonElement;
  private grid: THREE.LineSegments | null = null;
  private ground = new THREE.GridHelper(400, 200, 0x9fb4cc, 0xc7d6e6);
  // Hitbox view (H): every collider of a fresh physics world for the level, drawn as lines. It is
  // rebuilt a moment after each change; `hitboxGen` drops a rebuild that a newer change overtook.
  private hitboxes = false;
  private hitboxLines: THREE.LineSegments | null = null;
  private hitboxJson = "";
  private hitboxGen = 0;
  private hitboxTimer = 0;
  private hitboxBtn!: HTMLButtonElement;
  // The selected tube's node handles and segment midpoint dots; `node` is the picked node and
  // `mid` the picked segment (by the node it arrives at), -1 for none; at most one is picked.
  private handles = new THREE.Group();
  private node = -1;
  private mid = -1;
  private nodeDrag: { plane: THREE.Plane; off: THREE.Vector3; before: string } | null = null;
  private undoStack: string[] = [];
  // What undo took back, newest last; any new edit clears it.
  private redoStack: string[] = [];
  // The selection the side panel was last built for (see renderPanel).
  private panelShows = "";
  private raf = 0;
  private panel: HTMLElement;
  private info = h("div", { class: "info" });
  private body = h("div", { class: "body" });
  private inspector = h("div", { class: "editor inspector" }, this.body);
  private problems = h("div", { class: "problems" });
  private notice = h("div", { class: "notice" });
  private noticeTimer = 0;
  private ray = new THREE.Raycaster();
  private drag: { plane: THREE.Plane; off: THREE.Vector3; anchor: number; starts: Map<number, { x: number; z: number }>; moved: boolean; before: string } | null = null;
  private onResize = () => this.resize();
  private onKey = (e: KeyboardEvent) => this.key(e);
  private onKeyUp = (e: KeyboardEvent) => this.held.delete(e.code);
  private onBlur = () => this.held.clear();
  private held = new Set<string>();
  private lastFrame = 0;

  private ctx: Ctx;
  private level: Level;
  private opts: EditorOpts;

  constructor(ctx: Ctx, level: Level, opts: EditorOpts) {
    this.ctx = ctx;
    this.level = level;
    this.opts = opts;
    this.env = createScene(FOG_EDITOR);
    this.scene = this.env.scene;
    this.ground.position.y = gridY;
    this.scene.add(this.ground);
    this.built = buildLevel(level, true);
    this.scene.add(this.built.group);
    fitSun(this.env.sun, this.built);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.scene.add(this.handles);
    this.controls = new OrbitControls(this.camera, ctx.canvas);
    this.controls.enableDamping = true;
    // Left is ours (select, marquee, drag); middle pans; right-drag orbits and a right click deletes.
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    const s = level.pieces.find((p) => p.type === "start") ?? { x: 0, y: 0, z: 0 };
    this.camera.position.set(s.x + 28, s.y + 36, s.z + 30);
    this.controls.target.set(s.x + 10, s.y, s.z - 20);
    const thumbs = pieceThumbs(ctx.renderer);

    this.panel = h("div", { class: "editor" },
      this.info,
      h("div", { class: "bar" },
        h("button", { onclick: () => this.play() }, "▶ Play"),
        this.hereBtn = h("button", { class: "ghost", title: "Play from a spot you click (P)", onclick: () => this.armDrop(!this.dropping) }, "▶ Play At") as HTMLButtonElement,
        h("button", { class: "ghost", title: "Ctrl+Z", onclick: () => this.undo() }, "Undo"),
        h("button", { class: "ghost", title: "Ctrl+Shift+Z", onclick: () => this.redo() }, "Redo"),
        h("button", { onclick: () => void this.save() }, "Save"),
        this.hitboxBtn = h("button", { class: "ghost", title: "Show every collider exactly as the physics has it (H)", onclick: () => this.toggleHitboxes() }, "Hitboxes") as HTMLButtonElement,
      ),
      h("div", { class: "bar snap" }, this.snapPicker("platform", "Platform snap"), this.snapPicker("structure", "Structure snap"), this.fineToggle(), this.gridLevel()),
      h("div", { class: "bar add" }, ...paletteGroups().map(([title, types]) => h("div", { class: "group" }, h("div", { class: "group-title" }, title), ...types.flatMap((t) => [
        { name: t as string, make: (x: number, y: number, z: number) => newPiece(t, x, y, z) },
        ...PIECE_VARIANTS.filter((v) => v.base === t),
      ]).map((e) => h("button", { class: "pick", title: e.name, onclick: () => this.add(e.make) }, h("img", { src: thumbs.get(e.name), alt: e.name })))))),
      this.problems,
      this.notice,
    );
    ctx.overlay.append(h("button", { class: "editor-back", title: "Leave the editor", "aria-label": "Leave the editor", onclick: () => opts.onExit() }, "←"), this.inspector, this.panel);
    try { this.hitboxes = localStorage.getItem(HITBOX_KEY) === "1"; } catch { /* off */ }
    this.hitboxBtn.className = this.hitboxes ? "" : "ghost";
    ctx.canvas.addEventListener("pointerdown", this.down);
    ctx.canvas.addEventListener("pointermove", this.move);
    ctx.canvas.addEventListener("pointerup", this.up);
    ctx.canvas.addEventListener("pointerleave", () => { this.cursor = null; });
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
    addEventListener("keyup", this.onKeyUp);
    addEventListener("blur", this.onBlur);
    this.resize();
    this.refresh();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.pan(dt);
    this.controls.update();
    this.env.render(this.ctx.renderer, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  // WASD slides camera and target together along the ground, scaled by orbit distance.
  private pan(dt: number) {
    if (!this.held.size) return;
    const t = this.controls.target, c = this.camera.position;
    const fwd = new THREE.Vector3(t.x - c.x, 0, t.z - c.z);
    if (fwd.lengthSq() < 1e-6) return;
    fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const move = new THREE.Vector3();
    if (this.held.has("KeyW")) move.add(fwd);
    if (this.held.has("KeyS")) move.sub(fwd);
    if (this.held.has("KeyD")) move.add(right);
    if (this.held.has("KeyA")) move.sub(right);
    if (move.lengthSq() < 1e-6) return;
    move.normalize().multiplyScalar(c.distanceTo(t) * 0.9 * dt);
    c.add(move);
    t.add(move);
  }

  private resize() {
    this.ctx.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private commit(before = JSON.stringify(this.level)) {
    for (const q of this.level.pieces) if (isPlatform(q) || q.type === "bridge" || q.type === "plank" || q.type === "seesaw" || q.type === "support" || q.type === "gate" || q.type === "tube") q.y = layerSnap(q.y);
    if (before !== JSON.stringify(this.level)) this.pushUndo(before);
    this.refresh();
  }

  // Slide a new platform along +x until it sits clear of every other platform.
  private placeFree(piece: Piece) {
    const others = { ...this.level, pieces: [...this.level.pieces, piece] };
    for (let tries = 0; tries < 400 && platformOverlaps(others).length; tries++) piece.x += 0.5;
  }

  private refresh() {
    this.scene.remove(this.built.group);
    this.built = buildLevel(this.level, true);
    markOverlapping(this.built, new Set(platformOverlaps(this.level).flat()));
    this.scene.add(this.built.group);
    fitSun(this.env.sun, this.built);
    for (const hl of this.helpers) hl.removeFromParent();
    this.helpers = [];
    for (const i of [...this.sel]) if (i >= this.level.pieces.length) this.sel.delete(i);
    for (const i of this.sel) {
      const g = this.built.pieceGroups[i], q = this.level.pieces[i], panel = this.built.planks.get(i);
      // A plank's outline is the plank alone, turning with it; its hinge and yokes are not part of it.
      if (q?.type === "plank" && panel) {
        const box = Object.assign(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(q.w, q.h, PLANK_T)), new THREE.LineBasicMaterial({ color: 0xffd23f })), { update() {} });
        panel.add(box);
        this.helpers.push(box);
      } else if (g) { const hl = new THREE.BoxHelper(g, 0xffd23f); this.helpers.push(hl); this.scene.add(hl); }
    }
    this.drawHitboxes();
    this.grid?.removeFromParent();
    this.grid?.geometry.dispose();
    this.grid = null;
    if (this.selectedPieces().some(isStructure)) { this.grid = placementGrid(this.level); this.scene.add(this.grid); }
    this.drawHandles();
    const probs = levelProblems(this.level);
    this.problems.textContent = probs.join(" · ");
    this.renderPanel();
  }

  private renderPanel() {
    // Rebuilding the panel keeps it scrolled where it was while the same pieces stay selected.
    const shows = [...this.sel].sort((x, y) => x - y).join(","), top = shows === this.panelShows ? this.body.scrollTop : 0;
    this.panelShows = shows;
    queueMicrotask(() => { this.body.scrollTop = top; });
    clear(this.body);
    clear(this.info);
    const name = h("input", { type: "text", value: this.level.name, oninput: () => { this.level.name = name.value; } });
    const id = h("input", { type: "text", value: this.level.id, oninput: () => { this.level.id = id.value.replace(/[^a-z0-9-]/g, "-"); } });
    this.info.append(h("h3", {}, "Level"), h("div", { class: "props" }, h("label", {}, "name", name), h("label", {}, "id", id)));
    this.inspector.hidden = !this.sel.size;
    if (this.sel.size > 1) {
      this.body.append(
        h("h3", {}, `${this.sel.size} pieces selected`),
        h("div", { class: "row", style: "display:flex;gap:6px;margin-top:6px" },
          h("button", { class: "ghost", onclick: () => this.duplicate() }, "Duplicate"),
          h("button", { class: "ghost", onclick: () => this.remove() }, "Delete"),
        ),
      );
      return;
    }
    const index = this.sel.size === 1 ? [...this.sel][0]! : -1;
    const p = this.level.pieces[index];
    if (p) {
      const props = h("div", { class: "props" });
      const rec = p as unknown as Record<string, number>;
      const field = (key: string, step: number) => {
        const coarse = isCoarse(p.type, key);
        const input = h("input", { type: "number", step: coarse ? SIZE_GRID : step, value: rec[key] ?? 0,
          onchange: () => {
            const before = JSON.stringify(this.level);
            rec[key] = coarse ? Math.round(Number(input.value) / SIZE_GRID) * SIZE_GRID : Number(input.value);
            this.commit(before);
          } });
        return h("label", {}, label(key), input);
      };
      const step = isStructure(p) ? SNAP.structure : SNAP.platform;
      props.append(field("x", step), field("y", HEIGHT_STEP), field("z", step));
      for (const [k, step] of NUM_FIELDS[p.type]) props.append(field(k, step));
      if (isPlatform(p)) props.append(this.fencePanel(p));
      if (p.type === "plank") {
        const cb = h("input", { type: "checkbox", checked: !!p.side, onchange: () => {
          const before = JSON.stringify(this.level);
          if (cb.checked) { p.side = true; attachToEdge(this.level, p); } else delete p.side;
          this.commit(before);
        } });
        props.append(h("div", { class: "checks", title: "Hang it on the side wall of the nearest platform edge, so it falls out across the gap" }, h("label", {}, cb, "side")));
      }
      if (p.type === "kicker") {
        const cb = h("input", { type: "checkbox", checked: isSliding(p), onchange: () => {
          const before = JSON.stringify(this.level);
          if (cb.checked) { p.track = Math.max(KICKER_TRACK, p.w); p.offset = 0; delete p.roll; } else { delete p.track; delete p.offset; }
          this.commit(before);
        } });
        props.append(h("div", { class: "checks", title: "Let the ball push it left and right along an invisible track" }, h("label", {}, cb, "slides sideways")));
        if (isSliding(p)) props.append(field("track", 1), field("offset", 0.5));
        if (p.top !== undefined) {
          const right = p.wall !== "left";
          props.append(field("top", 0.1), h("div", { class: "checks" }, h("label", {}, "wall side",
            h("button", { title: "Which side stays straight against the wall; the other narrows toward the top", onclick: () => {
              const before = JSON.stringify(this.level);
              p.wall = right ? "left" : "right";
              this.commit(before);
            } }, right ? "right" : "left"))));
        }
      }
      if (p.type === "slab") {
        const cb = h("input", { type: "checkbox", checked: !!p.belt, onchange: () => {
          const before = JSON.stringify(this.level);
          if (cb.checked) p.belt = true; else delete p.belt;
          this.commit(before);
        } });
        props.append(h("div", { class: "checks", title: "Rods instead of a tiled top, carrying the ball toward the far end (local -z); turn it with rot" }, h("label", {}, cb, "treadmill")));
      }
      if (p.type === "stool") {
        const alongZ = p.slide === "z";
        props.append(h("div", { class: "checks" }, h("label", {}, "slides",
          h("button", { title: "Switch between sliding left and right (its width) and front and back (its depth)", onclick: () => {
            const before = JSON.stringify(this.level);
            if (alongZ) delete p.slide; else p.slide = "z";
            p.track = Math.max(p.track, alongZ ? p.w : p.d);
            this.commit(before);
          } }, alongZ ? "front ↕ back" : "left ↔ right"))));
      }
      if (p.type === "plank" || p.type === "seesaw") {
        const cb = h("input", { type: "checkbox", checked: !!p.freeze, onchange: () => {
          const before = JSON.stringify(this.level);
          if (cb.checked) p.freeze = true; else delete p.freeze;
          this.commit(before);
        } });
        props.append(h("div", { class: "checks", title: "Hold the start pose until something touches it; unticked, physics runs from the start" }, h("label", {}, cb, "freeze until touched")));
      }
      if (p.type === "rails") {
        const pick = <T extends string | number>(label: string, value: T, options: [T, string][], set: (v: T) => void) => {
          const sel = h("select", { onchange: () => { const before = JSON.stringify(this.level); set(options[sel.selectedIndex]![0]); this.commit(before); } },
            ...options.map(([v, text]) => h("option", { selected: v === value }, text))) as HTMLSelectElement;
          return h("label", {}, label, sel);
        };
        const ends: [RailEnd, string][] = [["top", "top: stands over it, turns down into it"], ["side", "side: goes into its wall"], ["end", "end: stops in the air, closed round"]];
        props.append(
          pick("lines", p.lines, [[2, "2 rails"], [1, "1 rail"]], (v) => { p.lines = v; settle(this.level, p); }),
          pick("end a", p.a, ends, (v) => { p.a = v; settle(this.level, p); }),
          pick("end b", p.b, ends, (v) => { p.b = v; settle(this.level, p); }),
        );
      }
      if (p.type === "bean") {
        const loop = h("select", { title: "Ping-pong rolls the path out and back, waiting at each end; loop closes it with a straight run back to the first node and goes round", onchange: () => {
          const before = JSON.stringify(this.level);
          p.loop = loop.value === "loop" ? "loop" : "pingpong";
          this.commit(before);
        } },
          h("option", { value: "pingpong", selected: p.loop === "pingpong" }, "ping-pong: out and back"),
          h("option", { value: "loop", selected: p.loop === "loop" }, "loop: last node back to start"),
        ) as HTMLSelectElement;
        props.append(h("label", {}, "route", loop));
      }
      this.body.append(h("h3", {}, `${p.type} #${index}`), props);
      if (p.type === "tube" || p.type === "rails" || p.type === "fence" || p.type === "bean") this.body.append(this.tubePanel(p));
      if (p.type === "slab" && !p.belt && !p.twist && !isTilted(p) && !isMoving(p)) this.body.append(this.shapePanel(p));
      if (p.type === "slab" && !p.belt && !isShaped(p)) this.body.append(this.moverPanel(p));
      this.body.append(
        h("div", { class: "row", style: "display:flex;gap:6px;margin-top:6px" },
          h("button", { class: "ghost", onclick: () => this.duplicate() }, "Duplicate"),
          h("button", { class: "ghost", onclick: () => this.remove() }, "Delete"),
        ),
      );
    }
  }

  // A slab's shape: for each side, how far its two ends are pushed out (or in, negative) and how
  // far its middle bows out (or in). All zero is a plain rectangle, and the shape is dropped.
  private shapePanel(p: Slab): HTMLElement {
    const panel = h("div", { class: "shape-panel" }, h("h3", {}, "Shape"));
    const grid = h("div", { class: "shape", title: "Each side: how far its two ends are pushed out (negative pulls them in) and how far its middle bows out (negative bows it in), in units" });
    grid.append(h("span", {}), h("span", { class: "head" }, "ends"), h("span", { class: "head" }), h("span", { class: "head" }, "bow"));
    const rows: ["n" | "e" | "s" | "w", "n" | "s" | "e" | "w", "n" | "s" | "e" | "w"][] = [["n", "w", "e"], ["e", "n", "s"], ["s", "w", "e"], ["w", "n", "s"]];
    for (const [side, a, b] of rows) {
      grid.append(h("span", { class: "side" }, side));
      for (const key of [a, b, "bow"] as const) {
        const input = h("input", { type: "number", step: 0.5, value: p.shape?.[side]?.[key] ?? 0, onchange: () => {
          const before = JSON.stringify(this.level), v = Math.round(Number(input.value) * 2) / 2;
          const sh = p.shape ?? (p.shape = {}), s = sh[side] ?? (sh[side] = {});
          if (v) s[key] = v; else delete s[key];
          if (!Object.keys(s).length) delete sh[side];
          if (!Object.keys(sh).length) delete p.shape;
          this.commit(before);
        } });
        grid.append(h("label", { title: key === "bow" ? `how far the ${side} side's middle bows out` : `how far the ${side} side is pushed out at its ${key} end` }, key === "bow" ? "" : key, input));
      }
    }
    panel.append(grid);
    return panel;
  }

  // One button per side of the platform: adds a fence piece along that whole side, which is then
  // its own piece to shorten, bend or delete.
  private fencePanel(p: Platform): HTMLElement {
    const row = h("div", { class: "checks", title: "Add a fence piece along this side of the platform" }, h("span", {}, "fence a side"));
    for (const side of fenceSides(p)) {
      row.append(h("button", { class: "ghost", onclick: () => {
        const before = JSON.stringify(this.level);
        const add = platformFence(p, side.key);
        this.level.pieces.push(...add);
        this.commit(before);
        if (add.length) this.select(this.level.pieces.length - 1);
      } }, side.key));
    }
    return row;
  }

  private selectedTube(): PathPiece | null {
    const p = this.sel.size === 1 ? this.level.pieces[[...this.sel][0]!] : undefined;
    return p?.type === "tube" || p?.type === "rails" || p?.type === "fence" || p?.type === "bean" ? p : null;
  }

  // A sphere at each node of the selected tube and a smaller mint one halfway along each segment,
  // drawn through everything; the picked one is yellow.
  private drawHandles() {
    for (const c of [...this.handles.children]) { c.removeFromParent(); (c as THREE.Mesh).geometry.dispose(); }
    const p = this.selectedTube();
    if (!p) { this.node = -1; this.mid = -1; return; }
    if (this.node > p.path.length) this.node = -1;
    if (this.mid > p.path.length) this.mid = -1;
    const ns = tubeWorld(p), lift = pathLift(p);
    ns.forEach((n, k) => {
      const color = k === this.node ? 0xffd23f : 0xffffff;
      const m = new THREE.Mesh(new THREE.SphereGeometry(k === this.node ? 0.42 : 0.34, 16, 10), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
      m.position.set(n.x, n.y + lift, n.z);
      m.renderOrder = 10;
      m.userData.tubeNode = k;
      this.handles.add(m);
    });
    // A smaller dot halfway along each segment: drag it to bend that segment into a curve, or on a
    // smooth path to pull a new node out of it.
    for (let k = 1; k < ns.length; k++) {
      const at = midOf(ns, k), picked = k === this.mid;
      const color = p.smooth ? 0x8fe9ff : picked ? 0xffd23f : ns[k]!.mid ? 0x5dffa8 : 0xa8ffd0;
      const m = new THREE.Mesh(new THREE.SphereGeometry(picked ? 0.34 : 0.28, 14, 8), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
      m.position.set(at.x, at.y + lift, at.z);
      m.renderOrder = 10;
      m.userData.tubeMid = k;
      this.handles.add(m);
    }
  }

  // Edit the selected tube's nodes in world space and commit.
  private editTube(fn: (nodes: WorldNode[], p: PathPiece) => void, before = JSON.stringify(this.level)) {
    const p = this.selectedTube();
    if (!p) return;
    const nodes = tubeWorld(p);
    fn(nodes, p);
    setTubeWorld(p, nodes);
    settle(this.level, p);
    fitMids(p);
    this.commit(before);
  }

  // The picked node's end of the selected rails, if it is one.
  private railsEnd(): "a" | "b" | null {
    const p = this.selectedTube();
    if (!p || p.type !== "rails") return null;
    return this.node === 0 ? "a" : this.node === p.path.length ? "b" : null;
  }

  // Turns the picked rails end by `deg` from its current heading, onto the nearest 15 degrees.
  private turnEnd(deg: number) {
    const p = this.selectedTube(), end = this.railsEnd();
    if (!p || p.type !== "rails" || !end) return;
    const before = JSON.stringify(this.level);
    const yaw = Math.round((railsEndYaw(p, end, this.level) + deg) / 15) * 15;
    p[end === "a" ? "aYaw" : "bYaw"] = ((yaw + 540) % 360) - 180;
    this.commit(before);
  }

  // Path editor: one row per node (relative to the entrance, before rot), the turn at each
  // interior node with its sharp / smooth switch and bend radius, and node operations.
  private tubePanel(p: PathPiece): HTMLElement {
    const turns = tubeTurns(p);
    const wrap = h("div", { class: "tube-path" }, h("h3", {}, "path"));
    const smoothPath = !!p.smooth;
    wrap.append(h("div", { class: "checks" }, h("label", {}, "shape",
      h("button", { title: "Smooth curve: one curve through every node, never a corner (drag the small dots to add nodes). Corners & arcs: straight runs, rounded or sharp corners and arc segments", onclick: () => {
        const before = JSON.stringify(this.level);
        if (smoothPath) delete p.smooth; else { p.smooth = true; for (const n of p.path) delete n.mid; }
        this.mid = -1;
        this.commit(before);
      } }, smoothPath ? "smooth curve" : "corners & arcs"))));
    const num = (n: Record<string, number>, key: string, step: number) => {
      const input = h("input", { type: "number", step, value: n[key] ?? 0, onchange: () => { const before = JSON.stringify(this.level); n[key] = Number(input.value); fitMids(p); this.commit(before); } });
      return h("label", {}, label(key), input);
    };
    // The curve of the segment arriving at node k: its point's x y z, each held between the
    // segment's two nodes on that axis (shown beside it), and the curve kept inside that box.
    const curveRow = (k: number) => {
      const n = p.path[k - 1]!, { lo, hi } = midBounds(p, k - 1);
      const cur = n.mid ?? { x: r3((lo[0] + hi[0]) / 2), y: r3((lo[1] + hi[1]) / 2), z: r3((lo[2] + hi[2]) / 2) };
      const field = (axis: "x" | "y" | "z", i: number) => {
        const range = `${r3(lo[i]!)} … ${r3(hi[i]!)}`;
        const input = h("input", { type: "number", step: 0.5, min: lo[i]!, max: hi[i]!, value: cur[axis], disabled: hi[i]! - lo[i]! < 1e-6,
          title: `${axis} must be between ${range} (the two nodes' ${axis})`,
          onchange: () => {
            const before = JSON.stringify(this.level), want = { ...cur, [axis]: Number(input.value) };
            n.mid = fitMid(p, k - 1, want);
            if ((["x", "y", "z"] as const).some((a) => Math.abs(n.mid![a] - want[a]) > 1e-3)) this.flash(`Curve kept inside its segment: x ${n.mid.x}, y ${n.mid.y}, z ${n.mid.z}`);
            this.commit(before);
          } }) as HTMLInputElement;
        return h("label", {}, axis, input, h("span", { class: "range" }, range));
      };
      const row = h("div", { class: `node curve${k === this.mid ? " picked" : ""}`, onclick: (e: Event) => { if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) { this.mid = k; this.node = -1; this.refresh(); } } },
        h("span", { class: "tag", title: `Curve of the segment into node ${k === p.path.length ? "end" : k}` }, "curve"), field("x", 0), field("y", 1), field("z", 2));
      if (n.mid) row.append(h("button", { class: "ghost", title: "Make this segment straight again", onclick: () => { const before = JSON.stringify(this.level); delete n.mid; this.commit(before); } }, "straighten"));
      return row;
    };
    const rows = [{ x: 0, y: 0, z: 0, bend: 0 }, ...p.path].map((n, k) => {
      const last = k === p.path.length, end = k === 0 || last;
      const row = h("div", { class: `node${k === this.node ? " picked" : ""}`, onclick: (e: Event) => { if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) { this.node = k; this.mid = -1; this.refresh(); } } },
        h("span", { class: "tag" }, k === 0 || last ? "end" : `${k}`));
      if (k === 0) row.append(h("span", { class: "hint" }, `${p.type === "tube" ? "mouth" : "start"} at x y z`));
      else row.append(num(n as unknown as Record<string, number>, "x", SNAP.platform), num(n as unknown as Record<string, number>, "y", HEIGHT_STEP), num(n as unknown as Record<string, number>, "z", SNAP.platform));
      if (!end && !smoothPath) {
        const smooth = n.bend > 0;
        row.append(
          h("span", { class: "hint" }, `${turns[k]!.toFixed(0)}°`),
          h("button", { class: smooth ? "" : "ghost", title: "Sharp elbow or smooth bend (B)", onclick: () => { const before = JSON.stringify(this.level); n.bend = smooth ? 0 : TUBE_BEND; this.commit(before); } }, smooth ? "smooth" : "sharp"),
        );
        if (smooth) row.append(num(n as unknown as Record<string, number>, "bend", 0.5));
      }
      if (end && p.type === "rails") {
        const which = k === 0 ? "a" : "b", key = k === 0 ? "aYaw" : "bYaw";
        const input = h("input", { type: "number", step: 15, value: railsEndYaw(p, which, this.level), onchange: () => { const before = JSON.stringify(this.level); p[key] = Number(input.value); this.commit(before); } }) as HTMLInputElement;
        row.append(h("label", { title: "Heading of the rails out of this end, in degrees (R / Shift+R turn it 15)" }, "turn", input));
        if (p[key] !== undefined) row.append(h("button", { class: "ghost", title: "Back to the worked-out heading", onclick: () => { const before = JSON.stringify(this.level); delete p[key]; this.commit(before); } }, "auto"));
      }
      return k > 0 && !smoothPath ? [curveRow(k), row] : [row];
    }).flat();
    wrap.append(...rows, h("div", { class: "row", style: "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap" },
      h("button", { class: "ghost", title: "Insert a node halfway along the segment after the picked node", onclick: () => this.splitNode() }, "Split"),
      h("button", { class: "ghost", title: "Remove the picked node (Delete)", onclick: () => this.removeNode() }, "Remove node"),
      h("button", { class: "ghost", title: "Carry on 4 past the last node", onclick: () => this.extendTube() }, "Extend"),
      h("button", { class: "ghost", title: "Number the nodes from the other end", onclick: () => this.editTube((ns, q) => {
        // Each curve point belongs to the segment arriving at its node, so it moves one node along.
        const mids = ns.map((n) => n.mid);
        ns.reverse();
        ns.forEach((n, k) => { const m = mids[ns.length - k]; if (m) n.mid = m; else delete n.mid; });
        ns[0]!.bend = 0;
        if (q.type === "rails") {
          [q.a, q.b] = [q.b, q.a];
          const [ya, yb] = [q.aYaw, q.bYaw];
          delete q.aYaw; delete q.bYaw;
          if (yb !== undefined) q.aYaw = yb;
          if (ya !== undefined) q.bYaw = ya;
        }
      }) }, "Reverse"),
    ), h("div", { class: "hint" }, smoothPath
      ? "Drag a node to shape the curve; E / Q raise or lower it, arrows nudge it, Delete removes it, R / Shift+R turn a rails end. Drag a small dot between two nodes to pull out a new node there."
      : "Drag a node; E / Q raise or lower it, arrows nudge it, B toggles sharp / smooth, R / Shift+R turn a rails end. Drag the small dot halfway along a segment to curve it (E / Q tilt the curve up or down, Delete straightens it)."));
    return wrap;
  }

  // A slab's movement: a toggle that makes it a moving platform or a fixed one again, and while it
  // moves its schedule: speed, wait and offset, ping-pong or loop, and one row per stop (offset from
  // the start, before rot, and the seconds it waits there), with stops added past the last one or removed.
  private moverPanel(p: Piece & { type: "slab" }): HTMLElement {
    const wrap = h("div", { class: "tube-path" }, h("h3", {}, "movement"));
    const change = (fn: () => void) => { const before = JSON.stringify(this.level); fn(); this.commit(before); };
    const m = p.move;
    wrap.append(h("button", { class: m ? "ghost" : "", title: "A moving platform carries everything standing on it", onclick: () => change(() => { if (m) delete p.move; else p.move = newMove(); }) },
      m ? "Stop moving" : "Make it move"));
    if (!m) return wrap;
    const loop = h("select", { onchange: () => change(() => { m.loop = loop.value === "loop" ? "loop" : "pingpong"; }) },
      h("option", { value: "pingpong", selected: m.loop === "pingpong" }, "ping-pong: out and back"),
      h("option", { value: "loop", selected: m.loop === "loop" }, "loop: last stop back to start"),
    ) as HTMLSelectElement;
    const num = (o: Record<string, number>, key: string, step: number) => {
      const input = h("input", { type: "number", step, value: o[key] ?? 0, onchange: () => change(() => { o[key] = Number(input.value); }) });
      return h("label", {}, label(key), input);
    };
    const mo = m as unknown as Record<string, number>;
    wrap.append(h("div", { class: "node" }, num(mo, "speed", 0.5), num(mo, "wait", 0.5), num(mo, "offset", 0.5)), h("label", {}, "route", loop));
    wrap.append(h("div", { class: "node" }, h("span", { class: "tag" }, "start"), h("span", { class: "hint" }, `waits ${m.wait}s (the wait field above)`)));
    m.stops.forEach((st, k) => {
      const o = st as unknown as Record<string, number>;
      wrap.append(h("div", { class: "node" }, h("span", { class: "tag" }, `${k + 1}`),
        num(o, "x", SNAP.platform), num(o, "y", HEIGHT_STEP), num(o, "z", SNAP.platform), num(o, "wait", 0.5),
        h("button", { class: "ghost", title: "Remove this stop", onclick: () => change(() => { m.stops.splice(k, 1); }) }, "remove")));
    });
    wrap.append(h("div", { class: "row", style: "display:flex;gap:6px;margin-top:6px;flex-wrap:wrap" },
      h("button", { class: "ghost", title: "Add a stop 8 further along the way the last leg went", onclick: () => change(() => {
        const last = m.stops[m.stops.length - 1] ?? { x: 0, y: 0, z: 0, wait: m.wait };
        const prev = m.stops[m.stops.length - 2] ?? { x: 0, y: 0, z: 0 };
        const dx = last.x - prev.x, dy = last.y - prev.y, dz = last.z - prev.z, l = Math.hypot(dx, dy, dz);
        m.stops.push(l > 1e-6 ? { x: last.x + (dx / l) * 8, y: last.y + (dy / l) * 8, z: last.z + (dz / l) * 8, wait: 0 } : { x: 0, y: 0, z: -8, wait: 0 });
      }) }, "Add stop"),
    ), h("div", { class: "hint" }, "Stops are offsets from the platform's start (before rotate). It eases in and out of every stop at up to its speed; the start offset starts it that many seconds into its schedule. Everything standing on it where the level places it rides with it."));
    return wrap;
  }

  private splitNode() {
    const p = this.selectedTube();
    if (!p) return;
    const k = Math.max(0, Math.min(this.node < 0 ? 0 : this.node, p.path.length - 1));
    this.editTube((ns) => {
      const a = ns[k]!, b = ns[k + 1]!;
      // A curved segment splits at its curve point, into two straight halves.
      const at = b.mid ? { x: b.mid.x, y: b.mid.y, z: b.mid.z } : { x: snap((a.x + b.x) / 2), y: layerSnap((a.y + b.y) / 2), z: snap((a.z + b.z) / 2) };
      delete b.mid;
      ns.splice(k + 1, 0, { ...at, bend: p.type === "fence" ? FENCE_RAIL_CORNER : TUBE_BEND });
    });
    this.node = k + 1;
    this.mid = -1;
    this.refresh();
  }

  private removeNode() {
    const p = this.selectedTube();
    if (!p || this.node < 0 || p.path.length < 2) return;
    const k = this.node;
    this.editTube((ns) => { ns.splice(k, 1); if (ns[k]) delete ns[k]!.mid; ns[0]!.bend = 0; delete ns[0]!.mid; });
    this.node = -1;
    this.mid = -1;
    this.refresh();
  }

  private extendTube() {
    const p = this.selectedTube();
    if (!p) return;
    this.editTube((ns) => {
      const a = ns[ns.length - 2]!, b = ns[ns.length - 1]!;
      const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
      b.bend = TUBE_BEND;
      ns.push({ x: snap(b.x + ((b.x - a.x) / l) * 4), y: layerSnap(b.y + ((b.y - a.y) / l) * 4), z: snap(b.z + ((b.z - a.z) / l) * 4), bend: 0 });
    });
    this.node = p.path.length;
    this.mid = -1;
    this.refresh();
  }

  // Move the picked node; moving the first mouth leaves the other nodes where they are.
  private moveNode(fn: (n: WorldNode) => void, before?: string) {
    const k = this.node;
    if (k < 0) return;
    this.editTube((ns) => fn(ns[k]!), before);
  }

  // Move the picked segment's curve point, curving the segment if it was straight.
  private moveMid(fn: (m: P3) => void, before?: string) {
    const k = this.mid;
    if (k < 1) return;
    this.editTube((ns) => { const m = { ...midOf(ns, k) }; fn(m); ns[k]!.mid = m; }, before);
  }

  private straightenMid() {
    const k = this.mid;
    if (k < 1) return;
    this.editTube((ns) => { delete ns[k]!.mid; });
  }

  // A labelled dropdown of snap increments; changing it redraws the grid and the panel.
  private snapPicker(kind: keyof typeof SNAP, label: string): HTMLElement {
    const sel = h("select", { title: `${label}: drag, arrow-key and paste increment` }, ...SNAP_STEPS.map((v) => h("option", { value: v, selected: v === SNAP[kind] }, String(v)))) as HTMLSelectElement;
    sel.onchange = () => {
      SNAP[kind] = Number(sel.value);
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(SNAP)); } catch { /* not remembered */ }
      this.refresh();
    };
    return h("label", {}, label, sel);
  }

  // The white grid's height, in whole layers.
  private gridLevel(): HTMLElement {
    const input = h("input", { type: "number", step: HEIGHT_STEP, value: gridY, title: "Height of the white grid; new pieces are placed on it",
      oninput: () => {
        gridY = layerSnap(Number(input.value) || 0);
        this.ground.position.y = gridY;
        try { localStorage.setItem(GRID_Y_KEY, String(gridY)); } catch { /* not remembered */ }
      } }) as HTMLInputElement;
    return h("label", { class: "grid-y" }, "Grid y", input);
  }

  private fineToggle(): HTMLElement {
    const cb = h("input", { type: "checkbox", checked: fineSizes, title: "Let platform sizes and heights leave the grid of 4",
      onchange: () => {
        fineSizes = cb.checked;
        try { localStorage.setItem(FINE_KEY, fineSizes ? "1" : "0"); } catch { /* not remembered */ }
        this.refresh();
      } }) as HTMLInputElement;
    return h("label", {}, cb, "Fine sizes");
  }

  private selectedPieces(): Piece[] {
    return [...this.sel].map((i) => this.level.pieces[i]).filter((p): p is Piece => !!p);
  }

  private select(i: number, add = false) {
    this.node = -1;
    this.mid = -1;
    if (!add) this.sel.clear();
    if (i >= 0) { if (add && this.sel.has(i)) this.sel.delete(i); else this.sel.add(i); }
    this.refresh();
  }

  private add(make: (x: number, y: number, z: number) => Piece) {
    const before = JSON.stringify(this.level);
    const t = this.controls.target;
    const sel = this.sel.size === 1 ? this.level.pieces[[...this.sel][0]!] : undefined;
    const base = sel ?? { x: snap(t.x), y: gridY, z: snap(t.z) };
    const piece = make(base.x + (sel ? 2 : 0), base.y, base.z);
    this.placeFree(piece);
    settle(this.level, piece);
    this.level.pieces.push(piece);
    this.sel = new Set([this.level.pieces.length - 1]);
    this.commit(before);
  }

  // Appends clones of `pieces` shifted by (dx, dz), settles structures, and selects the clones.
  private insert(pieces: Piece[], dx: number, dz: number, before: string) {
    const added = new Set<number>();
    for (const p of pieces) {
      const c = JSON.parse(JSON.stringify(p)) as Piece;
      c.x = snapFor(c)(c.x + dx); c.z = snapFor(c)(c.z + dz);
      if (pieces.length === 1) this.placeFree(c);
      settle(this.level, c);
      this.level.pieces.push(c);
      added.add(this.level.pieces.length - 1);
    }
    this.sel = added;
    this.commit(before);
  }

  private duplicate() {
    const pieces = this.selectedPieces();
    if (!pieces.length) return;
    this.insert(pieces, 2, 0, JSON.stringify(this.level));
  }

  private copy() {
    this.clipboard = this.selectedPieces().map((p) => JSON.parse(JSON.stringify(p)) as Piece);
    if (this.clipboard.length) this.flash(`Copied ${this.clipboard.length} piece${this.clipboard.length > 1 ? "s" : ""}`);
  }

  // Paste lands the group's centre under the cursor (on the group's base height), else 2 units over.
  private paste() {
    if (!this.clipboard.length) return;
    const cx = this.clipboard.reduce((a, p) => a + p.x, 0) / this.clipboard.length;
    const cz = this.clipboard.reduce((a, p) => a + p.z, 0) / this.clipboard.length;
    const unit = this.clipboard.some(isStructure) ? gridSnap : snap;
    let dx = 2, dz = 0;
    if (this.cursor) {
      const y = Math.min(...this.clipboard.map((p) => p.y));
      const pt = this.groundPoint(this.cursor.x, this.cursor.y, y);
      if (pt) { dx = unit(pt.x - cx); dz = unit(pt.z - cz); }
    }
    this.insert(this.clipboard, dx, dz, JSON.stringify(this.level));
  }

  private remove() {
    if (!this.sel.size) return;
    const before = JSON.stringify(this.level);
    for (const i of [...this.sel].sort((a, b) => b - a)) this.level.pieces.splice(i, 1);
    this.sel.clear();
    this.pushUndo(before);
    this.refresh();
  }

  private pushUndo(before: string) {
    this.undoStack.push(before);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  private undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    this.redoStack.push(JSON.stringify(this.level));
    this.level = JSON.parse(s) as Level;
    this.refresh();
  }

  private redo() {
    const s = this.redoStack.pop();
    if (!s) return;
    this.undoStack.push(JSON.stringify(this.level));
    this.level = JSON.parse(s) as Level;
    this.refresh();
  }

  private key(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === "KeyS") {
      e.preventDefault();
      // Blurring fires the focused field's change handler, so a just-typed value is saved too.
      if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
      void this.save();
      return;
    }
    if (e.target instanceof HTMLInputElement) return;
    if (!mod && ["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) { this.held.add(e.code); return; }
    if (e.code === "Escape") { if (this.dropping) { this.armDrop(false); return; } if (this.node >= 0 || this.mid >= 0) { this.node = -1; this.mid = -1; this.refresh(); return; } this.sel.clear(); this.refresh(); return; }
    if (!mod && e.code === "KeyP") { this.armDrop(!this.dropping); return; }
    if (!mod && e.code === "KeyH") { this.toggleHitboxes(); return; }
    if (mod && e.code === "KeyZ") { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && e.code === "KeyY") { e.preventDefault(); this.redo(); return; }
    if (mod && e.code === "KeyD") { e.preventDefault(); this.duplicate(); return; }
    if (mod && e.code === "KeyC") { e.preventDefault(); this.copy(); return; }
    if (mod && e.code === "KeyV") { e.preventDefault(); this.paste(); return; }
    if (mod && e.code === "KeyA") { e.preventDefault(); this.sel = new Set(this.level.pieces.map((_, i) => i)); this.refresh(); return; }
    // E/Q (PgUp/PgDn) step a whole layer; with Shift, half a layer.
    const rise = e.shiftKey ? HEIGHT_STEP : LAYER_H;
    if (this.node >= 0 && this.selectedTube() && !mod) {
      const g = SNAP.platform * (e.shiftKey ? 4 : 1);
      const ops: Record<string, () => void> = {
        ArrowLeft: () => this.moveNode((n) => { n.x = snap(n.x - g); }),
        ArrowRight: () => this.moveNode((n) => { n.x = snap(n.x + g); }),
        ArrowUp: () => this.moveNode((n) => { n.z = snap(n.z - g); }),
        ArrowDown: () => this.moveNode((n) => { n.z = snap(n.z + g); }),
        PageUp: () => this.moveNode((n) => { n.y += rise; }), KeyE: () => this.moveNode((n) => { n.y += rise; }),
        PageDown: () => this.moveNode((n) => { n.y -= rise; }), KeyQ: () => this.moveNode((n) => { n.y -= rise; }),
        KeyB: () => this.moveNode((n) => { n.bend = n.bend > 0 ? 0 : TUBE_BEND; }),
        Delete: () => this.removeNode(), Backspace: () => this.removeNode(),
      };
      if (this.railsEnd()) ops.KeyR = () => this.turnEnd(e.shiftKey ? -15 : 15);
      const op = ops[e.code];
      if (op) { e.preventDefault(); op(); return; }
    }
    if (this.mid >= 1 && this.selectedTube() && !mod) {
      const g = midSnap(1) * (e.shiftKey ? 4 : 1);
      const ops: Record<string, () => void> = {
        ArrowLeft: () => this.moveMid((m) => { m.x = midSnap(m.x - g); }),
        ArrowRight: () => this.moveMid((m) => { m.x = midSnap(m.x + g); }),
        ArrowUp: () => this.moveMid((m) => { m.z = midSnap(m.z - g); }),
        ArrowDown: () => this.moveMid((m) => { m.z = midSnap(m.z + g); }),
        PageUp: () => this.moveMid((m) => { m.y = r3(m.y + 0.5); }), KeyE: () => this.moveMid((m) => { m.y = r3(m.y + 0.5); }),
        PageDown: () => this.moveMid((m) => { m.y = r3(m.y - 0.5); }), KeyQ: () => this.moveMid((m) => { m.y = r3(m.y - 0.5); }),
        Delete: () => this.straightenMid(), Backspace: () => this.straightenMid(),
      };
      const op = ops[e.code];
      if (op) { e.preventDefault(); op(); return; }
    }
    const pieces = this.selectedPieces();
    if (!pieces.length) return;
    const before = JSON.stringify(this.level);
    const n = e.shiftKey ? 4 : 1;
    const nudge = (dx: number, dz: number) => {
      for (const p of pieces) {
        const g = isStructure(p) ? SNAP.structure : SNAP.platform;
        p.x = step(p.x, dx, g, n); p.z = step(p.z, dz, g, n);
        settle(this.level, p);
      }
    };
    switch (e.code) {
      case "Delete": case "Backspace": this.remove(); return;
      case "ArrowLeft": nudge(-1, 0); break;
      case "ArrowRight": nudge(1, 0); break;
      case "ArrowUp": nudge(0, -1); break;
      case "ArrowDown": nudge(0, 1); break;
      case "PageUp": case "KeyE": for (const p of pieces) p.y += rise; break;
      case "PageDown": case "KeyQ": for (const p of pieces) p.y -= rise; break;
      case "KeyR": for (const p of pieces) if ("rot" in p || ROLLED_PROPS.includes(p.type)) { const q = p as { rot?: number }; q.rot = ((q.rot ?? 0) + (e.shiftKey ? -90 : 90) + 360) % 360; } break;
      case "KeyT": for (const p of pieces) if (p.type === "slab") p.tilt = (p.tilt + (e.shiftKey ? -90 : 90) + 360) % 360; break;
      case "KeyY": for (const p of pieces) if (p.type === "slab") p.roll = ((p.roll ?? 0) + (e.shiftKey ? -90 : 90) + 360) % 360; else if ((p.type === "kicker" && !isSliding(p)) || p.type === "jump") p.roll = ((p.roll ?? 0) + (e.shiftKey ? -15 : 15) + 360) % 360; else if (ROLLED_PROPS.includes(p.type)) { const q = p as { roll?: number }; q.roll = ((q.roll ?? 0) + (e.shiftKey ? -15 : 15) + 360) % 360; } break;
      default: return;
    }
    e.preventDefault();
    this.commit(before);
  }

  private castFrom(clientX: number, clientY: number) {
    const r = this.ctx.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
  }

  private groundPoint(clientX: number, clientY: number, y: number): THREE.Vector3 | null {
    this.castFrom(clientX, clientY);
    const pt = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), pt) ? pt : null;
  }

  private pick(e: PointerEvent): number {
    this.castFrom(e.clientX, e.clientY);
    const hit = this.ray.intersectObjects(this.built.group.children, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.pieceIndex === undefined) o = o.parent;
    return o ? (o.userData.pieceIndex as number) : -1;
  }

  // Screen position of a piece's origin, or null when it is behind the camera.
  private toScreen(p: Piece): { x: number; y: number } | null {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    if (v.z > 1) return null;
    const r = this.ctx.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  private down = (e: PointerEvent) => {
    this.cursor = { x: e.clientX, y: e.clientY };
    if (this.dropping) {
      if (e.button === 0) {
        this.aimDrop(e.clientX, e.clientY);
        if (this.dropAt) this.play(this.dropAt);
      }
      if (e.button === 0 || e.button === 2) return;
    }
    if (e.button === 2) { this.rightDown = { x: e.clientX, y: e.clientY, index: this.pick(e) }; return; }
    if (e.button !== 0) return;
    if (this.handles.children.length) {
      this.castFrom(e.clientX, e.clientY);
      const hit = this.ray.intersectObjects(this.handles.children, false)[0];
      const tp = this.selectedTube();
      if (hit && tp?.smooth && hit.object.userData.tubeMid !== undefined) {
        // Smooth path: pull a new node out of the segment and drag it, all one undo.
        const before = JSON.stringify(this.level);
        this.node = (hit.object.userData.tubeMid as number) - 1;
        this.splitNode();
        const n = tubeNodeWorld(tp, this.node), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(n.y + pathLift(tp))), pt = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(plane, pt)) {
          this.nodeDrag = { plane, off: new THREE.Vector3(n.x - pt.x, 0, n.z - pt.z), before };
          this.controls.enabled = false;
          this.ctx.canvas.setPointerCapture(e.pointerId);
        }
        return;
      }
      if (hit) {
        const isMid = hit.object.userData.tubeMid !== undefined;
        this.node = isMid ? -1 : hit.object.userData.tubeNode as number;
        this.mid = isMid ? hit.object.userData.tubeMid as number : -1;
        const at = hit.object.position;
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -at.y);
        const pt = new THREE.Vector3();
        if (this.ray.ray.intersectPlane(plane, pt)) {
          this.nodeDrag = { plane, off: new THREE.Vector3(at.x - pt.x, 0, at.z - pt.z), before: JSON.stringify(this.level) };
          this.controls.enabled = false;
          this.ctx.canvas.setPointerCapture(e.pointerId);
        }
        this.refresh();
        return;
      }
    }
    const i = this.pick(e);
    if (i < 0) {
      // Box selection from empty space.
      const el = h("div", { class: "marquee" });
      this.ctx.overlay.append(el);
      this.marquee = { x0: e.clientX, y0: e.clientY, el, add: e.shiftKey };
      this.ctx.canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.shiftKey) { this.select(i, true); return; }
    if (!this.sel.has(i)) this.select(i);
    const p = this.level.pieces[i]!;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -p.y);
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, pt)) return;
    const starts = new Map<number, { x: number; z: number }>();
    for (const k of this.sel) { const q = this.level.pieces[k]; if (q) starts.set(k, { x: q.x, z: q.z }); }
    this.drag = { plane, off: new THREE.Vector3(p.x - pt.x, 0, p.z - pt.z), anchor: i, starts, moved: false, before: JSON.stringify(this.level) };
    this.controls.enabled = false;
    this.ctx.canvas.setPointerCapture(e.pointerId);
  };

  private move = (e: PointerEvent) => {
    this.cursor = { x: e.clientX, y: e.clientY };
    if (this.dropping) { this.aimDrop(e.clientX, e.clientY); return; }
    if (this.marquee) {
      const m = this.marquee;
      const x = Math.min(m.x0, e.clientX), y = Math.min(m.y0, e.clientY);
      m.el.style.cssText = `left:${x}px;top:${y}px;width:${Math.abs(e.clientX - m.x0)}px;height:${Math.abs(e.clientY - m.y0)}px`;
      return;
    }
    if (this.nodeDrag) {
      const nd = this.nodeDrag;
      this.castFrom(e.clientX, e.clientY);
      const pt = new THREE.Vector3();
      const p = this.selectedTube();
      if (!p || !this.ray.ray.intersectPlane(nd.plane, pt)) return;
      const s = this.mid >= 1 ? midSnap : snap;
      const x = s(pt.x + nd.off.x), z = s(pt.z + nd.off.z), cur = this.mid >= 1 ? midOf(tubeWorld(p), this.mid) : tubeNodeWorld(p, this.node);
      if (Math.abs(cur.x - x) < 1e-6 && Math.abs(cur.z - z) < 1e-6) return;
      // Each step re-commits from the drag's start, so one undo takes back the whole drag.
      const before = this.undoStack.length && this.undoStack[this.undoStack.length - 1] === nd.before ? this.undoStack.pop()! : nd.before;
      if (this.mid >= 1) this.moveMid((m) => { m.x = x; m.z = z; }, before);
      else this.moveNode((n) => { n.x = x; n.z = z; }, before);
      return;
    }
    if (!this.drag) return;
    const d = this.drag;
    const a = this.level.pieces[d.anchor];
    const a0 = d.starts.get(d.anchor);
    if (!a || !a0) return;
    this.castFrom(e.clientX, e.clientY);
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(d.plane, pt)) return;
    // The group moves by the anchor's snapped displacement, and each piece lands on its own grid.
    const unit = this.selectedPieces().some(isStructure) ? gridSnap : snap;
    const dx = unit(pt.x + d.off.x) - a0.x, dz = unit(pt.z + d.off.z) - a0.z;
    if (a.x === a0.x + dx && a.z === a0.z + dz) return;
    for (const [k, s0] of d.starts) {
      const q = this.level.pieces[k];
      if (!q) continue;
      q.x = snapFor(q)(s0.x + dx); q.z = snapFor(q)(s0.z + dz);
      settle(this.level, q);
      const g = this.built.pieceGroups[k];
      if (g) { g.position.set(q.x, (q.type === "crate" || q.type === "barrel") ? q.y + propLift(q) + 0.02 : q.y, q.z); g.rotation.y = (pieceRot(q) * Math.PI) / 180; }
    }
    for (const hl of this.helpers) hl.update();
    d.moved = true;
    markOverlapping(this.built, new Set(platformOverlaps(this.level).flat()));
  };

  private up = (e: PointerEvent) => {
    if (e.button === 2 && this.rightDown) {
      const rd = this.rightDown;
      this.rightDown = null;
      if (Math.hypot(e.clientX - rd.x, e.clientY - rd.y) < 4 && rd.index >= 0) { this.sel = new Set([rd.index]); this.remove(); }
      return;
    }
    if (this.marquee) {
      const m = this.marquee;
      this.marquee = null;
      m.el.remove();
      const x0 = Math.min(m.x0, e.clientX), x1 = Math.max(m.x0, e.clientX), y0 = Math.min(m.y0, e.clientY), y1 = Math.max(m.y0, e.clientY);
      if (!m.add) this.sel.clear();
      if (x1 - x0 > 3 || y1 - y0 > 3) {
        this.level.pieces.forEach((p, i) => {
          const sp = this.toScreen(p);
          if (sp && sp.x >= x0 && sp.x <= x1 && sp.y >= y0 && sp.y <= y1) this.sel.add(i);
        });
      }
      this.refresh();
      return;
    }
    if (this.nodeDrag) { this.nodeDrag = null; this.controls.enabled = true; return; }
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.controls.enabled = true;
    if (d.moved) this.commit(d.before); else this.renderPanel();
  };

  private play(at?: THREE.Vector3) {
    const probs = levelProblems(this.level);
    if (probs.length) { alert(probs.join("\n")); return; }
    if (!at) { this.opts.onPlay(cloneLevel(this.level)); return; }
    // Face the way the editor camera looks, so the run starts heading where you were looking.
    const d = this.camera.getWorldDirection(new THREE.Vector3());
    this.opts.onPlay(cloneLevel(this.level), { x: at.x, y: at.y, z: at.z, yaw: Math.atan2(-d.x, -d.z) });
  }

  private armDrop(on: boolean) {
    this.dropping = on;
    this.hereBtn.classList.toggle("ghost", !on);
    this.ctx.canvas.style.cursor = on ? "crosshair" : "";
    if (on && this.cursor) this.aimDrop(this.cursor.x, this.cursor.y);
    else { this.dropAt = null; this.ghost.visible = false; }
  }

  // The first upward-facing solid surface under the cursor (the goal beam and other glow is see-through).
  private aimDrop(clientX: number, clientY: number) {
    this.castFrom(clientX, clientY);
    this.dropAt = null;
    const n = new THREE.Vector3();
    for (const hit of this.ray.intersectObjects(this.built.group.children, true)) {
      const m = (hit.object as THREE.Mesh).material;
      if (m instanceof THREE.ShaderMaterial || (m instanceof THREE.MeshBasicMaterial && m.wireframe)) continue;
      if (!hit.face) continue;
      n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (n.y < 0.5) break; // a wall or underside is in the way
      this.dropAt = hit.point.clone();
      break;
    }
    this.ghost.visible = !!this.dropAt;
    if (this.dropAt) this.ghost.position.set(this.dropAt.x, this.dropAt.y + BALL_RADIUS, this.dropAt.z);
  }

  private flash(msg: string, error = false) {
    this.notice.textContent = msg;
    this.notice.classList.toggle("error", error);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.notice.textContent = ""; }, 2500);
  }

  // Writes src/levels/<id>.json through the dev server, replacing that level outright.
  private async save() {
    // Level files are only written by `npm run dev`; a deployed build never sends a save.
    if (!import.meta.env.DEV) { this.flash("Saving levels only works in local dev (npm run dev). Nothing is kept until it is saved.", true); return; }
    const probs = levelProblems(this.level);
    if (probs.length) { alert(`Fix these before saving:\n${probs.join("\n")}`); return; }
    if (!this.level.id) { alert("Give the level an id first."); return; }
    try {
      const res = await fetch("/__level/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(this.level) });
      if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
      const { file } = (await res.json()) as { file: string };
      this.flash(`Saved ${file}`);
      // Its menu picture too, from the level as the menu will load it.
      await saveThumb(this.ctx.renderer, validateLevel(cloneLevel(this.level))).catch((err: unknown) => this.flash(`Saved ${file}, but not its thumbnail: ${err instanceof Error ? err.message : String(err)}`, true));
    } catch (err) {
      this.flash(`Save failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }

  private toggleHitboxes(on = !this.hitboxes) {
    this.hitboxes = on;
    try { localStorage.setItem(HITBOX_KEY, on ? "1" : "0"); } catch { /* per session only */ }
    this.hitboxBtn.className = on ? "" : "ghost";
    this.hitboxJson = "";
    this.drawHitboxes();
  }

  // Build the level's physics as play would and draw its colliders, unless nothing has changed.
  private drawHitboxes() {
    clearTimeout(this.hitboxTimer);
    if (!this.hitboxes) {
      this.hitboxGen++;
      this.hitboxLines?.removeFromParent();
      this.hitboxLines?.geometry.dispose();
      this.hitboxLines = null;
      return;
    }
    const json = JSON.stringify(this.level);
    if (json === this.hitboxJson && this.hitboxLines) return;
    const gen = ++this.hitboxGen;
    this.hitboxTimer = window.setTimeout(async () => {
      let sim: Awaited<ReturnType<typeof createSim>> | null = null;
      try {
        sim = await createSim(cloneLevel(this.level));
        if (gen !== this.hitboxGen) return;
        const { vertices } = sim.world.debugRender();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
        this.hitboxLines?.removeFromParent();
        this.hitboxLines?.geometry.dispose();
        this.hitboxLines = new THREE.LineSegments(geo, HITBOX_MAT);
        this.hitboxLines.renderOrder = 8;
        this.scene.add(this.hitboxLines);
        this.hitboxJson = json;
      } catch { /* a level the physics cannot build draws no hitboxes */ } finally { sim?.free(); }
    }, 150);
  }

  dispose() {
    clearTimeout(this.hitboxTimer);
    this.hitboxGen++;
    this.ctx.canvas.style.cursor = "";
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.ctx.canvas.removeEventListener("pointerdown", this.down);
    this.ctx.canvas.removeEventListener("pointermove", this.move);
    this.ctx.canvas.removeEventListener("pointerup", this.up);
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    removeEventListener("keyup", this.onKeyUp);
    removeEventListener("blur", this.onBlur);
    clear(this.ctx.overlay);
  }
}
