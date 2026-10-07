import type { Graph } from "./graph.ts";
import type { Qty } from "./types.ts";

// Goal planning: expand a pinned item into a tree of what is still missing,
// counting the inventory against each ingredient as it goes.

export interface PlanNode {
  item: number;
  recipe: number;
  need: number;
  have: number;
  deficit: number;
  crafts: number;
  status: "done" | "partial" | "missing" | "raw";
  children: PlanNode[];
  truncated?: boolean;
}

export interface Plan {
  root: PlanNode;
  nodes: number;
  truncated: boolean;
  rawTotals: Map<number, number>;
  progress: number;
}

export interface PlanOptions {
  recipeChoice?: Map<number, number>;
  maxNodes?: number;
  maxDepth?: number;
}

export function pickRecipe(g: Graph, item: number, choice?: Map<number, number>): number {
  const c = choice?.get(item);
  if (c !== undefined && g.producers[item].includes(c)) return c;
  return g.primary[item];
}

export function planGoal(g: Graph, inventory: Qty, goalItem: number, qty: number, opts: PlanOptions = {}): Plan {
  const maxNodes = opts.maxNodes ?? 4000;
  const maxDepth = opts.maxDepth ?? 64;
  let count = 0;
  let truncated = false;
  const rawTotals = new Map<number, number>();
  // Inventory is consumed as the tree walks so shared ingredients are not double counted.
  const pool = new Map<number, number>();
  for (const [id, n] of Object.entries(inventory)) {
    const i = g.itemIndex.get(id);
    if (i !== undefined && n > 0) pool.set(i, n);
  }
  const take = (item: number, want: number): number => {
    const have = pool.get(item) ?? 0;
    const used = Math.min(have, want);
    if (used > 0) pool.set(item, have - used);
    return used;
  };
  const onStack = new Set<number>();

  const expand = (item: number, need: number, depth: number): PlanNode => {
    count++;
    const have = take(item, need);
    const deficit = need - have;
    const recipe = pickRecipe(g, item, opts.recipeChoice);
    const node: PlanNode = { item, recipe, need, have, deficit, crafts: 0, status: "done", children: [] };
    if (deficit <= 0) return node;
    if (recipe < 0) {
      node.status = "raw";
      rawTotals.set(item, (rawTotals.get(item) ?? 0) + deficit);
      return node;
    }
    const outQty = g.recipeOutputs[recipe].find((o) => o.item === item)?.qty ?? 1;
    node.crafts = Math.ceil(deficit / outQty);
    node.status = have > 0 ? "partial" : "missing";
    if (onStack.has(item) || depth >= maxDepth || count >= maxNodes) {
      node.truncated = true;
      truncated = true;
      return node;
    }
    onStack.add(item);
    for (const inp of g.recipeInputs[recipe]) {
      node.children.push(expand(inp.item, inp.qty * node.crafts, depth + 1));
    }
    onStack.delete(item);
    return node;
  };

  const root = expand(goalItem, qty, 0);
  return { root, nodes: count, truncated, rawTotals, progress: progressOf(root) };
}

// Progress is weighted by the number of leaf requirements satisfied, so a half-built
// sub-assembly counts for something even when the assembly itself is at 0.
export function progressOf(node: PlanNode): number {
  const walk = (n: PlanNode): [number, number] => {
    if (n.need <= 0) return [0, 0];
    if (n.children.length === 0) return [n.have / n.need, 1];
    let got = 0;
    let total = 0;
    for (const c of n.children) {
      const [a, b] = walk(c);
      got += a;
      total += b;
    }
    const self = n.have / n.need;
    return [got * (1 - self) + total * self, total];
  };
  const [got, total] = walk(node);
  return total === 0 ? 1 : got / total;
}

// Raw material cost per single unit of each item, memoised across the graph.
// Fractional crafts are allowed here: it answers "how much copper is in a motor".
// Iterative post-order so a 10k-deep chain cannot overflow the stack.
export function rawCostPerUnit(g: Graph, item: number, cache: Map<number, Map<number, number>> = new Map(), choice?: Map<number, number>): Map<number, number> {
  const hit = cache.get(item);
  if (hit) return hit;
  const order: number[] = [];
  const state = new Map<number, number>();
  const work: [number, number][] = [[item, 0]];
  state.set(item, 1);
  while (work.length) {
    const frame = work[work.length - 1];
    const v = frame[0];
    const recipe = pickRecipe(g, v, choice);
    const ins = recipe >= 0 ? g.recipeInputs[recipe] : [];
    if (frame[1] < ins.length) {
      const w = ins[frame[1]++].item;
      if (!cache.has(w) && !state.has(w)) {
        state.set(w, 1);
        work.push([w, 0]);
      }
    } else {
      order.push(v);
      work.pop();
    }
  }
  for (const v of order) {
    if (cache.has(v)) continue;
    const out = new Map<number, number>();
    cache.set(v, out);
    const recipe = pickRecipe(g, v, choice);
    if (recipe < 0) {
      out.set(v, 1);
      continue;
    }
    const outQty = g.recipeOutputs[recipe].find((o) => o.item === v)?.qty ?? 1;
    for (const inp of g.recipeInputs[recipe]) {
      const sub = cache.get(inp.item);
      if (!sub) continue; // back-edge in a cycle: contributes nothing
      const scale = inp.qty / outQty;
      for (const [raw, q] of sub) out.set(raw, (out.get(raw) ?? 0) + q * scale);
    }
  }
  return cache.get(item)!;
}

export function maxCrafts(g: Graph, recipe: number, inventory: Qty): number {
  let n = Infinity;
  for (const inp of g.recipeInputs[recipe]) {
    const have = inventory[g.items[inp.item].id] ?? 0;
    n = Math.min(n, Math.floor(have / inp.qty));
  }
  return n === Infinity ? 0 : n;
}
