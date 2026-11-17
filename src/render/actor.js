// The hero on the map: a logical position in cell coordinates that is tweened from cell
// centre to cell centre, plus the pose supplied by its locomotion profile.

import { LOCOMOTION, idlePose } from './motion.js';

export class Actor {
  constructor(def, cell) {
    this.def = def;
    this.loco = LOCOMOTION[def.locomotion];
    this.x = cell.x;            // cell coordinates; integer = exactly on a cell
    this.y = cell.y;
    this.facing = 1;            // 1 = right, -1 = left
    this.state = 'idle';        // idle | move | sleep | dizzy | win
    this.air = 0;               // flyers: 0 on the ground .. 1 cruising
    this.wantAir = false;
    this.tween = null;
    this.t = 0;
  }

  place(cell) { this.x = cell.x; this.y = cell.y; this.tween = null; this.t = 0; this.state = 'idle'; this.facing = 1; this.wantAir = false; }

  face(dx) { if (dx) this.facing = Math.sign(dx); }

  /** Start of a run: flyers take off first. */
  async begin() {
    this.state = 'move';
    if (this.loco.airborne) { this.wantAir = true; await this.wait(260); }
  }

  /** End of a run: flyers land. */
  async end(state = 'idle') {
    if (this.loco.airborne) { this.wantAir = false; await this.wait(300); }
    this.state = state;
  }

  /** Moves to the centre of cell (x, y). */
  stepTo(x, y) {
    this.face(x - this.x);
    return this.run({ fromX: this.x, fromY: this.y, toX: x, toY: y, ms: this.loco.stepMs, ease: this.loco.ease });
  }

  /** Runs into something: go part of the way, then back to the cell centre. */
  async bump(dx, dy) {
    this.face(dx);
    const { x, y } = this;
    const ms = this.loco.stepMs * 0.45;
    await this.run({ fromX: x, fromY: y, toX: x + dx * 0.38, toY: y + dy * 0.38, ms, ease: t => t });
    await this.run({ fromX: x + dx * 0.38, fromY: y + dy * 0.38, toX: x, toY: y, ms, ease: t => t });
  }

  run(tween) {
    return new Promise(resolve => { this.tween = { ...tween, elapsed: 0, resolve }; });
  }

  wait(ms) {
    return this.run({ fromX: this.x, fromY: this.y, toX: this.x, toY: this.y, ms, ease: t => t, still: true });
  }

  update(dt) {
    this.air += ((this.wantAir ? 1 : 0) - this.air) * Math.min(1, dt * 9);
    const tw = this.tween;
    if (!tw) { this.t = 0; return; }
    tw.elapsed += dt * 1000;
    const raw = Math.min(1, tw.elapsed / tw.ms);
    const k = tw.ease(raw);
    this.x = tw.fromX + (tw.toX - tw.fromX) * k;
    this.y = tw.fromY + (tw.toY - tw.fromY) * k;
    this.t = tw.still ? 0 : raw;
    if (raw >= 1) { this.x = tw.toX; this.y = tw.toY; this.t = 0; this.tween = null; tw.resolve(); }
  }

  pose(time) {
    if (this.state === 'move' || this.air > 0.02) return this.loco.pose(this.t, time, this.air);
    if (this.state === 'sleep') { const p = idlePose(time * 0.5); return p; }
    return idlePose(time);
  }
}
