// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0x2b3240;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x0c1016;
export const LIGHT_GREY = 0x55607a, DARK_GREY = 0x1a1f2b;
// Accent strips and glows.
export const CYAN = 0xff5fc8, GREEN = 0x6dffb0, ORANGE = 0xffb03a;
export const RED = 0xff3b4a, DARK_RED = 0x5a1020;
export const TUBE_GLASS = 0x9a7bff;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = -0.03;

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
  jumpHolo: 0xffd36a,
  magnetAura: 0xff3b4a,
  ball: { light: 0xffffff, mid: 0xe4e8ef, dark: 0xbfc6d2, bevel: 0xffffff, groove: 0x9aa3b5, dash: 0xff5fc8, chrome: false },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "lab" as "lab" | "ice" | "cute",
  floes: false,
  tileTints: null as number | null,
  rain: 0,
  bubbles: 0,
  cloudCover: 0,
  fog: 1,
  floorRoughness: 0.85,
  toon: false,
  outline: 0,
  outlineColor: 0x000000,
  skyTop: 0x0a0e2c,
  skyHorizon: 0x55306c,
  cloud: 0x8a6283,
  cloudShade: 0x201732,
  seaDeep: 0x080f26,
  seaShallow: 0x1a2652,
  seaSky: 0x6b3c8a,
  seaGrid: null as number | null,
  hemiSky: 0x6a5aa0,
  hemiGround: 0x1e1830,
  hemi: 1.0,
  sun: 0xffc9a0,
  sunPower: 1.6,
  glow: 1.6,
  lightMetal: 0,
  lightRoughness: 0.4,
  bodyRoughness: 0.5,
  tileWide: 2,
  tileGrout: null as number | null,
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);
