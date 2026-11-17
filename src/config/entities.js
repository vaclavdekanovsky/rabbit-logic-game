// Catalogue of everything that can stand on the map. All sizes are in GAME CELLS, never
// pixels, so the art resolution and the background tile size can change freely.

/**
 * Heroes. `locomotion` selects the movement profile in render/motion.js.
 * Art is resolved by naming convention against the asset manifest:
 *   sheet  `<art>_<state>`  (animated, from pipeline/make_sheet.py)  wins over
 *   sprite `<art>_<state>`  (still image)                            which falls back to
 *   sprite `<art>_idle`.
 * States: idle, move, sleep, dizzy, win.
 */
export const HEROES = {
  bunny:  { art: 'bunny',  locomotion: 'hop',  height: 0.92 },
  bear:   { art: 'bear',   locomotion: 'walk', height: 0.98 },
  dragon: { art: 'dragon', locomotion: 'fly',  height: 0.98 },
};

export const GOALS = {
  carrot: { sprite: 'carrot', height: 0.8 },
  fish:   { sprite: 'fish',   height: 0.5, layer: 'ground' },
  gem:    { sprite: 'gem',    height: 0.8 },
};

/**
 * Blockers and enemies.
 *   footprint [w, h]  game cells occupied (multi-tile allowed)
 *   layer     'standing' = y-sorted with the hero, anchored at its feet
 *             'ground'   = flat, drawn under everything that stands, stretched over the footprint
 *   fill      fraction of the footprint the art covers
 *   rotatable footprint may be placed rotated by 90 degrees
 *   pass      per-footprint-cell exceptions, keyed "dx,dy" in unrotated space:
 *             'cross' = walkable only straight across the long axis (a bridge)
 *   kind      'blocker' | 'enemy' (enemies breathe, face the hero and have their own message)
 *   minBoard  smallest board side on which the generator may use it
 *
 * Rivers are not props: they are terrain, generated as a path in world/level.js and drawn by
 * render/river.js.
 */
export const PROPS = {
  rock:     { kind: 'blocker', sprite: 'rock',     footprint: [1, 1], layer: 'standing', fill: 0.92 },
  boulder:  { kind: 'blocker', sprite: 'rock',     footprint: [2, 2], layer: 'standing', fill: 0.94, minBoard: 5 },
  campfire: { kind: 'blocker', sprite: 'campfire', footprint: [1, 1], layer: 'standing', fill: 0.9 },
  pond:     { kind: 'blocker', sprite: 'pond',     footprint: [1, 1], layer: 'ground',   fill: 0.96 },
  fox:      { kind: 'enemy',   sprite: 'fox',      footprint: [1, 1], layer: 'standing', fill: 0.62,
              bumpMsg: 'Watch out, a fox! Find a way around it.' },
};
