import type { Content, Item, Recipe, ItemId, RecipeId, Enemy, GatherNode, Tech, Station } from "./types.ts";
import { RECYCLE_TAG } from "./types.ts";

// Compiled graph: every id becomes a dense index so hot paths touch only arrays.
// Build once per content version; everything else reads from it.

export interface ItemSources {
  recipes: number[];
  gatherNodes: number[];
  enemies: number[];
}

export interface Graph {
  content: Content;
  items: Item[];
  recipes: Recipe[];
  itemIndex: Map<ItemId, number>;
  recipeIndex: Map<RecipeId, number>;
  techIndex: Map<string, Tech>;
  stationIndex: Map<string, Station>;
  enemyIndex: Map<string, Enemy>;
  gatherIndex: Map<string, GatherNode>;
  recipeInputs: { item: number; qty: number }[][];
  recipeOutputs: { item: number; qty: number }[][];
  recipeIsRecycle: boolean[];
  producers: number[][];
  consumers: number[][];
  sources: ItemSources[];
  primary: Int32Array;
  depth: Int32Array;
  raw: boolean[];
  cycles: Cycle[];
  inCycle: boolean[];
  unknownRefs: UnknownRef[];
  searchKeys: string[];
}

export interface Cycle {
  items: number[];
  recipes: number[];
}

export interface UnknownRef {
  kind: "recipe" | "gather" | "enemy" | "tech" | "station";
  id: string;
  field: string;
  ref: string;
}

export function buildGraph(content: Content): Graph {
  const items = content.items;
  const recipes = content.recipes;
  const itemIndex = new Map<ItemId, number>();
  items.forEach((it, i) => itemIndex.set(it.id, i));
  const recipeIndex = new Map<RecipeId, number>();
  recipes.forEach((r, i) => recipeIndex.set(r.id, i));
  const techIndex = new Map(content.techs.map((t) => [t.id, t]));
  const stationIndex = new Map(content.stations.map((s) => [s.id, s]));
  const enemyIndex = new Map(content.enemies.map((e) => [e.id, e]));
  const gatherIndex = new Map(content.gatherNodes.map((g) => [g.id, g]));
  const unknownRefs: UnknownRef[] = [];

  const n = items.length;
  const producers: number[][] = Array.from({ length: n }, () => []);
  const consumers: number[][] = Array.from({ length: n }, () => []);
  const sources: ItemSources[] = Array.from({ length: n }, () => ({ recipes: [], gatherNodes: [], enemies: [] }));
  const recipeInputs: { item: number; qty: number }[][] = [];
  const recipeOutputs: { item: number; qty: number }[][] = [];
  const recipeIsRecycle: boolean[] = [];

  const resolve = (kind: UnknownRef["kind"], id: string, field: string, ref: string): number => {
    const idx = itemIndex.get(ref);
    if (idx === undefined) {
      unknownRefs.push({ kind, id, field, ref });
      return -1;
    }
    return idx;
  };

  recipes.forEach((r, ri) => {
    const ins: { item: number; qty: number }[] = [];
    const outs: { item: number; qty: number }[] = [];
    for (const [id, qty] of Object.entries(r.inputs)) {
      const i = resolve("recipe", r.id, "inputs", id);
      if (i >= 0) {
        ins.push({ item: i, qty });
        consumers[i].push(ri);
      }
    }
    for (const [id, qty] of Object.entries(r.outputs)) {
      const i = resolve("recipe", r.id, "outputs", id);
      if (i >= 0) {
        outs.push({ item: i, qty });
        producers[i].push(ri);
        sources[i].recipes.push(ri);
      }
    }
    recipeInputs.push(ins);
    recipeOutputs.push(outs);
    recipeIsRecycle.push(!!r.tags?.includes(RECYCLE_TAG));
    if (r.unlock && !techIndex.has(r.unlock)) unknownRefs.push({ kind: "recipe", id: r.id, field: "unlock", ref: r.unlock });
    if (!stationIndex.has(r.station)) unknownRefs.push({ kind: "recipe", id: r.id, field: "station", ref: r.station });
  });

  content.gatherNodes.forEach((g, gi) => {
    for (const d of g.drops) {
      const i = resolve("gather", g.id, "drops", d.item);
      if (i >= 0) sources[i].gatherNodes.push(gi);
    }
    if (g.unlock && !techIndex.has(g.unlock)) unknownRefs.push({ kind: "gather", id: g.id, field: "unlock", ref: g.unlock });
  });
  content.enemies.forEach((e, ei) => {
    for (const d of e.drops) {
      const i = resolve("enemy", e.id, "drops", d.item);
      if (i >= 0) sources[i].enemies.push(ei);
    }
    if (e.unlock && !techIndex.has(e.unlock)) unknownRefs.push({ kind: "enemy", id: e.id, field: "unlock", ref: e.unlock });
  });
  content.techs.forEach((t) => {
    for (const id of Object.keys(t.cost)) resolve("tech", t.id, "cost", id);
    for (const req of t.requires ?? []) if (!techIndex.has(req)) unknownRefs.push({ kind: "tech", id: t.id, field: "requires", ref: req });
  });
  content.stations.forEach((s) => {
    if (s.unlock && !techIndex.has(s.unlock)) unknownRefs.push({ kind: "station", id: s.id, field: "unlock", ref: s.unlock });
  });

  // Primary recipe: the first non-recycle producer. Players can override per item at plan time.
  const primary = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const p = producers[i].find((ri) => !recipeIsRecycle[ri]);
    primary[i] = p ?? producers[i][0] ?? -1;
  }
  const raw = items.map((_, i) => primary[i] < 0);

  const cycles = findCycles(n, recipeInputs, recipeOutputs, recipeIsRecycle);
  const inCycle = new Array<boolean>(n).fill(false);
  for (const c of cycles) for (const i of c.items) inCycle[i] = true;

  const depth = computeDepth(n, primary, recipeInputs);
  const searchKeys = items.map((it) => `${it.name} ${it.id} ${it.category}`.toLowerCase());

  return {
    content, items, recipes, itemIndex, recipeIndex, techIndex, stationIndex, enemyIndex, gatherIndex,
    recipeInputs, recipeOutputs, recipeIsRecycle, producers, consumers, sources, primary, depth, raw,
    cycles, inCycle, unknownRefs, searchKeys,
  };
}

// Tarjan SCC over the item graph. Edge: input item -> output item through a
// non-recycle recipe. Any SCC larger than one node, or a self-loop, is a cycle.
export function findCycles(
  n: number,
  recipeInputs: { item: number }[][],
  recipeOutputs: { item: number }[][],
  recipeIsRecycle: boolean[],
): Cycle[] {
  const adj: number[][] = Array.from({ length: n }, () => []);
  const edgeRecipe: Map<number, number[]> = new Map();
  for (let ri = 0; ri < recipeInputs.length; ri++) {
    if (recipeIsRecycle[ri]) continue;
    for (const a of recipeInputs[ri]) {
      for (const b of recipeOutputs[ri]) {
        adj[a.item].push(b.item);
        const key = a.item * n + b.item;
        const list = edgeRecipe.get(key);
        if (list) list.push(ri);
        else edgeRecipe.set(key, [ri]);
      }
    }
  }
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack: number[] = [];
  let counter = 0;
  const sccs: number[][] = [];
  // Iterative Tarjan so a 10k-deep chain cannot blow the call stack.
  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    const work: [number, number][] = [[root, 0]];
    index[root] = low[root] = counter++;
    stack.push(root);
    onStack[root] = 1;
    while (work.length) {
      const frame = work[work.length - 1];
      const v = frame[0];
      if (frame[1] < adj[v].length) {
        const w = adj[v][frame[1]++];
        if (index[w] === -1) {
          index[w] = low[w] = counter++;
          stack.push(w);
          onStack[w] = 1;
          work.push([w, 0]);
        } else if (onStack[w]) {
          low[v] = Math.min(low[v], index[w]);
        }
      } else {
        work.pop();
        if (work.length) {
          const u = work[work.length - 1][0];
          low[u] = Math.min(low[u], low[v]);
        }
        if (low[v] === index[v]) {
          const scc: number[] = [];
          let w: number;
          do {
            w = stack.pop()!;
            onStack[w] = 0;
            scc.push(w);
          } while (w !== v);
          sccs.push(scc);
        }
      }
    }
  }
  const cycles: Cycle[] = [];
  for (const scc of sccs) {
    const selfLoop = scc.length === 1 && adj[scc[0]].includes(scc[0]);
    if (scc.length === 1 && !selfLoop) continue;
    const members = new Set(scc);
    const recipes = new Set<number>();
    for (const a of scc) for (const b of adj[a]) if (members.has(b)) for (const ri of edgeRecipe.get(a * n + b) ?? []) recipes.add(ri);
    cycles.push({ items: scc.sort((x, y) => x - y), recipes: [...recipes].sort((x, y) => x - y) });
  }
  return cycles;
}

// Depth = longest chain of primary recipes down to a raw item. Back-edges count as 0.
function computeDepth(n: number, primary: Int32Array, recipeInputs: { item: number }[][]): Int32Array {
  const depth = new Int32Array(n).fill(-1);
  const state = new Uint8Array(n); // 0 new, 1 visiting, 2 done
  for (let root = 0; root < n; root++) {
    if (state[root] === 2) continue;
    const work: [number, number][] = [[root, 0]];
    state[root] = 1;
    while (work.length) {
      const frame = work[work.length - 1];
      const v = frame[0];
      const ri = primary[v];
      const ins = ri >= 0 ? recipeInputs[ri] : [];
      if (frame[1] < ins.length) {
        const w = ins[frame[1]++].item;
        if (state[w] === 0) {
          state[w] = 1;
          work.push([w, 0]);
        }
      } else {
        let d = 0;
        for (const inp of ins) if (state[inp.item] === 2) d = Math.max(d, depth[inp.item] + 1);
        depth[v] = d;
        state[v] = 2;
        work.pop();
      }
    }
  }
  return depth;
}

export function itemIdx(g: Graph, id: ItemId): number {
  const i = g.itemIndex.get(id);
  if (i === undefined) throw new Error(`unknown item ${id}`);
  return i;
}

export function searchItems(g: Graph, query: string, limit = 50): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: number[] = [];
  const keys = g.searchKeys;
  for (let i = 0; i < keys.length && out.length < limit; i++) if (keys[i].startsWith(q)) out.push(i);
  for (let i = 0; i < keys.length && out.length < limit; i++) if (!keys[i].startsWith(q) && keys[i].includes(q)) out.push(i);
  return out;
}
