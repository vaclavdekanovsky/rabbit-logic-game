// Background layer for arbitrarily large maps.
//
// The world is cut into square chunks that are baked to off-screen canvases on demand and
// cached, so cost depends on what is visible, not on the map size. Each chunk is built from
// three passes, all driven by (seed, world position) so neighbouring chunks match exactly:
//
//   1. base     the seamless biome texture, repeated every `ground.cells` game cells
//   2. patches  "texture bombing": soft round stamps of the same texture taken from a random
//               offset / rotation. Same material, but the repeat is no longer visible.
//   3. macro    slow light / shade / colour drift (value noise) spanning several cells.
//
// The background repeat size is independent of the game grid: both are expressed in game
// cells and simply share one coordinate system.

import { hash2, valueNoise } from '../core/rng.js';
import { groundImage } from './assets.js';

const CHUNK_CELLS = 4;
const MACRO_RES = 12; // noise samples per chunk side
const MAX_CACHED = 80;

export class Ground {
  constructor(biome, seed) {
    this.cfg = biome.ground;
    this.seed = seed;
    this.img = groundImage(this.cfg.texture);
    this.cache = new Map();
    this.cellPx = 0;
    this.stamp = document.createElement('canvas');
  }

  /** Draws every chunk intersecting the view. ctx is already scaled to world units. */
  draw(ctx, view, cellPx) {
    if (cellPx !== this.cellPx) { this.cache.clear(); this.cellPx = cellPx; }
    const x0 = Math.floor(view.x / CHUNK_CELLS), x1 = Math.floor((view.x + view.w) / CHUNK_CELLS);
    const y0 = Math.floor(view.y / CHUNK_CELLS), y1 = Math.floor((view.y + view.h) / CHUNK_CELLS);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        // +tiny overlap hides hairline gaps between chunks at fractional camera positions
        ctx.drawImage(this.chunk(cx, cy), cx * CHUNK_CELLS, cy * CHUNK_CELLS, CHUNK_CELLS + 0.01, CHUNK_CELLS + 0.01);
      }
    }
  }

  chunk(cx, cy) {
    const key = `${cx},${cy}`;
    let c = this.cache.get(key);
    if (!c) {
      if (this.cache.size >= MAX_CACHED) this.cache.delete(this.cache.keys().next().value);
      c = this.bake(cx, cy);
      this.cache.set(key, c);
    }
    return c;
  }

  /** Texture pattern mapped to world space, optionally shifted / rotated / mirrored. */
  pattern(ctx, originX, originY, shiftX = 0, shiftY = 0, quarterTurns = 0, mirror = false) {
    const p = ctx.createPattern(this.img, 'repeat');
    const s = (this.cfg.cells * this.cellPx) / this.img.width;
    const m = new DOMMatrix()
      .translateSelf(-originX * this.cellPx, -originY * this.cellPx)
      .rotateSelf(quarterTurns * 90)
      .scaleSelf(mirror ? -s : s, s)
      .translateSelf(shiftX * this.img.width, shiftY * this.img.height);
    p.setTransform(m);
    return p;
  }

  bake(cx, cy) {
    const px = Math.ceil(CHUNK_CELLS * this.cellPx);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    const wx = cx * CHUNK_CELLS, wy = cy * CHUNK_CELLS;

    // 1. base
    ctx.fillStyle = this.pattern(ctx, wx, wy);
    ctx.fillRect(0, 0, px, px);

    // 2. patches on a jittered grid; include neighbours whose radius reaches into this chunk
    const { spacing, radius, alpha } = this.cfg.patches;
    const reach = radius[1];
    const gx0 = Math.floor((wx - reach) / spacing), gx1 = Math.floor((wx + CHUNK_CELLS + reach) / spacing);
    const gy0 = Math.floor((wy - reach) / spacing), gy1 = Math.floor((wy + CHUNK_CELLS + reach) / spacing);
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const h = k => hash2(this.seed, gx, gy, k);
        const r = radius[0] + (radius[1] - radius[0]) * h(2);
        const pxW = (gx + h(0)) * spacing, pyW = (gy + h(1)) * spacing;
        this.stampPatch(ctx, pxW - wx, pyW - wy, r, pxW, pyW, h(3), h(4), Math.floor(h(5) * 4), h(6) > 0.5, alpha);
      }
    }

    // 3. macro variation, sampled one texel beyond the chunk so bilinear scaling is continuous
    this.macro(ctx, wx, wy, px);
    return canvas;
  }

  stampPatch(ctx, lx, ly, r, worldX, worldY, shiftX, shiftY, turns, mirror, alpha) {
    const size = Math.ceil(2 * r * this.cellPx);
    const s = this.stamp;
    if (s.width < size) s.width = s.height = size;
    const sc = s.getContext('2d');
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, size, size);
    sc.fillStyle = this.pattern(sc, worldX - r, worldY - r, shiftX, shiftY, turns, mirror);
    sc.fillRect(0, 0, size, size);
    const g = sc.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sc.globalCompositeOperation = 'destination-in';
    sc.fillStyle = g;
    sc.fillRect(0, 0, size, size);
    ctx.globalAlpha = alpha;
    ctx.drawImage(s, 0, 0, size, size, (lx - r) * this.cellPx, (ly - r) * this.cellPx, size, size);
    ctx.globalAlpha = 1;
  }

  macro(ctx, wx, wy, px) {
    const { size, light, shade, tint } = this.cfg.macro;
    const n = MACRO_RES + 2;
    const texel = CHUNK_CELLS / MACRO_RES;
    const layers = [
      [light, v => Math.max(0, v)],
      [shade, v => Math.max(0, -v)],
      [tint, (v, t) => Math.max(0, t * 1.6 - 0.35)],
    ];
    for (const [color, weight] of layers) {
      const low = document.createElement('canvas');
      low.width = low.height = n;
      const lc = low.getContext('2d');
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = (wx + (i - 0.5) * texel) / size, y = (wy + (j - 0.5) * texel) / size;
          const v = valueNoise(this.seed, x, y, 10) * 0.7 + valueNoise(this.seed, x * 2.3, y * 2.3, 11) * 0.3;
          const t = valueNoise(this.seed, x * 0.8 + 40, y * 0.8 - 17, 12);
          lc.globalAlpha = Math.min(1, weight(v, t));
          lc.fillStyle = color;
          lc.fillRect(i, j, 1, 1);
        }
      }
      const t = texel * this.cellPx;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(low, -t, -t, n * t, n * t);
    }
  }
}
