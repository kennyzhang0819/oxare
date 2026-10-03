import * as THREE from "three";
import { cloneLevel, type Level } from "./level.ts";
import { LEVELS } from "./levels/index.ts";
import { blankLevel } from "./editor.ts";
import { loadProgress, playerSettings } from "./game.ts";
import { createScene, type SceneEnv } from "./scene.ts";
import { levelThumbSrc, saveThumb } from "./thumbs.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

// The worlds along the top of the level select. Every level is in Classic for now; Neo is still to
// come, shown but locked.
const WORLDS: { name: string; locked: boolean }[] = [{ name: "Classic", locked: false }, { name: "Neo", locked: true }];
const worldTabs = () => h("div", { class: "world-tabs", role: "tablist" },
  ...WORLDS.map((w, i) => h("button", {
    class: i === 0 ? "world-tab active" : "world-tab", role: "tab", "aria-selected": String(i === 0), disabled: w.locked, title: w.locked ? `${w.name}: locked` : w.name,
  }, w.locked ? h("span", { class: "lock", innerHTML: LOCK_ICON }) : null, w.name)),
);
const LOCK_ICON = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="2.5" y="7" width="11" height="8" rx="2" fill="currentColor"/></svg>';
// The title in the menu buttons' frosted fill and border, the border thicker along the top. The two
// fills are masked apart so they never overlap and stack their transparency.
// The viewBox fits Orbitron Black at size 100; it needs changing with the font or the word.
const TITLE_WORD = '<text x="0" y="86" font-family="Orbitron" font-weight="900" font-size="100" letter-spacing="10">OXARE</text>';
const TITLE_SVG = `<svg viewBox="-6 6 456 86" aria-hidden="true">
  <defs><symbol id="title-word" overflow="visible">${TITLE_WORD}</symbol></defs>
  <mask id="title-fill" maskUnits="userSpaceOnUse" x="-50" y="-50" width="560" height="200"><use href="#title-word" fill="#fff"/></mask>
  <mask id="title-ring" maskUnits="userSpaceOnUse" x="-50" y="-50" width="560" height="200">
    <use href="#title-word" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <use href="#title-word" y="-3.5" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <use href="#title-word" fill="#000"/>
  </mask>
  <rect x="-50" y="-50" width="560" height="200" fill="rgba(255,255,255,0.32)" mask="url(#title-fill)"/>
  <rect x="-50" y="-50" width="560" height="200" fill="rgba(255,255,255,0.75)" mask="url(#title-ring)"/>
</svg>`;

// `admin` swaps the player's level list for the admin panel (levels, editors); Ctrl+Shift+S
// flips between them. It only hides the tools, it is not access control.
export interface MenuOpts { admin: boolean; onPlay(index: number): void; onEdit(level: Level): void; onChanged(): void; onToggleAdmin(): void }

export class Menu implements Mode {
  private ctx: Ctx;
  private env: SceneEnv;
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  private raf = 0;
  private onResize = () => this.resize();
  private onKey: (e: KeyboardEvent) => void;
  private back: (() => void) | null = null;
  private onDown: ((e: PointerEvent) => void) | null = null;

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
      else if (e.code === "Escape" && ctx.overlay.querySelector(".more-menu:not([hidden])")) this.closeMore();
      else if (e.code === "Escape" && this.back) this.back();
    };
    addEventListener("keydown", this.onKey);
    if (!opts.admin) {
      const slot = h("h1", { class: "menu-title", "aria-label": "Oxare", innerHTML: TITLE_SVG });
      // Home and options sit under the title; the level selector stands alone.
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
          worldTabs(),
          // Hidden levels are the admin's playgrounds; players see and number only the public ones.
          h("div", { class: "level-grid" },
            ...LEVELS.flatMap((l, i) => (l.hidden ? [] : [i])).map((i, n) => { const l = LEVELS[i]!; return h("button", { class: "level-card", onclick: () => opts.onPlay(i) },
              h("img", { src: levelThumbSrc(ctx.renderer, l), alt: "" }),
              h("span", { class: "name" }, `${n + 1}. ${l.name}`),
              h("span", { class: "best" }, progress[l.id] ? fmtTime(progress[l.id]!.best) : "--:--.--"),
            ); }),
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
    const card = (level: Level, label: string, sub: string, play: () => void) => {
      const more = h("div", { class: "more-menu", hidden: true },
        h("button", { onclick: () => void duplicateLevel(level) }, "Duplicate"),
        h("button", { onclick: () => void setHidden(level, !level.hidden) }, level.hidden ? "Make public" : "Make hidden"),
        h("button", { class: "delete", onclick: () => void deleteLevel(level) }, "Delete"),
      );
      return h("div", { class: level.hidden ? "level-card hidden-level" : "level-card" },
        h("button", { class: "thumb", title: "Play", onclick: play }, h("img", { src: levelThumbSrc(ctx.renderer, level), alt: "" })),
        h("span", { class: "name" }, label),
        h("span", { class: "best" }, sub),
        h("div", { class: "actions" },
          h("button", { class: "edit", onclick: () => opts.onEdit(cloneLevel(level)) }, "Edit"),
          h("button", { class: "more", title: "More", onclick: () => { const open = more.hidden; this.closeMore(); more.hidden = !open; } }, "⋯"),
          more,
        ),
      );
    };
    // Removes src/levels/<id>.json through the dev server, like the editor's Save writes it.
    const deleteLevel = async (level: Level) => {
      this.closeMore();
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
    // Rewrites the level's file public or hidden, like the editor's Save.
    const setHidden = async (level: Level, hide: boolean) => {
      this.closeMore();
      if (!import.meta.env.DEV) { alert("Changing a level's visibility only works in local dev (npm run dev)."); return; }
      const next = cloneLevel(level);
      if (hide) next.hidden = true; else delete next.hidden;
      try {
        const res = await fetch("/__level/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
        if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
        opts.onChanged();
      } catch (err) {
        alert(`Changing visibility failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    // Re-renders and saves every level's menu picture (after a change to how pieces look).
    const rebuildThumbs = async (button: HTMLButtonElement) => {
      if (!import.meta.env.DEV) { alert("Saving thumbnails only works in local dev (npm run dev)."); return; }
      button.disabled = true;
      try {
        for (const [k, level] of LEVELS.entries()) {
          button.textContent = `Thumbnails ${k + 1} / ${LEVELS.length}`;
          await saveThumb(ctx.renderer, level);
        }
        opts.onChanged();
      } catch (err) {
        alert(`Saving thumbnails failed: ${err instanceof Error ? err.message : String(err)}`);
        button.disabled = false;
        button.textContent = "Rebuild thumbnails";
      }
    };
    // Saves a copy under the next free id, like the editor's Save.
    const duplicateLevel = async (level: Level) => {
      this.closeMore();
      if (!import.meta.env.DEV) { alert("Duplicating levels only works in local dev (npm run dev)."); return; }
      const ids = new Set(LEVELS.map((l) => l.id));
      let id: string;
      if (/^\d+$/.test(level.id)) {
        const n = Math.max(...[...ids].filter((x) => /^\d+$/.test(x)).map(Number)) + 1;
        id = String(n).padStart(level.id.length, "0");
      } else {
        id = `${level.id}-copy`;
        for (let k = 2; ids.has(id); k++) id = `${level.id}-copy-${k}`;
      }
      try {
        const res = await fetch("/__level/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...cloneLevel(level), id, name: `${level.name} copy` }) });
        if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
        opts.onChanged();
      } catch (err) {
        alert(`Duplicate failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    this.onDown = (e) => { if (!(e.target as Element).closest?.(".more, .more-menu")) this.closeMore(); };
    addEventListener("pointerdown", this.onDown);
    ctx.overlay.append(
      h("div", { class: "menu" },
        worldTabs(),
        h("div", { class: "level-grid" },
          ...LEVELS.map((l, i) => card(l, `${i + 1}. ${l.name}`, l.hidden ? `${l.id}.json · hidden` : `${l.id}.json`, () => opts.onPlay(i))),
          h("button", { class: "level-card plus", title: "New level", onclick: () => opts.onEdit(blankLevel()) },
            h("span", { class: "plus-mark" }, "+"),
            h("span", { class: "name" }, "New level"),
          ),
        ),
        h("div", { class: "row", style: "display:flex;gap:10px" },
          h("button", { class: "menu-btn small", onclick: (e: Event) => void rebuildThumbs(e.currentTarget as HTMLButtonElement) }, "Rebuild thumbnails"),
          h("button", { class: "menu-btn small", onclick: () => opts.onToggleAdmin() }, "Back to levels (Ctrl+Shift+S)"),
        ),
      ),
    );
  }

  private closeMore() {
    this.ctx.overlay.querySelectorAll<HTMLElement>(".more-menu").forEach((m) => { m.hidden = true; });
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
    removeEventListener("keydown", this.onKey);
    if (this.onDown) removeEventListener("pointerdown", this.onDown);
    clear(this.ctx.overlay);
  }
}
