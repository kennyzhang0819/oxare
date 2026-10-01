import * as THREE from "three";
import { cloneLevel, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";
import { DRAFT_KEY, blankLevel, loadDraft } from "./editor.ts";
import { loadProgress, playerSettings } from "./game.ts";
import { createScene, type SceneEnv } from "./scene.ts";
import { levelThumb } from "./thumbs.ts";
import { GlassTitle } from "./title.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

// `admin` swaps the player's level list for the admin panel (levels, editors); Ctrl+Shift+S
// flips between them. It only hides the tools, it is not access control.
export interface MenuOpts { admin: boolean; onPlay(index: number): void; onPlayLevel(level: Level): void; onEdit(level: Level): void; onChanged(): void; onToggleAdmin(): void }

export class Menu implements Mode {
  private ctx: Ctx;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private raf = 0;
  private title: GlassTitle | null = null;
  private onResize = () => this.resize();
  private onKey: (e: KeyboardEvent) => void;
  private back: (() => void) | null = null;

  constructor(ctx: Ctx, opts: MenuOpts) {
    this.ctx = ctx;
    // Open sky and sea behind the menu, nothing else; the camera slowly turns over the water.
    this.env = createScene();
    this.env.scene.add(this.camera);
    addEventListener("resize", this.onResize);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
    this.onKey = (e) => {
      if (e.code === "KeyS" && e.ctrlKey && e.shiftKey) { e.preventDefault(); opts.onToggleAdmin(); }
      else if (e.code === "Escape" && this.back) this.back();
    };
    addEventListener("keydown", this.onKey);
    if (!opts.admin) {
      const slot = h("h1", { class: "title-slot" }, "OXARE");
      this.title = new GlassTitle(ctx.renderer, this.camera, slot, "OXARE");
      // Home and options sit under the glass title; the level selector stands alone.
      const body = h("div", { class: "menu-body" });
      ctx.overlay.append(h("div", { class: "menu" }, slot, body));
      const show = (title: boolean, back: (() => void) | null, ...children: HTMLElement[]) => {
        slot.hidden = !title;
        this.back = back;
        body.replaceChildren(...children);
      };
      const home = () => show(true, null,
        h("div", { class: "menu-actions" },
          h("button", { class: "menu-btn primary", onclick: levels }, "Start"),
          h("button", { class: "menu-btn", onclick: options }, "Options"),
        ));
      const levels = () => {
        const progress = loadProgress();
        show(false, home,
          h("div", { class: "level-grid" },
            ...LEVELS.map((l, i) => h("button", { class: "level-card", onclick: () => opts.onPlay(i) },
              h("img", { src: levelThumb(ctx.renderer, l), alt: "" }),
              h("span", { class: "name" }, `${i + 1}. ${l.name}`),
              h("span", { class: "best" }, progress[l.id] ? fmtTime(progress[l.id]!.best) : "--:--.--"),
            )),
          ),
          h("button", { class: "menu-btn small", onclick: home }, "Back"),
        );
      };
      const options = () => show(true, home,
        h("div", { class: "card options" }, h("h2", {}, "Options"), playerSettings()),
        h("button", { class: "menu-btn small", onclick: home }, "Back"),
      );
      home();
      return;
    }
    // The editor's working copy gets its own card while it differs from every saved level.
    const draft = loadDraft();
    const unsaved = draft && !LEVELS.some((l) => JSON.stringify(l) === JSON.stringify(draft)) ? draft : null;
    const card = (level: Level, label: string, sub: string, play: () => void, remove: () => void) => h("div", { class: "level-card" },
      h("button", { class: "thumb", title: "Play", onclick: play }, h("img", { src: levelThumb(ctx.renderer, level), alt: "" })),
      h("span", { class: "name" }, label),
      h("span", { class: "best" }, sub),
      h("div", { class: "actions" },
        h("button", { class: "edit", onclick: () => opts.onEdit(cloneLevel(level)) }, "Edit"),
        h("button", { class: "delete", onclick: remove }, "Delete"),
      ),
    );
    // Removes src/levels/<id>.json through the dev server, like the editor's Save writes it.
    const deleteLevel = async (level: Level) => {
      if (!import.meta.env.DEV) { alert("Deleting levels only works in local dev (npm run dev)."); return; }
      if (!confirm(`Delete "${level.name}" (src/levels/${level.id}.json)? This removes the file.`)) return;
      try {
        const res = await fetch("/__level/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: level.id }) });
        if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
        const i = LEVELS.findIndex((l) => l.id === level.id);
        if (i >= 0) LEVELS.splice(i, 1);
        opts.onChanged();
      } catch (err) {
        alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    const discardDraft = () => {
      if (!confirm("Discard the unsaved editor draft?")) return;
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing kept */ }
      opts.onChanged();
    };
    ctx.overlay.append(
      h("div", { class: "menu" },
        h("div", { class: "level-grid" },
          ...LEVELS.map((l, i) => card(l, `${i + 1}. ${l.name}`, `${l.id}.json`, () => opts.onPlay(i), () => void deleteLevel(l))),
          unsaved ? card(unsaved, unsaved.name, `draft · ${unsaved.id}`, () => opts.onPlayLevel(cloneLevel(unsaved)), discardDraft) : null,
          h("button", { class: "level-card plus", title: "New level", onclick: () => opts.onEdit(blankLevel()) },
            h("span", { class: "plus-mark" }, "+"),
            h("span", { class: "name" }, "New level"),
          ),
        ),
        h("button", { class: "menu-btn small", onclick: () => opts.onToggleAdmin() }, "Back to levels (Ctrl+Shift+S)"),
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
    this.title?.update(now / 1000);
    this.env.render(this.ctx.renderer, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.title?.dispose();
    removeEventListener("resize", this.onResize);
    removeEventListener("keydown", this.onKey);
    clear(this.ctx.overlay);
  }
}
