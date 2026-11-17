// Runtime side of the asset manifest produced by pipeline/build_assets.py.

import manifest from '../generated/assets.json';

const images = new Map();

function load(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Missing asset ${url} - run "npm run assets"`));
    img.src = url;
  });
}

export async function loadAssets() {
  const entries = [
    ...Object.values(manifest.sprites),
    ...Object.values(manifest.grounds),
    ...Object.values(manifest.sheets ?? {}),
  ];
  await Promise.all(entries.map(async e => images.set(e.url, await load(e.url))));
}

export const spriteUrl = id => manifest.sprites[id].url;
export const groundImage = id => images.get(manifest.grounds[id].url);

/** A drawable: image + source rect + size + anchor. */
export function sprite(id) {
  const m = manifest.sprites[id];
  return { img: images.get(m.url), sx: 0, sy: 0, sw: m.w, sh: m.h, ax: m.ax, ay: m.ay, scale: 1, animated: false };
}

/**
 * Art for a hero state. An animation sheet `<art>_<state>` wins; otherwise the still
 * `<art>_<state>`; otherwise `<art>_idle`. `time` is in seconds; `phase` (0..1) is the progress of the current step and
 * drives sheets built with `--sync step`, so one hop on screen is exactly one hop cycle.
 */
export function heroFrame(art, state, time, phase = 0) {
  const sheet = manifest.sheets?.[`${art}_${state}`];
  if (sheet) {
    const f = sheet.sync === 'step'
      ? Math.min(sheet.frames - 1, Math.floor(phase * sheet.frames))
      : Math.floor(time * sheet.fps) % sheet.frames;
    return { img: images.get(sheet.url), sx: f * sheet.frameW, sy: 0, sw: sheet.frameW, sh: sheet.frameH, ax: sheet.ax, ay: sheet.ay, scale: sheet.scale ?? 1, animated: true };
  }
  return sprite(manifest.sprites[`${art}_${state}`] ? `${art}_${state}` : `${art}_idle`);
}
