# Platforms, holes and the physics floor

How slabs, curves and ramps are shaped, drawn and made solid. Code: `src/platform.ts` (drawing), `src/floor.ts` (physics floor), `src/poly.ts` (shape maths).

## Edge profile

Every platform edge has the same profile, top and bottom, so a platform looks the same flipped:

- a rounded white lip, 0.45 wide and 0.28 tall (`PLATFORM_EDGE_INSET`, `PLATFORM_EDGE_DROP`)
- a thin grey border line just inside the lip
- the wall between the two lips, carrying the cyan edge strip

## Joins

Where two platforms meet at the same height there is no seam: that edge has no lip or border, the top runs flat right to it, and its corners are square, so the two tops read as one. The joined spans come from the physics floor (`platformSeams` in `src/floor.ts`, the edges two tops share once each is split at the other's corners), carried into each piece's own frame and handed to `platformMesh` as `joins`; it splits its outline where a join starts or ends. An open edge that runs straight on into a join (a 10-wide end where a 6-wide lane leaves it) steps its lip rings across the join's end, so its lip carries the lane's side lip on and the two meet on a mitre. A slab, curve or ramp with a join lays its top as the grid's cells, each clipped to the ring inside the lips, so a bend or warp still has points to bend. The top's tiles are laid in the level's frame (`tileFrame` in `scene.ts`), turned back only by a piece's turn past the nearest quarter turn, so they run straight on across a join. Moving, tilted and rolled pieces are never joined.

With `ENV.ruin` (docs/colors.md "Looks") the same profile is old steel: steel lips, and a riveted, rusting plate wall in place of the strip.

The wall's texture runs along the perimeter (u is the distance walked round the loop), so the wall ring ends on a copy of its first vertex at the full perimeter. Wrapping straight back to the first vertex would squeeze every repeat into one quad and leave a comb of stripes along one edge. The two copies share one normal (`seams`), so the join shows no crease.

Seen from above, outside corners are rounded. Inside corners (a hole's corners, or the corner of a notch) are rounded too, the other way.

## Curves

A curve is drawn as a straight strip laid along its centre line (`curveStrip` in `src/level.ts`): 2 straight (`CURVE_STRAIGHT`), the arc, then 2 straight again. The arc turns 90 for a corner, 180 for a C or 270 for a 3/4 ring (`sweep`): a C is one strip, so there is no seam where two corners would meet, and its far end comes back level with its near one; a 3/4 ring's far end heads back along local +x past the near end's line, so its inner radius must be at least the two straights (4) to keep the ends apart. `param`, the strip's inverse, picks whichever of the two straights and the arc lands nearest the point, each clamped to its own run: past a half turn both straights lie in the arc's open quarter, so a half-plane test can't tell them apart. The straights keep each end's rounded corners square to the end instead of leaning with the arc, and the strip's long edges break exactly where the straights meet the arc. The footprint, the physics floor and the fence rails follow the same layout.

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

Curves, ramps, tilted, twisted and curled slabs are never cut. Glass slabs are cut like any other.

## Physics floor

The ball rolls on one welded triangle mesh built from every platform top (`floorMesh`). Separate boxes per platform would make the ball hop at every join.

- Joins weld only where the corner points of the two pieces land on the same spot, so keep piece edges on the 0.5 grid.
- An open edge (nothing next to it, including a hole's edge) has the same rounded lip as the visuals, so the ball rolls off it.
- Where two pieces meet, the floor is flat: no lip and no dip, as drawn. Each piece still adds a point on the seam where the inset corner of its open side lands (0.45 along at a square corner, further at a slanted one), and both pieces take each other's, so the strips there weld. Along a straight run the inset points are kept in order between the run's corners, or a slanted corner would fold the strip over itself.
- Under the top there is a second mesh with the side walls and underside, so a ball below or beside a platform hits it.
- A treadmill is in the floor as its frame only: a slab top with its opening cut out, the opening's edge dropping square with no lip. Its rods are their own spinning bodies.
- Both meshes are zero-thickness shells that only push from their front face, so every platform is also filled with solid convex hulls from its underside to 0.03 below its surface, chamfered under the lip. The ball never touches them while rolling, but if it ever reaches the corner where a wall meets the lip, the solid pushes it back out instead of letting it in. `check.ts` fires balls at raised slab, holed slab, curve and ramp edges to prove nothing gets inside.

`npm run check` checks that the ball neither sinks nor hops crossing a join, curves stay flat, and that the ball falls through holes and notches but rolls past them.

## Shaped slabs

A slab with `shape` has its sides moved: each side's two ends pushed out or pulled in, and its middle bowed out or in on a smooth curve (a quadratic through its ends). A bowed side is sampled about every 1 unit (`SHAPE_STEP`) into a polygon, and from there a shaped slab is handled exactly like a slab carved by holes: the drawn mesh, the lip, the physics floor and the fences all take the polygon. So:

- a straight side (no bow) is one edge, and welds to a neighbour whose edge lands on it, so a slab can run 6 wide into 10 wide and join a 6-wide platform at one end and a 10-wide one at the other
- a bowed side is an open edge with the full lip, however close another platform comes
- the footprint used for overlaps, snapping and `surfaceAt` is the polygon's triangles
- a fence on a bowed side follows it, bending at every sample
- an inward bow is concave, so its solid is built per triangle like a holed slab's

A shaped slab is otherwise a plain slab: no tilt, roll, twist, treadmill or movement, and every end must stay at least 1 across.

## Twisted slabs

A slab with `twist` is in the welded floor like any other, laid as a grid of small quads (half a unit along it, one across) so each is nearly flat and the creases between their triangles are too small for the ball to feel. The grid is laid out flat and the twist turns each point as it is emitted, depth and all, as a curled slab's strips are bent: the underside, walls and solids turn with the top and keep the slab's full thickness, so a slab twisted to upright is as solid there as anywhere (dropped straight down they would thin to nothing). Its flat end welds to the platform before it. The solid under each quad is built per triangle (as under a holed slab), since a convex hull over a warped quad's corners would bulge up through the rolling surface. A twisted slab that is also tilted or rolled is out of the welded floor, but collides as this same twisted floor turned into place.

## Curled slabs

A slab with `curl` is in the welded floor too, laid as half-unit strips along its length. The strips are worked out flat, exactly where an uncurled slab's would be, so the seam with the platform before it, the lips along its sides and the far end's open lip come out as on any slab; only when a strip's vertices are emitted is each carried round the curl with its cross-section (`curlPoint` in level.ts, the same map the drawn mesh uses). So a strip can stand upright or hang upside down in a loop while the welding and the lip profile never see anything but a flat rectangle. The near end is left exactly where it is, so it welds and seams with the flat slab before it, and the ball crosses onto the curl without a hop. Walls and the underside bend the same way, and the solid under each strip is built per triangle as under a twisted slab. The flat layout can lie under the curl's overhang, so nothing in the floor is looked up by position there: a curled slab's footprint for `surfaceAt`, snapping and overlaps is only the part before it turns vertical.

## Glass slabs

A glass slab's physics floor is a plain slab's, holes and all. Only the drawn mesh changes: the groups that carry the tiled top and underside are moved onto a second mesh with the glass material, which casts no shadow, while the rim, lips and walls stay on the slab's mesh with its shadow.


## Shadows

The sun's shadow map covers the whole level (`fitSun`), and `scene.ts` patches two of three's shader chunks:

- Three draws the faces that point away from the light into the shadow map, so a closed solid's shadow depth is its far side, for example a slab's underside. Under the cel ramp those faces still get some sun, so they used to test against their own depth and showed acne (moiré rings and stripes on undersides and lips), plus blots from props above. Faces turned from the sun now skip the shadow test. Physically they are already in their own shadow, and the ramp gives them their darker band.
- Three's PCF rotates five taps by per-pixel noise, which made dithered edges that crawl as the camera moves. It is replaced by a fixed 4x4 grid of hardware-filtered taps, `shadow.radius` texels apart, which gives a smooth penumbra about five shadow texels wide.

If a three upgrade changes either chunk, the patch throws at startup instead of silently dropping out.
