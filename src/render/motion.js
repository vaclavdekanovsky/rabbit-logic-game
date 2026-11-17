// How heroes move. The hero's logical position always travels from one cell CENTRE to the
// next; a locomotion profile only decides the timing of that step and the pose on the way
// (lift above the ground, squash / stretch, lean). The shadow stays on the ground line, which
// is what makes hops and flight readable.
//
// pose(t, time, air) -> { lift, sx, sy, rot }
//   t     progress of the current step 0..1 (0 when standing)
//   time  seconds, for continuous motion (wing beat, breathing)
//   air   0..1 how airborne a flyer currently is (eased by the actor)
// `lift` is in game cells, `rot` in radians for a hero facing right.

const smooth = t => t * t * (3 - 2 * t);

export const LOCOMOTION = {
  // Bunny: one hop per cell. Crouch -> stretch in the air -> squash on landing.
  hop: {
    stepMs: 400,
    ease: t => smooth(t),
    pose(t) {
      const s = Math.sin(Math.PI * t);
      return { lift: 0.3 * s, sx: 1.08 - 0.14 * s, sy: 0.9 + 0.2 * s, rot: -0.13 * Math.sin(2 * Math.PI * t) };
    },
  },
  // Polar bear: steady heavy walk, two steps per cell, body rolls side to side.
  walk: {
    stepMs: 640,
    ease: t => t,
    pose(t) {
      const w = Math.sin(2 * Math.PI * t * 2);
      return { lift: 0.035 * Math.abs(w), sx: 1 + 0.02 * w, sy: 1 - 0.02 * Math.abs(w), rot: 0.055 * w };
    },
  },
  // Dragon: takes off, glides between cells without touching down, lands at the end.
  fly: {
    stepMs: 340,
    ease: t => t,
    airborne: true,
    pose(t, time, air) {
      const beat = Math.sin(time * 16);
      return { lift: air * (0.42 + 0.05 * Math.sin(time * 5)), sx: 1 + 0.05 * beat * air, sy: 1 - 0.07 * beat * air, rot: 0.12 * air };
    },
  },
};

/** Gentle breathing for anything that is standing still (hero, enemies). */
export function idlePose(time, phase = 0) {
  const b = Math.sin(time * 2.6 + phase);
  return { lift: 0, sx: 1 - 0.012 * b, sy: 1 + 0.022 * b, rot: 0 };
}
