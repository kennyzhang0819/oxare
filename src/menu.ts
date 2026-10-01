import * as THREE from "three";
import { cloneLevel, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";
import { loadDraft } from "./editor.ts";
import { loadProgress } from "./game.ts";
import { createScene, type SceneEnv } from "./scene.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

export interface MenuOpts { onPlay(index: number): void; onEdit(level: Level): void }

export class Menu implements Mode {
  private ctx: Ctx;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private raf = 0;
  private onResize = () => this.resize();

  constructor(ctx: Ctx, opts: MenuOpts) {
    this.ctx = ctx;
    // Open sky and sea behind the menu, nothing else; the camera slowly turns over the water.
    this.env = createScene();
    addEventListener("resize", this.onResize);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
    const progress = loadProgress();
    const draft = loadDraft();
    ctx.overlay.append(
      h("div", { class: "menu" },
        h("h1", {}, "OXARE"),
        h("div", { class: "levels" },
          ...LEVELS.map((l, i) => h("div", { class: "level-row" },
            h("span", { class: "name" }, `${i + 1}. ${l.name}`),
            h("span", { class: "best" }, progress[l.id] ? fmtTime(progress[l.id]!.best) : ""),
            h("button", { onclick: () => opts.onPlay(i) }, "Play"),
            h("button", { class: "ghost", onclick: () => opts.onEdit(cloneLevel(l)) }, "Edit"),
          )),
          draft ? h("div", { class: "level-row" },
            h("span", { class: "name" }, `Draft: ${draft.name}`),
            h("button", { onclick: () => opts.onEdit(draft) }, "Open editor"),
          ) : h("div", { class: "level-row" },
            h("span", { class: "name" }, "New level"),
            h("button", { onclick: () => opts.onEdit(cloneLevel(LEVELS[0]!)) }, "Open editor"),
          ),
        ),
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
    this.env.render(this.ctx.renderer, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    removeEventListener("resize", this.onResize);
    clear(this.ctx.overlay);
  }
}
