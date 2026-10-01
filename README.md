# Oxare

A ball-rolling puzzle game in the sky, in the spirit of Aerox. TypeScript, Vite, Three.js, Rapier.

```
npm install
npm run dev      # http://localhost:5173
npm run check    # typecheck + headless physics check of every level
npm run build    # static bundle in dist/
```

## Controls

Aerox-style: left / right swings the camera around the ball, up / down rolls it toward or away from the camera.
Keyboard arrows or WASD, mouse drag to look around, touch drag as a virtual stick, or device tilt (enable it on the menu; iOS asks for permission).
In a level: `T` opens the feel-tuning panel (gravity, throttle, speed cap, damping, tilt range, camera), `R` respawns, `Esc` returns to the menu.
Tuning values persist in the browser; the panel's Copy button gives them as JSON to paste into `src/tuning.ts`.

## Levels

Each level is a JSON file in `src/levels/`, picked up automatically and listed in file-name order. A level is a list of pieces:

| type      | fields                                   | notes |
|-----------|------------------------------------------|-------|
| `start`   | x y z                                    | one per level: a low round pad (radius 1.3, height 0.22) the ball spawns on top of |
| `goal`    | x y z r                                  | one per level: a disc with a beam of light 40 units tall; touching the beam anywhere, airborne included, ends the level |
| `slab`    | x y z w d rot tilt fences{n,e,s,w}       | flat platform, top surface at y, fences on local sides before rotation; `tilt` (degrees about the local x axis, pivoting on the centre) leans it, 90 stands it up as a wall |
| `curve`   | x y z inner outer rot fences{inner,outer,a,b} | 90° annulus around (x, z), sweeping from local +x to local -z; `a` and `b` fence the two ends |
| `ramp`    | x y z w d rot rise fences{e,w}           | level landing, S-curve climb through the middle half, level landing: from height y at local +z to y + rise layers at local -z; `rise` may be negative |
| `bridge`  | x y z w d rot                            | hanging plank bridge, `d` long along local z and `w` wide, slung between the platform edges at its two ends; `y` is the top of those platforms and the hinge line sits 0.36 below it, at the upper light line of the edge strip, so the planks meet the bottom of the platform lip. One hinged plank per cell; the planks are free bodies that sag and swing under the ball |
| `plank`   | x y z w h rot                            | knock-down plank: a panel `w` wide, `h` tall and 0.3 thick standing straight up on the surface at y, hinged along its bottom edge at (x, z) with local x along the hinge. It holds still until anything touches it, then topples under physics (toward local -z when pushed from +z) and lies across the gap as a crossing. Make `h` at least half a cell longer than the gap so the tip lands on the far platform rather than its rounded edge |
| `block`   | x y z w h d rot                          | obstacle sitting on a surface at y |
| `blockade` | x y z rot                               | fixed 3×1.5×3 panelled crate on a surface at y |
| `pillar`  | x y z                                    | fixed cylinder column, radius 0.7, height 2.2, on a surface at y |
| `barrier` | x y z rot                                | fixed 4×1.4×0.5 blocker on a surface at y; the visible pod on its two legs is 3 wide, the collider still spans the full 4 |
| `crate`   | x y z rot s                              | pushable cube of side `s` (default 1.2), a free body under gravity; returns home if it falls off |
| `hole`    | x y z w d rot                            | opening cut through the slab whose top is at y, rimmed with the edge strip; keep it 0.5 from the slab edge |
| `spinner` | x y z length speed                       | rotating bar, speed in rad/s |

`rot` is degrees about the vertical axis.

### Units

| axis | 1 unit is | notes |
|------|-----------|-------|
| x, z | one placement-grid cell | lane width 10; platforms snap to 0.5, structures and holes to 1; ball diameter 1.1 |
| y    | one platform thickness, which is one height layer | platforms sit on whole numbers and stack when one is a layer above another; the ball stands 1.1 tall; a ramp rises `rise` layers, 4 by default; fences are 0.9 tall, blockades 1.5, pillars 2.2 |

The editor snaps platform, bridge and plank `y` to a layer (PgUp/PgDn or E/Q step one layer, or type into the y field) and structures take their `y` from the platform under them. R turns the selection 90° about the vertical axis; T tilts a slab 90° about its own x axis. A tilted slab is solid on every face but is not part of the welded rolling floor, so it has no rounded lip, is skipped by the overlap check, and cannot carry holes or structures. Structures (`block`, `blockade`, `pillar`) snap to a 1-unit grid in the editor and drop onto the platform beneath them; the grid is drawn whenever a structure is selected. Slabs and curves may touch along an edge but must not overlap; the editor paints overlapping platforms red and lists them under problems, and `npm run check` rejects levels that have any. Use the in-game editor (Edit on the menu) to lay a level out and press Save or Ctrl+S. ▶ Play runs from the start pad; ▶ Here (or P) arms a ghost ball that follows the cursor over any upward surface, and a click plays from that spot, facing the way the editor camera looks (Esc cancels): in `npm run dev` that writes `src/levels/<id>.json` directly, replacing the level with that id. There is no access control yet.
