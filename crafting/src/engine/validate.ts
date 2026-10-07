import type { Graph } from "./graph.ts";

// Content diagnostics for the admin editor and the CLI validator.

export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  kind: "item" | "recipe" | "station" | "tech" | "gather" | "enemy" | "content";
  id: string;
}

export function validate(g: Graph): Diagnostic[] {
  const out: Diagnostic[] = [];
  const c = g.content;
  const push = (severity: Severity, code: string, kind: Diagnostic["kind"], id: string, message: string) =>
    out.push({ severity, code, kind, id, message });

  const dupes = (kind: Diagnostic["kind"], list: { id: string }[]) => {
    const seen = new Set<string>();
    for (const x of list) {
      if (seen.has(x.id)) push("error", "duplicate-id", kind, x.id, `Duplicate ${kind} id "${x.id}"`);
      seen.add(x.id);
      if (!/^[a-z0-9_]+$/.test(x.id)) push("error", "bad-id", kind, x.id, `Id "${x.id}" must be lowercase letters, digits and underscores`);
    }
  };
  dupes("item", c.items);
  dupes("recipe", c.recipes);
  dupes("station", c.stations);
  dupes("tech", c.techs);
  dupes("gather", c.gatherNodes);
  dupes("enemy", c.enemies);

  for (const u of g.unknownRefs) push("error", "unknown-ref", u.kind, u.id, `${u.kind} "${u.id}" ${u.field} references unknown "${u.ref}"`);

  for (const cyc of g.cycles) {
    const names = cyc.items.map((i) => g.items[i].name).join(" → ");
    for (const ri of cyc.recipes) push("error", "cycle", "recipe", g.recipes[ri].id, `Recipe cycle: ${names} (tag a recipe "recycle" to exclude it from planning)`);
  }

  const goals = new Set(c.goals ?? []);
  const techUnlocksStation = new Set(c.stations.map((s) => s.unlock).filter(Boolean));

  g.items.forEach((it, i) => {
    const s = g.sources[i];
    const hasSource = s.recipes.length + s.gatherNodes.length + s.enemies.length > 0;
    if (!hasSource) push("error", "no-source", "item", it.id, `"${it.name}" has no acquisition source (no recipe, gather node or enemy drop)`);
    const usedByRecipe = g.consumers[i].length > 0;
    const usedByTech = c.techs.some((t) => it.id in t.cost);
    const usedAsEquip = !!it.equip;
    if (!usedByRecipe && !usedByTech && !usedAsEquip && !goals.has(it.id)) push("warn", "unused", "item", it.id, `"${it.name}" is used by 0 recipes, techs or goals`);
    if (g.depth[i] >= 30) push("info", "deep", "item", it.id, `"${it.name}" has recipe depth ${g.depth[i]}`);
    if (it.tier < 0 || !Number.isInteger(it.tier)) push("error", "bad-tier", "item", it.id, `"${it.name}" tier must be a non-negative integer`);
  });

  g.recipes.forEach((r, ri) => {
    if (g.recipeOutputs[ri].length === 0) push("error", "no-output", "recipe", r.id, `Recipe "${r.id}" produces nothing`);
    if (g.recipeInputs[ri].length === 0 && !r.tags?.includes("free")) push("warn", "no-input", "recipe", r.id, `Recipe "${r.id}" has no inputs`);
    if (!(r.time > 0)) push("error", "bad-time", "recipe", r.id, `Recipe "${r.id}" time must be > 0`);
    for (const [id, q] of [...Object.entries(r.inputs), ...Object.entries(r.outputs)]) {
      if (!(q > 0) || !Number.isInteger(q)) push("error", "bad-qty", "recipe", r.id, `Recipe "${r.id}" quantity for "${id}" must be a positive integer`);
    }
    for (const inp of g.recipeInputs[ri]) if (g.recipeOutputs[ri].some((o) => o.item === inp.item)) push("warn", "self-ref", "recipe", r.id, `Recipe "${r.id}" consumes and produces "${g.items[inp.item].name}"`);
    const tech = r.unlock ? g.techIndex.get(r.unlock) : undefined;
    const station = g.stationIndex.get(r.station);
    for (const o of g.recipeOutputs[ri]) {
      const it = g.items[o.item];
      if (tech && it.tier < tech.tier) push("warn", "tier-mismatch", "recipe", r.id, `Tier ${it.tier} item "${it.name}" requires tier ${tech.tier} technology "${tech.name}"`);
      if (station && station.tier > it.tier) push("warn", "tier-mismatch", "recipe", r.id, `Tier ${it.tier} item "${it.name}" is made at tier ${station.tier} station "${station.name}"`);
      for (const inp of g.recipeInputs[ri]) {
        const ii = g.items[inp.item];
        if (ii.tier > it.tier + 1) push("warn", "tier-inversion", "recipe", r.id, `"${it.name}" (tier ${it.tier}) consumes higher-tier "${ii.name}" (tier ${ii.tier})`);
      }
    }
  });

  for (const s of c.stations) {
    if (!c.recipes.some((r) => r.station === s.id)) push("warn", "unused-station", "station", s.id, `Station "${s.name}" has no recipes`);
    if (s.unlock && !techUnlocksStation.has(s.unlock)) { /* unreachable, kept for symmetry */ }
  }

  // Tech graph: cycles and unreachable techs.
  const techState = new Map<string, number>();
  const visit = (id: string, trail: string[]): void => {
    const st = techState.get(id);
    if (st === 2) return;
    if (st === 1) {
      push("error", "tech-cycle", "tech", id, `Technology cycle: ${[...trail, id].join(" → ")}`);
      return;
    }
    techState.set(id, 1);
    const t = g.techIndex.get(id);
    for (const req of t?.requires ?? []) if (g.techIndex.has(req)) visit(req, [...trail, id]);
    techState.set(id, 2);
  };
  for (const t of c.techs) visit(t.id, []);
  for (const t of c.techs) {
    for (const req of t.requires ?? []) {
      const r = g.techIndex.get(req);
      if (r && r.tier > t.tier) push("warn", "tier-mismatch", "tech", t.id, `Tier ${t.tier} tech "${t.name}" requires tier ${r.tier} tech "${r.name}"`);
    }
  }
  const start = new Set(c.startTechs ?? []);
  for (const t of c.techs) if (!start.has(t.id) && Object.keys(t.cost).length === 0) push("warn", "free-tech", "tech", t.id, `Tech "${t.name}" costs nothing and is not a start tech`);

  for (const gn of c.gatherNodes) {
    if (!(gn.time > 0)) push("error", "bad-time", "gather", gn.id, `Gather node "${gn.id}" time must be > 0`);
    if (!c.skills.some((s) => s.id === gn.skill)) push("error", "unknown-ref", "gather", gn.id, `Gather node "${gn.id}" references unknown skill "${gn.skill}"`);
    for (const d of gn.drops) if (d.chance <= 0 || d.chance > 1 || d.min > d.max || d.min < 0) push("error", "bad-drop", "gather", gn.id, `Gather node "${gn.id}" drop "${d.item}" has bad chance/range`);
  }
  for (const e of c.enemies) {
    if (!(e.hp > 0) || !(e.speed > 0)) push("error", "bad-stats", "enemy", e.id, `Enemy "${e.id}" needs hp > 0 and speed > 0`);
    for (const d of e.drops) if (d.chance <= 0 || d.chance > 1 || d.min > d.max || d.min < 0) push("error", "bad-drop", "enemy", e.id, `Enemy "${e.id}" drop "${d.item}" has bad chance/range`);
  }
  for (const gid of c.goals ?? []) if (!g.itemIndex.has(gid)) push("error", "unknown-ref", "content", "goals", `Goal references unknown item "${gid}"`);
  for (const tid of c.startTechs ?? []) if (!g.techIndex.has(tid)) push("error", "unknown-ref", "content", "startTechs", `Start tech "${tid}" is unknown`);

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || a.code.localeCompare(b.code));
}

export function summarize(d: Diagnostic[]): { errors: number; warnings: number; infos: number } {
  return {
    errors: d.filter((x) => x.severity === "error").length,
    warnings: d.filter((x) => x.severity === "warn").length,
    infos: d.filter((x) => x.severity === "info").length,
  };
}
