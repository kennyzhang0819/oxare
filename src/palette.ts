// Every colour a level is drawn in, as 0xRRGGBB; docs/colors.md shows them. The level is drawn in
// the few colours just below and nothing else: each piece's group only says which of them it wears.
export const WHITE = 0xa3bdb6;
// Reserved: only the goal disc, the platforms' side strip and the magnet.
export const BLACK = 0x4f6964;
export const LIGHT_GREY = 0xbcd0c9, DARK_GREY = 0x6a8a84;
// Accent strips and glows.
export const CYAN = 0xffe566, ORANGE = 0xffa24a;
export const RED = 0xff6b6b, DARK_RED = 0xd14a4a;
export const TUBE_GLASS = 0xcfeaff;

// Floor tiles: the white in TILE_SHADES fixed shades, each a step darker; every tile takes one.
export const TILE_SHADES = 5, TILE_STEP = 0.006;

export const PROPS = { white: WHITE, grey: DARK_GREY, tread: DARK_GREY, hinge: DARK_GREY, cyan: CYAN, movable: ORANGE };
// Supports, columns and arches take the pillar's colours.
export const PILLAR = { white: WHITE, slate: DARK_GREY, pale: LIGHT_GREY };
export const PLATFORM = { tile: WHITE, lip: WHITE, lipLine: LIGHT_GREY, recess: BLACK, rim: WHITE, border: LIGHT_GREY, block: DARK_GREY, plank: LIGHT_GREY, glass: TUBE_GLASS };
// The circuit board every obstacle carries (barrier, kicker back, stool, puffer, magnet, barrel, arch).
export const BOARD = { edge: DARK_GREY, board: DARK_GREY, trace: LIGHT_GREY, pad: WHITE, hole: DARK_GREY, chip: LIGHT_GREY, chipTop: LIGHT_GREY };
export const BLOCKADE = { plate: LIGHT_GREY };
export const BARRIER = { grille: LIGHT_GREY, louvre: DARK_GREY };
export const START_PAD = { top: WHITE, side: WHITE, centre: LIGHT_GREY, centreDark: LIGHT_GREY, centreLight: WHITE, groove: DARK_GREY };
export const CRATE = { body: WHITE, cross: DARK_GREY, screen: LIGHT_GREY, shine: WHITE, light: ORANGE };
export const STOOL = { screen: DARK_GREY };
export const GOAL = { disc: 0x3f74c4, spokes: LIGHT_GREY, hub: LIGHT_GREY };
export const BUMPER = { rubber: RED };
// The puffer's ring of air.
export const PUFFER = { air: 0xf2f8ff };
export const MAGNET = { glow: RED, lower: DARK_RED, groove: BLACK, upper: BLACK };
export const KICKER = { light: CYAN, glow: CYAN, slideTread: DARK_GREY };
export const TUBE = { glass: TUBE_GLASS };
export const RAILS = { rail: WHITE, stripe: CYAN };
// The pushable cube.
export const CUBE = { body: DARK_GREY, plate: LIGHT_GREY, top: WHITE, glow: ORANGE };
export const TREADMILL = { belt: 0x56625f, cleat: DARK_GREY, arrow: CYAN, bed: DARK_GREY };
export const BEAN = { cap: LIGHT_GREY, stripe: RED, band: WHITE, body: DARK_GREY, dot: WHITE };
// The grassy floor (ENV.grass): the turf, the blades over it in two shades, and the odd daisy.
export const GRASS = { turf: 0x93d07f, dark: 0x6ab45f, light: 0xa3da8c, petal: 0xffffff, pollen: 0xffe566 };
// The other floors a level or platform can have (level.ts FLOORS), each flat fills only: old steel plates
// with rivets and rust; soil with mud, dry patches, pebbles and sprouts; flagstones with moss in the joints.
export const FLOOR = {
  metal: { plate: [0x8fb0a8, 0x86a8a0, 0x7f9f98], seam: 0x6a8a84, rivet: 0xb2cbc3, rust: 0xc07a4c, rustDark: 0x96573a },
  soil: { base: 0x9a6b47, mud: 0x7a5236, dry: 0xb5845a, pebble: 0xc9bfae, sprout: 0x6ab45f },
  stone: { slab: [0xc3c1b0, 0xb5b3a2, 0xcdcbbb], joint: 0x7fb85e, moss: 0x8cc46a },
};
// The old structure (column, support): steel painted `paint`, with `seam` lines and `rivet` heads, its
// paint flaking to `rust` and `rustDark`; a lamp post's lamp and a signal mast's beacon, lit.
export const RUIN = { paint: 0x86a8a0, seam: 0x6a8a84, rivet: 0xb2cbc3, rust: 0xc07a4c, rustDark: 0x96573a, lamp: 0xffe3a3, beacon: 0xff5a47 };
// The caution paint on everything the ball can push or move: yellow striped across with dark.
export const CAUTION = { yellow: 0xffcf2e, dark: 0x2e3a37 };
// The apples a level is played for: a red body on a brown stem with a green leaf.
export const APPLE = { body: 0xe8423a, stem: 0x7a5232, leaf: 0x5cbf4f };
// The optional golden apple: a gold body glowing a little, a darker stem and a yellow-green leaf.
export const GOLDEN = { body: 0xffcc33, glow: 0x8a5c00, stem: 0x8a5a1c, leaf: 0x9fd04f };
// Odd things left lying about among the plants, rarely (decor.ts CURIOS): a rubber duck, a soda can, a mug, a
// traffic cone, a beach ball, a garden gnome. Each list is picked from.
export const CURIO = {
  duck: [0xffd84a], beak: [0xff8a2a], eye: [0x2c3b36],
  can: [0xe8423a, 0x3fb6c9, 0x9b6fd6, 0x5cbf4f], tin: [0xd9e2e6],
  mug: [0xf6f2ea, 0xf79ac0, 0x6f9fd8, 0xffd86e], coffee: [0x6a4127],
  cone: [0xff7a2e], stripe: [0xf6f2ea],
  ballA: [0xe8423a], ballB: [0xffd84a], ballC: [0x3f8fd6],
  gnome: [0x3f6fc4], hat: [0xe8423a], beard: [0xf6f2ea], face: [0xf2c09a],
};
// Decor (decor.ts): the overgrowth scattered along platform edges, columns and supports. Each list is picked from at random.
export const DECOR = {
  fern: [0x6fae5a, 0x7cbc63, 0x5f9f58], rust: 0xc9793f, tuft: [0x6ab45f, 0x7cc16a, 0x88c870],
  stem: 0x5f9f58, flower: [0xb79be0, 0xf2a6c0, 0xf6f2ea, 0xffd86e, 0x8f7fd6],
  vine: [0x5f9f58, 0x6fae5a, 0x78b562], bloom: [0xc6a9ec, 0xf6f2ea, 0xf2a6c0],
  bark: [0x8a6a52, 0x6f5442], birch: 0xe6ded0, canopy: [0x4fae4a, 0x5cbf4f, 0x6fcb55], willow: [0x8fd45a, 0xa2dc5e, 0x7cc94e],
  autumn: [0xf08a2a, 0xe8562e, 0xf5b52e], blossom: [0xf79ac0, 0xff8fb6, 0xf2a6d6], lime: [0xa6d943, 0xb8e04a], deep: [0x2f8a4e, 0x3a9a58], moss: [0x7fb85e, 0x8cc46a],
  wheat: [0xd9b46a, 0xc89c52, 0xe6c784], straw: 0xb3b872, spire: [0x8f7fd6, 0x6f86d8, 0xc79be0, 0xf2a6c0],
  heather: [0xb07ccf, 0xc68fd8, 0xe0a3c8], mound: 0x5f9a5a, leaf: [0x4f9a5a, 0x5fae63, 0x69b56a],
  cap: [0xf08a7a, 0xf6efe3, 0xc9a07a], stalk: 0xf6efe3, clover: [0x8acb6e, 0x9ad47c], ivy: [0x4f8f55, 0x5f9f58, 0x6aab5e],
};

// Effects, not pieces, keep their own colours: the jump pad's rising squares, the magnet's aura and
// the ball. (The goal's portal is drawn in its own shaders.)
export const EFFECTS = {
  jumpHolo: 0xffe566,
  magnetAura: 0xff6b6b,
  ball: { light: 0x86bbf7, mid: 0x7fb5f2, dark: 0x7fb5f2, bevel: 0x7fb5f2, groove: 0x7fb5f2, dash: 0xeef4fb, chrome: false, cute: true },
};

// The world round the pieces and the finish on them: sky, clouds, sea, lights, and a few material
// numbers scene.ts and textures.ts read, so a look is one file.
export const ENV = {
  style: "ruin" as "lab" | "ice" | "cute" | "ruin",
  props: "lab",
  faces: false,
  floes: false,
  grass: true,
  tileTints: [0xd0dff0, 0xd6e5f4, 0xccdcf1, 0xd3e9ee],
  rain: 0,
  bubbles: 0,
  cloudCover: 0.18,
  fog: 2.2,
  mist: true,
  mistTop: 0xeef2e4,
  mistBottom: 0x8fbcc0,
  floorRoughness: 0.8,
  toon: true,
  outline: 0.035,
  outlineColor: 0x1b2f52,
  skyTop: 0x1c4fa8,
  skyHorizon: 0x78acec,
  cloud: 0xdfeaf7,
  cloudShade: 0x86a3cc,
  seaDeep: 0x2a63b8,
  seaShallow: 0x3d7ed2,
  seaSky: 0x8ebcf0,
  seaGrid: null as number | null,
  hemiSky: 0x8fb4de,
  hemiGround: 0x1e3a52,
  hemi: 1.0,
  sun: 0xe6eefb,
  sunPower: 1.9,
  glow: 0.3,
  lightMetal: 0,
  lightRoughness: 0.5,
  bodyRoughness: 0.75,
  tileWide: 2,
  tileGrout: null as number | null,
};

// As a CSS colour, for canvas textures.
export const css = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
// The colour scaled by k (below 1 darker), for shades of one colour.
export const shade = (c: number, k: number): number =>
  [16, 8, 0].reduce((out, s) => out | (Math.max(0, Math.min(255, Math.round(((c >> s) & 255) * k))) << s), 0);

// Theme overrides.
Object.assign(BOARD, { edge: LIGHT_GREY, board: WHITE, trace: 0xf2a89e, pad: 0xeef4fb, hole: 0x2c4a7a, chip: 0x2c4a7a, chipTop: 0xeef4fb });
Object.assign(CRATE, { body: WHITE, cross: LIGHT_GREY, screen: 0x2c4a7a, shine: 0xeef4fb, light: ORANGE });
Object.assign(PILLAR, { white: WHITE, slate: DARK_GREY, pale: 0xc2d8f0 });
