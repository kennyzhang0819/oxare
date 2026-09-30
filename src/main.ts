import * as THREE from "three";
import "./style.css";
import { Editor } from "./editor.ts";
import { Game } from "./game.ts";
import { LEVELS } from "./levels/index.ts";
import { Menu } from "./menu.ts";
import { initPhysics } from "./sim.ts";
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
void initPhysics();

let mode: Mode | null = null;
function show(next: () => Mode) {
  mode?.dispose();
  mode = next();
}

function menu() {
  show(() => new Menu(ctx, { onPlay: playLevel, onEdit: edit }));
}

function playLevel(i: number) {
  const level = LEVELS[i];
  if (!level) return menu();
  show(() => new Game(ctx, level, {
    onExit: menu,
    onRetry: () => playLevel(i),
    onNext: LEVELS[i + 1] ? () => playLevel(i + 1) : undefined,
  }));
}

function edit(level: Level) {
  show(() => new Editor(ctx, level, {
    onExit: menu,
    onPlay: (l) => show(() => new Game(ctx, l, { onExit: () => edit(l), onRetry: () => edit(l) })),
  }));
}

menu();
