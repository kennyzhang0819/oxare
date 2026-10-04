import * as THREE from "three";
import "@fontsource/fredoka/500.css";
import "@fontsource/fredoka/600.css";
import "@fontsource/fredoka/700.css";
import "@fontsource/nunito/500.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/jetbrains-mono/500.css";
import "./style.css";
import { Editor } from "./editor.ts";
import { Game } from "./game.ts";
import { LEVELS, refreshLevels } from "./levels/index.ts";
import { Loading, nextFrame } from "./loading.ts";
import { Menu } from "./menu.ts";
import { loadThumbIndex } from "./thumbs.ts";
import { loadTuning } from "./tuning.ts";
import { h } from "./ui.ts";
import { applyUiScale } from "./uiscale.ts";
import { worldOf, type Level } from "./level.ts";

export interface Ctx { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; overlay: HTMLElement }
// `ready` resolves once the mode has drawn its first frame; the splash covers the switch until then.
export interface Mode { dispose(): void; ready?: Promise<void> }

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const ctx: Ctx = { renderer, canvas, overlay };
applyUiScale();

loadTuning();

let mode: Mode | null = null;
let switching = 0;
function show(next: () => Mode) {
  mode?.dispose();
  mode = next();
}

// A level or the editor takes a moment to build; this paints a splash first so the click shows at once.
function showSlow(next: () => Mode) {
  mode?.dispose();
  mode = null;
  const splash = h("div", { class: "loading splash" }, h("div", { class: "bar" }, h("div", { class: "fill" })), h("div", { class: "status" }, "Loading"));
  overlay.append(splash);
  const token = ++switching;
  void nextFrame().then(nextFrame).then(() => {
    if (token !== switching) { splash.remove(); return; }
    mode = next();
    overlay.append(splash);
    void (mode.ready ?? Promise.resolve()).then(() => splash.remove());
  });
}

// Levels have no drafts: only what Save wrote to disk exists. Clears what older builds kept.
try { localStorage.removeItem("balling.draft"); } catch { /* nothing kept */ }

let admin = false;
// The menu always reads the level files fresh first.
function menu() {
  void Promise.all([refreshLevels(), loadThumbIndex()]).then(() => show(() => new Menu(ctx, { admin, onPlay: playLevel, onEdit: edit, onChanged: menu, onToggleAdmin: () => { admin = !admin; menu(); } })));
}

function playLevel(i: number) {
  const level = LEVELS[i];
  if (!level) return show(() => new Loading(ctx, menu));
  // Next is the next level in the same world; a player's skips hidden ones, the admin panel's does not.
  const next = LEVELS.findIndex((l, k) => k > i && worldOf(l) === worldOf(level) && (admin || !l.hidden));
  showSlow(() => new Game(ctx, level, {
    admin,
    onExit: menu,
    onRetry: () => playLevel(i),
    onNext: next >= 0 ? () => playLevel(next) : undefined,
  }));
}

function edit(level: Level, file: string | null) {
  showSlow(() => new Editor(ctx, level, {
    file,
    onExit: menu,
    onPlay: (l, from, f) => showSlow(() => new Game(ctx, l, { onExit: () => edit(l, f), onRetry: () => edit(l, f), from, admin: true })),
  }));
}

// No browser context menu ("Save image as..." on the canvas); text fields keep theirs.
addEventListener("contextmenu", (e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); });
addEventListener("dragstart", (e) => e.preventDefault());

show(() => new Loading(ctx, menu));
