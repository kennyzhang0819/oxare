import * as THREE from "three";
import { cloneLevel, WORLDS, worldOf, type Level, type World } from "./level.ts";
import { LEVELS } from "./levels/index.ts";
import { blankLevel } from "./editor.ts";
import { loadProgress, playerSettings } from "./game.ts";
import { createScene, type SceneEnv } from "./scene.ts";
import { levelThumbSrc, saveThumb } from "./thumbs.ts";
import { clear, fmtTime, h } from "./ui.ts";
import type { Ctx, Mode } from "./main.ts";

// Worlds players can't open yet: shown with a lock. The admin panel opens every world.
const LOCKED: World[] = [];
// The world tab open, kept while the menu is rebuilt.
let tab: World = "classic";
// The level select: back, world tabs and tools in a bar along the top with the view switch and pager
// under them, and one page of levels scrolling below. Only the page shown is built, pictures included.
const VIEW_KEY = "balling.levelView";
const PAGE_SIZE = { grid: 24, list: 50 };
type View = keyof typeof PAGE_SIZE;
let view: View = "grid";
try { if (localStorage.getItem(VIEW_KEY) === "list") view = "list"; } catch { /* grid */ }
// The first level of the page shown, kept while the menu is rebuilt (after a duplicate or delete) and across a view switch.
let first = 0;
const GRID_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>';
const LIST_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="1.2"/><rect x="1" y="6.5" width="14" height="3" rx="1.2"/><rect x="1" y="11" width="14" height="3" rx="1.2"/></svg>';
// `levels` lists the LEVELS indices shown in a world; `item` draws one of them, `n` its number there.
interface Browse { admin: boolean; start: HTMLElement[]; end: HTMLElement[]; levels(world: World): number[]; item(i: number, n: number, view: View): HTMLElement }
const levelSelect = (b: Browse) => {
  const tabs = h("div", { class: "world-tabs", role: "tablist" }), tools = h("div", { class: "level-tools" }), scroll = h("div", { class: "level-scroll" });
  const locked = (w: World) => !b.admin && LOCKED.includes(w);
  if (locked(tab)) tab = "classic";
  let shown = b.levels(tab);
  const pages = () => Math.max(1, Math.ceil(shown.length / PAGE_SIZE[view]));
  const go = (page: number) => { first = Math.max(0, Math.min(pages() - 1, page)) * PAGE_SIZE[view]; render(); scroll.scrollTop = 0; };
  const render = () => {
    shown = b.levels(tab);
    tabs.replaceChildren(...WORLDS.map((w) => h("button", {
      class: w.id === tab ? "world-tab active" : "world-tab", role: "tab", "aria-selected": String(w.id === tab), disabled: locked(w.id), title: locked(w.id) ? `${w.name}: locked` : w.name,
      onclick: () => { if (w.id !== tab) { tab = w.id; first = 0; render(); scroll.scrollTop = 0; } },
    }, locked(w.id) ? h("span", { class: "lock", innerHTML: LOCK_ICON }) : null, w.name)));
    const count = shown.length;
    const size = PAGE_SIZE[view], last = pages() - 1, page = Math.min(Math.floor(first / size), last), from = page * size, to = Math.min(count, from + size);
    const at = h("input", { type: "number", min: 1, max: last + 1, value: page + 1, title: "Go to page", onchange: () => go(Number(at.value) - 1) }) as HTMLInputElement;
    const pick = (v: View, label: string, icon: string) => h("button", { class: v === view ? "active" : "", "aria-pressed": String(v === view), title: `${label} view`,
      onclick: () => { view = v; try { localStorage.setItem(VIEW_KEY, v); } catch { /* this visit only */ } render(); } }, h("span", { class: "icon", innerHTML: icon }), label);
    tools.replaceChildren(
      h("div", { class: "view-toggle" }, pick("grid", "Grid", GRID_ICON), pick("list", "List", LIST_ICON)),
      h("span", { class: "count" }, count ? `${from + 1}–${to} of ${count}` : "No levels yet"),
      ...(last > 0 ? [h("div", { class: "pager" },
        h("button", { title: "First page", disabled: page === 0, onclick: () => go(0) }, "«"),
        h("button", { title: "Previous page (←)", disabled: page === 0, onclick: () => go(page - 1) }, "‹"),
        h("label", {}, "Page", at, `of ${last + 1}`),
        h("button", { title: "Next page (→)", disabled: page === last, onclick: () => go(page + 1) }, "›"),
        h("button", { title: "Last page", disabled: page === last, onclick: () => go(last) }, "»"),
      )] : []),
    );
    const items = h("div", { class: view === "grid" ? "level-grid" : "level-list" });
    for (let k = from; k < to; k++) items.append(b.item(shown[k]!, k + 1, view));
    scroll.replaceChildren(items);
  };
  render();
  return {
    el: h("div", { class: "level-select" }, h("div", { class: "level-top" }, h("div", { class: "start" }, ...b.start), tabs, h("div", { class: "end" }, ...b.end), tools), scroll),
    turn: (by: number) => go(Math.floor(first / PAGE_SIZE[view]) + by),
  };
};
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
  private turnPage: ((by: number) => void) | null = null;
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
      else if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && this.turnPage && !(e.target instanceof HTMLInputElement)) this.turnPage(e.code === "ArrowLeft" ? -1 : 1);
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
        this.turnPage = null;
        body.replaceChildren(...children);
      };
      const home = () => show(true, null,
        h("div", { class: "menu-actions" },
          h("button", { class: "menu-btn primary", onclick: levels }, "Start"),
          h("button", { class: "menu-btn", onclick: options }, "Options"),
        ));
      const levels = () => {
        const progress = loadProgress();
        // Hidden levels are the admin's playgrounds; players see and number only the public ones.
        const select = levelSelect({ admin: false, start: [h("button", { class: "menu-btn small", onclick: home }, "Back")], end: [],
          levels: (w) => LEVELS.flatMap((l, i) => (l.hidden || worldOf(l) !== w ? [] : [i])), item: (i, n, v) => {
          const l = LEVELS[i]!;
          return h("button", { class: v === "grid" ? "level-card" : "level-row", onclick: () => opts.onPlay(i) },
            h("img", { src: levelThumbSrc(ctx.renderer, l), alt: "", loading: "lazy" }),
            h("span", { class: "name" }, `${n}. ${l.name}`),
            h("span", { class: "best" }, progress[l.id] ? fmtTime(progress[l.id]!.best) : "--:--.--"),
          );
        } });
        show(false, home, select.el);
        this.turnPage = select.turn;
      };
      const options = () => show(true, home,
        h("div", { class: "card options" }, h("h2", {}, "Options"), playerSettings()),
        h("button", { class: "menu-btn small", onclick: home }, "Back"),
      );
      home();
      return;
    }
    const card = (level: Level, label: string, sub: string, play: () => void, v: View) => {
      const more = h("div", { class: "more-menu", hidden: true },
        h("button", { onclick: () => void duplicateLevel(level) }, "Duplicate"),        h("button", { onclick: () => void rewrite(level, (l) => { if (l.hidden) delete l.hidden; else l.hidden = true; }, "Changing visibility") }, level.hidden ? "Make public" : "Make hidden"),
        ...WORLDS.filter((w) => w.id !== worldOf(level)).map((w) => h("button", { onclick: () => void rewrite(level, (l) => { if (w.id === "classic") delete l.world; else l.world = w.id; }, "Moving the level") }, `Move to ${w.name}`)),
        h("button", { class: "delete", onclick: () => void deleteLevel(level) }, "Delete"),
      );
      return h("div", { class: `${v === "grid" ? "level-card" : "level-row"}${level.hidden ? " hidden-level" : ""}` },
        h("button", { class: "thumb", title: "Play", onclick: play }, h("img", { src: levelThumbSrc(ctx.renderer, level), alt: "", loading: "lazy" })),
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
    // Rewrites the level's file with `change` made (public or hidden, its world), like the editor's Save.
    const rewrite = async (level: Level, change: (next: Level) => void, what: string) => {
      this.closeMore();
      if (!import.meta.env.DEV) { alert(`${what} only works in local dev (npm run dev).`); return; }
      const next = cloneLevel(level);
      change(next);
      try {
        const res = await fetch("/__level/save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
        if (!res.ok) throw new Error(await res.text() || `${res.status} ${res.statusText}`);
        opts.onChanged();
      } catch (err) {
        alert(`${what} failed: ${err instanceof Error ? err.message : String(err)}`);
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
        button.textContent = "Rebuild thumbs";
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
    const select = levelSelect({
      admin: true,
      start: [h("button", { class: "menu-btn small", title: "Back to the player's levels (Ctrl+Shift+S)", onclick: () => opts.onToggleAdmin() }, "Back")],
      end: [
        h("button", { class: "menu-btn small primary", title: "Start a blank level in the editor", onclick: () => opts.onEdit({ ...blankLevel(), ...(tab !== "classic" ? { world: tab } : {}) }) }, "+ New level"),
        h("button", { class: "menu-btn small", title: "Re-render and save every level's menu picture", onclick: (e: Event) => void rebuildThumbs(e.currentTarget as HTMLButtonElement) }, "Rebuild thumbs"),
      ],
      levels: (w) => LEVELS.flatMap((l, i) => (worldOf(l) === w ? [i] : [])),
      item: (i, n, v) => { const l = LEVELS[i]!; return card(l, `${n}. ${l.name}`, l.hidden ? `${l.id}.json · hidden` : `${l.id}.json`, () => opts.onPlay(i), v); },
    });
    this.turnPage = select.turn;
    ctx.overlay.append(h("div", { class: "menu" }, select.el));
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
