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
In a level: `T` opens the feel-tuning panel (gravity, throttle, speed cap, damping, tilt range, camera, and the gravity scale shared by movable props: crates, bridge planks and knock-down planks), `R` respawns, `Esc` returns to the menu.
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
| `plank`   | x y z w h rot                            | knock-down plank: a panel `w` wide, `h` tall and 0.3 thick standing straight up on the surface at y, on a hinge through the middle of its base at (x, z), running along local x and held 0.16 above the surface in a yoke at each side. It is a free body like a crate with its base pinned: it holds still until anything touches it, then follows the push over, in either direction, and lies flat as a crossing; it can stand mid-platform too. Make `h` at least half a cell longer than the gap so the tip lands on the far platform rather than its rounded edge. **Every plank must be pushed back 0.5 tiles from the platform's border**: put its hinge 0.5 in from the edge it stands on, never on the edge itself |
| `support` | x y z w h rot                            | three pillars standing against a platform's side wall and carrying a platform `h` layers above (4 by default). Put (x, z) on the lower platform's edge at its top surface `y`, with local +z pointing out past the edge: the pillars sit just outside it, spread over `w`, from below the lower platform up to the upper platform's underside at y + h - 1. Each pillar stands half a unit off the lower platform's wall and its foot bends inward into that wall; the dark slotted face looks inward. The stems are solid |
| `kicker`  | x y z w d h rot                          | small solid wedge ramp on a platform: `w` wide, rising `h` over `d` toward local -z (defaults 3, 3, 1, an 18° slope), white with a dark slatted tread and orange side strips. Snaps like a structure; keep the slope gentle so the ball rolls up rather than bouncing off the front edge |
| `block`   | x y z w h d rot                          | obstacle sitting on a surface at y |
| `blockade` | x y z rot                               | fixed 3×1.5×3 panelled crate on a surface at y |
| `pillar`  | x y z                                    | fixed cylinder column, radius 0.7, height 2.2, on a surface at y |
| `barrier` | x y z rot                                | fixed 3×1.4×0.5 pod on two legs, standing on a surface at y; its collider is exactly the pod |
| `crate`   | x y z w h d rot                          | pushable box `w` × `h` × `d` (each default 1.2; an older `s` sets all three), a free body under gravity resting on the surface at y; returns home if it falls off |
| `hole`    | x y z w d rot                            | opening cut through the slab whose top is at y, rimmed with the edge strip; keep it 0.5 from the slab edge |
| `spinner` | x y z length speed                       | rotating bar, speed in rad/s |

`rot` is degrees about the vertical axis.

### Units

| axis | 1 unit is | notes |
|------|-----------|-------|
| x, z | one placement-grid cell | new pieces are sized in multiples of 4, the standard look-right unit: a new slab is 8 wide and 16 long, a new curve 8 wide; lane width 8; in the editor platforms snap to 0.5 and structures and holes to 1 by default (change either with the Platform snap and Structure snap pickers); ball diameter 1.1 |
| y    | one platform thickness, which is one height layer | platforms sit on whole numbers and stack when one is a layer above another; the ball stands 1.1 tall; a ramp rises `rise` layers, 4 by default; fences are 0.9 tall, blockades 1.5, pillars 2.2 |

The editor snaps platform, bridge and plank `y` to a layer (PgUp/PgDn or E/Q step one layer, or type into the y field) and structures take their `y` from the platform under them. R turns the selection 90° about the vertical axis; T tilts a slab 90° about its own x axis. A tilted slab is solid on every face but is not part of the welded rolling floor, so it has no rounded lip, is skipped by the overlap check, and cannot carry holes or structures. Structures (`block`, `blockade`, `pillar`) snap to the structure grid in the editor (1 unit unless changed with Structure snap) and drop onto the platform beneath them; the grid is drawn whenever a structure is selected. Slabs and curves may touch along an edge but must not overlap; the editor paints overlapping platforms red and lists them under problems, and `npm run check` rejects levels that have any. Use the in-game editor (Edit on the menu) to lay a level out and press Save or Ctrl+S. ▶ Play runs from the start pad; ▶ Here (or P) arms a ghost ball that follows the cursor over any upward surface, and a click plays from that spot, facing the way the editor camera looks (Esc cancels): in `npm run dev` that writes `src/levels/<id>.json` directly, replacing the level with that id. There is no access control yet.
