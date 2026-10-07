import { describe, it, expect } from "vitest";
import { buildGraph, searchItems } from "./graph.ts";
import { validate } from "./validate.ts";
import { planGoal, rawCostPerUnit, maxCrafts } from "./plan.ts";
import { newGame, advance, startGather, startCraft, startFight, research, applyOffline, FOREVER, MAX_OFFLINE_SEC } from "./sim.ts";
import { emptyContent, type Content, type Recipe, type Item } from "./types.ts";
import { baseContent } from "../content/index.ts";

function tiny(): Content {
  const c = emptyContent();
  c.skills = [{ id: "mining", name: "Mining" }];
  c.stations = [{ id: "bench", name: "Bench", tier: 0 }];
  c.techs = [{ id: "start", name: "Start", tier: 0, cost: {} }];
  c.startTechs = ["start"];
  c.items = [
    { id: "ore", name: "Ore", category: "raw", tier: 0 },
    { id: "bar", name: "Bar", category: "metal", tier: 0 },
    { id: "gear", name: "Gear", category: "part", tier: 0 },
    { id: "motor", name: "Motor", category: "part", tier: 0 },
  ];
  c.recipes = [
    { id: "bar", inputs: { ore: 2 }, outputs: { bar: 1 }, station: "bench", time: 1 },
    { id: "gear", inputs: { bar: 2 }, outputs: { gear: 2 }, station: "bench", time: 1 },
    { id: "motor", inputs: { gear: 3, bar: 1 }, outputs: { motor: 1 }, station: "bench", time: 2 },
  ];
  c.gatherNodes = [{ id: "mine", name: "Mine", skill: "mining", time: 1, drops: [{ item: "ore", min: 1, max: 1, chance: 1 }] }];
  c.goals = ["motor"];
  return c;
}

describe("graph", () => {
  it("indexes producers, consumers, depth and raw items", () => {
    const g = buildGraph(tiny());
    const ore = g.itemIndex.get("ore")!;
    const motor = g.itemIndex.get("motor")!;
    expect(g.raw[ore]).toBe(true);
    expect(g.raw[motor]).toBe(false);
    expect(g.depth[motor]).toBe(3);
    expect(g.consumers[ore]).toEqual([0]);
    expect(g.producers[motor]).toEqual([2]);
    expect(g.sources[ore].gatherNodes).toEqual([0]);
  });

  it("detects cycles and reports the recipes involved", () => {
    const c = tiny();
    c.recipes.push({ id: "undo", inputs: { motor: 1 }, outputs: { gear: 1 }, station: "bench", time: 1 });
    const g = buildGraph(c);
    expect(g.cycles.length).toBe(1);
    expect(g.cycles[0].items.map((i) => g.items[i].id).sort()).toEqual(["gear", "motor"]);
    expect(g.cycles[0].recipes.map((r) => g.recipes[r].id).sort()).toEqual(["motor", "undo"]);
    expect(validate(g).some((d) => d.code === "cycle")).toBe(true);
  });

  it("ignores recipes tagged recycle when looking for cycles", () => {
    const c = tiny();
    c.recipes.push({ id: "undo", inputs: { motor: 1 }, outputs: { gear: 1 }, station: "bench", time: 1, tags: ["recycle"] });
    const g = buildGraph(c);
    expect(g.cycles.length).toBe(0);
    expect(g.primary[g.itemIndex.get("gear")!]).toBe(1);
  });

  it("detects a self loop", () => {
    const c = tiny();
    c.recipes.push({ id: "loop", inputs: { bar: 1 }, outputs: { bar: 2 }, station: "bench", time: 1 });
    const g = buildGraph(c);
    expect(g.cycles.length).toBe(1);
  });

  it("reports unknown references and items without a source", () => {
    const c = tiny();
    c.recipes[0].inputs = { nothing: 1 };
    c.items.push({ id: "orphan", name: "Orphan", category: "x", tier: 0 });
    const d = validate(buildGraph(c));
    expect(d.some((x) => x.code === "unknown-ref" && x.id === "bar")).toBe(true);
    expect(d.some((x) => x.code === "no-source" && x.id === "orphan")).toBe(true);
  });

  it("searches by prefix first", () => {
    const g = buildGraph(baseContent);
    const hits = searchItems(g, "iron").map((i) => g.items[i].id);
    expect(hits[0]).toBe("iron_ore");
    expect(hits).toContain("bog_iron");
  });
});

describe("plan", () => {
  it("computes deficits against inventory without double counting shared items", () => {
    const g = buildGraph(tiny());
    const motor = g.itemIndex.get("motor")!;
    const p = planGoal(g, { bar: 2, ore: 4 }, motor, 1);
    expect(p.root.deficit).toBe(1);
    const gear = p.root.children.find((c) => g.items[c.item].id === "gear")!;
    expect(gear.need).toBe(3);
    expect(gear.crafts).toBe(2);
    const barUnderGear = gear.children[0];
    expect(barUnderGear.need).toBe(4);
    expect(barUnderGear.have).toBe(2);
    const barDirect = p.root.children.find((c) => g.items[c.item].id === "bar")!;
    expect(barDirect.have).toBe(0);
    expect(p.rawTotals.get(g.itemIndex.get("ore")!)).toBe(2);
    expect(p.progress).toBeGreaterThan(0);
    expect(p.progress).toBeLessThan(1);
  });

  it("raw cost per unit allows fractional crafts", () => {
    const g = buildGraph(tiny());
    const cost = rawCostPerUnit(g, g.itemIndex.get("motor")!);
    expect(cost.get(g.itemIndex.get("ore")!)).toBeCloseTo(3 * 2 + 2);
  });

  it("terminates on cyclic content", () => {
    const c = tiny();
    c.recipes.push({ id: "undo", inputs: { motor: 1 }, outputs: { gear: 1 }, station: "bench", time: 1 });
    const g = buildGraph(c);
    const p = planGoal(g, {}, g.itemIndex.get("motor")!, 1);
    expect(p.nodes).toBeGreaterThan(0);
    rawCostPerUnit(g, g.itemIndex.get("motor")!);
  });

  it("maxCrafts", () => {
    const g = buildGraph(tiny());
    expect(maxCrafts(g, 0, { ore: 7 })).toBe(3);
    expect(maxCrafts(g, 2, { gear: 6 })).toBe(0);
  });
});

describe("sim", () => {
  it("gathers, crafts and stops at the count", () => {
    const g = buildGraph(tiny());
    const s = newGame(g, 1);
    expect(startGather(g, s, "mine", 5)).toBe(true);
    advance(g, s, 4.5);
    expect(s.inventory.ore).toBe(4);
    expect(s.action?.kind).toBe("gather");
    advance(g, s, 10);
    expect(s.inventory.ore).toBe(5);
    expect(s.action).toBeNull();
    expect(startCraft(g, s, "bar", FOREVER)).toBe(true);
    advance(g, s, 100);
    expect(s.inventory.bar).toBe(2);
    expect(s.inventory.ore).toBe(1);
    expect(s.action).toBeNull();
  });

  it("fights, loots and retreats on knockout", () => {
    const g = buildGraph(baseContent);
    const s = newGame(g, 7);
    expect(startFight(g, s, "slime", 3)).toBe(true);
    advance(g, s, 60);
    expect(s.inventory.slime_gel).toBeGreaterThanOrEqual(3);
    expect(s.stats.kills.slime).toBe(3);
    expect(s.action).toBeNull();
    expect(startFight(g, s, "cave_guardian", 1)).toBe(false);
    s.techs.push("cave_expedition");
    expect(startFight(g, s, "cave_guardian", 1)).toBe(true);
    advance(g, s, 9);
    expect(s.player.hp).toBe(0);
    expect(s.stats.deaths).toBe(1);
    expect(s.action).toBeNull();
    advance(g, s, 100);
    expect(s.player.hp).toBe(s.player.maxHp);
  });

  it("research consumes cost and gates recipes", () => {
    const g = buildGraph(baseContent);
    const s = newGame(g, 3);
    expect(research(g, s, "smelting")).toBe(false);
    s.inventory = { stone: 20, clay_crucible: 2, copper_ore: 12, coal: 5 };
    expect(research(g, s, "smelting")).toBe(true);
    expect(s.inventory.stone).toBeUndefined();
    expect(startCraft(g, s, "copper_bar", 1)).toBe(true);
  });

  it("offline progress is capped", () => {
    const g = buildGraph(tiny());
    const s = newGame(g, 1);
    startGather(g, s, "mine", FOREVER);
    s.savedAt = Date.now() - 48 * 3600 * 1000;
    const elapsed = applyOffline(g, s);
    expect(elapsed).toBe(MAX_OFFLINE_SEC);
    expect(s.inventory.ore).toBe(MAX_OFFLINE_SEC);
  });
});

describe("scale", () => {
  it("builds and validates 10k recipes quickly", () => {
    const c = tiny();
    const N = 10_000;
    const items: Item[] = [];
    const recipes: Recipe[] = [];
    for (let i = 0; i < N; i++) {
      items.push({ id: `i${i}`, name: `Item ${i}`, category: "x", tier: 0 });
      const inputs: Record<string, number> = {};
      if (i === 0) inputs.ore = 1;
      else {
        inputs[`i${i - 1}`] = 2;
        if (i > 10) inputs[`i${i - 7}`] = 1;
        if (i % 3 === 0) inputs[`i${Math.floor(i / 2)}`] = 1;
      }
      recipes.push({ id: `r${i}`, inputs, outputs: { [`i${i}`]: 1 }, station: "bench", time: 1 });
    }
    c.items.push(...items);
    c.recipes.push(...recipes);
    c.goals = [`i${N - 1}`];
    const t0 = performance.now();
    const g = buildGraph(c);
    const d = validate(g);
    const build = performance.now() - t0;
    expect(g.cycles.length).toBe(0);
    expect(g.depth[g.itemIndex.get(`i${N - 1}`)!]).toBe(N);
    expect(d.filter((x) => x.severity === "error").length).toBe(0);
    expect(build).toBeLessThan(2000);
    const t1 = performance.now();
    const p = planGoal(g, {}, g.itemIndex.get("i50")!, 1);
    expect(performance.now() - t1).toBeLessThan(500);
    expect(p.truncated).toBe(true);
    const cost = rawCostPerUnit(g, g.itemIndex.get(`i${N - 1}`)!);
    expect(cost.size).toBe(1);
  });
});
