import * as THREE from "three";
import "@fontsource/orbitron/700.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/jetbrains-mono/500.css";
import "./style.css";
import { Editor } from "./editor.ts";
import { Game } from "./game.ts";
import { LEVELS, refreshLevels } from "./levels/index.ts";
import { Loading } from "./loading.ts";
import { Menu } from "./menu.ts";
import { loadThumbIndex } from "./thumbs.ts";
import { loadTuning } from "./tuning.ts";
import { worldOf, type Level } from "./level.ts";

export interface Ctx { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement; overlay: HTMLElement }
export interface Mode { dispose(): void }

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const ctx: Ctx = { renderer, canvas, overlay };

loadTuning();

let mode: Mode | null = null;
function show(next: () => Mode) {
  mode?.dispose();
  mode = next();
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
  show(() => new Game(ctx, level, {
    admin,
    onExit: menu,
    onRetry: () => playLevel(i),
    onNext: next >= 0 ? () => playLevel(next) : undefined,
  }));
}

function edit(level: Level) {
  show(() => new Editor(ctx, level, {
    onExit: menu,
    onPlay: (l, from) => show(() => new Game(ctx, l, { onExit: () => edit(l), onRetry: () => edit(l), from, admin: true })),
  }));
}

// No browser context menu ("Save image as..." on the canvas); text fields keep theirs.
addEventListener("contextmenu", (e) => { if (!(e.target instanceof HTMLInputElement)) e.preventDefault(); });
addEventListener("dragstart", (e) => e.preventDefault());

show(() => new Loading(ctx, menu));
