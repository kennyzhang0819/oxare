// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xfff7fb;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x8f74c4;
export const LIGHT_GREY = 0xffd9ea, DARK_GREY = 0xa98bd6;
// Accent strips and glows.
export const CYAN = 0xfff08a, GREEN = 0xff8fc8, ORANGE = 0xffb45c;
export const RED = 0xff5c8a, DARK_RED = 0xc23d6e;
export const TUBE_GLASS = 0xcfe9ff;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = 0.006;

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
  jumpHolo: 0xfff08a,
  magnetAura: 0xff5c8a,
  ball: { light: 0xffb3d9, mid: 0xffb3d9, dark: 0xffb3d9, bevel: 0xffb3d9, groove: 0xffb3d9, dash: 0xffb3d9, chrome: true },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "cute" as "lab" | "ice" | "cute",
  floes: false,
  tileTints: [0xffe6f1, 0xe6f2ff, 0xf0e8ff, 0xe6fff4],
  rain: 0,
  bubbles: 420,
  cloudCover: 0.14,
  fog: 1,
  floorRoughness: 0.8,
  toon: true,
  outline: 0.035,
  outlineColor: 0x5a3f6e,
  skyTop: 0x5fb0ff,
  skyHorizon: 0xffd6ea,
  cloud: 0xffffff,
  cloudShade: 0xf1b9d8,
  seaDeep: 0xb79cff,
  seaShallow: 0xd4c3ff,
  seaSky: 0xfff0f8,
  seaGrid: null as number | null,
  hemiSky: 0xffffff,
  hemiGround: 0xffc6e0,
  hemi: 1.1,
  sun: 0xfff6ea,
  sunPower: 1.6,
  glow: 1.0,
  lightMetal: 0,
  lightRoughness: 0.5,
  bodyRoughness: 0.5,
  tileWide: 2,
  tileGrout: null as number | null,
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);

// Theme overrides.
Object.assign(BOARD, { edge: LIGHT_GREY, board: WHITE, trace: 0xffa9cf, pad: 0xffffff, hole: 0x5a3f6e, chip: 0x5a3f6e, chipTop: 0xffffff });
Object.assign(CRATE, { body: WHITE, cross: LIGHT_GREY, screen: 0x5a3f6e, shine: 0xffffff, light: GREEN });
