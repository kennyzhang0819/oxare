import * as THREE from "three";
import { cloneLevel, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";
import { loadDraft } from "./editor.ts";
import { loadProgress } from "./game.ts";
import { createScene, type SceneEnv } from "./scene.ts";
import { GlassTitle } from "./title.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

// `admin` swaps the player's level list for the admin panel (levels, editors); Ctrl+Shift+S
// flips between them. It only hides the tools, it is not access control.
export interface MenuOpts { admin: boolean; onPlay(index: number): void; onEdit(level: Level): void; onToggleAdmin(): void }

export class Menu implements Mode {
  private ctx: Ctx;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private raf = 0;
  private title: GlassTitle;
  private onResize = () => this.resize();
  private onKey: (e: KeyboardEvent) => void;

  constructor(ctx: Ctx, opts: MenuOpts) {
    this.ctx = ctx;
    // Open sky and sea behind the menu, nothing else; the camera slowly turns over the water.
    this.env = createScene();
    this.env.scene.add(this.camera);
    const word = opts.admin ? "ADMIN" : "OXARE";
    const slot = h("h1", { class: "title-slot" }, word);
    this.title = new GlassTitle(ctx.renderer, this.camera, slot, word);
    addEventListener("resize", this.onResize);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
    this.onKey = (e) => {
      if (e.code === "KeyS" && e.ctrlKey && e.shiftKey) { e.preventDefault(); opts.onToggleAdmin(); }
    };
    addEventListener("keydown", this.onKey);
    const progress = loadProgress();
    const best = (l: Level) => h("span", { class: "best" }, progress[l.id] ? fmtTime(progress[l.id]!.best) : "");
    if (!opts.admin) {
      ctx.overlay.append(
        h("div", { class: "menu" },
          slot,
          h("div", { class: "levels" },
            ...LEVELS.map((l, i) => h("div", { class: "level-row" },
              h("span", { class: "name" }, `${i + 1}. ${l.name}`),
              best(l),
              h("button", { onclick: () => opts.onPlay(i) }, "Play"),
            )),
          ),
        ),
      );
      return;
    }
    const draft = loadDraft();
    ctx.overlay.append(
      h("div", { class: "menu" },
        slot,
        h("div", { class: "levels" },
          ...LEVELS.map((l, i) => h("div", { class: "level-row" },
            h("span", { class: "name" }, `${i + 1}. ${l.name}`),
            h("span", { class: "best" }, `${l.id}.json`),
            h("button", { class: "ghost", onclick: () => opts.onPlay(i) }, "Play"),
            h("button", { onclick: () => opts.onEdit(cloneLevel(l)) }, "Edit"),
          )),
          draft ? h("div", { class: "level-row" },
            h("span", { class: "name" }, `Draft: ${draft.name}`),
            h("button", { onclick: () => opts.onEdit(draft) }, "Open editor"),
          ) : h("div", { class: "level-row" },
            h("span", { class: "name" }, "New level"),
            h("button", { onclick: () => opts.onEdit(cloneLevel(LEVELS[0]!)) }, "Open editor"),
          ),
        ),
        h("button", { class: "ghost", onclick: () => opts.onToggleAdmin() }, "Back to levels (Ctrl+Shift+S)"),
      ),
    );
  }
  private resize() {
    this.ctx.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private frame = (now: number) => {
    const a = now / 1000 * 0.03;
    this.camera.position.set(0, 10, 0);
    this.camera.lookAt(Math.sin(a) * 40, 2, Math.cos(a) * 40);
    this.title.update(now / 1000);
    this.env.render(this.ctx.renderer, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.title.dispose();
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}
