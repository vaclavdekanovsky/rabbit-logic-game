// Rivers as part of the terrain instead of a pasted picture.
//
// A river is a centre line through cell centres (world/level.js). From it this layer bakes,
// once per level and zoom, three world-sized images:
//
//   banks  soft bands wider than the water (damp earth / snow drift / heat glow). They are
//          blurred and blended over the ground texture, which is what makes the river sit IN
//          the map: there is no hard outline, the ground simply changes towards the water.
//   mask   the water shape, with an irregular edge (the width wobbles with noise)
//   rim    a light shallow band just inside the edge
//
// Every frame the liquid is drawn by scrolling two seamless MaterialCraft textures (colour
// and shine) at different speeds and cutting them out with the mask, so it flows.
// On top: VectorCraft floating details and the Blender / PhotoCraft bridge at each crossing.

import { hash2, valueNoise } from '../core/rng.js';
import { groundImage, sprite } from './assets.js';

const STEP = 0.05; // spacing of samples along the centre line, in cells

/** Rounds the corners of a polyline (Chaikin), keeping its end points. */
function smooth(points, rounds = 3) {
  let pts = points;
  for (let k = 0; k < rounds; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/** Evenly spaced samples with the distance travelled, for width noise and floaters. */
function resample(points) {
  const out = [];
  let dist = 0, carry = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let t = carry;
    for (; t < len; t += STEP) {
      out.push({ x: a.x + (b.x - a.x) * t / len, y: a.y + (b.y - a.y) * t / len, d: dist + t });
    }
    carry = t - len;
    dist += len;
  }
  return out;
}

export class RiverLayer {
  constructor(biome, level, world) {
    this.cfg = biome.river;
    this.level = level;
    this.world = world;
    this.rivers = level.rivers.map(r => ({ river: r, samples: resample(smooth(r.points)) }));
    this.cellPx = 0;
    this.scratch = document.createElement('canvas');
    this.floaters = this.placeFloaters();
  }

  get empty() { return this.rivers.length === 0; }

  /** Shortest distance from a point to any river centre line (for keeping scenery out). */
  distance(x, y) {
    let best = Infinity;
    for (const { samples } of this.rivers) {
      for (let i = 0; i < samples.length; i += 4) best = Math.min(best, Math.hypot(samples[i].x - x, samples[i].y - y));
    }
    return best;
  }

  placeFloaters() {
    const { level } = this;
    const out = [];
    this.rivers.forEach(({ river, samples }, ri) => {
      const every = Math.round(0.9 / STEP);
      for (let i = every; i < samples.length - every; i += every) {
        const h = k => hash2(level.seed, i, ri, 40 + k);
        const s = samples[Math.min(samples.length - 1, i + Math.floor((h(0) - 0.5) * every * 0.6))];
        const nearBridge = river.bridges.some(b => Math.hypot(b.x + 0.5 - s.x, b.y + 0.5 - s.y) < 0.75);
        if (nearBridge || h(1) < 0.25) continue;
        out.push({ x: s.x, y: s.y, frame: Math.floor(h(2) * 3), size: 0.27 + 0.13 * h(3), spin: h(4) * 6.28, phase: h(5) * 6.28 });
      }
    });
    return out;
  }

  /** Canvas the size of the whole world at the current zoom. */
  worldCanvas() {
    const c = document.createElement('canvas');
    c.width = Math.ceil(this.world.w * this.cellPx);
    c.height = Math.ceil(this.world.h * this.cellPx);
    return c;
  }

  /** The river body: overlapping discs along the centre line, radius wobbling with noise. */
  shape(grow) {
    const c = this.worldCanvas();
    const ctx = c.getContext('2d');
    const s = this.cellPx, { world, level } = this;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    this.rivers.forEach(({ samples }, ri) => {
      for (const p of samples) {
        const wobble = 1 + 0.16 * valueNoise(level.seed, p.d * 1.4, ri * 9.1, 30) + 0.07 * valueNoise(level.seed, p.d * 4.2, ri * 9.1, 31);
        const r = Math.max(0.05, (this.cfg.width / 2) * wobble + grow) * s;
        const x = (p.x - world.x) * s, y = (p.y - world.y) * s;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    });
    ctx.fill();
    return c;
  }

  /** Blurs a shape and optionally recolours it. */
  soften(shape, blurCells, color) {
    const c = this.worldCanvas();
    const ctx = c.getContext('2d');
    ctx.filter = `blur(${(blurCells * this.cellPx).toFixed(2)}px)`;
    ctx.drawImage(shape, 0, 0);
    ctx.filter = 'none';
    if (color) {
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    return c;
  }

  bake(cellPx) {
    this.cellPx = cellPx;
    const body = this.shape(0);
    this.mask = this.soften(body, 0.018);
    this.banks = this.cfg.banks.map(b => ({ blend: b.blend, image: this.soften(this.shape(b.grow), b.blur, b.color) }));
    // rim = light colour everywhere on the water except a blurred core
    this.rim = this.soften(body, 0, this.cfg.rim);
    const rc = this.rim.getContext('2d');
    rc.globalCompositeOperation = 'destination-out';
    rc.drawImage(this.soften(this.shape(-0.06), 0.05), 0, 0);
  }

  /** Scrolling seamless texture, repeat size given in cells. */
  fillFlow(ctx, image, w, h, view, repeat, dx, dy) {
    const p = ctx.createPattern(image, 'repeat');
    const k = (repeat * this.cellPx) / image.width;
    p.setTransform(new DOMMatrix().translateSelf((dx - view.x) * this.cellPx, (dy - view.y) * this.cellPx).scaleSelf(k, k));
    ctx.fillStyle = p;
    ctx.fillRect(0, 0, w, h);
  }

  /** `main` is the game canvas context; drawing happens in device pixels. */
  draw(main, view, cellPx, time) {
    if (this.empty) return;
    if (cellPx !== this.cellPx) this.bake(cellPx);
    const { cfg, world, scratch } = this;
    const canvas = main.canvas;
    const ox = Math.round((world.x - view.x) * cellPx), oy = Math.round((world.y - view.y) * cellPx);

    main.save();
    main.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of this.banks) {
      main.globalCompositeOperation = b.blend;
      main.drawImage(b.image, ox, oy);
    }
    main.globalCompositeOperation = 'source-over';

    if (scratch.width !== canvas.width || scratch.height !== canvas.height) {
      scratch.width = canvas.width;
      scratch.height = canvas.height;
    }
    const sc = scratch.getContext('2d');
    const flow = time * cfg.flow;
    sc.globalCompositeOperation = 'source-over';
    sc.globalAlpha = 1;
    this.fillFlow(sc, groundImage(cfg.texture), canvas.width, canvas.height, view, cfg.repeat, flow, flow * 0.35);
    sc.globalCompositeOperation = cfg.shineBlend;
    sc.globalAlpha = cfg.shineAlpha;
    this.fillFlow(sc, groundImage(cfg.shine), canvas.width, canvas.height, view, cfg.repeat * 1.37, flow * 1.9 + 0.3, -flow * 0.5);
    sc.globalCompositeOperation = 'source-over';
    sc.globalAlpha = 1;
    sc.drawImage(this.rim, ox, oy);
    sc.globalCompositeOperation = 'destination-in';
    sc.drawImage(this.mask, ox, oy);
    main.drawImage(scratch, 0, 0);
    main.restore();

    this.drawFloaters(main, time);
  }

  drawFloaters(ctx, time) {
    const d = sprite(this.cfg.floaters);
    const fw = d.sw / 3;
    for (const f of this.floaters) {
      ctx.save();
      ctx.translate(f.x + 0.03 * Math.sin(time * 0.9 + f.phase), f.y + 0.03 * Math.cos(time * 0.7 + f.phase));
      ctx.rotate(f.spin + 0.12 * Math.sin(time * 0.6 + f.phase));
      ctx.drawImage(d.img, f.frame * fw, 0, fw, d.sh, -f.size / 2, -f.size / 2, f.size, f.size);
      ctx.restore();
    }
  }

  /** Drawn after the pads so the deck rests on the tiles at both ends. The art is made for
   *  a river flowing left-right and covers 1.5 cells. */
  drawBridges(ctx) {
    const d = sprite(this.cfg.bridge);
    const size = 1.36;
    for (const { river } of this.rivers) {
      for (const b of river.bridges) {
        ctx.save();
        ctx.translate(b.x + 0.5, b.y + 0.5);
        if (!river.horizontal) ctx.rotate(Math.PI / 2);
        ctx.drawImage(d.img, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  }
}
