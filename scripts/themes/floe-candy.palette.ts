// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xf2fbff;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x1b3a5c;
export const LIGHT_GREY = 0xc9e4f0, DARK_GREY = 0x4a7d99;
// Accent strips and glows.
export const CYAN = 0x7dffd0, GREEN = 0xff7fcf, ORANGE = 0xffa53c;
export const RED = 0xff2a4a, DARK_RED = 0x5a1030;
export const TUBE_GLASS = 0xcfeefb;

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
  jumpHolo: 0xffd27a,
  magnetAura: 0xff2a4a,
  ball: { light: 0xb04a7a, mid: 0x7a1a44, dark: 0x3a0a20, bevel: 0xb04a7a, groove: 0x200510, dash: 0xffd27a, chrome: false },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "ice" as "lab" | "ice",
  rain: 0,
  cloudCover: 0.05,
  fog: 0x000001,
  floorRoughness: 0.5,
  skyTop: 0x6fb6ff,
  skyHorizon: 0xffd3e9,
  cloud: 0xfff4f9,
  cloudShade: 0xf2b9d9,
  seaDeep: 0xff9fd0,
  seaShallow: 0xffc4e2,
  seaSky: 0xfff0f8,
  seaGrid: null as number | null,
  hemiSky: 0xfff0f8,
  hemiGround: 0xffb0d6,
  hemi: 0.9,
  sun: 0xfff6ec,
  sunPower: 2.2,
  glow: 1.2,
  lightMetal: 0,
  lightRoughness: 0.4,
  bodyRoughness: 0.3,
  tileWide: 2,
  tileGrout: 0x8fc6dd,
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);

// Theme overrides.
Object.assign(BOARD, { edge: DARK_GREY, board: BLACK, trace: CYAN, pad: WHITE, hole: BLACK, chip: GREEN, chipTop: WHITE });
