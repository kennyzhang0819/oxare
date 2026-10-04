// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xfdfeff;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x3f74c4;
export const LIGHT_GREY = 0xe3f0ff, DARK_GREY = 0x86b1ea;
// Accent strips and glows.
export const CYAN = 0xffe566, GREEN = 0x74e6bb, ORANGE = 0xffa24a;
export const RED = 0xff6b6b, DARK_RED = 0xd14a4a;
export const TUBE_GLASS = 0xcfeaff;

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
  jumpHolo: 0xffe566,
  magnetAura: 0xff6b6b,
  ball: { light: 0xd8e8ff, mid: 0xd8e8ff, dark: 0xd8e8ff, bevel: 0xd8e8ff, groove: 0xd8e8ff, dash: 0xd8e8ff, chrome: true },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "cute" as "lab" | "ice" | "cute",
  props: "soft",
  faces: false,
  floes: false,
  tileTints: [0xe8f3ff, 0xeefaff, 0xf3f0ff, 0xe9fff5],
  rain: 0,
  bubbles: 0,
  cloudCover: 0.08,
  fog: 1,
  floorRoughness: 0.8,
  toon: true,
  outline: 0,
  outlineColor: 0x1b2f52,
  skyTop: 0x070f2a,
  skyHorizon: 0x5f88bd,
  cloud: 0xb8cde0,
  cloudShade: 0x22395a,
  seaDeep: 0x061a2e,
  seaShallow: 0x173f5c,
  seaSky: 0x5f88bd,
  seaGrid: null as number | null,
  hemiSky: 0x8fb4de,
  hemiGround: 0x1e3a52,
  hemi: 1.1,
  sun: 0xeaf2ff,
  sunPower: 2.2,
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
Object.assign(BOARD, { edge: LIGHT_GREY, board: WHITE, trace: 0xffb3a7, pad: 0xffffff, hole: 0x2c4a7a, chip: 0x2c4a7a, chipTop: 0xffffff });
Object.assign(CRATE, { body: WHITE, cross: LIGHT_GREY, screen: 0x2c4a7a, shine: 0xffffff, light: GREEN });
Object.assign(PILLAR, { white: WHITE, slate: DARK_GREY, pale: 0xcfe4ff });
