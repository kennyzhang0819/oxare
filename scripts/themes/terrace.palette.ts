// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xcfc9b8;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x2f3a2a;
export const LIGHT_GREY = 0xb6ad98, DARK_GREY = 0x6b5a45;
// Accent strips and glows.
export const CYAN = 0xffc94a, GREEN = 0x7fd14a, ORANGE = 0xe9683a;
export const RED = 0xd63a3a, DARK_RED = 0x5c1f1f;
export const TUBE_GLASS = 0xbfe7c9;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = 0.035;

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
  jumpHolo: 0xffc94a,
  magnetAura: 0xd63a3a,
  ball: { light: 0x7fc29a, mid: 0x2f7a4e, dark: 0x133a26, bevel: 0x7fc29a, groove: 0x0a2416, dash: 0xffc94a, chrome: false },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "lab" as "lab" | "ice" | "cute",
  props: "lab",
  faces: false,
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
  skyTop: 0x6fa3d8,
  skyHorizon: 0xf4e6cf,
  cloud: 0xffffff,
  cloudShade: 0xb9c3d4,
  seaDeep: 0xe8edf2,
  seaShallow: 0xf6f8fa,
  seaSky: 0xf4e6cf,
  seaGrid: null as number | null,
  hemiSky: 0xd7e6ff,
  hemiGround: 0x5f6b3a,
  hemi: 0.8,
  sun: 0xffe6c0,
  sunPower: 2.0,
  glow: 0.7,
  lightMetal: 0,
  lightRoughness: 0.5,
  bodyRoughness: 0.9,
  tileWide: 2,
  tileGrout: 0x6f8a4a,
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);

// Theme overrides.
Object.assign(BOARD, { edge: DARK_GREY, board: DARK_GREY, trace: LIGHT_GREY, pad: CYAN, hole: 0x4a3b2c, chip: 0x4a3b2c, chipTop: LIGHT_GREY });
