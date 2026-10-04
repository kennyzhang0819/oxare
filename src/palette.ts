// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xe9eef3;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x343b43;
export const LIGHT_GREY = 0xb4bdc5, DARK_GREY = 0x5f6975;
// Accent strips and glows.
export const CYAN = 0x2fe6ff, GREEN = 0x3fe87a, ORANGE = 0xff7a2e;
export const RED = 0xff2b2b, DARK_RED = 0x6e2630;
export const TUBE_GLASS = 0x5ad2e6;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = 0.012;

export const PROPS = { white: WHITE, grey: DARK_GREY, tread: DARK_GREY, hinge: DARK_GREY, cyan: CYAN, green: GREEN };
// Supports, columns and gates take the pillar's colours.
export const PILLAR = { white: WHITE, slate: DARK_GREY, pale: LIGHT_GREY };
export const PLATFORM = { tile: WHITE, lip: WHITE, lipLine: LIGHT_GREY, recess: BLACK, rim: WHITE, border: LIGHT_GREY, block: DARK_GREY, plank: LIGHT_GREY, glass: TUBE_GLASS };
// The circuit board every obstacle carries (barrier, kicker back, stool, bumper, magnet, barrel, gate).
export const BOARD = { edge: DARK_GREY, board: DARK_GREY, trace: LIGHT_GREY, pad: WHITE, hole: DARK_GREY, chip: LIGHT_GREY, chipTop: LIGHT_GREY };
export const BLOCKADE = { plate: LIGHT_GREY };
export const BARRIER = { grille: LIGHT_GREY, louvre: DARK_GREY };
export const START_PAD = { top: WHITE, side: WHITE, centre: LIGHT_GREY, centreDark: LIGHT_GREY, centreLight: WHITE, groove: DARK_GREY };
export const CRATE = { body: WHITE, cross: DARK_GREY, screen: LIGHT_GREY, shine: WHITE, light: GREEN };
export const STOOL = { screen: DARK_GREY };
export const GOAL = { disc: BLACK, spokes: LIGHT_GREY, hub: LIGHT_GREY };
export const BUMPER = { rubber: RED };
export const MAGNET = { glow: RED, lower: DARK_RED, groove: BLACK, upper: BLACK };
export const KICKER = { light: ORANGE, glow: ORANGE, slideTread: DARK_GREY };
export const TUBE = { glass: TUBE_GLASS };
export const RAILS = { rail: WHITE, stripe: CYAN };
// The cube, on its own and hanging from a gate.
export const CUBE = { body: DARK_GREY, plate: LIGHT_GREY, top: WHITE, glow: GREEN };
export const TREADMILL = { rod: LIGHT_GREY, groove: DARK_GREY, arrow: ORANGE, bed: DARK_GREY };
export const BEAN = { cap: LIGHT_GREY, stripe: RED, band: WHITE, body: DARK_GREY, dot: WHITE };

// Effects, not pieces, keep their own colours: the jump pad's rising squares, the magnet's aura and
// the ball. (The goal's beam is drawn in its own shader.)
export const EFFECTS = {
  jumpHolo: 0xf0c45a,
  magnetAura: 0xff2828,
  ball: { light: 0x5592f2, mid: 0x417ee8, dark: 0x326bd2, bevel: 0x86b4fa, groove: 0x143584, dash: 0x2fd9f2, chrome: false },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  skyTop: 0x448fec, skyHorizon: 0xafcde9,
  // A cloud lit by the sun and its shaded underside.
  cloud: 0xf7f7f7, cloudShade: 0x94a6c7,
  seaDeep: 0x2a6cb0, seaShallow: 0x3a80c4, seaSky: 0x8fb8e0,
  // A flat sea (no ripples or sky) ruled with lines in this colour, when set.
  seaGrid: null as number | null,
  hemiSky: 0xffffff, hemiGround: 0x7ea0c8, hemi: 0.7,
  sun: 0xffffff, sunPower: 2.2,
  // Multiplies every glow; the light strips' finish; the finish of white bodies and rails.
  glow: 1, lightMetal: 0, lightRoughness: 0.4, bodyRoughness: 0.45,
  // Width of the mosaic's wide tiles (1 for none) and an optional grout line colour between tiles.
  tileWide: 2, tileGrout: null as number | null,
  // Which family of drawn patterns the pieces wear: the lab's mosaic, slats and circuit boards, or
  // the ice pack's floes, frost and snowflakes.
  style: "lab" as "lab" | "ice" | "cute",
  // The ice pack's floes on the floor (off: the smooth mosaic), and pastel tints the mosaic's tiles
  // pick from (null: shades of the tile colour).
  floes: false, tileTints: null as number[] | null,
  // Weather: rain streaks and bubbles (how many; 0 for none), extra cloud cover, a fog multiplier,
  // the floor's finish.
  rain: 0, bubbles: 0, cloudCover: 0, fog: 1, floorRoughness: 0.85,
  // Cel shading (stepped light) and an ink outline this wide round every solid, in this colour.
  toon: false, outline: 0, outlineColor: 0x000000,
  // Which bodies the props are built as: the lab's cylinders, pucks and crates, or soft shapes
  // (beads, puddings, donuts, mochi, pillows, clouds, pills) inside the same colliders.
  props: "lab" as "lab" | "soft",
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);
