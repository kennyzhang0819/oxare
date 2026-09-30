import * as THREE from "three";
import { Input } from "./input.ts";
import { BALL_RADIUS, type Level } from "./level.ts";
import { buildLevel, createScene, makeBall, type Built } from "./scene.ts";
import { STEP, createSim, type Sim } from "./sim.ts";
import { TUNING, TUNING_RANGES, resetTuning, saveTuning, type TuningKey } from "./tuning.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

const PROGRESS_KEY = "balling.progress";
type Progress = Record<string, { best: number }>;
export function loadProgress(): Progress {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}") as Progress; } catch { return {}; }
}

export interface GameOpts { onExit(): void; onNext?: () => void; onRetry(): void }

export class Game implements Mode {
  private scene: THREE.Scene;
  private sun: THREE.DirectionalLight;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private built: Built;
  private ballMesh = makeBall();
  private input = new Input();
  private sim: Sim | null = null;
  private yaw = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private time = 0;
  private falls = 0;
  private collected = new Set<number>();
  private done = false;
  private hud: HTMLElement;
  private timeEl = h("span", { class: "pill" }, "0:00.00");
  private gemEl = h("span", { class: "pill" });
  private tunePanel: HTMLElement | null = null;
  private onResize = () => this.resize();
  private onKey = (e: KeyboardEvent) => {
    if (e.code === "Escape") this.opts.onExit();
    if (e.code === "KeyT" && !(e.target instanceof HTMLInputElement)) this.toggleTune();
    if (e.code === "KeyR" && !(e.target instanceof HTMLInputElement)) this.fall();
  };

  private ctx: Ctx;
  private level: Level;
  private opts: GameOpts;

  constructor(ctx: Ctx, level: Level, opts: GameOpts) {
    this.ctx = ctx;
    this.level = level;
    this.opts = opts;
    ({ scene: this.scene, sun: this.sun } = createScene());
    this.built = buildLevel(level, false);
    this.scene.add(this.built.group, this.ballMesh);
    this.hud = h("div", { class: "hud" },
      h("button", { class: "ghost", onclick: () => opts.onExit() }, "Menu"),
      h("span", { class: "pill" }, level.name),
      this.timeEl, this.gemEl,
      h("span", { class: "spacer" }),
      h("button", { class: "ghost", onclick: () => this.toggleTune() }, "Tune (T)"),
    );
    ctx.overlay.append(this.hud);
    this.updateGemHud();
    this.input.attach(ctx.canvas);
    if (this.input.tiltOn) this.input.calibrate();
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
    this.resize();
    void this.boot();
  }

  private async boot() {
    this.sim = await createSim(this.level);
    if (this.raf === -1) { this.sim.free(); return; }
    this.snapCamera();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private resize() {
    const { canvas, renderer } = this.ctx;
    renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  private forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  private frame = (now: number) => {
    const sim = this.sim!;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.input.update();
    if (!this.done) {
      this.yaw -= this.input.steer * TUNING.yawRate * dt;
      this.acc += dt;
      this.time += dt;
      while (this.acc >= STEP) {
        const f = this.forward();
        sim.step(this.input.throttle, f.x, f.z);
        this.acc -= STEP;
      }
    }
    const p = sim.ball.translation();
    const r = sim.ball.rotation();
    this.ballMesh.position.set(p.x, p.y, p.z);
    this.ballMesh.quaternion.set(r.x, r.y, r.z, r.w);
    for (const s of sim.spinners) {
      const bar = this.built.spinnerBars.get(s.index);
      if (bar) bar.rotation.y = s.angle;
    }
    for (const [i, m] of this.built.gems) {
      if (this.collected.has(i)) continue;
      m.rotation.y = this.time * 2;
      m.position.y = 0.8 + Math.sin(this.time * 3 + i) * 0.1;
      const g = this.level.pieces[i]!;
      if (Math.hypot(p.x - g.x, p.y - (g.y + 0.8), p.z - g.z) < BALL_RADIUS + 0.5) {
        this.collected.add(i);
        m.visible = false;
        this.updateGemHud();
      }
    }
    if (!this.done) {
      if (p.y < TUNING.respawnY) this.fall();
      const goal = this.built.goal;
      if (goal) {
        const gp = this.level.pieces[goal.index]!;
        if (gp.type === "goal" && Math.hypot(p.x - gp.x, p.z - gp.z) < gp.r && Math.abs(p.y - (gp.y + BALL_RADIUS)) < 0.6) this.finish();
      }
    }
    this.timeEl.textContent = fmtTime(this.time);
    this.updateCamera(dt);
    this.ctx.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  private snapCamera() {
    const p = this.sim!.ball.translation();
    this.camera.position.set(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.camera.lookAt(p.x, p.y, p.z);
  }

  private updateCamera(dt: number) {
    const p = this.sim!.ball.translation();
    const target = new THREE.Vector3(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.camera.position.lerp(target, 1 - Math.exp(-10 * dt));
    this.camera.lookAt(p.x, p.y + 0.5, p.z);
    this.sun.position.set(p.x + 8, p.y + 14, p.z + 6);
    this.sun.target.position.set(p.x, p.y, p.z);
  }

  private fall() {
    this.falls++;
    this.sim!.respawn();
  }

  private updateGemHud() {
    this.gemEl.textContent = `◆ ${this.collected.size}/${this.built.gems.size}`;
  }

  private finish() {
    this.done = true;
    const progress = loadProgress();
    const prev = progress[this.level.id]?.best;
    const best = prev == null || this.time < prev;
    if (best) { progress[this.level.id] = { best: this.time }; localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); }
    this.ctx.overlay.append(
      h("div", { class: "banner" },
        h("div", { class: "card" },
          h("h2", {}, "Level complete"),
          h("div", {}, `Time ${fmtTime(this.time)}${best ? " · new best" : ""}`),
          h("div", {}, `Gems ${this.collected.size}/${this.built.gems.size} · Falls ${this.falls}`),
          h("div", { class: "row" },
            h("button", { onclick: () => this.opts.onRetry() }, "Retry"),
            this.opts.onNext ? h("button", { onclick: () => this.opts.onNext!() }, "Next") : null,
            h("button", { class: "ghost", onclick: () => this.opts.onExit() }, "Menu"),
          ),
        ),
      ),
    );
  }

  private toggleTune() {
    if (this.tunePanel) { this.tunePanel.remove(); this.tunePanel = null; return; }
    const out = h("textarea", { readOnly: true });
    const refresh = () => { out.value = JSON.stringify(TUNING, null, 1); };
    const rows = (Object.keys(TUNING) as TuningKey[]).map((k) => {
      const [min, max, step] = TUNING_RANGES[k];
      const val = h("span", {}, String(TUNING[k]));
      const range = h("input", { type: "range", min, max, step, value: TUNING[k],
        oninput: () => { TUNING[k] = Number(range.value); val.textContent = range.value; saveTuning(); refresh(); } });
      return h("label", {}, h("span", {}, k), val, range);
    });
    refresh();
    this.tunePanel = h("div", { class: "tune" },
      ...rows,
      h("div", { class: "row" },
        h("button", { onclick: () => { resetTuning(); this.toggleTune(); this.toggleTune(); } }, "Reset"),
        h("button", { class: "ghost", onclick: () => navigator.clipboard?.writeText(out.value) }, "Copy"),
      ),
      out,
    );
    this.ctx.overlay.append(this.tunePanel);
  }

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = -1;
    this.sim?.free();
    this.input.detach();
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}
