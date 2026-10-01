import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BALL_RADIUS, LAYER_H, PIECE_TYPES, STRUCT_GRID, cloneLevel, isPlatform, isStructure, levelProblems, newPiece, platformFootprint, platformHeightAt, platformOverlaps, surfaceAt, validateLevel, type Level, type Piece, type PieceType, type XZ } from "./level.ts";
import { buildLevel, createScene, markOverlapping, type Built, type SceneEnv } from "./scene.ts";
import { pieceThumbs } from "./thumbs.ts";
import { clear, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";
import type { PlayFrom } from "./game.ts";

export const DRAFT_KEY = "balling.draft";
export function loadDraft(): Level | null {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? validateLevel(JSON.parse(s)) : null; } catch { return null; }
}

const NUM_FIELDS: Record<PieceType, [key: string, step: number][]> = {
  start: [],
  slab: [["w", 0.5], ["d", 0.5], ["rot", 15], ["tilt", 15]],
  curve: [["inner", 0.5], ["outer", 0.5], ["rot", 15]],
  ramp: [["w", 0.5], ["d", 0.5], ["rot", 15], ["rise", 1]],
  bridge: [["w", 0.5], ["d", 0.5], ["rot", 15]],
  plank: [["w", 0.5], ["h", 0.5], ["rot", 15]],
  support: [["w", 0.5], ["h", 1], ["rot", 15]],
  kicker: [["w", 0.5], ["d", 0.5], ["h", 0.1], ["rot", 15]],
  block: [["w", 0.5], ["h", 0.5], ["d", 0.5], ["rot", 15]],
  blockade: [["rot", 15]],
  barrier: [["rot", 15]],
  crate: [["w", 0.1], ["h", 0.1], ["d", 0.1], ["rot", 15]],
  hole: [["w", 0.5], ["d", 0.5], ["rot", 15]],
  pillar: [],
  spinner: [["length", 0.5], ["speed", 0.1]],
  goal: [["r", 0.5]],
};
// Snap increments for moving platforms and structures, chosen in the toolbar and remembered.
const SNAP_KEY = "balling.snap";
const SNAP_STEPS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const SNAP = { platform: 0.5, structure: STRUCT_GRID };
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
const layerSnap = (v: number) => Math.round(v / LAYER_H) * LAYER_H;

// Structures snap to the placement grid and drop onto whatever platform is under them.
function settle(level: Level, p: Piece) {
  if (!isStructure(p)) return;
  p.x = gridSnap(p.x); p.z = gridSnap(p.z);
  const y = surfaceAt(level, p.x, p.z);
  if (y !== null) p.y = y;
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
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private controls: OrbitControls;
  private built: Built;
  private sel = new Set<number>();
  private helpers: THREE.BoxHelper[] = [];
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
  private undoStack: string[] = [];
  private raf = 0;
  private panel: HTMLElement;
  private body = h("div", { class: "body" });
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
    this.env = createScene();
    this.scene = this.env.scene;
    this.scene.add(new THREE.GridHelper(200, 100, 0x9fb4cc, 0xc7d6e6));
    this.built = buildLevel(level, true);
    this.scene.add(this.built.group);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.controls = new OrbitControls(this.camera, ctx.canvas);
    this.controls.enableDamping = true;
    // Left is ours (select, marquee, drag); middle pans; right-drag orbits and a right click deletes.
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    const s = level.pieces.find((p) => p.type === "start") ?? { x: 0, y: 0, z: 0 };
    this.camera.position.set(s.x + 28, s.y + 36, s.z + 30);
    this.controls.target.set(s.x + 10, s.y, s.z - 20);
    const thumbs = pieceThumbs(ctx.renderer);

    this.panel = h("div", { class: "editor" },
      h("div", { class: "bar" },
        h("button", { class: "ghost", onclick: () => opts.onExit() }, "Menu"),
        h("button", { onclick: () => this.play() }, "▶ Play"),
        this.hereBtn = h("button", { class: "ghost", title: "Play from a spot you click (P)", onclick: () => this.armDrop(!this.dropping) }, "▶ Here") as HTMLButtonElement,
        h("button", { class: "ghost", onclick: () => this.undo() }, "Undo"),
        h("button", { onclick: () => void this.save() }, "Save"),
        h("button", { class: "ghost", onclick: () => this.newLevel() }, "New"),
      ),
      h("div", { class: "bar snap" }, this.snapPicker("platform", "Platform snap"), this.snapPicker("structure", "Structure snap")),
      h("div", { class: "bar add" }, ...PIECE_TYPES.map((t) => h("button", { class: "pick", title: t, onclick: () => this.add(t) }, h("img", { src: thumbs.get(t), alt: t })))),
      this.problems,
      this.notice,
      this.body,
    );
    ctx.overlay.append(this.panel);
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
    for (const q of this.level.pieces) if (isPlatform(q) || q.type === "bridge" || q.type === "plank" || q.type === "support") q.y = layerSnap(q.y);
    if (before !== JSON.stringify(this.level)) this.undoStack.push(before);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.refresh();
  }

  // Slide a new platform along +x until it sits clear of every other platform.
  private placeFree(piece: Piece) {
    const others = { ...this.level, pieces: [...this.level.pieces, piece] };
    for (let tries = 0; tries < 400 && platformOverlaps(others).length; tries++) piece.x += 0.5;
  }

  private refresh() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(this.level));
    this.scene.remove(this.built.group);
    this.built = buildLevel(this.level, true);
    markOverlapping(this.built, new Set(platformOverlaps(this.level).flat()));
    this.scene.add(this.built.group);
    for (const hl of this.helpers) hl.removeFromParent();
    this.helpers = [];
    for (const i of [...this.sel]) if (i >= this.level.pieces.length) this.sel.delete(i);
    for (const i of this.sel) {
      const g = this.built.pieceGroups[i];
      if (g) { const hl = new THREE.BoxHelper(g, 0xffd23f); this.helpers.push(hl); this.scene.add(hl); }
    }
    this.grid?.removeFromParent();
    this.grid?.geometry.dispose();
    this.grid = null;
    if (this.selectedPieces().some(isStructure)) { this.grid = placementGrid(this.level); this.scene.add(this.grid); }
    const probs = levelProblems(this.level);
    this.problems.textContent = probs.join(" · ");
    this.renderPanel();
  }

  private renderPanel() {
    clear(this.body);
    const name = h("input", { type: "text", value: this.level.name, oninput: () => { this.level.name = name.value; localStorage.setItem(DRAFT_KEY, JSON.stringify(this.level)); } });
    const id = h("input", { type: "text", value: this.level.id, oninput: () => { this.level.id = id.value.replace(/[^a-z0-9-]/g, "-"); localStorage.setItem(DRAFT_KEY, JSON.stringify(this.level)); } });
    this.body.append(h("h3", {}, "Level"), h("div", { class: "props" }, h("label", {}, "name", name), h("label", {}, "id", id)));
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
        const input = h("input", { type: "number", step, value: rec[key] ?? 0,
          onchange: () => { const before = JSON.stringify(this.level); rec[key] = Number(input.value); this.commit(before); } });
        return h("label", {}, key, input);
      };
      const step = isStructure(p) ? SNAP.structure : SNAP.platform;
      props.append(field("x", step), field("y", LAYER_H), field("z", step));
      for (const [k, step] of NUM_FIELDS[p.type]) props.append(field(k, step));
      if (p.type === "slab" || p.type === "curve" || p.type === "ramp") {
        const f = p.fences as unknown as Record<string, boolean>;
        const checks = h("div", { class: "checks" }, "fences:");
        for (const k of Object.keys(f)) {
          const cb = h("input", { type: "checkbox", checked: f[k], onchange: () => { const before = JSON.stringify(this.level); f[k] = cb.checked; this.commit(before); } });
          checks.append(h("label", {}, cb, k));
        }
        props.append(checks);
      }
      this.body.append(
        h("h3", {}, `${p.type} #${index}`), props,
        h("div", { class: "row", style: "display:flex;gap:6px;margin-top:6px" },
          h("button", { class: "ghost", onclick: () => this.duplicate() }, "Duplicate"),
          h("button", { class: "ghost", onclick: () => this.remove() }, "Delete"),
        ),
      );
    }
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

  private selectedPieces(): Piece[] {
    return [...this.sel].map((i) => this.level.pieces[i]).filter((p): p is Piece => !!p);
  }

  private select(i: number, add = false) {
    if (!add) this.sel.clear();
    if (i >= 0) { if (add && this.sel.has(i)) this.sel.delete(i); else this.sel.add(i); }
    this.refresh();
  }

  private add(type: PieceType) {
    const before = JSON.stringify(this.level);
    const t = this.controls.target;
    const sel = this.sel.size === 1 ? this.level.pieces[[...this.sel][0]!] : undefined;
    const base = sel ?? { x: snap(t.x), y: snap(t.y), z: snap(t.z) };
    const piece = newPiece(type, base.x + (sel ? 2 : 0), base.y, base.z);
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
    this.undoStack.push(before);
    this.refresh();
  }

  private undo() {
    const s = this.undoStack.pop();
    if (!s) return;
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
    if (e.code === "Escape") { if (this.dropping) { this.armDrop(false); return; } this.sel.clear(); this.refresh(); return; }
    if (!mod && e.code === "KeyP") { this.armDrop(!this.dropping); return; }
    if (mod && e.code === "KeyZ") { e.preventDefault(); this.undo(); return; }
    if (mod && e.code === "KeyD") { e.preventDefault(); this.duplicate(); return; }
    if (mod && e.code === "KeyC") { e.preventDefault(); this.copy(); return; }
    if (mod && e.code === "KeyV") { e.preventDefault(); this.paste(); return; }
    if (mod && e.code === "KeyA") { e.preventDefault(); this.sel = new Set(this.level.pieces.map((_, i) => i)); this.refresh(); return; }
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
      case "PageUp": case "KeyE": for (const p of pieces) p.y += LAYER_H; break;
      case "PageDown": case "KeyQ": for (const p of pieces) p.y -= LAYER_H; break;
      case "KeyR": for (const p of pieces) if ("rot" in p) p.rot = (p.rot + (e.shiftKey ? -90 : 90) + 360) % 360; break;
      case "KeyT": for (const p of pieces) if (p.type === "slab") p.tilt = (p.tilt + (e.shiftKey ? -90 : 90) + 360) % 360; break;
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
      if (g) g.position.set(q.x, q.type === "crate" ? q.y + q.h / 2 + 0.02 : q.y, q.z);
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
    const probs = levelProblems(this.level);
    if (probs.length) { alert(`Fix these before saving:\n${probs.join("\n")}`); return; }
    if (!this.level.id) { alert("Give the level an id first."); return; }
    try {
      const res = await fetch("/__level/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(this.level) });
      if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
      const { file } = (await res.json()) as { file: string };
      this.flash(`Saved ${file}`);
    } catch (err) {
      this.flash(`Save failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }

  private newLevel() {
    const before = JSON.stringify(this.level);
    this.level = { id: "new-level", name: "New Level", pieces: [
      newPiece("start", 0, 0, 0),
      { ...newPiece("slab", 0, 0, 0), w: 8, d: 8, fences: { n: false, e: true, s: true, w: true } } as Piece,
      newPiece("goal", 0, 0, -12),
      { ...newPiece("slab", 0, 0, -12), w: 8, d: 8, fences: { n: true, e: true, s: false, w: true } } as Piece,
    ] };
    this.sel.clear();
    this.undoStack.push(before);
    this.refresh();
  }

  dispose() {
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
