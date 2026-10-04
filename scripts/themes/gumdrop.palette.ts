// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xfffdf6;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x3b2a52;
export const LIGHT_GREY = 0xf8ebdc, DARK_GREY = 0x6e4a9e;
// Accent strips and glows.
export const CYAN = 0xffe34d, GREEN = 0x8ee04a, ORANGE = 0xff5fa2;
export const RED = 0xff2e4c, DARK_RED = 0x8e1b36;
export const TUBE_GLASS = 0xffb3e6;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = 0.02;

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
  jumpHolo: 0xffe34d,
  magnetAura: 0xff2e4c,
  ball: { light: 0xff2e4c, mid: 0xfff6e8, dark: 0xffe34d, bevel: 0xffffff, groove: 0x3fa0ff, dash: 0xff2e4c, chrome: false },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "lab" as "lab" | "ice" | "cute",
  props: "lab",
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
  skyTop: 0x4ea3ff,
  skyHorizon: 0xd6f1ff,
  cloud: 0xffffff,
  cloudShade: 0xbcd8f0,
  seaDeep: 0x3fa0ff,
  seaShallow: 0x6cc0ff,
  seaSky: 0xdff4ff,
  seaGrid: null as number | null,
  hemiSky: 0xffffff,
  hemiGround: 0xffd6e0,
  hemi: 0.95,
  sun: 0xffffff,
  sunPower: 2.2,
  glow: 1.0,
  lightMetal: 0,
  lightRoughness: 0.25,
  bodyRoughness: 0.3,
  tileWide: 1,
  tileGrout: null as number | null,
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);

// Theme overrides.
Object.assign(BOARD, { edge: BLACK, board: BLACK, trace: WHITE, pad: CYAN, hole: BLACK, chip: GREEN, chipTop: GREEN });
