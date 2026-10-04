# Colors

Every color a level's pieces are drawn in lives in `src/palette.ts`. The game currently wears the ruin look: the lab props (`props` `lab`) in the `ruin` pattern family, an old abandoned steel structure grown over by plants (docs/decor.md), cel shaded with an ink outline, floating in mist. The slot names below keep their lab-era names, so `WHITE` is a pale steel, `CYAN` the lemon paint and `BLACK` a dark steel. The pieces use only these, and each piece's group there (`PROPS`, `PLATFORM`, `BOARD`, `CRATE`, ...) just says which of them it wears. Change one and everything wearing it follows.

| Color | Value | Worn by |
|---|---|---|
| `WHITE` | #a3bdb6 | platform lips, rims and tiles, the bodies of nearly every prop, pillars, supports, columns, gates and their links, barriers, rings, fences and rails, the start pad, circuit-board pads, the crate's plate and the shine on its screen, the cube's top plate, a bean's bands and dots |
| `BLACK` | #4f6964 | reserved: the platforms' side strip and the magnet (groove and upper disc), and nothing else (the origin's open wormhole keeps its own blue) |
| `LIGHT_GREY` | #bcd0c9 | light accents: circuit-board traces and chips, the line under a platform's lip and along it, pillar rings and support bars, blockade plates, barrier grilles, plank tint, the crate's screen, the cube's rims and octagon plates, a bean's rounded ends |
| `DARK_GREY` | #6a8a84 | dark accents: the circuit board itself, prop trim and panel edges, every kicker's tread (sliding ones too), the stool's screens, jump pad vents, hinges, pillar slats and support trim, the crate's cross and screen frame, the cube's faces (on its own and under a gate), the treadmill belt's cleats and its opening's walls, a bean's dotted body |
| `CYAN` | #ffe566 | the light strip on fixed props (kickers and jump pads included), the treadmill's chevrons, and the rails' stripe |
| `ORANGE` | #ffa24a | everything the ball can push or move: planks', boards', bridges', stools', barrels' and sliding kickers' light, the crate's corners, the cube's pips, rim lines and octagon borders |
| `RED` | #ff6b6b | the puffer's collar, the magnet's light, a bean's stripes |
| `DARK_RED` | #d14a4a | the magnet's lower disc |
| `TUBE_GLASS` | #cfeaff | pipe windows, hoops and the pane of a glass slab |

The accents say what a piece does: orange is anything the ball can push or move, yellow every other prop, red what is dangerous.

Floor tiles are `WHITE` in `TILE_SHADES` (5) fixed shades, each `TILE_STEP` (1.2%) darker; every tile takes one, its top and left edge two steps lighter, bottom and right two darker. Planks use the same tiles tinted `LIGHT_GREY`.

## Grass

`ENV.grass` (on in the bubble-emo looks) draws the platform tops as flat sticker grass from `GRASS`: plain `turf` with a few flat round `light` patches, a small three-spike tuft in `dark` on most cells of a jittered 7 by 7 grid, each turned its own way so nothing gives a platform's orientation away, and the odd daisy (`petal`, `pollen`), nothing shaded, one repeat per 4 units, seamless. Only the floor is grass; blocks and planks keep the look's tiles (pads in the cute style).

### Floors

The other floors a level or platform can have (`floor`, docs/levels.md) are drawn by `floorTexture` from `FLOOR`, flat fills and circles only on a square grid, so none gives a platform's turn away, one repeat per 4 units, seamless:

| Floor | Drawn as |
|---|---|
| metal | 1-unit steel plates (`plate` shades) between `seam` lines, a `rivet` head in each corner, blobs of `rust` with `rustDark` in their middles |
| soil | `base` earth with `dry` patches and `mud` puddles (blobs of circles), `pebble` dots and two-leaf `sprout`s each turned its own way |
| stone | 1-unit flagstones (`slab` shades, a few darker spots) between mossy `joint`s, `moss` blobs at some corners |

The mixed floor, the default, is mostly grass with patches of the others (`patches.ts`). The floor's frame (the tile frame) is laid out in 1-unit squares, each one floor: a slow noise read at the square's middle, nudged a little per square so the edges step raggedly, makes it a patch past `COVER`, and a slower noise picks soil, metal or stone (`PATCH_KINDS`). The squares are not drawn as squares: between square middles each floor's share is blended bilinearly and a point takes the floor with the most, the seam method of animechs' terrain (its docs/terrain-directions.md "The seams"). So a step of the grid is cut on a 45° slant, a lone square becomes a diamond and an inside corner fills. A thin darker line runs along the seam, where the runner-up's share comes close to the winner's. The floor's shader works this out per pixel and samples that floor's texture; the plants (decor.ts) work out the same in TypeScript, and the two must be kept in step. Each level is seeded from its id (`patchSeed`), so no two lay their patches out alike.

## The ruin look

`ENV.style` `ruin` is the old structure the levels are built from, long abandoned and grown over. Its props are a set of their own, not the lab props repainted. Each is a plain steel body (`propSteel`: the rust texture `metalTexture`, `RUIN`, laid on each face from the piece's own frame, from whichever side the face looks most, so it stays put on a prop that moves) and at most a band or two of old paint (`ruinPaint`): caution stripes on what the ball can push or move, red on what is dangerous, and nothing on the rest, so the stripes always mean the ball can interact with it. The caution paint (`cautionPaint`, `CAUTION`) is yellow (#ffcf2e) striped diagonally with dark (#2e3a37), the stripes 0.24 apart and laid from the mesh's own coordinates, so they ride with a moving prop and run slantwise on every face, set off from the static steel at a glance; the yellow is lit a little from within so it stays bright in shade. Every "yellow band" below is this paint.

| Piece | In the ruin style |
|---|---|
| blockade, block | a plain steel block |
| barrier | a steel beam on two dark posts, a dark flange along its top and bottom |
| pillar | the lab pillar's shape in the ruin wrap: steel with riveted seam bands and rust runs (`ruinPillar`) |
| column, support | the structure's own steel (`metalColumn`, `metalSupport`), a support's ears and a gate's in dark steel (`steelEars`) |
| puffer | a squat steel drum with a band of louvred vents round its middle under a red collar; its air ring a soft white band (`PUFFER.air`) |
| magnet | a steel drum with red rings, its aura as before |
| kicker | a plain steel wedge; a sliding one has two yellow stripes up its slope |
| jump pad | a plain steel pad under three hovering pale steel rings |
| crate, cube, stool | a steel box with a yellow band round its middle |
| barrel | a steel drum with two raised dark ribs and a yellow band between them |
| bean | a steel capsule with a red band near each end |
| plank | a steel sheet with a yellow band across its top end and another just above its hinge, on plain steel mounts |
| board, seesaw | a steel plate with both ends painted yellow; a seesaw's posts plain steel |
| pangolin, bridge, spinner, start pad | plain steel (the pangolin with yellow bands, the start pad's bowl dark) |
| gate, arch | steel arches and their ears, no panels or trim |
| lamp post, signal mast | plain steel bars; the lamp under the hood glows `RUIN.lamp`, the mast's beacon blinks `RUIN.beacon` (both unlit, no outline) |
| fences, rails, rings | plain steel pipe, no light strip |

The lights no longer glow (`glow` 0.3). The platforms' walls and lips are steel too (docs/platforms.md). Plants grow over everything that stands still (docs/decor.md).

## Decor

The overgrowth along platform edges (docs/decor.md) picks its colours from `DECOR`: fern greens with the odd `rust` fern, tuft greens, flower stems in `stem` with heads from `flower`, vine greens and wisteria `bloom`.

## UI

The menus and HUD take their colours from the tokens at the top of `src/style.css`, not from `palette.ts`, and follow the title picture:

- **Ink:** every button, tab, card, pill, slider and switch has a 2.5px border in `--line` (the game's ink, `ENV.outlineColor`), with an ink drop under it like the letters' depth. A button presses down into its drop when clicked.
- **Fills:** solid fills. A primary button, a selected tab and a switch that is on are `--moss`; the rest are pale `--steel`. Panels (cards, level cards, the HUD pills) are `--panel` mist.
- **Display text:** pale (`--text`), inked round in `--line`, wider along the top. Body text is `--ink`.
- **Title:** the title is a picture, `public/title.png`, rendered in the game's own look, not text:
  - **Letters:** RUSTBLOOM in Fredoka Medium capitals, extruded into solid letters. "RUST" is the props' rusting steel and "BLOOM" plain in the grass floor's green (`GRASS.turf`), so it matches the levels.
  - **Look:** cel lit with a thick ink outline.
  - **Plants:** the game's own plants (`plantGroup`) are placed by casting rays at the letters: grass, flowers, ferns and shrubs on their tops, ivy low on their fronts, and vines hanging from their undersides.
  - **Re-rendering:** after a change to the steel, the plants or the palette, open `/title.html` in `npm run dev` (`src/title.ts`) and run `save()` in its console. That writes the picture through the thumbnail endpoint as `public/thumbs/title.png`; move it to `public/title.png` and drop its `title` key from `public/thumbs/index.json`.
- **Display font:** Fredoka.
- **Body font:** Nunito.

## Apples

`APPLE` holds an apple's colours: the red `body`, the brown `stem` and the green `leaf`. `GOLDEN` holds the golden apple's: a gold `body` lit a little from within (`glow`, its emissive), a darker `stem` and a yellow-green `leaf`.

The apple marks (icons.ts, used by the HUD, the level select and the level-complete card) are the same apple drawn flat with a pale shine stroke, inked in dark brown: red (#e8423a), gold (#f6c234), or one still to get as a dashed ink outline at low opacity with no leaf.

## Dialogs

The shared popup (`openDialog`, dialog.ts) is the UI's one way to tell the player something: a panel card (the same fill, ink border and drop as the other cards) on a screen dimmed in ink at a third, a pale inked display title, a line or two of body text and its buttons (the primary moss, the rest steel). Most carry an emblem: a 112 round badge breaking the card's top edge in the dialog's tone (`moss`, `gold`, `steel` or `rust`), with an ink border and drop and a soft inner shade, the icon bobbing in it and pale rays turning slowly behind it. A gold dialog adds three sparkles twinkling round the emblem. It pops in with a small overshoot and fades out in 0.16 s. Any button closes it after its own action; Enter presses the primary, Esc closes it unless it is a choice that must be made (`dismissable: false`). Reduced motion stills it.

## Effects

Effects are not pieces and keep their own colors, in `EFFECTS`: the jump pad's rising squares (#f0c45a), the magnet's aura (#ff2828) and the ball's blues. The origin's wormhole is drawn in its own shaders, from `GOAL.disc` (the accretion disc's cool blue) and `CYAN` (its hot inner glow and sparks). Sky, sea, lighting and the editor's guides are outside the palette too.

## Looks

`ENV` in `palette.ts` holds the rest of a look: sky top and horizon, the lit and shaded cloud colours, the sea's deep, shallow and sky colours (or `seaGrid`, which flattens the sea into a ruled mat in that colour), the hemisphere and sun light, a `glow` multiplier on every emissive, the light strips' metalness and roughness, the white bodies' roughness, the mosaic's wide-tile width and an optional grout colour between tiles. `EFFECTS.ball.chrome` makes the ball one polished colour with no lines. `scripts/themes/` holds six whole alternative palettes (`nightline`, `kiln`, `maquette`, `gumdrop`, `floe`, `terrace`); copying one over `src/palette.ts` restyles every piece without touching geometry or physics. `render.html` (dev only, `src/render.ts`) builds `src/showcase.json`, a level with every piece type, and exposes `window.shoot` so a headless browser can take fixed-camera stills of a look; `render.html?level=06` builds that level instead. `ENV.style` picks the family of drawn patterns: `lab` (mosaic tiles, slats, circuit boards), `ruin` (rusting steel, "The ruin look" above; the platforms' walls get a seam under each steel lip, a rivet row inside each seam, a plate joint every two units and one big rust chunk every four) or `ice` (an ice pack of floes split by water seams, an edge of deep water with icicles under a single core light, frost panels with a snowflake in place of the circuit board, frozen pillars with bubbles and frost streaks, ice crates with a frozen window). Weather lives there too: `rain` (how many streaks ride with the camera; 0 for none), `cloudCover` (added to the cloud deck's coverage), `fog` (a multiplier on the play fog), `mist` (a gradient void from `mistBottom` to `mistTop` with fog in its colour, no sea or clouds; docs/decor.md) and `floorRoughness` (the platform top's finish; low reads wet). `floe` in `scripts/themes/` is the ice patterns under a polar sky with clouds and a steel ball; `floe-rain` and `floe-candy` are the same under an overcast and a pink sky. `floes` puts the ice pack's floes on the floor in place of the mosaic (off by default: the floor stays smooth) and `tileTints` is a list of pastel colours the mosaic's tiles pick from instead of shades of one. `style` `cute` is the third family: a kawaii face on every panel, candy-striped pillars, macaron crates and a single fat light line along the edge; with it `toon` (three-step cel lighting on every standard material), `outline` (an ink line this wide round every solid, in `outlineColor`) and `bubbles` (soap bubbles riding with the camera). `scripts/themes/bubble.palette.ts` is that look. `props` `soft` rounds the kicker and jump pad more, stands the barrier on one stick and restyles the structures (below). `scripts/themes/bubble.palette.ts` and `bubble-clean.palette.ts` (no outline) are the white-and-blue cute look on those bodies; `floe-soft` is Floe on them. `faces` puts kawaii faces on the cute style's panels and soft props (off: a star in their place). `bubble-emo` and `bubble-emo-clean` are the cute set under Floe's deep polar sky, no bubbles, no faces. With the `cute` style the floor is drawn as big soft rounded pads (two to a repeat, a hair lighter than the shallow groove between them, pads picking from `tileTints`), the side as one blue wall under a white lip with a row of lighter scallops hanging from its top and a soft light dot under each, the ball (`EFFECTS.ball.cute`) as a toy ball with big white spots, lit in steps and outlined like the pieces, the bean two-tone with big dots, and the start pad with a star. `props` `soft` also simplifies the kicker (a coloured tongue with white dots on a plain wedge), the jump pad (a round coloured cushion under three hovering rings), the stool (a smooth block with a light belt and the panel on top) and the spinner (a rounded bar). With `toon` on, the sky's clouds are cartoon cumulus: in some cells of a large grid, one cloud of seven balls (a big one, a ring of five round it turned at random, one on top) merged smoothly and lumped by noise, standing on the deck's base; each sky pixel walks the deck cell by cell and sphere-traces the cell's cloud, and a hit is cel-lit in three bands from its surface normal, its underside in shade, with a dark rim at its silhouette, fading into the sky with distance and gone at the horizon (reflection passes see the deck flat from below); the sea is two flat bands of water, hard white glints and the clouds' shadows (the same balls seen from above); cel-lit bodies take no shadows (only what wears the floor texture does) so their bands stay flat, and the sun's shadow bias and filter are softer so cast shadows stay clean. `props` `soft` also restyles the structures: gate and support legs lose their panels and collars for two light rings a stretch and bead-shaped ears with a light dot, gate beams carry a row of round dots, tube mouths and hoops are plain rings with six light beads round them, and fences and rails are pastel rods with no stripe and a light bead at each end and turn. In the same mode the gate's arches and the support's stems are one round tube each down the middle of their solids, the gate's chain a row of round beads, the barrier a cloud on a single stick, and the kicker and jump pad plumper wedges (their hulls take a larger rounding, inset so the drawing stays inside the collider) kept plain like the pillow, each with one round button in the thrust colour; the jump pad's three hovering squares become three solid light rings that take the toon shading and the outline. The stool and bean follow the pillow too: a plain body in the tint with one round button (the movables' colour on the stool, the hazard colour on the bean), and the barrier's cloud is in the tint with its stick and a button in the light colour.
