# Crafting

A Melvor-shaped idle game where the crafting graph is the game. Three branches feed one graph: gathering gives bulk, combat gives the scarce stuff, support systems transform it, and every big craft reaches back into all three. This is the vertical slice: one milestone craft (the Steam Generator) that bottoms out into ore, wood, fiber and monster parts through 57 recipes.

```
npm install
npm run dev        # http://localhost:5174
npm run check      # typecheck + content validation + engine tests
npm run validate   # content validation only (fails on errors; use it in CI)
npm run build
```

## Layout

```
src/engine/   pure TypeScript, no React, no DOM. Runs in Node for scripts and tests.
  types.ts      content schema (Item, Recipe, Station, Tech, GatherNode, Enemy)
  graph.ts      buildGraph(): dense-index compiled graph, producers/consumers, Tarjan cycles, depth
  plan.ts       planGoal(): recursive deficit tree against inventory; rawCostPerUnit(); maxCrafts()
  validate.ts   diagnostics: cycles, no-source, unused, unknown refs, tier mismatches, bad numbers
  sim.ts        GameState and advance(dt): gathering, crafting, combat, research, offline catch-up
src/content/  JSON only. items, recipes, stations, techs, gather, enemies, meta (skills, start techs, goals)
src/game/     Zustand store: game loop (100ms tick), autosave (localStorage), content overlay
src/ui/       the player screens: Gather, Fight, Craft, Research, Goals, Inventory, item drawer
src/admin/    the content editor
scripts/      validate.ts (CLI), import-content.ts (bundle -> src/content files)
```

## Engine notes

**Compiled graph.** `buildGraph` maps every id to an integer once. Recipe inputs/outputs, producers and consumers are arrays of integers. Everything downstream (planning, validation, search, UI) reads arrays, never scans the content lists. Rebuilding for 10k recipes takes a few milliseconds; the test suite checks it stays under two seconds including validation.

**Cycles.** Tarjan's SCC over the item graph (input item -> output item through a recipe). Any component bigger than one node, or a self-loop, is reported with the recipes involved. Recipes tagged `"recycle"` (dismantling, melting down) are left out of cycle detection and are never picked as a primary recipe, so recycling loops are allowed without breaking planning. All graph walks are iterative, so a 10k-deep chain can't overflow the stack.

**Planning.** `planGoal` expands a pinned item into a tree. Inventory is drawn down as the walk goes, so a shared ingredient is not counted twice. Each node has need/have/deficit/crafts and a status (done, partial, missing, raw). Alternate producers are chosen per item in the Goals screen and stored in the save. `rawCostPerUnit` is the memoised fractional bill of materials, shown in the item drawer and the admin inspector. Trees are capped (4000 nodes, depth 64) and flagged `truncated` rather than hanging.

**Simulation.** `advance(graph, state, dt)` is pure and loops in whole action steps, so a 100ms tick and an 8-hour offline catch-up go through the same code. Gear is implicit: the best weapon, armor and toolkit in the inventory count. Gather nodes gate on tool tier; enemies, recipes and stations gate on techs.

## Content

Every id is a lowercase slug. A recipe:

```json
{"id":"steel_bar","inputs":{"iron_bar":2,"coal":2,"flux":1},"outputs":{"steel_bar":2},"station":"blast_furnace","time":6,"unlock":"advanced_smelting"}
```

Tiers are a design-lint signal, not a mechanic: the validator warns when a tier 0 item needs tier 2 tech, when a recipe consumes something more than one tier above its output, and so on. Items with `equip` are gear. `meta.json` lists skills, start techs and the goals the Goals screen offers to pin.

## Admin workflow

The Admin tab edits the live content. Changes are saved to the browser and apply to the running game at once, with diagnostics recomputed on every save. Use it to:

- add or edit any entity with a form or raw JSON;
- type a chain like `Copper Ore -> Concentrate -> Matte -> Blister Copper` to create the items and 1:1 recipes in one go, then tune quantities;
- read the diagnostics panel (click one to jump to the entity) and the per-item graph view (depth, sources, consumers, raw cost);
- give yourself items for testing (`+10`, `+100`).

To ship edits: `export` downloads `content.json`; `npm run import-content -- ~/Downloads/content.json` splits it into `src/content/*.json`; `npm run validate` must be clean before you commit. `reset` discards local edits and returns to the shipped files.
