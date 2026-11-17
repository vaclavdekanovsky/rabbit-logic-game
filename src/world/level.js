// Logical world: the game grid, what occupies it, and whether a step is allowed.
// Nothing here knows about pixels, images or the background.

import { PROPS } from '../config/entities.js';
import { mulberry32, randInt, weightedPick } from '../core/rng.js';

export const DIRS = {
  up:    { dx: 0,  dy: -1, angle: -Math.PI / 2 },
  down:  { dx: 0,  dy: 1,  angle: Math.PI / 2 },
  left:  { dx: -1, dy: 0,  angle: Math.PI },
  right: { dx: 1,  dy: 0,  angle: 0 },
};

// Cell codes
const FREE = 0, BLOCKED = 1, CROSS_V = 2, CROSS_H = 3; // CROSS_V: may only be walked through vertically

export class Level {
  constructor(cols, rows, seed) {
    this.cols = cols;
    this.rows = rows;
    this.seed = seed;
    this.cells = new Uint8Array(cols * rows);
    this.owner = new Array(cols * rows).fill(null); // prop occupying each cell
    this.props = [];
    this.rivers = [];
    this.start = { x: 0, y: 0 };
    this.goal = { x: cols - 1, y: rows - 1 };
    this.solution = [];
  }

  inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  code(x, y) { return this.cells[y * this.cols + x]; }
  propAt(x, y) { return this.inside(x, y) ? this.owner[y * this.cols + x] : null; }

  canMove(x, y, nx, ny) {
    if (!this.inside(nx, ny)) return false;
    const vertical = nx === x;
    for (const c of [this.code(x, y), this.code(nx, ny)]) {
      if (c === CROSS_V && !vertical) return false;
      if (c === CROSS_H && vertical) return false;
    }
    return this.code(nx, ny) !== BLOCKED;
  }

  /** Footprint cells of a prop placed at (x, y); rot = 1 swaps the axes. */
  footprintCells(def, x, y, rot) {
    const [w, h] = def.footprint;
    const out = [];
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = rot ? x + dy : x + dx;
        const cy = rot ? y + dx : y + dy;
        let code = BLOCKED;
        if (def.pass?.[`${dx},${dy}`] === 'cross') code = (w >= h) !== !!rot ? CROSS_V : CROSS_H;
        out.push({ x: cx, y: cy, code });
      }
    }
    return out;
  }

  canPlace(cells, clearance) {
    return cells.every(c =>
      this.inside(c.x, c.y) && this.code(c.x, c.y) === FREE &&
      Math.abs(c.x - this.start.x) + Math.abs(c.y - this.start.y) > clearance &&
      Math.abs(c.x - this.goal.x) + Math.abs(c.y - this.goal.y) > 0);
  }

  /** Places a prop if it fits and the goal stays reachable. */
  tryPlace(type, x, y, rot = 0, clearance = 1) {
    const def = PROPS[type];
    const cells = this.footprintCells(def, x, y, rot);
    if (!this.canPlace(cells, clearance)) return null;
    const [fw, fh] = def.footprint;
    const prop = { type, def, x, y, rot, w: rot ? fh : fw, h: rot ? fw : fh, cells };
    for (const c of cells) { this.cells[c.y * this.cols + c.x] = c.code; this.owner[c.y * this.cols + c.x] = prop; }
    if (!this.solve()) {
      for (const c of cells) { this.cells[c.y * this.cols + c.x] = FREE; this.owner[c.y * this.cols + c.x] = null; }
      this.solve();
      return null;
    }
    this.props.push(prop);
    return prop;
  }

  /**
   * A river is terrain, not a prop: a winding path of cells from one side of the board to the
   * other (it keeps flowing through the border scenery and off the map), blocked everywhere
   * except at its bridges, which can only be crossed straight. Kept only if the goal stays
   * reachable. `points` is the centre line in cell coordinates for the renderer.
   */
  addRiver(rng, bridgeCount) {
    const horizontal = rng() < 0.5;
    const along = horizontal ? this.cols : this.rows;
    const across = horizontal ? this.rows : this.cols;
    const cell = (a, r) => (horizontal ? { x: a, y: r } : { x: r, y: a });

    // walk along the flow axis, now and then stepping sideways by one cell
    const path = [];
    if (across < 3) return null;
    let r = 1 + randInt(rng, across - 2), straight = 0; // never along the outer row: a bridge there leads nowhere
    for (let a = 0; a < along; a++) {
      path.push({ a, r });
      straight++;
      if (a >= 1 && a < along - 2 && straight >= 2 && rng() < 0.32) {
        const nr = r + (rng() < 0.5 ? -1 : 1);
        if (nr >= 1 && nr < across - 1) { r = nr; path.push({ a, r }); straight = 0; }
      }
    }
    const cells = path.map(p => cell(p.a, p.r));
    const taken = c => this.code(c.x, c.y) !== FREE ||
      (c.x === this.start.x && c.y === this.start.y) || (c.x === this.goal.x && c.y === this.goal.y);
    if (cells.some(taken)) return null;

    // bridges only where the river runs straight, and not right next to each other
    const straightAt = i => (path[i - 1]?.r ?? path[i].r) === path[i].r && (path[i + 1]?.r ?? path[i].r) === path[i].r &&
      path[i - 1]?.a !== path[i].a && path[i + 1]?.a !== path[i].a;
    const candidates = path.map((_, i) => i).filter(straightAt).sort(() => rng() - 0.5);
    const bridges = [];
    for (const i of candidates) {
      if (bridges.length < bridgeCount && bridges.every(j => Math.abs(path[j].a - path[i].a) >= 2)) bridges.push(i);
    }
    if (!bridges.length) return null;

    const first = path[0], last = path[path.length - 1];
    const centre = (a, r) => (horizontal ? { x: a + 0.5, y: r + 0.5 } : { x: r + 0.5, y: a + 0.5 });
    const river = {
      isRiver: true,
      def: { kind: 'river', layer: 'ground' },
      horizontal,
      cells,
      bridges: bridges.map(i => cells[i]),
      points: [centre(first.a - 4, first.r), ...path.map(p => centre(p.a, p.r)), centre(last.a + 4, last.r)],
    };
    cells.forEach((c, i) => {
      this.cells[c.y * this.cols + c.x] = bridges.includes(i) ? (horizontal ? CROSS_V : CROSS_H) : BLOCKED;
      this.owner[c.y * this.cols + c.x] = river;
    });
    if (!this.solve()) {
      for (const c of cells) { this.cells[c.y * this.cols + c.x] = FREE; this.owner[c.y * this.cols + c.x] = null; }
      this.solve();
      return null;
    }
    this.rivers.push(river);
    return river;
  }

  /** Breadth-first search; stores the shortest list of directions in `solution`. */
  solve() {
    const prev = new Int32Array(this.cols * this.rows).fill(-1);
    const via = new Array(this.cols * this.rows);
    const startI = this.start.y * this.cols + this.start.x;
    const goalI = this.goal.y * this.cols + this.goal.x;
    prev[startI] = startI;
    const queue = [startI];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      if (i === goalI) break;
      const x = i % this.cols, y = (i - x) / this.cols;
      for (const [name, d] of Object.entries(DIRS)) {
        const nx = x + d.dx, ny = y + d.dy;
        if (!this.canMove(x, y, nx, ny)) continue;
        const ni = ny * this.cols + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = i; via[ni] = name;
        queue.push(ni);
      }
    }
    if (prev[goalI] === -1) { this.solution = []; return false; }
    const path = [];
    for (let i = goalI; i !== startI; i = prev[i]) path.push(via[i]);
    this.solution = path.reverse();
    return true;
  }
}

/**
 * Random, always-solvable level.
 * @param size   entry of SIZES (cols, rows, props, river, blockDirect)
 * @param biome  entry of BIOMES (weighted prop list)
 */
export function generateLevel(size, biome, seed) {
  const rng = mulberry32(seed);
  const { cols, rows } = size;
  const level = new Level(cols, rows, seed);

  if (rng() > 0.5) {
    level.start = { x: 0, y: randInt(rng, rows) };
    level.goal = { x: cols - 1, y: randInt(rng, rows) };
  } else {
    level.start = { x: randInt(rng, cols), y: 0 };
    level.goal = { x: randInt(rng, cols), y: rows - 1 };
  }
  level.solve();

  // Rivers first: they shape the whole board. A fractional count is a probability.
  let rivers = Math.floor(size.river) + (rng() < size.river % 1 ? 1 : 0);
  for (let tries = 0; rivers > 0 && tries < 60; tries++) {
    if (level.addRiver(rng, size.bridges ?? 1)) rivers--;
  }

  const minSide = Math.min(cols, rows);
  const pool = biome.props.filter(([type]) => (PROPS[type].minBoard ?? 0) <= minSide);
  let left = size.props;

  // Make the obvious straight route impossible so the child has to plan a detour.
  if (size.blockDirect) {
    const s = level.solution;
    let x = level.start.x, y = level.start.y;
    const mid = Math.floor(s.length / 2);
    for (let i = 0; i < mid; i++) { x += DIRS[s[i]].dx; y += DIRS[s[i]].dy; }
    if (level.tryPlace(weightedPick(rng, pool.filter(([t]) => PROPS[t].footprint[0] === 1)), x, y)) left--;
  }

  for (let tries = 0; left > 0 && tries < size.props * 40; tries++) {
    const type = weightedPick(rng, pool);
    const rot = PROPS[type].rotatable ? randInt(rng, 2) : 0;
    if (level.tryPlace(type, randInt(rng, cols), randInt(rng, rows), rot)) left--;
  }
  return level;
}
