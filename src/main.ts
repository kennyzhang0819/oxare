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
import { LEVELS } from "./levels/index.ts";
import { Loading } from "./loading.ts";
import { Menu } from "./menu.ts";
import { loadTuning } from "./tuning.ts";
import type { Level } from "./level.ts";

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

let admin = false;
function menu() {
  show(() => new Menu(ctx, { admin, onPlay: playLevel, onEdit: edit, onToggleAdmin: () => { admin = !admin; menu(); } }));
}

function playLevel(i: number) {
  const level = LEVELS[i];
  if (!level) return show(() => new Loading(ctx, menu));
  show(() => new Game(ctx, level, {
    admin,
    onExit: menu,
    onRetry: () => playLevel(i),
    onNext: LEVELS[i + 1] ? () => playLevel(i + 1) : undefined,
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
