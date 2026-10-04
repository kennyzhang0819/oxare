import * as THREE from "three";
import { h } from "./ui.ts";

// The performance readout is one setting for the whole app (off by default): switched in the settings,
// it shows or hides at once in any live readout (so from the pause menu too), and is remembered.
const KEY = "balling.stats";
let enabled = false;
try { enabled = localStorage.getItem(KEY) === "1"; } catch { /* off */ }
const live = new Set<Stats>();
const REFRESH_MS = 500;

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));

export class Stats {
  readonly el: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private size = new THREE.Vector2();
  private t0 = 0;
  private since = 0;
  private frames = 0;
  private script = 0;
  private sim = 0;
  private calls = 0;
  private tris = 0;

  constructor(renderer: THREE.WebGLRenderer, overlay: HTMLElement) {
    this.renderer = renderer;
    this.el = h("div", { class: "stats", "aria-live": "off" });
    overlay.append(this.el);
    live.add(this);
    this.apply();
  }

  static enabled(): boolean { return enabled; }

  static setEnabled(on: boolean): void {
    enabled = on;
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* this session only */ }
    for (const s of live) s.apply();
  }

  // The renderer's counters normally reset on every render call; while the readout is on they reset once per
  // frame in `begin` instead, so the sky pass, the ball's mirror and the main pass all add up.
  private apply() {
    this.el.hidden = !enabled;
    this.renderer.info.autoReset = !enabled;
    this.renderer.info.reset();
    this.since = performance.now();
    this.frames = this.script = this.sim = this.calls = this.tris = 0;
  }

  // At the top of a frame, before anything renders; `now` is the frame's timestamp.
  begin(now: number): void {
    if (!enabled) return;
    this.t0 = now;
    this.renderer.info.reset();
  }

  // Once the frame is drawn; `simMs` is how long its physics steps took.
  end(simMs = 0): void {
    if (!enabled) return;
    const now = performance.now();
    this.frames++;
    this.script += now - this.t0;
    this.sim += simMs;
    this.calls += this.renderer.info.render.calls;
    this.tris += this.renderer.info.render.triangles;
    const span = now - this.since;
    if (span < REFRESH_MS) return;
    const n = this.frames, r = this.renderer;
    r.getDrawingBufferSize(this.size);
    const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
    this.el.textContent = [
      `${Math.round((n * 1000) / span)} fps  ${(span / n).toFixed(1)} ms`,
      `script ${(this.script / n).toFixed(1)} ms  sim ${(this.sim / n).toFixed(2)} ms`,
      `draws ${fmt(this.calls / n)}  tris ${fmt(this.tris / n)}`,
      `${this.size.x}×${this.size.y} @${r.getPixelRatio()}x`,
      `geo ${r.info.memory.geometries}  tex ${r.info.memory.textures}  prog ${r.info.programs?.length ?? 0}` + (heap ? `  heap ${Math.round(heap / 1048576)} MB` : ""),
    ].join("\n");
    this.since = now;
    this.frames = this.script = this.sim = this.calls = this.tris = 0;
  }

  dispose(): void {
    live.delete(this);
    this.renderer.info.autoReset = true;
    this.el.remove();
  }
}
