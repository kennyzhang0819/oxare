# Platforms, holes and the physics floor

How slabs, curves and ramps are shaped, drawn and made solid. Code: `src/platform.ts` (drawing), `src/floor.ts` (physics floor), `src/poly.ts` (shape maths).

## Edge profile

Every platform edge has the same profile, top and bottom, so a platform looks the same flipped:

- a rounded white lip, 0.45 wide and 0.28 tall (`PLATFORM_EDGE_INSET`, `PLATFORM_EDGE_DROP`)
- a thin grey border line just inside the lip
- the wall between the two lips, carrying the cyan edge strip

Seen from above, outside corners are rounded. Inside corners (a hole's corners, or the corner of a notch) are rounded too, the other way.

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
- Both meshes are zero-thickness shells that only push from their front face, so every platform is also filled with solid convex hulls from its underside to 0.03 below its surface, chamfered under the lip. The ball never touches them while rolling, but if it ever reaches the corner where a wall meets the lip, the solid pushes it back out instead of letting it in. `check.ts` fires balls at raised slab, holed slab, curve and ramp edges to prove nothing gets inside.

`npm run check` checks that seams stay shallow, curves stay flat, and that the ball falls through holes and notches but rolls past them.
