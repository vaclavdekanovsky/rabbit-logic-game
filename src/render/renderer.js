// Draws the world. One coordinate system for everything: 1 unit = 1 game cell, cell (x, y)
// covers [x, x+1] x [y, y+1] and its centre is (x + 0.5, y + 0.5).
//
// Layers, bottom to top:
//   1. ground        background chunks (render/ground.js) - independent tile size
//   2. border shade  darkens the scenery ring outside the playable cells
//   3. river         banks blended into the ground, flowing liquid, bridges (render/river.js)
//   4. pads          the game tiles the hero steps on (none on the river)
//   5. flat props    ponds, flat goals, the planned trail
//   6. standing      props, enemies, border scenery, goal and hero, sorted by their feet

import { VIEW } from '../config/biomes.js';
import { hash2 } from '../core/rng.js';
import { heroFrame, sprite } from './assets.js';
import { Ground } from './ground.js';
import { idlePose } from './motion.js';
import { RiverLayer } from './river.js';

const FEET = 0.42; // feet sit this fraction of the sprite height below the cell centre

export class Renderer {
  constructor(canvas, { biome, level, actor, goalDef }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.biome = biome;
    this.level = level;
    this.actor = actor;
    this.goalDef = goalDef;
    this.goalVisible = true;
    this.trail = [];
    this.ground = new Ground(biome, level.seed);

    const m = biome.border.margin;
    this.world = { x: -m, y: -m, w: level.cols + 2 * m, h: level.rows + 2 * m };
    this.view = { x: 0, y: 0, w: Math.min(this.world.w, VIEW.maxCols), h: Math.min(this.world.h, VIEW.maxRows) };
    this.aspect = this.view.w / this.view.h;
    this.look = null;       // free-look target (view origin) set by dragging; null = follow the hero
    this.dragging = false;
    this.lastLook = 0;
    this.overview = false;
    this.river = new RiverLayer(biome, level, this.world);
    this.scenery = this.buildScenery();
    this.follow(1);
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.round(w / this.aspect);
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.cellPx = w / this.view.w;
  }

  /** True when the map is larger than the window onto it, so panning / overview make sense. */
  get scrolls() {
    return this.world.w > VIEW.maxCols + 0.01 || this.world.h > VIEW.maxRows + 0.01;
  }

  /** Overview shows the whole map at once; off returns to the normal, hero-following window. */
  setOverview(on) {
    this.overview = on && this.scrolls;
    this.look = null;
    this.view.w = this.overview ? this.world.w : Math.min(this.world.w, VIEW.maxCols);
    this.view.h = this.overview ? this.world.h : Math.min(this.world.h, VIEW.maxRows);
    this.aspect = this.view.w / this.view.h;
    this.follow(1);
    this.resize();
  }

  clampView(x, y) {
    const { world, view } = this;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    return {
      x: clamp(x, world.x, world.x + world.w - view.w),
      y: clamp(y, world.y, world.y + world.h - view.h),
    };
  }

  /** Free look: move the window by (dx, dy) cells. It drifts back to the hero when left alone. */
  panBy(dx, dy) {
    if (this.overview || !this.scrolls) return;
    const base = this.look ?? this.view;
    this.look = this.clampView(base.x + dx, base.y + dy);
    this.view.x = this.look.x;
    this.view.y = this.look.y;
    this.lastLook = performance.now();
  }

  /** Back to following the hero. */
  recenter() { this.look = null; }

  /** Camera keeps the hero in view (or the free-look spot); `k` = 1 snaps, smaller values glide. */
  follow(k) {
    const { view, actor } = this;
    if (this.look && !this.dragging && performance.now() - this.lastLook > 4000) this.look = null;
    const t = this.look ?? this.clampView(actor.x + 0.5 - view.w / 2, actor.y + 0.5 - view.h / 2);
    view.x += (t.x - view.x) * k;
    view.y += (t.y - view.y) * k;
  }

  /** Rocks etc. scattered in the ring outside the board, deterministic per level. */
  buildScenery() {
    const { level, biome } = this;
    const m = biome.border.margin;
    const out = [];
    const step = 0.5;
    for (let gy = Math.floor(-m / step); gy * step < level.rows + m; gy++) {
      for (let gx = Math.floor(-m / step); gx * step < level.cols + m; gx++) {
        const h = k => hash2(level.seed, gx, gy, 20 + k);
        const x = (gx + 0.2 + 0.6 * h(0)) * step, y = (gy + 0.2 + 0.6 * h(1)) * step;
        const inside = x > -0.12 && y > 0.1 && x < level.cols + 0.12 && y < level.rows + 0.3;
        if (inside || h(2) > biome.border.density || this.river.distance(x, y - 0.15) < 0.62) continue;
        const pick = biome.border.scatter[Math.floor(h(3) * biome.border.scatter.length)][0];
        out.push({ sprite: pick, x, y, height: 0.26 + 0.3 * h(4), flip: h(5) > 0.5 ? 1 : -1 });
      }
    }
    return out;
  }

  draw(time, dt) {
    const { ctx, view, level, biome } = this;
    this.resize();
    this.follow(Math.min(1, dt * 5));
    const s = this.cellPx;
    ctx.setTransform(s, 0, 0, s, -Math.round(view.x * s), -Math.round(view.y * s));
    ctx.imageSmoothingQuality = 'high';

    this.ground.draw(ctx, view, s);
    this.drawBorderShade();
    this.river.draw(ctx, view, s, time);
    this.drawPads();
    this.river.drawBridges(ctx);

    for (const p of level.props) if (p.def.layer === 'ground') this.drawFlatProp(p);
    this.drawTrail(time);

    const standing = [];
    for (const p of level.props) if (p.def.layer !== 'ground') standing.push(this.standingProp(p, time));
    for (const sc of this.scenery) {
      standing.push({ y: sc.y, draw: () => this.drawSprite(sprite(sc.sprite), sc.x, sc.y, sc.height, { flip: sc.flip, shadow: 0.2 }) });
    }
    if (this.goalVisible) standing.push(this.goalItem(time));
    standing.push(this.heroItem(time));
    standing.sort((a, b) => a.y - b.y);
    for (const it of standing) it.draw();
  }

  drawBorderShade() {
    const { ctx, world, level, biome } = this;
    ctx.fillStyle = biome.border.shade;
    ctx.beginPath();
    ctx.rect(world.x - 1, world.y - 1, world.w + 2, world.h + 2);
    ctx.roundRect(-0.08, -0.08, level.cols + 0.16, level.rows + 0.16, 0.22);
    ctx.fill('evenodd');
  }

  /** Game tiles. Cells under a multi-cell flat prop (river) get no pad. */
  drawPads() {
    const { ctx, level, view } = this;
    const pad = this.biome.pad;
    const inset = 0.035, r = 0.14;
    const x0 = Math.max(0, Math.floor(view.x)), x1 = Math.min(level.cols - 1, Math.floor(view.x + view.w));
    const y0 = Math.max(0, Math.floor(view.y)), y1 = Math.min(level.rows - 1, Math.floor(view.y + view.h));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const owner = level.propAt(x, y);
        if (owner && (owner.isRiver || (owner.def.layer === 'ground' && owner.cells.length > 1))) continue;
        ctx.beginPath();
        ctx.roundRect(x + inset, y + inset, 1 - 2 * inset, 1 - 2 * inset, r);
        ctx.fillStyle = (x + y) % 2 === 0 ? pad.even : pad.odd;
        ctx.fill();
        ctx.lineWidth = 0.028;
        ctx.strokeStyle = pad.border;
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(x + inset + 0.03, y + inset + 0.03, 1 - 2 * inset - 0.06, 1 - 2 * inset - 0.06, r - 0.03);
        ctx.lineWidth = 0.014;
        ctx.strokeStyle = pad.highlight;
        ctx.stroke();
      }
    }
  }

  drawFlatProp(p) {
    const { ctx } = this;
    const d = sprite(p.def.sprite);
    const [fw, fh] = p.def.footprint;
    const aspect = d.sw / d.sh;
    const w = Math.min(fw * p.def.fill, fh * 1.15 * aspect);
    const h = w / aspect;
    ctx.save();
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
    if (p.rot) ctx.rotate(Math.PI / 2);
    ctx.drawImage(d.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  standingProp(p, time) {
    const d = sprite(p.def.sprite);
    const aspect = d.sw / d.sh;
    const h = Math.min(p.w * p.def.fill / aspect, p.h * p.def.fill * 1.1);
    const gx = p.x + p.w / 2, gy = p.y + p.h / 2 + h * FEET;
    const enemy = p.def.kind === 'enemy';
    const pose = enemy ? idlePose(time, p.x * 1.7 + p.y) : {};
    const flip = enemy && this.actor.x + 0.5 < gx ? -1 : 1;
    return { y: gy, draw: () => this.drawSprite(d, gx, gy, h, { ...pose, flip }) };
  }

  goalItem(time) {
    const { goal } = this.level;
    const d = sprite(this.goalDef.sprite);
    const h = this.goalDef.height;
    const flat = this.goalDef.layer === 'ground';
    const gx = goal.x + 0.5;
    const gy = goal.y + 0.5 + (flat ? h * 0.5 : h * FEET);
    const pulse = 1 + 0.04 * Math.sin(time * 3);
    return { y: flat ? goal.y : gy, draw: () => this.drawSprite(d, gx, gy, h, { sx: pulse, sy: pulse, shadow: flat ? 0 : 0.28, ayOverride: flat ? 1 : undefined }) };
  }

  heroItem(time) {
    const a = this.actor;
    const d = heroFrame(a.def.art, a.state, time, a.t);
    const h = a.def.height;
    const gx = a.x + 0.5, gy = a.y + 0.5 + h * FEET;
    // Wide side-view frames (a bear on all fours) are limited to about one cell in width.
    const size = Math.min(h * d.scale, 1.08 * d.sh / d.sw);
    // A baked animation already contains its own deformation; keep only the lift.
    const pose = d.animated ? { lift: a.pose(time).lift } : a.pose(time);
    return { y: gy + 0.001, draw: () => this.drawSprite(d, gx, gy, size, { ...pose, flip: a.facing }) };
  }

  /** Draws a sprite pinned by its anchor to the ground point (gx, gy). */
  drawSprite(d, gx, gy, h, { lift = 0, sx = 1, sy = 1, rot = 0, flip = 1, shadow = 0.28, ayOverride } = {}) {
    const { ctx } = this;
    const w = h * d.sw / d.sh;
    const ay = ayOverride ?? d.ay;
    if (shadow) {
      const k = 1 - Math.min(0.45, lift * 0.9);
      ctx.fillStyle = `rgba(0,0,0,${shadow * k})`;
      ctx.beginPath();
      ctx.ellipse(gx, gy - h * 0.02, w * 0.36 * k, w * 0.13 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(gx, gy - lift);
    ctx.rotate(rot * flip);
    ctx.scale(flip * sx, sy);
    ctx.drawImage(d.img, d.sx, d.sy, d.sw, d.sh, -d.ax * w, -ay * h, w, h);
    ctx.restore();
  }

  drawTrail(time) {
    const { ctx } = this;
    const d = sprite('footprint');
    const pulse = 0.5 + 0.04 * Math.sin(time * 4);
    for (const p of this.trail) {
      ctx.save();
      ctx.translate(p.x + 0.5, p.y + 0.5);
      if (p.kind !== 'plain') {
        ctx.fillStyle = p.kind === 'error' ? 'rgba(239,68,68,0.6)' : 'rgba(34,197,94,0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(d.img, -pulse / 2, -pulse / 2, pulse, pulse);
      ctx.restore();
    }
  }
}
