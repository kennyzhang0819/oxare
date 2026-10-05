# Decor and mist

The world was once a structure, abandoned long ago and taken over by plants, floating in fog, after Cloud Gardens. That means a clean gradient void instead of sea and clouds, overgrowth along every platform's open edges, trees, and the old steel (column, support) grown over. The props are the structure's old machines (docs/colors.md "The ruin look"). Code: `src/decor.ts` (the plants), `src/scene.ts` (the mist), `src/palette.ts` (`DECOR`, `ENV.mist`).

## Mist

With `ENV.mist` on, the sky dome is a plain vertical gradient, `mistBottom` looking down to `mistTop` looking up (`makeMist`). There is no sea and no clouds. The fog is three's squared-exponential fog (`FOG_PLAY` times `ENV.fog`, 2.2 in the current look), but its colour is not one flat colour. The fog shader chunks are patched so a fading point takes the void's colour in the direction the camera looks at it (`mistAt`). Whatever fades out therefore fades into exactly the background behind it, above the camera and below it alike.

The same `mistAt` is pasted into the dome's shader and the fog chunk, so the two can't drift apart. Turning `mist` off brings back the sky, clouds and sea.

## Decor

Decor is drawn only: nothing in it has a collider and the ball rolls straight through it, except the trees' stems (see Trees). It is rebuilt from the level on every build, seeded by piece index, so a level always grows the same plants. The editor builds without it (`buildLevel`'s `plants` false), since growing it costs far more than a piece's rebuild; its Show plants button grows it once (`buildDecor` plus `stylize`) until the level next changes, and it can't be clicked. A build's plants are freed with `disposeDecor` (instance buffers only; geometry and materials are shared).

Where it grows:

- Every still platform grows plants, whatever its shape: slabs, curves and ramps, tilted, rolled, twisted and curled ones included. Moving platforms and treadmills don't.
- Each platform is seen through its surface (`surfaceOf`), which carries a point of its flat layout, and a height off its top, to where the platform draws it (the slab's twist and curl, then its roll, tilt and turn; a curve's roll; a ramp's slope). Every plant stands square to the surface where it grows, so on a twisted or upright stretch it sticks straight out of it.
- The rim is sampled every 0.5 (`STEP`). On a level, unturned platform a sample is kept only where the edge is open: no platform within 0.5 of the same height lies 0.4 past it, so seams between platforms stay bare while an edge over a lower platform still grows. A turned or bent platform keeps its long sides whatever lies past them, and its ends only where they are open the same way. A ramp keeps only its sides.
- The whole top is grown over too, in clumps: about 0.11 per square unit, each three to seven plants within 0.9 of each other and at least 0.35 in from the rim. They are mostly tufts and clover, with now and then a flower clump, a small fern, mushrooms, a small shrub or one of the taller plants. Nothing grows in a hole or within 0.35 of its cut (`HOLE_PAD`), on any platform, tilted and rolled holes included: every plant is tested in each hole's own frame. Fewer on a floor less given to growing (`GROWTH`, the level's or platform's `floor`): grass grows the full 0.11, soil 0.8 of it, stone 0.55, metal 0.3; on the mixed floor that goes by the patch square under each clump (`patchAt`). Edges, walls and props grow the same whatever the floor.
- Samples within reach of any other piece are dropped (`keepOut`): a disc round each prop, bridge end and the start (not the apples, which float among the plants), and a chain of discs along every path piece (fences, rails, tubes, beans). Plants never cover a mechanism.

What grows at a kept sample:

- **Ferns**: seven arching fronds with zigzag leaflets. Half sit on the lip leaning out so they spill over it; the rest stand 0.45 in. Every corner gets one. Some are rust-coloured, like dying fern.
- **Grass tufts and clover**: tufts of seven blades, and patches of three-leaf clover lying flat, 0.3 to 1 in from the edge.
- **One taller plant now and then**, 0.55 to 1 in, more of them at corners:
  - flower clumps (five stems, lupin spires and round heads)
  - wheat (six straws with long nodding seed heads, up to about 1.2 tall)
  - delphinium spires (three stems with beads stacked up their top half, up to about 1.7)
  - heather (a low green mound dotted with flower clusters)
  - a bush of broad rounded leaves
  - mushrooms (a big one and two small)
- **Shrubs, saplings and firs**: the sizes between the ground plants and the trees (below), 0.35 to 0.85 in.
- **Ivy** clinging flat to the outside of the wall just under the lip, facing out of it.
- **Vines** hanging straight down from just under the lip past the wall, 1 to 5 long, with leaves turning round the stem, on any edge whose surface faces mostly up. About a third end in a wisteria bloom, built onto the vine's own length and placed at its root (`bloom0` to `bloom3`, one per vine length) so it sways with the vine's tip. A vine is only as long as clears any platform below it, bloom included.

Each kind is one `InstancedMesh` for the whole level, coloured per instance from `DECOR`. A plant in two colours is two kinds placed together: stems and heads, straws and wheat, mound and heather, stalks and caps.

Every plant sways in a little wind: its vertices move by how far they are from the plant's root, phased by where the plant stands (`DECOR_TIME`, advanced in the scene's tick).

## Shrubs, saplings and firs

Every size from the grass to the trees grows, so a tree never stands alone over a carpet of grass:

- **Shrubs** grow on about one edge sample in eight (0.5 to 1.3 tall), the small ones in the clumps on the top too, and now and then round a prop's foot. They are leafy puffs, round (`shrub`) or upright (`shrubTall`), green, dark, lime or now and then autumn. One in four is in flower: its own kind of dots (`shrubDots`, `shrubTallDots`) that sways with it.
- **Saplings and firs** grow on about one edge sample in twenty, 1.5 to 2.6 tall. They keep 2.5 from any other. A sapling is a slim stem with a small puff crown in a tree's leaf colours (`LEAVES`). A fir is three cones stacked on a stub.
- **Round a tree's root:** each tree gets one to three shrubs along the rim by its root, and half the time a sapling.

## Curios

Now and then something odd and bright lies among the plants on a platform's top (`CURIOS`), about one per 400 square units of open top (`CURIO_RATE`), so most slabs have none and a big yard one or two:

- a rubber duck
- a soda can lying on its side (red, teal, purple or green)
- a coffee mug with coffee in it
- a traffic cone with a white stripe
- a beach ball in red, yellow and blue slices
- a garden gnome

Each is turned any way, at least 0.6 in from the rim and clear of other pieces like the plants. Each colour of one is its own kind, placed together like stems and heads. Their colours are `CURIO` in palette.ts. They are drawn only, like every plant, and inked like the trees (`ink`).

## Trees

Now and then an open edge sample of a level platform (not a corner) grows a tree out of the wall, its root just under the lip. A tree's stem is solid, its crown and branches are not; see "Stems" below. No tree, sapling or fir grows with its root inside a `clearing` piece or within half a unit of one, at about its height (`treeless`).

**Size:** most trees are small (0.5 to 0.75 times their modelled size, 35%) or middling (0.85 to 1.15, 30%), fewer large (1.25 to 1.5, 22%) and only some big (1.6 to 2, 13%). It keeps 4 plus 4 times its size from any other tree, so small ones can stand closer together.

**Shape:** a tapered trunk arches away from the wall with two branches and two roots gripping it. Its crown sits `TREE` from the root, out past the edge, and a tree only grows where no platform lies under its crown's middle or four points round it. The crown hangs over open air, its lowest leaves about a ball's height above the top.

**Kinds:** every crown is made of puffs (lumpy blobs). Its shape (`SHAPES`) and its leaf colour (`LEAVES`) are picked apart, each by weight:

| Shape | Crown |
|---|---|
| round | puffs all round (the commonest) |
| tall | puffs stacked upward, smaller toward the top |
| wide | a flat umbrella of puffs |
| twin | two clusters side by side |
| willow | a flatter crown with strands of small leaves hanging all round its rim |

- **Colour:** a willow is green or in pink blossom. Any other crown is green, dark green, autumn (orange, red or gold), pink blossom, or bright lime on pale birch bark.
- **Palette:** the colours are `DECOR.canopy`, `deep`, `autumn`, `blossom`, `lime` and `willow`, on `bark` (two browns) or `birch`.

### Placed trees

A `tree` piece (docs/levels.md) is a tree placed by hand, standing upright on the surface instead of growing out of a wall. It is built by `buildTree` from the same crowns and plant materials (an instanced mesh of one, outlined the same way), with its own trunk (`trunkUp`): `TREE_STEM`'s three tapering pieces up to the crown, two branches and three roots. Its crown and leaf colour are chosen in the editor rather than picked by weight; its shade within that colour, and its bark, come from where it stands. Unlike the scattered plants it can be clicked. Its trunk is solid through `pieceCapsules`, like any piece's parts, so the physics needs no scene for it; the scattered plants keep clear of it.

### Stems

Every tree's stem is solid: the wall trees' trunks, the saplings' stems and the firs' stubs. The scene works out where each tree grows (the placement is part of the decor's seeded scatter), so `buildDecor` also records each stem as a few straight pieces along its main limb (`STEMS`, in the tree's own frame), carried into the world by the same matrix the tree is drawn with. Branches, roots and crowns stay drawn only.

The game and the editor's hitbox view hand that list (`decorStems`) to `createSim`, which builds each piece as a capsule. The physics never grows plants itself, so it stays free of three. `npm run check` has no scene, so its levels have no trees; a test there hands `createSim` a stem by hand and checks it stops the ball.

## The old structure

The platforms' walls and lips, the columns and the supports are the old structure's steel (docs/colors.md "Looks", `ENV.ruin`). The column and support are densely grown over.

Each upright column gets:

- a moss cushion on its head with a flower clump in it
- vines hanging from its rim, never longer than the post
- two or three climbing vines wound round it, each starting at its foot and climbing part or all of the way. A climbing vine is stacked from one-unit pieces (`wrap`), each half a turn round the post, its leaves lying flat against it.
- six things per unit of height, scattered round it: ivy, a patch of small flat flowers (`blossoms`), or a sprig of leaves sticking out (`sprig`), all narrowed to hug the drum
- a fern, a flower clump, clover and tufts round its foot

A tilted or rolled column is left bare.

The lamp post gets a vine climbing part way up its post (`wrapLamp`), a vine or two hanging from its hood, and plants round its foot. The signal mast gets vines hanging from its rings and deck, a moss cushion on the deck, and a wide ring of plants round its foot. An arch gets vines hanging from its beam.

Each support pillar gets ivy, flowers and leaf sprigs up all four faces, five per unit of height. Usually it also gets a vine climbing its stem (`wrapStem`, wound round the stem's corners) and one vine down its outer face from the platform it holds. A support turned over keeps its wall plants but gets no climbing or hanging vine.

## Outline and cost

The pieces' ink outline is an inverted hull: a copy of the mesh, pushed out along its normals and drawn inside out, which shows as a rim only round a closed solid. So every plant part is built closed and wound outward:

- fronds and leaves are ribbons with a little thickness (`ribbon`)
- blades are slivers of a pyramid
- small leaves are diamonds
- flowers and beads are low-poly balls and cones

Corners are welded so normals run smooth and the hull doesn't crack. Each kind then gets a second `InstancedMesh` sharing its geometry and instance matrices, drawn with `outlined(sway, ink)`, pushed out and swaying exactly as the plant does. Small plants get half the pieces' outline width, scaling with the plant. The big ones get an `ink` width in world units whatever their size, so a big crown never has a hairline: 0.05 for trees, 0.04 for saplings and firs, 0.032 for shrubs. That costs one extra draw call per kind and doubles the plants' triangles.

Geometry and materials are built once and shared by every build. Leaves come by the thousand, so each is the fewest faces that still has volume. Level 06, one of the biggest, draws about 600k plant triangles plus as many again for the outlines.
