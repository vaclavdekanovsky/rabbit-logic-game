"""Asset post-processing pipeline for AI-generated sprites.

Replaces the ad-hoc remove_bg.py loop with one deterministic, vectorised pass:

  1. ingest   - copy new images from a staging folder into art/source/ (clean names)
  2. cutout   - remove the white background with an edge-seeded flood fill
                (interior whites such as polar-bear fur survive)
  3. defringe - "colour decontaminate" the anti-aliased edge so no white halo
                remains when the sprite is drawn on dark grass/lava
  4. trim     - crop to the opaque bounding box + uniform padding, square canvas
  5. resize   - downscale to a web size (default 512 px) -> *_nobg.png (+ .webp)

Run with uv so nothing is installed globally:
    uv run --with pillow --with numpy python scripts/process_assets.py --ingest gen_staging
    uv run --with pillow --with numpy python scripts/process_assets.py art/source/fox.png ...
"""
from __future__ import annotations

import argparse
import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "art" / "source"

WHITE_THRESHOLD = 236   # min(R,G,B) at or above this counts as background
SOFT_BAND = 18          # whites within this band below threshold become partly transparent
PADDING = 0.06          # fraction of the final canvas left empty around the sprite
SIZE = 512


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """Boolean mask of near-white pixels connected to the image border."""
    h, w, _ = rgb.shape
    near_white = rgb.min(axis=2) >= WHITE_THRESHOLD
    mask = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_white[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_white[y, x] and not mask[y, x]:
                mask[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True
                q.append((ny, nx))
    return mask


def cutout(img: Image.Image) -> Image.Image:
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    bg = background_mask(rgb.astype(np.uint8))

    # Only a thin ring around the flood-filled background gets soft alpha; the flood fill
    # itself uses the strict threshold so it never leaks into white fur/highlights.
    bg_img = Image.fromarray(bg.astype(np.uint8) * 255)
    ring = (np.asarray(bg_img.filter(ImageFilter.MaxFilter(5))) > 0) & ~bg
    whiteness = rgb.min(axis=2)
    soft = np.clip((WHITE_THRESHOLD - whiteness) / SOFT_BAND, 0.0, 1.0)
    alpha = np.ones(bg.shape, np.float32)
    alpha[bg] = 0.0
    alpha[ring] = soft[ring]

    # Colour decontamination: observed = a*fg + (1-a)*white  ->  fg = (observed - (1-a)*255)/a
    a = np.clip(alpha, 1e-3, 1.0)[..., None]
    fg = np.clip((rgb - (1.0 - a) * 255.0) / a, 0, 255)
    rgba = np.dstack([fg, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def trim_and_resize(img: Image.Image, size: int = SIZE) -> Image.Image:
    bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    side = int(max(w, h) / (1 - 2 * PADDING))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.LANCZOS)


def process(src: Path, size: int = SIZE, webp: bool = True) -> Path:
    out = src.with_name(f"{src.stem}_nobg.png")
    sprite = trim_and_resize(cutout(Image.open(src)), size)
    sprite.save(out, optimize=True)
    if webp:
        sprite.save(out.with_suffix(".webp"), quality=88, method=6)
    kb = out.stat().st_size // 1024
    print(f"{src.name:32s} -> {out.name:36s} {sprite.size[0]}px {kb} KB")
    return out


def ingest(staging: Path) -> list[Path]:
    copied = []
    for f in sorted(staging.glob("*.png")):
        name = f.stem.lower().replace(" ", "_").replace("-", "_")
        dst = PUBLIC / f"{name}.png"
        shutil.copy2(f, dst)
        copied.append(dst)
    return copied


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*", type=Path)
    ap.add_argument("--ingest", type=Path, help="staging folder with freshly generated PNGs")
    ap.add_argument("--size", type=int, default=SIZE)
    ap.add_argument("--no-webp", action="store_true")
    args = ap.parse_args()

    files = list(args.files)
    if args.ingest:
        files += ingest(args.ingest)
    for f in files:
        process(f, args.size, not args.no_webp)


if __name__ == "__main__":
    main()
