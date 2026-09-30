import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PIECE_TYPES, cloneLevel, levelProblems, newPiece, validateLevel, type Level, type Piece, type PieceType } from "./level.ts";
import { buildLevel, createScene, type Built } from "./scene.ts";
import { clear, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

export const DRAFT_KEY = "balling.draft";
export function loadDraft(): Level | null {
  try { const s = localStorage.getItem(DRAFT_KEY); return s ? validateLevel(JSON.parse(s)) : null; } catch { return null; }
}

const NUM_FIELDS: Record<PieceType, [key: string, step: number][]> = {
  start: [],
  slab: [["w", 0.5], ["d", 0.5], ["rot", 15]],
  curve: [["inner", 0.5], ["outer", 0.5], ["rot", 15]],
  block: [["w", 0.5], ["h", 0.5], ["d", 0.5], ["rot", 15]],
  spinner: [["length", 0.5], ["speed", 0.1]],
  gem: [],
  goal: [["r", 0.5]],
};
const snap = (v: number) => Math.round(v * 2) / 2;

export interface EditorOpts { onPlay(level: Level): void; onExit(): void }

export class Editor implements Mode {
  private scene: THREE.Scene;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private controls: OrbitControls;
  private built: Built;
  private selected = -1;
  private helper: THREE.BoxHelper | null = null;
  private undoStack: string[] = [];
  private raf = 0;
  private panel: HTMLElement;
  private body = h("div", { class: "body" });
  private problems = h("div", { class: "problems" });
  private ray = new THREE.Raycaster();
  private drag: { plane: THREE.Plane; off: THREE.Vector3; moved: boolean; before: string } | null = null;
  private onResize = () => this.resize();
  private onKey = (e: KeyboardEvent) => this.key(e);

  private ctx: Ctx;
  private level: Level;
  private opts: EditorOpts;

  constructor(ctx: Ctx, level: Level, opts: EditorOpts) {
    this.ctx = ctx;
    this.level = level;
    this.opts = opts;
    ({ scene: this.scene } = createScene());
    this.scene.add(new THREE.GridHelper(200, 100, 0x9fb4cc, 0xc7d6e6));
    this.built = buildLevel(level, true);
    this.scene.add(this.built.group);
    this.controls = new OrbitControls(this.camera, ctx.canvas);
    this.controls.enableDamping = true;
    const s = level.pieces.find((p) => p.type === "start") ?? { x: 0, y: 0, z: 0 };
    this.camera.position.set(s.x + 12, s.y + 18, s.z + 16);
    this.controls.target.set(s.x, s.y, s.z - 6);

    this.panel = h("div", { class: "editor" },
      h("div", { class: "bar" },
        h("button", { class: "ghost", onclick: () => opts.onExit() }, "Menu"),
        h("button", { onclick: () => this.play() }, "▶ Play"),
        h("button", { class: "ghost", onclick: () => this.undo() }, "Undo"),
        h("button", { class: "ghost", onclick: () => this.exportJson() }, "Export"),
        h("button", { class: "ghost", onclick: () => this.importJson() }, "Import"),
        h("button", { class: "ghost", onclick: () => this.newLevel() }, "New"),
      ),
      h("div", { class: "bar add" }, ...PIECE_TYPES.map((t) => h("button", { onclick: () => this.add(t) }, `+ ${t}`))),
      this.problems,
      this.body,
      h("div", { class: "hint" }, "Click to select, drag to move (snaps to 0.5). Arrows nudge, PgUp/PgDn raise, R rotates 90°, Ctrl+D duplicates, Delete removes, Ctrl+Z undoes. Orbit with right-drag / wheel."),
    );
    ctx.overlay.append(this.panel);
    ctx.canvas.addEventListener("pointerdown", this.down);
    ctx.canvas.addEventListener("pointermove", this.move);
    ctx.canvas.addEventListener("pointerup", this.up);
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
    this.resize();
    this.refresh();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = () => {
    this.controls.update();
    this.ctx.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  private resize() {
    this.ctx.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private commit(before = JSON.stringify(this.level)) {
    if (before !== JSON.stringify(this.level)) this.undoStack.push(before);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.refresh();
  }

  private refresh() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(this.level));
    this.scene.remove(this.built.group);
    this.built = buildLevel(this.level, true);
    this.scene.add(this.built.group);
    this.helper?.removeFromParent();
    this.helper = null;
    if (this.selected >= this.level.pieces.length) this.selected = -1;
    const g = this.built.pieceGroups[this.selected];
    if (g) { this.helper = new THREE.BoxHelper(g, 0xffd23f); this.scene.add(this.helper); }
    const probs = levelProblems(this.level);
    this.problems.textContent = probs.join(" · ");
    this.renderPanel();
  }

  private renderPanel() {
    clear(this.body);
    const name = h("input", { type: "text", value: this.level.name, oninput: () => { this.level.name = name.value; localStorage.setItem(DRAFT_KEY, JSON.stringify(this.level)); } });
    const id = h("input", { type: "text", value: this.level.id, oninput: () => { this.level.id = id.value.replace(/[^a-z0-9-]/g, "-"); localStorage.setItem(DRAFT_KEY, JSON.stringify(this.level)); } });
    this.body.append(h("h3", {}, "Level"), h("div", { class: "props" }, h("label", {}, "name", name), h("label", {}, "id", id)));
    const p = this.level.pieces[this.selected];
    if (p) {
      const props = h("div", { class: "props" });
      const rec = p as unknown as Record<string, number>;
      const field = (key: string, step: number) => {
        const input = h("input", { type: "number", step, value: rec[key] ?? 0,
          onchange: () => { const before = JSON.stringify(this.level); rec[key] = Number(input.value); this.commit(before); } });
        return h("label", {}, key, input);
      };
      props.append(field("x", 0.5), field("y", 0.5), field("z", 0.5));
      for (const [k, step] of NUM_FIELDS[p.type]) props.append(field(k, step));
      if (p.type === "slab" || p.type === "curve") {
        const f = p.fences as unknown as Record<string, boolean>;
        const checks = h("div", { class: "checks" }, "fences:");
        for (const k of Object.keys(f)) {
          const cb = h("input", { type: "checkbox", checked: f[k], onchange: () => { const before = JSON.stringify(this.level); f[k] = cb.checked; this.commit(before); } });
          checks.append(h("label", {}, cb, k));
        }
        props.append(checks);
      }
      this.body.append(
        h("h3", {}, `${p.type} #${this.selected}`), props,
        h("div", { class: "row", style: "display:flex;gap:6px;margin-top:6px" },
          h("button", { class: "ghost", onclick: () => this.duplicate() }, "Duplicate"),
          h("button", { class: "ghost", onclick: () => this.remove() }, "Delete"),
        ),
      );
    }
    const list = h("div", { class: "list" }, h("h3", {}, `Pieces (${this.level.pieces.length})`));
    this.level.pieces.forEach((q, i) => {
      list.append(h("div", { class: i === this.selected ? "sel" : "", onclick: () => this.select(i) }, `${i}: ${q.type} (${q.x}, ${q.y}, ${q.z})`));
    });
    this.body.append(list);
  }

  private select(i: number) {
    this.selected = i;
    this.refresh();
  }

  private add(type: PieceType) {
    const before = JSON.stringify(this.level);
    const t = this.controls.target;
    const sel = this.level.pieces[this.selected];
    const base = sel ?? { x: snap(t.x), y: snap(t.y), z: snap(t.z) };
    this.level.pieces.push(newPiece(type, base.x + (sel ? 2 : 0), base.y, base.z));
    this.selected = this.level.pieces.length - 1;
    this.commit(before);
  }

  private duplicate() {
    const p = this.level.pieces[this.selected];
    if (!p) return;
    const before = JSON.stringify(this.level);
    const c = JSON.parse(JSON.stringify(p)) as Piece;
    c.x += 2;
    this.level.pieces.push(c);
    this.selected = this.level.pieces.length - 1;
    this.commit(before);
  }

  private remove() {
    if (this.selected < 0) return;
    const before = JSON.stringify(this.level);
    this.level.pieces.splice(this.selected, 1);
    this.selected = -1;
    this.commit(before);
  }

  private undo() {
    const s = this.undoStack.pop();
    if (!s) return;
    this.level = JSON.parse(s) as Level;
    this.refresh();
  }

  private key(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    const p = this.level.pieces[this.selected];
    if (e.code === "Escape") { this.selected = -1; this.refresh(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") { e.preventDefault(); this.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyD") { e.preventDefault(); this.duplicate(); return; }
    if (!p) return;
    const before = JSON.stringify(this.level);
    const d = e.shiftKey ? 2 : 0.5;
    switch (e.code) {
      case "Delete": case "Backspace": this.remove(); return;
      case "ArrowLeft": p.x -= d; break;
      case "ArrowRight": p.x += d; break;
      case "ArrowUp": p.z -= d; break;
      case "ArrowDown": p.z += d; break;
      case "PageUp": p.y += d; break;
      case "PageDown": p.y -= d; break;
      case "KeyR": if ("rot" in p) p.rot = (p.rot + (e.shiftKey ? -90 : 90) + 360) % 360; break;
      default: return;
    }
    e.preventDefault();
    this.commit(before);
  }

  private pick(e: PointerEvent): number {
    const r = this.ctx.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.built.group.children, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && o.userData.pieceIndex === undefined) o = o.parent;
    return o ? (o.userData.pieceIndex as number) : -1;
  }

  private down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const i = this.pick(e);
    if (i !== this.selected) this.select(i);
    const p = this.level.pieces[i];
    if (!p) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -p.y);
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, pt)) return;
    this.drag = { plane, off: new THREE.Vector3(p.x - pt.x, 0, p.z - pt.z), moved: false, before: JSON.stringify(this.level) };
    this.controls.enabled = false;
    this.ctx.canvas.setPointerCapture(e.pointerId);
  };

  private move = (e: PointerEvent) => {
    const p = this.level.pieces[this.selected];
    if (!this.drag || !p) return;
    const r = this.ctx.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const pt = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.drag.plane, pt)) return;
    const nx = snap(pt.x + this.drag.off.x), nz = snap(pt.z + this.drag.off.z);
    if (nx === p.x && nz === p.z) return;
    p.x = nx; p.z = nz;
    this.drag.moved = true;
    const g = this.built.pieceGroups[this.selected];
    if (g) { g.position.set(p.x, p.y, p.z); this.helper?.update(); }
  };

  private up = () => {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.controls.enabled = true;
    if (d.moved) this.commit(d.before); else this.renderPanel();
  };

  private play() {
    const probs = levelProblems(this.level);
    if (probs.length) { alert(probs.join("\n")); return; }
    this.opts.onPlay(cloneLevel(this.level));
  }

  private exportJson() {
    const blob = new Blob([JSON.stringify(this.level, null, 2) + "\n"], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `${this.level.id || "level"}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private importJson() {
    const input = h("input", { type: "file", accept: ".json,application/json" });
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const before = JSON.stringify(this.level);
        this.level = validateLevel(JSON.parse(await f.text()));
        this.selected = -1;
        this.undoStack.push(before);
        this.refresh();
      } catch (err) { alert(String(err)); }
    };
    input.click();
  }

  private newLevel() {
    const before = JSON.stringify(this.level);
    this.level = { id: "new-level", name: "New Level", pieces: [
      newPiece("start", 0, 0, 0),
      { ...newPiece("slab", 0, 0, 0), w: 6, d: 6, fences: { n: false, e: true, s: true, w: true } } as Piece,
      newPiece("goal", 0, 0, -12),
      { ...newPiece("slab", 0, 0, -12), w: 6, d: 6, fences: { n: true, e: true, s: false, w: true } } as Piece,
    ] };
    this.selected = -1;
    this.undoStack.push(before);
    this.refresh();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.ctx.canvas.removeEventListener("pointerdown", this.down);
    this.ctx.canvas.removeEventListener("pointermove", this.move);
    this.ctx.canvas.removeEventListener("pointerup", this.up);
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}
