// A biome = one look for the whole map. Three independent layers are configured here:
//
//   ground  BACKGROUND tiles. A seamless texture whose repeat size is given in game cells
//           (`cells`, any number - it does not have to line up with the game grid), plus the
//           variation that keeps a large map from looking tiled.
//   pad     GAME tiles. The cells the hero actually steps on, drawn on top of the ground.
//   border  scenery ring outside the playable cells.
//   river   how water / lava is drawn (render/river.js): MaterialCraft textures, banks that
//           fade into the ground, the Blender bridge and the VectorCraft floating details.
//
// Lengths are in game cells; colours are plain CSS colours.

export const BIOMES = {
  grass: {
    label: '🌿 Grass',
    hero: 'bunny',
    goal: 'carrot',
    arrow: 'arrow_wooden',
    ground: {
      texture: 'grass',
      cells: 3.4,
      // texture bombing: soft patches of the same texture, shifted and rotated
      patches: { spacing: 1.7, radius: [0.9, 1.5], alpha: 1 },
      // macro variation: large, slow light / shade / colour drift across the world
      macro: { size: 4.5, light: 'rgba(255, 244, 150, 0.20)', shade: 'rgba(6, 60, 30, 0.34)', tint: 'rgba(214, 190, 70, 0.30)' },
    },
    pad: { even: 'rgba(255,255,255,0.13)', odd: 'rgba(10,50,20,0.13)', border: 'rgba(20,83,45,0.62)', highlight: 'rgba(255,255,255,0.45)' },
    border: { margin: 0.7, shade: 'rgba(8, 40, 18, 0.34)', scatter: [['rock', 1]], density: 0.3 },
    props: [['rock', 4], ['pond', 3], ['fox', 2], ['campfire', 2], ['boulder', 1]],
    river: {
      texture: 'river_grass', shine: 'river_grass_shine', shineBlend: 'screen', shineAlpha: 0.32,
      bridge: 'bridge_wood', floaters: 'floaters_grass',
      width: 0.66, flow: 0.22, repeat: 1.7,
      rim: 'rgba(170, 232, 255, 0.42)',
      // soft bands under the water, widest first: damp grass, then dark wet earth at the edge
      banks: [
        { grow: 0.24, blur: 0.10, color: 'rgba(30, 60, 14, 0.75)', blend: 'multiply' },
        { grow: 0.085, blur: 0.03, color: 'rgba(92, 64, 30, 0.95)', blend: 'source-over' },
      ],
    },
    text: {
      title: 'Help the Rabbit find the Carrot! 🐇🥕',
      win: 'The rabbit found the carrot! Great job!',
      bump: 'The rabbit hit an obstacle or fell in the water!',
      short: "The rabbit didn't reach the carrot. Try again!",
    },
    ui: { primary: '#4ade80', primaryDark: '#22c55e', secondary: '#f97316', secondaryDark: '#ea580c', bg: '#f0fdf4', titleShadow: '#fde047' },
  },

  ice: {
    label: '❄️ Ice',
    hero: 'bear',
    goal: 'fish',
    arrow: 'arrow_stone',
    ground: {
      texture: 'ice',
      cells: 4.2,
      patches: { spacing: 2.1, radius: [1.1, 1.9], alpha: 1 },
      macro: { size: 5, light: 'rgba(255, 255, 255, 0.30)', shade: 'rgba(20, 80, 140, 0.26)', tint: 'rgba(120, 200, 235, 0.22)' },
    },
    pad: { even: 'rgba(255,255,255,0.24)', odd: 'rgba(3,105,161,0.14)', border: 'rgba(3,105,161,0.6)', highlight: 'rgba(255,255,255,0.8)' },
    border: { margin: 0.7, shade: 'rgba(10, 60, 110, 0.30)', scatter: [['rock', 1]], density: 0.3 },
    props: [['rock', 4], ['pond', 3], ['campfire', 2], ['boulder', 1]],
    river: {
      texture: 'river_ice', shine: 'river_ice_shine', shineBlend: 'screen', shineAlpha: 0.2,
      bridge: 'bridge_ice', floaters: 'floaters_ice',
      width: 0.66, flow: 0.1, repeat: 1.9,
      rim: 'rgba(150, 215, 240, 0.4)',
      // a wide drift of snow, then the bright broken ice edge
      banks: [
        { grow: 0.22, blur: 0.10, color: 'rgba(255, 255, 255, 0.75)', blend: 'source-over' },
        { grow: 0.06, blur: 0.03, color: 'rgba(120, 190, 225, 0.9)', blend: 'source-over' },
      ],
    },
    text: {
      title: 'Help the Polar Bear find the Fish! 🐻‍❄️🐟',
      win: 'The polar bear caught the fish! Great job!',
      bump: 'The polar bear hit an obstacle or slipped into icy water!',
      short: "The polar bear didn't reach the fish. Try again!",
    },
    ui: { primary: '#38bdf8', primaryDark: '#0284c7', secondary: '#6366f1', secondaryDark: '#4f46e5', bg: '#f0f9ff', titleShadow: '#bae6fd' },
  },

  volcanic: {
    label: '🌋 Volcanic',
    hero: 'dragon',
    goal: 'gem',
    arrow: 'arrow_magic',
    ground: {
      texture: 'volcanic',
      cells: 3.8,
      patches: { spacing: 1.9, radius: [1.0, 1.7], alpha: 1 },
      macro: { size: 4.5, light: 'rgba(255, 190, 90, 0.20)', shade: 'rgba(10, 4, 14, 0.46)', tint: 'rgba(255, 70, 20, 0.20)' },
    },
    pad: { even: 'rgba(40,30,40,0.50)', odd: 'rgba(15,10,18,0.62)', border: 'rgba(251,146,60,0.7)', highlight: 'rgba(253,186,116,0.4)' },
    border: { margin: 0.7, shade: 'rgba(10, 0, 0, 0.42)', scatter: [['rock', 1]], density: 0.32 },
    props: [['rock', 4], ['campfire', 2], ['fox', 2], ['boulder', 1]],
    river: {
      texture: 'river_volcanic', shine: 'river_volcanic_shine', shineBlend: 'lighter', shineAlpha: 0.45,
      bridge: 'bridge_stone', floaters: 'floaters_volcanic',
      width: 0.66, flow: 0.14, repeat: 1.8,
      rim: 'rgba(255, 225, 120, 0.5)',
      // heat glow on the rock, then the scorched black crust at the edge
      banks: [
        { grow: 0.34, blur: 0.16, color: 'rgba(255, 110, 20, 0.5)', blend: 'lighter' },
        { grow: 0.08, blur: 0.035, color: 'rgba(22, 10, 12, 0.95)', blend: 'source-over' },
      ],
    },
    text: {
      title: 'Help the Dragon find the Ruby Gem! 🐉💎',
      win: 'The dragon found the glowing ruby gem! Great job!',
      bump: 'The dragon hit an obstacle or fell into the lava river!',
      short: "The dragon didn't reach the ruby gem. Try again!",
    },
    ui: { primary: '#f97316', primaryDark: '#c2410c', secondary: '#ef4444', secondaryDark: '#b91c1c', bg: '#fff7ed', titleShadow: '#fed7aa' },
  },
};

/** Board presets. `view` caps how many cells are visible at once; bigger maps scroll with the hero. */
export const SIZES = {
  easy:   { cols: 4,  rows: 4, props: 2,  river: 0 },
  medium: { cols: 5,  rows: 5, props: 3,  river: 0.6, blockDirect: true },
  hard:   { cols: 6,  rows: 6, props: 6,  river: 1,   bridges: 2, blockDirect: true },
  big:    { cols: 14, rows: 9, props: 24, river: 2,   bridges: 3, blockDirect: true },
};

export const VIEW = { maxCols: 9.4, maxRows: 7.4 };
