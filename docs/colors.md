# Colors

Every color a level's pieces are drawn in lives in `src/palette.ts`. The pieces use only these, and each piece's group there (`PROPS`, `PLATFORM`, `BOARD`, `CRATE`, ...) just says which of them it wears. Change one and everything wearing it follows.

| Color | Value | Worn by |
|---|---|---|
| `WHITE` | #e9eef3 | platform lips, rims and tiles, the bodies of nearly every prop, pillars, supports, columns, gates and their links, barriers, rings, fences and rails, the start pad, circuit-board pads, the crate's plate and the shine on its screen, the cube's top plate, a bean's bands and dots |
| `BLACK` | #343b43 | reserved: the goal disc, the platforms' side strip and the magnet (groove and upper disc), and nothing else |
| `LIGHT_GREY` | #b4bdc5 | light accents: circuit-board traces and chips, the line under a platform's lip and along it, pillar rings and support bars, blockade plates, barrier grilles, goal spokes and hub, plank tint, the crate's screen, the cube's rims and octagon plates, treadmill rods, a bean's rounded ends |
| `DARK_GREY` | #5f6975 | dark accents: the circuit board itself, prop trim and panel edges, every kicker's tread (sliding ones too), the stool's screens, jump pad vents, hinges, pillar slats and support trim, the crate's cross and screen frame, the cube's faces (on its own and under a gate), the treadmill rods' grooves and its opening's walls, a bean's dotted body |
| `CYAN` | #2fe6ff | the light strip on everything that glows, and the rails' stripe |
| `GREEN` | #3fe87a | planks', bridges' and sliding pieces' light, the crate's corners, the cube's rim lines and octagon borders |
| `ORANGE` | #ff7a2e | the kicker's strips, the treadmill's chevrons |
| `RED` | #ff2b2b | the bumper's band, the magnet's light, a bean's stripes |
| `DARK_RED` | #6e2630 | the magnet's lower disc |
| `TUBE_GLASS` | #5ad2e6 | tubes, hoops and the pane of a glass slab |

Floor tiles are `WHITE` in `TILE_SHADES` (5) fixed shades, each `TILE_STEP` (1.2%) darker; every tile takes one, its top and left edge two steps lighter, bottom and right two darker. Planks use the same tiles tinted `LIGHT_GREY`.

## Effects

Effects are not pieces and keep their own colors, in `EFFECTS`: the jump pad's rising squares (#f0c45a), the magnet's aura (#ff2828) and the ball's blues. The goal's beam is drawn in its own shader. Sky, sea, lighting and the editor's guides are outside the palette too.

## Looks

`ENV` in `palette.ts` holds the rest of a look: sky top and horizon, the lit and shaded cloud colours, the sea's deep, shallow and sky colours (or `seaGrid`, which flattens the sea into a ruled mat in that colour), the hemisphere and sun light, a `glow` multiplier on every emissive, the light strips' metalness and roughness, the white bodies' roughness, the mosaic's wide-tile width and an optional grout colour between tiles. `EFFECTS.ball.chrome` makes the ball one polished colour with no lines. `scripts/themes/` holds six whole alternative palettes (`nightline`, `kiln`, `maquette`, `gumdrop`, `floe`, `terrace`); copying one over `src/palette.ts` restyles every piece without touching geometry or physics. `render.html` (dev only, `src/render.ts`) builds `src/showcase.json`, a level with every piece type, and exposes `window.shoot` so a headless browser can take fixed-camera stills of a look. `ENV.style` picks the family of drawn patterns: `lab` (mosaic tiles, slats, circuit boards) or `ice` (an ice pack of floes split by water seams, an edge of deep water with icicles under a single core light, frost panels with a snowflake in place of the circuit board, frozen pillars with bubbles and frost streaks, ice crates with a frozen window). Weather lives there too: `rain` (how many streaks ride with the camera; 0 for none), `cloudCover` (added to the cloud deck's coverage), `fog` (a multiplier on the play fog) and `floorRoughness` (the platform top's finish; low reads wet). `floe` in `scripts/themes/` is the ice patterns under a polar sky with clouds and a steel ball; `floe-rain` and `floe-candy` are the same under an overcast and a pink sky. `floes` puts the ice pack's floes on the floor in place of the mosaic (off by default: the floor stays smooth) and `tileTints` is a list of pastel colours the mosaic's tiles pick from instead of shades of one. `style` `cute` is the third family: a kawaii face on every panel, candy-striped pillars, macaron crates and a single fat light line along the edge; with it `toon` (three-step cel lighting on every standard material), `outline` (an ink line this wide round every solid, in `outlineColor`) and `bubbles` (soap bubbles riding with the camera). `scripts/themes/bubble.palette.ts` is that look.
