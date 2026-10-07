import type { Graph } from "./graph.ts";
import type { Qty, ItemId, RecipeId, GatherNodeId, EnemyId, Item, Drop } from "./types.ts";

// Game simulation. Pure functions over GameState so the loop, offline catch-up
// and tests all go through the same `advance`.

export type Action =
  | { kind: "gather"; node: GatherNodeId; progress: number; remaining: number }
  | { kind: "craft"; recipe: RecipeId; progress: number; remaining: number }
  | { kind: "fight"; enemy: EnemyId; enemyHp: number; playerTimer: number; enemyTimer: number; remaining: number };

export const FOREVER = Number.POSITIVE_INFINITY;

export interface LogEntry {
  t: number;
  text: string;
  kind: "gain" | "loss" | "info" | "danger";
}

export interface GameState {
  version: 1;
  inventory: Qty;
  techs: string[];
  action: Action | null;
  player: { hp: number; maxHp: number };
  goals: { item: ItemId; qty: number }[];
  recipeChoice: Record<ItemId, RecipeId>;
  log: LogEntry[];
  stats: { crafted: Qty; gathered: Qty; kills: Record<EnemyId, number>; deaths: number; playTime: number };
  seed: number;
  savedAt: number;
}

export const BASE_HP = 20;
export const BASE_ATTACK = 1;
export const PLAYER_SWING = 1.5;
export const REGEN_PER_SEC = 0.5;
export const MAX_OFFLINE_SEC = 8 * 3600;
export const LOG_LIMIT = 60;

export function newGame(g: Graph, seed = Date.now() >>> 0): GameState {
  const s: GameState = {
    version: 1,
    inventory: {},
    techs: [...(g.content.startTechs ?? [])],
    action: null,
    player: { hp: BASE_HP, maxHp: BASE_HP },
    goals: [],
    recipeChoice: {},
    log: [],
    stats: { crafted: {}, gathered: {}, kills: {}, deaths: 0, playTime: 0 },
    seed,
    savedAt: Date.now(),
  };
  s.player.maxHp = maxHp(g, s);
  return s;
}

// mulberry32: tiny, seedable, good enough for loot.
function rand(s: GameState): number {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function add(inv: Qty, id: ItemId, n: number): void {
  const v = (inv[id] ?? 0) + n;
  if (v <= 0) delete inv[id];
  else inv[id] = v;
}

export function has(inv: Qty, cost: Qty): boolean {
  for (const [id, n] of Object.entries(cost)) if ((inv[id] ?? 0) < n) return false;
  return true;
}

function log(s: GameState, text: string, kind: LogEntry["kind"] = "info"): void {
  s.log.push({ t: s.stats.playTime, text, kind });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

// Equipment is implicit: the best item of each slot in the inventory counts.
export function bestEquip(g: Graph, inv: Qty, slot: "weapon" | "armor" | "tool"): Item | undefined {
  let best: Item | undefined;
  let score = -1;
  for (const id of Object.keys(inv)) {
    const i = g.itemIndex.get(id);
    if (i === undefined) continue;
    const it = g.items[i];
    const e = it.equip;
    if (!e || e.slot !== slot) continue;
    const v = (e.attack ?? 0) + (e.defense ?? 0) + (e.hp ?? 0) + (e.toolTier ?? 0) * 10;
    if (v > score) {
      score = v;
      best = it;
    }
  }
  return best;
}

export function playerAttack(g: Graph, s: GameState): number {
  return BASE_ATTACK + (bestEquip(g, s.inventory, "weapon")?.equip?.attack ?? 0);
}
export function playerDefense(g: Graph, s: GameState): number {
  return bestEquip(g, s.inventory, "armor")?.equip?.defense ?? 0;
}
export function maxHp(g: Graph, s: GameState): number {
  return BASE_HP + (bestEquip(g, s.inventory, "armor")?.equip?.hp ?? 0);
}
export function toolTier(g: Graph, s: GameState): number {
  return bestEquip(g, s.inventory, "tool")?.equip?.toolTier ?? 0;
}

export function techUnlocked(s: GameState, tech?: string): boolean {
  return !tech || s.techs.includes(tech);
}

export function recipeAvailable(g: Graph, s: GameState, ri: number): { ok: boolean; why?: string } {
  const r = g.recipes[ri];
  if (!techUnlocked(s, r.unlock)) return { ok: false, why: `Requires ${g.techIndex.get(r.unlock!)?.name ?? r.unlock}` };
  const st = g.stationIndex.get(r.station);
  if (st && !techUnlocked(s, st.unlock)) return { ok: false, why: `Requires ${st.name}` };
  return { ok: true };
}

export function gatherAvailable(g: Graph, s: GameState, id: GatherNodeId): { ok: boolean; why?: string } {
  const n = g.gatherIndex.get(id);
  if (!n) return { ok: false, why: "Unknown node" };
  if (!techUnlocked(s, n.unlock)) return { ok: false, why: `Requires ${g.techIndex.get(n.unlock!)?.name ?? n.unlock}` };
  if ((n.toolTier ?? 0) > toolTier(g, s)) return { ok: false, why: `Needs a tier ${n.toolTier} tool` };
  return { ok: true };
}

export function enemyAvailable(g: Graph, s: GameState, id: EnemyId): { ok: boolean; why?: string } {
  const e = g.enemyIndex.get(id);
  if (!e) return { ok: false, why: "Unknown enemy" };
  if (!techUnlocked(s, e.unlock)) return { ok: false, why: `Requires ${g.techIndex.get(e.unlock!)?.name ?? e.unlock}` };
  return { ok: true };
}

export function techAvailable(g: Graph, s: GameState, id: string): { ok: boolean; why?: string } {
  const t = g.techIndex.get(id);
  if (!t) return { ok: false, why: "Unknown tech" };
  if (s.techs.includes(id)) return { ok: false, why: "Researched" };
  for (const req of t.requires ?? []) if (!s.techs.includes(req)) return { ok: false, why: `Requires ${g.techIndex.get(req)?.name ?? req}` };
  if (!has(s.inventory, t.cost)) return { ok: false, why: "Missing materials" };
  return { ok: true };
}

export function research(g: Graph, s: GameState, id: string): boolean {
  if (!techAvailable(g, s, id).ok) return false;
  const t = g.techIndex.get(id)!;
  for (const [item, n] of Object.entries(t.cost)) add(s.inventory, item, -n);
  s.techs.push(id);
  log(s, `Researched ${t.name}`, "info");
  return true;
}

export function startGather(g: Graph, s: GameState, node: GatherNodeId, remaining: number): boolean {
  if (!gatherAvailable(g, s, node).ok) return false;
  s.action = { kind: "gather", node, progress: 0, remaining };
  return true;
}

export function startCraft(g: Graph, s: GameState, recipe: RecipeId, remaining: number): boolean {
  const ri = g.recipeIndex.get(recipe);
  if (ri === undefined || !recipeAvailable(g, s, ri).ok) return false;
  if (!has(s.inventory, g.recipes[ri].inputs)) return false;
  s.action = { kind: "craft", recipe, progress: 0, remaining };
  return true;
}

export function startFight(g: Graph, s: GameState, enemy: EnemyId, remaining: number): boolean {
  if (!enemyAvailable(g, s, enemy).ok) return false;
  if (s.player.hp <= 1) return false;
  const e = g.enemyIndex.get(enemy)!;
  s.action = { kind: "fight", enemy, enemyHp: e.hp, playerTimer: 0, enemyTimer: 0, remaining };
  return true;
}

export function stop(s: GameState): void {
  s.action = null;
}

function rollDrops(s: GameState, drops: Drop[], into: Qty, stat: Qty): string[] {
  const gained: string[] = [];
  for (const d of drops) {
    if (rand(s) > d.chance) continue;
    const n = d.min + Math.floor(rand(s) * (d.max - d.min + 1));
    if (n <= 0) continue;
    add(into, d.item, n);
    add(stat, d.item, n);
    gained.push(`${d.item}:${n}`);
  }
  return gained;
}

function nameOf(g: Graph, id: ItemId): string {
  const i = g.itemIndex.get(id);
  return i === undefined ? id : g.items[i].name;
}

function describeGains(g: Graph, gained: string[]): string {
  return gained.map((x) => {
    const [id, n] = x.split(":");
    return `+${n} ${nameOf(g, id)}`;
  }).join(", ");
}

// Advance the world by dt seconds. Bounded loop so a huge offline dt cannot hang.
export function advance(g: Graph, s: GameState, dt: number): void {
  let budget = 200_000;
  let left = dt;
  s.stats.playTime += dt;
  s.player.maxHp = maxHp(g, s);
  while (left > 0 && budget-- > 0) {
    const a = s.action;
    if (!a) {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + REGEN_PER_SEC * left);
      return;
    }
    if (a.kind === "gather") {
      const node = g.gatherIndex.get(a.node);
      if (!node || !gatherAvailable(g, s, a.node).ok) {
        s.action = null;
        continue;
      }
      const step = Math.min(left, node.time - a.progress);
      a.progress += step;
      left -= step;
      if (a.progress >= node.time - 1e-9) {
        a.progress = 0;
        const gained = rollDrops(s, node.drops, s.inventory, s.stats.gathered);
        if (gained.length) log(s, describeGains(g, gained), "gain");
        if (--a.remaining <= 0) s.action = null;
      }
    } else if (a.kind === "craft") {
      const ri = g.recipeIndex.get(a.recipe);
      if (ri === undefined || !recipeAvailable(g, s, ri).ok || !has(s.inventory, g.recipes[ri].inputs)) {
        s.action = null;
        continue;
      }
      const r = g.recipes[ri];
      const step = Math.min(left, r.time - a.progress);
      a.progress += step;
      left -= step;
      if (a.progress >= r.time - 1e-9) {
        a.progress = 0;
        for (const [id, n] of Object.entries(r.inputs)) add(s.inventory, id, -n);
        const gained: string[] = [];
        for (const [id, n] of Object.entries(r.outputs)) {
          add(s.inventory, id, n);
          add(s.stats.crafted, id, n);
          gained.push(`${id}:${n}`);
        }
        log(s, describeGains(g, gained), "gain");
        if (--a.remaining <= 0) s.action = null;
      }
    } else {
      const e = g.enemyIndex.get(a.enemy);
      if (!e || !enemyAvailable(g, s, a.enemy).ok) {
        s.action = null;
        continue;
      }
      const atk = Math.max(1, playerAttack(g, s) - e.defense);
      const eatk = Math.max(1, e.attack - playerDefense(g, s));
      const toPlayerHit = PLAYER_SWING - a.playerTimer;
      const toEnemyHit = e.speed - a.enemyTimer;
      const step = Math.min(left, toPlayerHit, toEnemyHit);
      a.playerTimer += step;
      a.enemyTimer += step;
      left -= step;
      if (a.playerTimer >= PLAYER_SWING - 1e-9) {
        a.playerTimer = 0;
        a.enemyHp -= atk;
        if (a.enemyHp <= 0) {
          s.stats.kills[e.id] = (s.stats.kills[e.id] ?? 0) + 1;
          const gained = rollDrops(s, e.drops, s.inventory, s.stats.gathered);
          log(s, `Defeated ${e.name}${gained.length ? ": " + describeGains(g, gained) : ""}`, "gain");
          a.enemyHp = e.hp;
          a.enemyTimer = 0;
          if (--a.remaining <= 0) s.action = null;
          continue;
        }
      }
      if (a.enemyTimer >= e.speed - 1e-9) {
        a.enemyTimer = 0;
        s.player.hp -= eatk;
        if (s.player.hp <= 0) {
          s.player.hp = 0;
          s.stats.deaths++;
          s.action = null;
          log(s, `Knocked out by ${e.name}. Retreating to recover.`, "danger");
        }
      }
    }
  }
}

export function applyOffline(g: Graph, s: GameState, now = Date.now()): number {
  const elapsed = Math.min(MAX_OFFLINE_SEC, Math.max(0, (now - s.savedAt) / 1000));
  if (elapsed > 1) advance(g, s, elapsed);
  s.savedAt = now;
  return elapsed;
}

export function setGoal(s: GameState, item: ItemId, qty: number): void {
  const existing = s.goals.find((x) => x.item === item);
  if (existing) existing.qty = qty;
  else s.goals.push({ item, qty });
}

export function removeGoal(s: GameState, item: ItemId): void {
  s.goals = s.goals.filter((x) => x.item !== item);
}
