import { create } from "zustand";
import { buildGraph, type Graph } from "../engine/graph.ts";
import type { Content, ItemId, RecipeId } from "../engine/types.ts";
import { baseContent } from "../content/index.ts";
import {
  newGame, advance, applyOffline, startGather, startCraft, startFight, stop, research, setGoal, removeGoal,
  type GameState,
} from "../engine/sim.ts";

const SAVE_KEY = "crafting.save.v1";
const CONTENT_KEY = "crafting.content.v1";

export type Screen = "gather" | "fight" | "craft" | "research" | "goals" | "inventory" | "admin";

function loadContent(): { content: Content; custom: boolean } {
  try {
    const raw = localStorage.getItem(CONTENT_KEY);
    if (raw) return { content: JSON.parse(raw) as Content, custom: true };
  } catch { /* fall through */ }
  return { content: baseContent, custom: false };
}

function loadGame(g: Graph): { game: GameState; offline: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const game = JSON.parse(raw) as GameState;
      if (game.version === 1) {
        // Infinity does not survive JSON; null means forever.
        if (game.action && (game.action.remaining as unknown) === null) game.action.remaining = Infinity;
        const offline = applyOffline(g, game);
        return { game, offline };
      }
    }
  } catch { /* fall through */ }
  return { game: newGame(g), offline: 0 };
}

export interface Store {
  content: Content;
  customContent: boolean;
  graph: Graph;
  game: GameState;
  screen: Screen;
  selectedItem: ItemId | null;
  offlineReport: number | null;
  lastTick: number;

  tick(): void;
  save(): void;
  reset(): void;
  setScreen(s: Screen): void;
  select(item: ItemId | null): void;
  gather(node: string, n: number): void;
  craft(recipe: RecipeId, n: number): void;
  fight(enemy: string, n: number): void;
  stopAction(): void;
  research(tech: string): void;
  pin(item: ItemId, qty: number): void;
  unpin(item: ItemId): void;
  chooseRecipe(item: ItemId, recipe: RecipeId | null): void;
  dismissOffline(): void;
  setContent(c: Content): void;
  resetContent(): void;
  cheat(item: ItemId, n: number): void;
}

export const useStore = create<Store>((set, get) => {
  const { content, custom } = loadContent();
  const graph = buildGraph(content);
  const { game, offline } = loadGame(graph);

  const mutate = (fn: (g: Graph, s: GameState) => void) => {
    const { graph, game } = get();
    fn(graph, game);
    set({ game: { ...game } });
  };

  return {
    content,
    customContent: custom,
    graph,
    game,
    screen: "gather",
    selectedItem: null,
    offlineReport: offline > 5 ? offline : null,
    lastTick: performance.now(),

    tick() {
      const now = performance.now();
      const dt = Math.min(5, (now - get().lastTick) / 1000);
      set({ lastTick: now });
      if (dt <= 0) return;
      mutate((g, s) => advance(g, s, dt));
    },
    save() {
      const s = get().game;
      s.savedAt = Date.now();
      const json = JSON.stringify(s, (_k, v) => (v === Infinity ? null : v));
      try { localStorage.setItem(SAVE_KEY, json); } catch { /* storage full or blocked */ }
    },
    reset() {
      const g = get().graph;
      try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      set({ game: newGame(g), offlineReport: null });
    },
    setScreen: (screen) => set({ screen }),
    select: (selectedItem) => set({ selectedItem }),
    gather: (node, n) => mutate((g, s) => startGather(g, s, node, n)),
    craft: (recipe, n) => mutate((g, s) => startCraft(g, s, recipe, n)),
    fight: (enemy, n) => mutate((g, s) => startFight(g, s, enemy, n)),
    stopAction: () => mutate((_g, s) => stop(s)),
    research: (tech) => mutate((g, s) => research(g, s, tech)),
    pin: (item, qty) => mutate((_g, s) => setGoal(s, item, qty)),
    unpin: (item) => mutate((_g, s) => removeGoal(s, item)),
    chooseRecipe: (item, recipe) => mutate((_g, s) => {
      if (recipe) s.recipeChoice[item] = recipe;
      else delete s.recipeChoice[item];
    }),
    dismissOffline: () => set({ offlineReport: null }),
    setContent(c) {
      const graph = buildGraph(c);
      try { localStorage.setItem(CONTENT_KEY, JSON.stringify(c)); } catch { /* ignore */ }
      set({ content: c, graph, customContent: true });
    },
    resetContent() {
      try { localStorage.removeItem(CONTENT_KEY); } catch { /* ignore */ }
      set({ content: baseContent, graph: buildGraph(baseContent), customContent: false });
    },
    cheat: (item, n) => mutate((_g, s) => { s.inventory[item] = (s.inventory[item] ?? 0) + n; }),
  };
});

// Recipe choice map in graph indices, derived from the save's id map.
export function recipeChoiceMap(g: Graph, choice: Record<ItemId, RecipeId>): Map<number, number> {
  const m = new Map<number, number>();
  for (const [item, recipe] of Object.entries(choice)) {
    const i = g.itemIndex.get(item);
    const r = g.recipeIndex.get(recipe);
    if (i !== undefined && r !== undefined) m.set(i, r);
  }
  return m;
}

export function startLoop(): () => void {
  const timer = setInterval(() => useStore.getState().tick(), 100);
  const saver = setInterval(() => useStore.getState().save(), 5000);
  const onHide = () => { if (document.visibilityState === "hidden") useStore.getState().save(); };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("beforeunload", () => useStore.getState().save());
  return () => {
    clearInterval(timer);
    clearInterval(saver);
    document.removeEventListener("visibilitychange", onHide);
  };
}
