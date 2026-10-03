# Platforms, holes and the physics floor

How slabs, curves and ramps are shaped, drawn and made solid. Code: `src/platform.ts` (drawing), `src/floor.ts` (physics floor), `src/poly.ts` (shape maths).

## Edge profile

Every platform edge has the same profile, top and bottom, so a platform looks the same flipped:

- a rounded white lip, 0.45 wide and 0.28 tall (`PLATFORM_EDGE_INSET`, `PLATFORM_EDGE_DROP`)
- a thin grey border line just inside the lip
- the wall between the two lips, carrying the cyan edge strip

Seen from above, outside corners are rounded. Inside corners (a hole's corners, or the corner of a notch) are rounded too, the other way.

## Curves

A curve is drawn as a straight strip laid along its centre line (`curveStrip` in `src/level.ts`): 2 straight (`CURVE_STRAIGHT`), the arc, then 2 straight again. The straights keep each end's rounded corners square to the end instead of leaning with the arc, and the strip's long edges break exactly where the straights meet the arc. The footprint, the physics floor and the fence rails follow the same layout.

## Holes

A hole is a cutout. Each slab whose top is at the hole's `y` becomes its outline minus every hole on it. Everything left over gets the edge profile above, so:

- a hole inside a slab is a rounded opening with the full rim
- a hole across a slab edge notches the slab, and the notch's rim joins the outer rim
- overlapping holes merge into one opening
- a hole across a seam cuts both slabs

Holes are free-form, so they can carve a slab into any shape. Two limits:

- An edge facing a gap narrower than about 1 (two lips) gets a thinner lip, so the rims from each side don't cross.
- Pieces left over that are smaller than 1×1 are dropped.

In play a hole draws nothing itself. In the editor it shows a faint cyan footprint so it can be seen and clicked.

Curves, ramps and tilted slabs are never cut.

## Physics floor

The ball rolls on one welded triangle mesh built from every platform top (`floorMesh`). Separate boxes per platform would make the ball hop at every join.

- Joins weld only where the corner points of the two pieces land on the same spot, so keep piece edges on the 0.5 grid.
- An open edge (nothing next to it, including a hole's edge) has the same rounded lip as the visuals, so the ball rolls off it.
- Where two pieces meet, the lip is only a tiny dip (`PLATFORM_SEAM_DROP`, 0.015) so the ball keeps its speed. The visuals still show the full groove.
- Under the top there is a second mesh with the side walls and underside, so a ball below or beside a platform hits it.
- A treadmill is in the floor as its frame only: a slab top with its opening cut out, the opening's edge dropping square with no lip. Its rods are their own spinning bodies.
- Both meshes are zero-thickness shells that only push from their front face, so every platform is also filled with solid convex hulls from its underside to 0.03 below its surface, chamfered under the lip. The ball never touches them while rolling, but if it ever reaches the corner where a wall meets the lip, the solid pushes it back out instead of letting it in. `check.ts` fires balls at raised slab, holed slab, curve and ramp edges to prove nothing gets inside.

`npm run check` checks that seams stay shallow, curves stay flat, and that the ball falls through holes and notches but rolls past them.

## Shaped slabs

A slab with `shape` has its sides moved: each side's two ends pushed out or pulled in, and its middle bowed out or in on a smooth curve (a quadratic through its ends). A bowed side is sampled about every 1 unit (`SHAPE_STEP`) into a polygon, and from there a shaped slab is handled exactly like a slab carved by holes: the drawn mesh, the lip, the physics floor and the fences all take the polygon. So:

- a straight side (no bow) is one edge, and welds to a neighbour whose edge lands on it, so a slab can run 6 wide into 10 wide and join a 6-wide platform at one end and a 10-wide one at the other
- a bowed side is an open edge with the full lip, however close another platform comes
- the footprint used for overlaps, snapping and `surfaceAt` is the polygon's triangles
- a fence on a bowed side follows it, bending at every sample
- an inward bow is concave, so its solid is built per triangle like a holed slab's

A shaped slab is otherwise a plain slab: no tilt, roll, twist, treadmill or movement, and every end must stay at least 1 across.

## Twisted slabs

A slab with `twist` is in the welded floor like any other, laid as a grid of small quads (half a unit along it, one across) over its rolled top, so each quad is nearly flat and the creases between their triangles are too small for the ball to feel. Its flat end welds to the platform before it. The solid under each quad is built per triangle (as under a holed slab), since a convex hull over a warped quad's corners would bulge up through the rolling surface.
