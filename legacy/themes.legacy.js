export const THEMES = {
  grass: {
    id: 'grass',
    label: '🌿 Grass',
    title: 'Help the Rabbit find the Carrot! 🐇🥕',
    printTitle: 'Help the Rabbit find the Carrot!',
    heroName: 'rabbit',
    goalName: 'carrot',
    winMsg: 'The rabbit found the carrot! Great job!',
    failObstacleMsg: 'The rabbit hit an obstacle or fell in the water!',
    failShortMsg: "The rabbit didn't reach the carrot. Try again!",
    hero: {
      idle: '/happy_rabbit_nobg.png',
      sleeping: '/sleeping_rabbit_nobg.png',
      dizzy: '/rabbit_dizzy_nobg.png',
      eating: '/rabbit_eating_carrot_nobg.png'
    },
    goal: '/carrot_nobg.png',
    arrow: '/arrow_wooden_nobg.png',
    tileBg: '/tile_grass.png',
    boardBg: '/background_grass_surrounded.png',
    borderOverlay: '/border_overlay.png',
    obstacles: ['fox_nobg.png', 'pond_nobg.png', 'rock_nobg.png', 'fireplace_nobg.png'],
    streamFilter: 'none',
    colors: {
      primary: '#4ade80',
      primaryDark: '#22c55e',
      secondary: '#f97316',
      secondaryDark: '#ea580c',
      bgColor: '#f0fdf4',
      titleShadow: '#fde047',
      cellBorder: 'rgba(20, 83, 45, 0.6)',
      cellHighlight: 'rgba(255, 255, 255, 0.5)',
      cellShadow: 'rgba(15, 60, 30, 0.38)',
      cellEvenTint: 'rgba(255, 255, 255, 0.12)',
      cellOddTint: 'rgba(10, 50, 20, 0.14)'
    }
  },
  ice: {
    id: 'ice',
    label: '❄️ Ice',
    title: 'Help the Polar Bear find the Fish! 🐻‍❄️🐟',
    printTitle: 'Help the Polar Bear find the Fish!',
    heroName: 'polar bear',
    goalName: 'fish',
    winMsg: 'The polar bear caught the fish! Great job!',
    failObstacleMsg: 'The polar bear hit an obstacle or slipped into icy water!',
    failShortMsg: "The polar bear didn't reach the fish. Try again!",
    hero: {
      idle: '/polar_bear_happy_nobg.png',
      sleeping: '/polar_bear_happy_nobg.png',
      dizzy: '/polar_bear_happy_nobg.png',
      eating: '/polar_bear_happy_nobg.png'
    },
    goal: '/fish_goal_nobg.png',
    arrow: '/arrow_stone_nobg.png',
    tileBg: '/tile_ice.png',
    boardBg: '/background_ice_surrounded.png',
    borderOverlay: '/border_overlay_ice.png',
    obstacles: ['rock_nobg.png', 'pond_nobg.png', 'fireplace_nobg.png'],
    streamFilter: 'hue-rotate(15deg) brightness(1.15) saturate(1.2)',
    colors: {
      primary: '#38bdf8',
      primaryDark: '#0284c7',
      secondary: '#6366f1',
      secondaryDark: '#4f46e5',
      bgColor: '#f0f9ff',
      titleShadow: '#bae6fd',
      cellBorder: 'rgba(3, 105, 161, 0.65)',
      cellHighlight: 'rgba(255, 255, 255, 0.8)',
      cellShadow: 'rgba(2, 132, 199, 0.4)',
      cellEvenTint: 'rgba(255, 255, 255, 0.22)',
      cellOddTint: 'rgba(3, 105, 161, 0.16)'
    }
  },
  volcanic: {
    id: 'volcanic',
    label: '🌋 Volcanic',
    title: 'Help the Dragon find the Ruby Gem! 🐉💎',
    printTitle: 'Help the Dragon find the Ruby Gem!',
    heroName: 'dragon',
    goalName: 'ruby gem',
    winMsg: 'The dragon found the glowing ruby gem! Great job!',
    failObstacleMsg: 'The dragon hit an obstacle or fell into the lava river!',
    failShortMsg: "The dragon didn't reach the ruby gem. Try again!",
    hero: {
      idle: '/dragon_happy_nobg.png',
      sleeping: '/dragon_happy_nobg.png',
      dizzy: '/dragon_happy_nobg.png',
      eating: '/dragon_happy_nobg.png'
    },
    goal: '/volcanic_gem_nobg.png',
    arrow: '/arrow_magical_nobg.png',
    tileBg: '/tile_lava.png',
    boardBg: '/background_volcanic_surrounded.png',
    borderOverlay: '/border_overlay_volcanic.png',
    obstacles: ['rock_nobg.png', 'fireplace_nobg.png', 'fox_nobg.png'],
    streamFilter: 'hue-rotate(165deg) saturate(2.5) brightness(1.05)',
    colors: {
      primary: '#f97316',
      primaryDark: '#c2410c',
      secondary: '#ef4444',
      secondaryDark: '#b91c1c',
      bgColor: '#fff7ed',
      titleShadow: '#fed7aa',
      cellBorder: 'rgba(251, 146, 60, 0.55)',
      cellHighlight: 'rgba(253, 186, 116, 0.4)',
      cellShadow: 'rgba(0, 0, 0, 0.55)',
      cellEvenTint: 'rgba(255, 180, 100, 0.09)',
      cellOddTint: 'rgba(0, 0, 0, 0.2)'
    }
  }
};

