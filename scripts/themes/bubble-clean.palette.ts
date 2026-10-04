// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xfdfeff;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x4f8ad9;
export const LIGHT_GREY = 0xe3f0ff, DARK_GREY = 0x86b1ea;
// Accent strips and glows.
export const CYAN = 0xffe566, GREEN = 0x74e6bb, ORANGE = 0xffa24a;
export const RED = 0xff6b6b, DARK_RED = 0xd14a4a;
export const TUBE_GLASS = 0xcfeaff;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = 0.006;

export const PROPS = { white: WHITE, grey: DARK_GREY, tread: DARK_GREY, hinge: DARK_GREY, cyan: CYAN, movable: GREEN };
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
// The soft look's animals (docs/animals.md): the blockade a bunny, the barrier a fish, the pillar a
// giraffe, fences, rails and rings snakes, the kicker a turtle, the jump pad a frog, the bumper a
// ladybug, the magnet an octopus, the stool a pig, the bean a caterpillar, the crate a cow, the barrel
// an owl, the cube a chick, the plank a butterfly, the board a flounder, the seesaw a crocodile, the
// column a penguin and the support a whale with a spout, each in its own colours, their eyes in ink.
export const ANIMALS = {
  eye: 0x1b2f52,
  // The green dome hovering over every animal the ball can push.
  push: 0x74e6bb,
  bunny: { fur: 0xfaf3ea, ear: 0xf8aebd, nose: 0xf8aebd, tooth: 0xffffff },
  fish: { body: 0xff9b7a, fin: 0xffe566, lip: 0xfff3d1 },
  giraffe: { hide: 0xffdd6b, spot: 0xff9f4a, muzzle: 0xfff3d1, horn: 0xff9f4a },
  snake: { skin: 0x9be3b8, band: 0x4caf7d },
  turtle: { shell: 0x7ccfc4, skin: 0xcde9b8, plate: 0xffe566 },
  frog: { skin: 0xa9db5e, spot: 0x6fae45 },
  ladybug: { shell: 0xff6b6b, head: 0xfff3d1 },
  octopus: { skin: 0xb9a3f0, spot: 0xff6b6b },
  pig: { skin: 0xf7b5c8, snout: 0xe98aa6 },
  caterpillar: { skin: 0xff8c8c, band: 0xc9484f },
  cow: { hide: 0xfaf7f2, patch: 0x1b2f52, muzzle: 0xf2b8c6, horn: 0xf3e6cc },
  owl: { feather: 0xd8b48e, wing: 0xb08c66, belly: 0xf3e6cc, beak: 0xffa24a },
  chick: { down: 0xfff0a0, wing: 0xf3d96e, beak: 0xffa24a, blush: 0xf7b5c8 },
  butterfly: { panel: 0xfff4e6, wing: 0xffa24a, spot: 0xffe566 },
  flounder: { skin: 0xe8c89a, spot: 0x9c7a56 },
  pangolin: { body: 0xe9c29b, scale: 0xb98557, plate: 0xf3d3ad, face: 0xfbe6d2, tip: 0xffa24a },
  crocodile: { skin: 0x5fb3a3, scute: 0x2f6f66, tooth: 0xffffff },
  penguin: { coat: 0x2f3f5c, flipper: 0x1f2b40, belly: 0xf3f0e6, beak: 0xffa24a },
  whale: { skin: 0x6f98d6, fin: 0x5a84c4, belly: 0xf3f0e6, water: 0xcfeaff, splash: 0xffffff },
};
// The grassy floor (ENV.grass): the turf, the blades over it in two shades, and the odd daisy.
export const GRASS = { turf: 0x93d07f, dark: 0x6ab45f, light: 0xa3da8c, petal: 0xffffff, pollen: 0xffe566 };

// Effects, not pieces, keep their own colours: the jump pad's rising squares, the magnet's aura and
// the ball. (The goal's beam is drawn in its own shader.)
export const EFFECTS = {
  jumpHolo: 0xffe566,
  magnetAura: 0xff6b6b,
  ball: { light: 0x9ccaff, mid: 0x8ec2ff, dark: 0x8ec2ff, bevel: 0x8ec2ff, groove: 0x8ec2ff, dash: 0xffffff, chrome: false, cute: true },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "cute" as "lab" | "ice" | "cute",
  props: "soft",
  faces: false,
  floes: false,
  grass: false,
  tileTints: [0xe8f3ff, 0xeefaff, 0xf3f0ff, 0xe9fff5],
  rain: 0,
  bubbles: 0,
  cloudCover: 0.14,
  fog: 1,
  floorRoughness: 0.8,
  toon: true,
  outline: 0,
  outlineColor: 0x2c4a7a,
  skyTop: 0x4aa3ff,
  skyHorizon: 0xeaf6ff,
  cloud: 0xffffff,
  cloudShade: 0xb9d3ee,
  seaDeep: 0x3f93e8,
  seaShallow: 0x6fb6f2,
  seaSky: 0xeaf6ff,
  seaGrid: null as number | null,
  hemiSky: 0xffffff,
  hemiGround: 0xbfdcff,
  hemi: 1.0,
  sun: 0xfff8ee,
  sunPower: 2.0,
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
