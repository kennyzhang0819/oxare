import * as THREE from "three";
import { Input } from "./input.ts";
import { APPLE, BALL_RADIUS, ORIGIN_LEAVE, START_PAD_H, inOrigin, moverAt, startOf, takesApple, moverShift, pangolinUnrolled, type Level } from "./level.ts";
import { buildLevel, createScene, fitSun, hideHullsAround, makeBall, posePlank, turnBelts, type Built, type SceneEnv } from "./scene.ts";
import { disposeDecor } from "./decor.ts";
import { NEAR_ON } from "./fade.ts";
import { STEP, createSim, type Sim } from "./sim.ts";
import { decorStems } from "./decor.ts";
import { DEFAULT_TUNING, FIXED_KEYS, PLAYER_KEYS, TUNING, TUNING_RANGES, resetTuning, saveTuning, type TuningKey } from "./tuning.ts";
import { slider } from "./slider.ts";
import { UI_SCALE, setUiScale, uiScale } from "./uiscale.ts";
import { Stats } from "./stats.ts";
import { toggle } from "./toggle.ts";
import { clear, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

// Seconds the wormhole takes to swallow the ball before the level-complete card.
const SINK_TIME = 0.9;
// Seconds a taken apple takes to pop and vanish, and the wormhole to open once the last is taken.
const POP_TIME = 0.3, OPEN_TIME = 1.2;
const APPLE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7c-2-1.6-6.5-1.4-7.6 2.6C3.3 13.7 6 21 9.3 21c1.2 0 1.7-.6 2.7-.6s1.5.6 2.7.6c3.3 0 6-7.3 4.9-11.4C18.5 5.6 14 5.4 12 7z" fill="#e8423a" stroke="#3a2a22" stroke-width="1.3"/><path d="M12 7.2c0-1.6.4-3 1.3-4" stroke="#3a2a22" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M13.2 4.6c1.5-1.4 3.6-1.5 4.8-.9-.9 1.5-3 2.3-4.8.9z" fill="#5cbf4f" stroke="#3a2a22" stroke-width="1.1"/></svg>`;

export interface PlayFrom { x: number; y: number; z: number; yaw: number }
// `admin` (played from the admin panel or the editor) adds the feel-tuning panel: a Tune button and T.
export interface GameOpts { onExit(): void; onNext?: () => void; onRetry(): void; from?: PlayFrom; admin?: boolean }

export class Game implements Mode {
  private scene: THREE.Scene;
  private sun: THREE.DirectionalLight;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private built: Built;
  private ball = makeBall();
  private input = new Input();
  private sim: Sim | null = null;
  // Pose before the latest physics step; the frame renders between it and the current pose.
  private prevPos = new THREE.Vector3();
  private prevRot = new THREE.Quaternion();
  private shown = new THREE.Vector3();
  private yaw = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private time = 0;
  private falls = 0;
  private done = false;
  // Each taken apple's piece index and the run time it was taken at; how many the level has; when the
  // last was taken (the wormhole opens from then); whether the ball has left the origin since it last
  // started there; and the HUD's apple count.
  private taken = new Map<number, number>();
  private total = 0;
  private openAt: number | null = null;
  private left = false;
  private count: HTMLElement | null = null;
  // Set once the ball goes back into the wormhole: where it went in and how long it has been sinking.
  private sink: { from: THREE.Vector3; to: THREE.Vector3; t: number; ended: boolean } | null = null;
  private frames = 0;
  // How far each pangolin was last drawn unrolled, by piece index.
  private unrolled = new Map<number, number>();
  ready: Promise<void>;
  private drawn!: () => void;
  private hud: HTMLElement;
  private stats: Stats;
  private tunePanel: HTMLElement | null = null;
  private pauseMenu: HTMLElement | null = null;
  private onResize = () => this.resize();
  // Set when the game lets go of the mouse itself, so only the player's Esc out of the lock pauses.
  private released = false;
  private unlockedAt = -Infinity;
  private onLock = () => {
    if (document.pointerLockElement) return;
    this.unlockedAt = performance.now();
    if (this.released) { this.released = false; return; }
    if (!this.done && !this.pauseMenu) this.togglePause();
  };
  private onKey = (e: KeyboardEvent) => {
    // The Esc that ended a mouse lock has already paused.
    if (e.code === "Escape" && !this.done && performance.now() - this.unlockedAt > 300) this.togglePause();
    if (e.code === "KeyT" && this.opts.admin && !(e.target instanceof HTMLInputElement)) this.toggleTune();
    if (e.code === "KeyR" && !(e.target instanceof HTMLInputElement)) this.fall();
  };

  private ctx: Ctx;
  private level: Level;
  private opts: GameOpts;

  constructor(ctx: Ctx, level: Level, opts: GameOpts) {
    this.ctx = ctx;
    this.level = level;
    this.opts = opts;
    this.ready = new Promise((r) => { this.drawn = r; });
    this.env = createScene();
    ({ scene: this.scene, sun: this.sun } = this.env);
    this.built = buildLevel(level, false);
    this.scene.add(this.built.group, this.ball.mesh);
    fitSun(this.sun, this.built);
    this.total = this.built.apples.size;
    this.hud = h("div", { class: "hud" },
      this.total ? h("div", { class: "pill apples" }, h("span", { class: "apple-icon", innerHTML: APPLE_ICON }), (this.count = h("span", {}, `0 / ${this.total}`))) : null,
      h("span", { class: "spacer" }),
      opts.admin ? h("button", { class: "ghost", onclick: () => this.toggleTune() }, "Tune (T)") : null,
      h("button", { class: "ghost", onclick: () => { if (!this.done) this.togglePause(); } }, "Menu"),
    );
    ctx.overlay.append(this.hud);
    this.stats = new Stats(ctx.renderer, ctx.overlay);
    this.input.attach(ctx.canvas, ctx.overlay);
    this.input.lock();
    addEventListener("resize", this.onResize);
    addEventListener("keydown", this.onKey);
    document.addEventListener("pointerlockchange", this.onLock);
    this.resize();
    void this.boot();
  }

  private async boot() {
    if (this.opts.from) this.yaw = this.opts.from.yaw;
    this.sim = await createSim(this.level, this.opts.from, decorStems(this.built.decor));
    if (this.raf === -1) { this.sim.free(); return; }
    this.savePrev();
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
    this.stats.begin(now);
    this.input.update();
    const lookPx = this.input.takeLookPx();
    let simMs = 0;
    if (!this.done && !this.pauseMenu) {
      this.yaw -= this.input.steer * TUNING.yawRate * dt + lookPx * TUNING.mouseSens;
      this.acc += dt;
      this.time += dt;
      const t0 = performance.now();
      while (this.acc >= STEP) {
        this.savePrev();
        const f = this.forward();
        sim.step(this.input.throttle, f.x, f.z);
        this.acc -= STEP;
      }
      simMs = performance.now() - t0;
    }
    // Frames run 0-3 physics steps each, so the raw post-step pose judders; blending back toward
    // the previous pose by the unconsumed fraction of a step moves the ball by exactly the frame's dt.
    const alpha = this.done ? 1 : this.acc / STEP;
    const p = sim.ball.translation();
    const r = sim.ball.rotation();
    this.shown.set(p.x, p.y, p.z).lerp(this.prevPos, 1 - alpha);
    this.ball.mesh.position.copy(this.shown);
    this.ball.mesh.quaternion.set(r.x, r.y, r.z, r.w).slerp(this.prevRot, 1 - alpha);
    if (this.sink) this.sinkBall(dt);
    turnBelts(this.built, sim.beltTravel - TUNING.beltSpeed * STEP * (1 - alpha));
    for (const s of sim.spinners) {
      const bar = this.built.spinnerBars.get(s.index);
      if (bar) bar.rotation.y = s.angle - s.speed * STEP * (1 - alpha);
    }
    // Moving platforms by their schedule at the same in-between moment the ball is drawn at.
    for (const m of sim.movers) {
      const g = this.built.movers.get(m.index);
      if (g) { const at = moverAt(m.piece, sim.time - STEP * (1 - alpha)); g.position.set(at.x, at.y, at.z); }
    }
    // What rides a moving platform goes with it (a crate or barrel is placed by its own body below).
    for (const [i, m] of sim.riders) {
      const g = this.built.pieceGroups[i], p = this.level.pieces[i];
      if (!g || !p || p.type === "crate" || p.type === "barrel" || p.type === "cube") continue;
      const d = moverShift(m.piece, sim.time - STEP * (1 - alpha));
      g.position.set(p.x + d.x, p.y + d.y, p.z + d.z);
    }
    for (const c of sim.crates) {
      const g = this.built.crates.get(c.index);
      if (!g) continue;
      const t = c.body.translation(), q = c.body.rotation();
      g.position.set(t.x, t.y, t.z);
      g.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (const b of sim.bridges) {
      const planks = this.built.bridges.get(b.index), piece = this.built.pieceGroups[b.index];
      if (!planks || !piece) continue;
      b.planks.forEach((body, k) => { const pg = planks[k]; if (pg) posePlank(piece, pg, body.translation(), body.rotation()); });
    }
    for (const pl of sim.planks) {
      const panel = this.built.planks.get(pl.index), piece = this.built.pieceGroups[pl.index];
      if (panel && piece) posePlank(piece, panel, pl.body.translation(), pl.body.rotation());
    }
    for (const pg of sim.pangolins) {
      const pose = this.built.pangolins.get(pg.index);
      const a = pangolinUnrolled(pg.track, pg.at === null ? 0 : sim.time - STEP * (1 - alpha) - pg.at, TUNING.unrollSpeed);
      if (pose && a !== this.unrolled.get(pg.index)) { this.unrolled.set(pg.index, a); pose(a); }
    }
    if (!this.done) {
      if (p.y < sim.respawnY) this.fall();
      this.collect(p);
      this.homecoming(p);
    }
    this.poseApples();
    this.updateCamera();
    // The mirror refreshes every other frame: six extra scene passes at 60 Hz is the single
    // dearest thing in the loop, and a one-frame-old reflection on a rolling ball is invisible.
    if (this.frames++ % 2 === 0) this.ball.reflect(this.ctx.renderer, this.env);
    hideHullsAround(this.built, this.camera.position);
    NEAR_ON.value = 1;
    this.env.render(this.ctx.renderer, this.camera);
    NEAR_ON.value = 0;
    this.drawn();
    this.stats.end(simMs);
    this.raf = requestAnimationFrame(this.frame);
  };

  private savePrev() {
    const p = this.sim!.ball.translation();
    const r = this.sim!.ball.rotation();
    this.prevPos.set(p.x, p.y, p.z);
    this.prevRot.set(r.x, r.y, r.z, r.w);
  }

  private snapCamera() {
    const p = this.shown.set(this.prevPos.x, this.prevPos.y, this.prevPos.z);
    this.camera.position.set(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.aim(p);
  }

  // Pitch the camera so the frame's bottom edge sits `camBallGap` ball heights below the
  // ball: the ball rides low in the view and the rest of the frame is scene and sky.
  private aim(p: THREE.Vector3) {
    const c = this.camera.position;
    const hx = p.x - c.x, hz = p.z - c.z, d = Math.hypot(hx, hz) || 1e-6;
    const floorY = p.y - BALL_RADIUS - TUNING.camBallGap * 2 * BALL_RADIUS;
    const pitch = Math.atan2(floorY - c.y, d) + (this.camera.fov * Math.PI) / 360;
    this.camera.lookAt(c.x + (hx / d) * Math.cos(pitch), c.y + Math.sin(pitch), c.z + (hz / d) * Math.cos(pitch));
  }

  private updateCamera() {
    const p = this.shown;
    // Locked to the ball, no easing: the ball holds one spot in the frame however it moves.
    this.camera.position.set(p.x + Math.sin(this.yaw) * TUNING.camDist, p.y + TUNING.camHeight, p.z + Math.cos(this.yaw) * TUNING.camDist);
    this.aim(p);
  }

  // The ball takes every apple it touches (takesApple); the last one opens the wormhole.
  private collect(p: { x: number; y: number; z: number }) {
    for (const i of this.built.apples.keys()) {
      const a = this.level.pieces[i];
      if (!a || this.taken.has(i) || !takesApple(a, p)) continue;
      this.taken.set(i, this.time);
      if (this.count) this.count.textContent = `${this.taken.size} / ${this.total}`;
      if (this.taken.size === this.total) { this.openAt = this.time; this.count?.parentElement?.classList.add("done"); }
    }
  }

  // The level ends when the ball, every apple taken, rolls back into the open wormhole at the origin,
  // having left it first. A level with no apples is open from the start.
  private homecoming(p: { x: number; y: number; z: number }) {
    const o = startOf(this.level);
    if (Math.hypot(p.x - o.x, p.z - o.z) > ORIGIN_LEAVE) this.left = true;
    if (!this.left || this.taken.size < this.total || !inOrigin(this.level, p)) return;
    this.done = true;
    this.sink = { from: this.shown.clone(), to: new THREE.Vector3(o.x, o.y + START_PAD_H - 0.02, o.z), t: 0, ended: false };
  }

  // Apples spin and bob until taken, then pop and vanish; the wormhole opens over OPEN_TIME.
  private poseApples() {
    const t = this.time;
    for (const [i, a] of this.built.apples) {
      const at = this.taken.get(i);
      if (at === undefined) {
        a.rotation.y = t * 1.6 + i;
        a.position.y = APPLE.float + Math.sin(t * 2.2 + i) * 0.08;
        continue;
      }
      const k = (t - at) / POP_TIME;
      a.visible = k < 1;
      a.scale.setScalar(Math.max(1e-3, (1 + 0.8 * k) * (1 - k * k)));
    }
    const k = this.total === 0 ? 1 : this.openAt === null ? 0 : Math.min(1, (t - this.openAt) / OPEN_TIME);
    this.built.origin?.(k * k * (3 - 2 * k));
  }

  // A fall (or R) loses every apple taken: they float back where they were and the wormhole shuts, so
  // all of them have to be carried home in one run.
  private fall() {
    this.left = false;
    this.falls++;
    this.taken.clear();
    this.openAt = null;
    for (const a of this.built.apples.values()) { a.visible = true; a.scale.setScalar(1); }
    if (this.count) { this.count.textContent = `0 / ${this.total}`; this.count.parentElement?.classList.remove("done"); }
    this.sim!.respawn();
    this.savePrev();
  }

  private releaseMouse() {
    if (!document.pointerLockElement) return;
    this.released = true;
    document.exitPointerLock();
  }

  // The portal swallows the ball: it spirals in, quickening, shrinking to nothing at the centre.
  private sinkBall(dt: number) {
    const s = this.sink!, m = this.ball.mesh;
    s.t += dt;
    const k = Math.min(1, s.t / SINK_TIME), e = k * k;
    const dx = s.from.x - s.to.x, dz = s.from.z - s.to.z;
    const a = Math.atan2(dz, dx) - e * Math.PI * 3, rad = Math.hypot(dx, dz) * (1 - e), size = 1 - e;
    m.position.set(s.to.x + Math.cos(a) * rad, s.to.y + BALL_RADIUS * size + (s.from.y - s.to.y - BALL_RADIUS) * (1 - k) * (1 - k), s.to.z + Math.sin(a) * rad);
    m.rotateY(e * 12);
    m.scale.setScalar(Math.max(1e-3, size));
    if (k < 1 || s.ended) return;
    s.ended = true;
    m.visible = false;
    this.finish();
  }

  private finish() {
    this.done = true;
    this.releaseMouse();
    this.ctx.overlay.append(
      h("div", { class: "banner" },
        h("div", { class: "card" },
          h("h2", {}, "Level complete"),
          h("div", {}, `Falls ${this.falls}`),
          h("div", { class: "row" },
            h("button", { onclick: () => this.opts.onRetry() }, "Retry"),
            this.opts.onNext ? h("button", { onclick: () => this.opts.onNext!() }, "Next") : null,
            h("button", { class: "ghost", onclick: () => this.opts.onExit() }, "Menu"),
          ),
        ),
      ),
    );
  }

  // The in-game menu pauses the run (the clock and physics stop): Resume, Restart, Settings (the
  // player's settings, with Back to the menu) and Quit.
  private togglePause() {
    // While playing the mouse stays locked (if that's on): closing the menu takes it again, and anything
    // that lets it go (Esc, leaving the window) opens the menu.
    if (this.pauseMenu) { this.pauseMenu.remove(); this.pauseMenu = null; this.input.lock(); return; }
    this.releaseMouse();
    const card = h("div", { class: "card pause" });
    const menu = () => card.replaceChildren(
      h("h2", {}, "Paused"),
      h("div", { class: "stack" },
        h("button", { onclick: () => this.togglePause() }, "Resume"),
        h("button", { class: "ghost", onclick: () => this.opts.onRetry() }, "Restart"),
        h("button", { class: "ghost", onclick: settings }, "Settings"),
        h("button", { class: "ghost", onclick: () => this.opts.onExit() }, "Quit"),
      ),
    );
    const settings = () => card.replaceChildren(
      h("h2", {}, "Settings"),
      playerSettings(),
      h("div", { class: "row" }, h("button", { class: "ghost", onclick: menu }, "Back")),
    );
    menu();
    this.pauseMenu = h("div", { class: "banner" }, card);
    this.ctx.overlay.append(this.pauseMenu);
  }

  private toggleTune() {
    if (this.tunePanel) { this.tunePanel.remove(); this.tunePanel = null; this.input.lock(); return; }
    this.releaseMouse();
    const out = h("textarea", { readOnly: true });
    const refresh = () => { out.value = JSON.stringify(TUNING, null, 1); };
    const rows = (Object.keys(TUNING) as TuningKey[]).filter((k) => !PLAYER_KEYS.includes(k) && !FIXED_KEYS.includes(k)).map((k) => {
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
    this.drawn();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = -1;
    this.sim?.free();
    this.ball.dispose();
    disposeDecor(this.built.decor);
    this.stats.dispose();
    this.releaseMouse();
    document.removeEventListener("pointerlockchange", this.onLock);
    this.input.detach();
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}

// The player's own settings, shown in the pause menu and under Options on the home screen.
export function playerSettings(): HTMLElement {
  // Speeds read as a share of their default; camera distances in units.
  const row = (label: string, key: TuningKey, units = false) => {
    const [min, max, step] = TUNING_RANGES[key];
    const show = (v = TUNING[key]) => (units ? v.toFixed(2).replace(/\.?0+$/, "") : `${Math.round((v / DEFAULT_TUNING[key]) * 100)}%`);
    const val = h("span", {}, show());
    const range = slider({ min, max, step, value: TUNING[key], mark: DEFAULT_TUNING[key], label, text: show,
      onInput: (v) => { TUNING[key] = v; val.textContent = show(v); saveTuning(); } });
    return h("div", { class: "field" }, h("span", {}, label), val, range);
  };
  const on = (label: string, title: string, checked: boolean, set: (on: boolean) => void) =>
    h("label", { class: "toggle", title }, h("span", {}, label), toggle({ checked, label, onChange: set }));
  // UI size shows as you drag but is applied once the slider is let go, so the slider doesn't move under the pointer.
  const size = () => {
    const show = (v: number) => `${Math.round(v * 100)}%`;
    const val = h("span", {}, show(uiScale()));
    return h("div", { class: "field" }, h("span", {}, "UI size"), val,
      slider({ ...UI_SCALE, value: uiScale(), mark: UI_SCALE.default, label: "UI size", text: show, onInput: (v) => { val.textContent = show(v); }, onChange: setUiScale }));
  };
  const game = () => [
    row("Turn speed (keys)", "yawRate"),
    row("Mouse sensitivity", "mouseSens"),
    on("Lock mouse to camera", "On: click the game to capture the mouse, which then turns the camera as far as you like; Esc lets it go. Off: drag to turn",
      Input.mouseLockEnabled(), (v) => Input.setMouseLock(v)),
    row("Camera distance", "camDist", true),
    row("Camera height", "camHeight", true),
  ];
  const other = () => [
    on("Performance stats", "While playing, in the top right: frame rate, frame, script and physics time, draw calls and triangles, resolution and memory",
      Stats.enabled(), (v) => Stats.setEnabled(v)),
  ];
  const pages: [string, () => HTMLElement[]][] = [["Game", game], ["Interface", () => [size()]], ["Other", other]];
  const body = h("div", {}), tabs = h("div", { class: "settings-tabs", role: "tablist" });
  const show = (k: number) => {
    tabs.replaceChildren(...pages.map(([name], i) => h("button", { class: i === k ? "active" : "", role: "tab", "aria-selected": String(i === k), onclick: () => show(i) }, name)));
    body.replaceChildren(...pages[k]![1]());
  };
  show(0);
  return h("div", { class: "settings" }, tabs, body);
}
