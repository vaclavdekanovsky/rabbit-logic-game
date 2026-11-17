"""Turn AI-generated animation frames into a game-ready sprite sheet.

Sheet ids follow the convention <hero>_<state>, e.g. bunny_move, bear_move, dragon_move,
bunny_idle. The game picks a sheet up automatically when one with that id exists and falls
back to the still image + procedural motion otherwise.

Input is either a folder of frames (sorted by name; e.g. frames extracted from an
image-to-video clip with `ffmpeg -i run.mp4 -vf fps=12 frames/%03d.png`) or one sheet image,
whose frames are found automatically (pass --cols/--rows only for a strict grid):

    npm run sheet -- bunny_move --grid gen_staging/bunny_move.png --cutout --sync step
    npm run sheet -- dragon_move --grid gen_staging/dragon_move.png --cutout --align canvas --fps 12
    npm run sheet -- bear_move --frames gen_staging/bear_walk --cutout --sync step
    npm run assets      # merges the new sheet into src/generated/assets.json

What it fixes, because AI frames never line up:
  * cutout  - removes the white background of every frame (same code as the sprites)
  * align   - "feet": every frame is shifted so the lowest opaque row sits on one baseline
              and its centre of mass on one vertical line -> no jitter, no sliding.
              "canvas": keep each frame where it was drawn (use for flying / jumping
              cycles where the up-down movement is part of the animation).
  * scale   - one common scale for all frames, so the character does not pulse in size
  * pack    - a single horizontal strip (WebP) + metadata with the feet anchor
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

ALPHA_MIN = 8


def load_frames(args) -> list[Image.Image]:
    if args.frames:
        files = sorted(p for p in Path(args.frames).iterdir() if p.suffix.lower() in (".png", ".webp", ".jpg", ".jpeg"))
        frames = [Image.open(f) for f in files]
    elif args.cols and args.rows:
        grid = Image.open(args.grid)
        cw, ch = grid.width // args.cols, grid.height // args.rows
        frames = [grid.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for r in range(args.rows) for c in range(args.cols)]
    else:
        return split_auto(Image.open(args.grid), args)
    if args.count:
        frames = frames[: args.count]
    if args.cutout:
        from process_assets import cutout
        frames = [cutout(f) for f in frames]
    return [f.convert("RGBA") for f in frames]


def split_auto(sheet: Image.Image, args) -> list[Image.Image]:
    """Find the frames of a sheet by themselves: every large connected blob is one frame.

    AI models rarely respect grid cells, so slicing by cols/rows cuts off tails and ears.
    Frames are ordered in reading order (rows top to bottom, then left to right).
    """
    from scipy import ndimage

    if args.cutout:
        from process_assets import cutout
        sheet = cutout(sheet)
    sheet = sheet.convert("RGBA")
    rgba = np.asarray(sheet)
    solid = rgba[..., 3] > 32
    # dilate so whiskers and loose strokes stay attached to their character
    labels, n = ndimage.label(ndimage.binary_dilation(solid, iterations=4))
    areas = ndimage.sum(solid, labels, range(1, n + 1))
    keep = [i + 1 for i, a in enumerate(areas) if a >= 0.2 * areas.max()]
    boxes = ndimage.find_objects(labels)
    row_h = np.median([boxes[i - 1][0].stop - boxes[i - 1][0].start for i in keep])

    def reading_order(i):
        ys, xs = boxes[i - 1]
        return (round((ys.start + ys.stop) / 2 / row_h), xs.start)

    frames = []
    for i in sorted(keep, key=reading_order):
        px = rgba.copy()
        px[labels != i] = 0
        frames.append(Image.fromarray(px, "RGBA"))
    print(f"auto-split: {len(frames)} frames ({n - len(keep)} small blobs ignored)")
    return frames[: args.count] if args.count else frames


def measure(frame: Image.Image):
    """Opaque bbox and centre-of-mass x of a frame, or None if it is empty."""
    alpha = np.asarray(frame.getchannel("A"))
    ys, xs = np.nonzero(alpha > ALPHA_MIN)
    if len(xs) == 0:
        return None
    w = alpha.astype(np.float32).sum(axis=0)
    cx = float((w * np.arange(alpha.shape[1])).sum() / w.sum())
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, cx


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", help="sheet id, <hero>_<state>, e.g. bunny_move")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--frames", help="folder with one image per frame")
    src.add_argument("--grid", help="single image containing a grid of frames")
    ap.add_argument("--cols", type=int, help="with --rows: slice a strict grid instead of auto-detecting frames")
    ap.add_argument("--rows", type=int)
    ap.add_argument("--sync", choices=("time", "step"), default="time",
                    help="step = play exactly one cycle per cell moved (hops, walks); time = free-running at --fps")
    ap.add_argument("--count", type=int, help="use only the first N frames")
    ap.add_argument("--pick", help="frame order to keep, e.g. 0,1,2,1 (drop bad frames, ping-pong a wing beat)")
    ap.add_argument("--cutout", action="store_true", help="remove a white background first")
    ap.add_argument("--align", choices=("feet", "canvas"), default="feet")
    ap.add_argument("--height", type=int, default=256, help="output frame height in px")
    ap.add_argument("--fps", type=float, default=10)
    args = ap.parse_args()

    if args.align == "canvas" and args.grid and not (args.cols and args.rows):
        sys.exit("--align canvas needs --frames or a strict grid (--cols/--rows): auto-detected frames have no common canvas")
    frames = load_frames(args)
    if args.pick:
        frames = [frames[int(i)] for i in args.pick.split(",")]
    boxes = [measure(f) for f in frames]
    frames = [f for f, b in zip(frames, boxes) if b]
    boxes = [b for b in boxes if b]
    if not frames:
        sys.exit("no non-empty frames found")

    if args.align == "feet":
        # Place every frame relative to (centre of mass x, lowest opaque row).
        left = max(b[4] - b[0] for b in boxes)
        right = max(b[2] - b[4] for b in boxes)
        up = max(b[3] - b[1] for b in boxes)
        fw, fh = int(np.ceil(left + right)), int(up)
        placed = []
        for f, (x0, y0, x1, y1, cx) in zip(frames, boxes):
            cell = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
            cell.paste(f.crop((x0, y0, x1, y1)), (round(left - (cx - x0)), fh - (y1 - y0)))
            placed.append(cell)
        ax, ay = left / fw, 0.97
    else:
        # Keep the original placement; crop all frames with the same union box.
        x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
        x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
        placed = [f.crop((x0, y0, x1, y1)) for f in frames]
        fw, fh = x1 - x0, y1 - y0
        ax, ay = (float(np.mean([b[4] for b in boxes])) - x0) / fw, 0.97

    # Tall poses (a stretched jump) set the frame height; `scale` tells the game how much
    # bigger than a still image the frame box is, so the character keeps its size.
    body_scale = fh / float(np.median([b[3] - b[1] for b in boxes]))
    scale = args.height / fh
    ow, oh = max(1, round(fw * scale)), args.height
    sheet = Image.new("RGBA", (ow * len(placed), oh), (0, 0, 0, 0))
    for i, cell in enumerate(placed):
        sheet.paste(cell.resize((ow, oh), Image.LANCZOS), (i * ow, 0))

    out = ROOT / "public" / "assets" / "sheets" / f"{args.id}.webp"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=90, method=6)
    meta = {
        "url": f"/assets/sheets/{args.id}.webp", "frames": len(placed), "fps": args.fps, "sync": args.sync,
        "frameW": ow, "frameH": oh, "ax": round(ax, 4), "ay": ay, "scale": round(body_scale, 3),
    }
    meta_dir = ROOT / "pipeline" / "sheets"
    meta_dir.mkdir(parents=True, exist_ok=True)
    (meta_dir / f"{args.id}.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"{args.id}: {len(placed)} frames, {ow}x{oh}px each -> {out.relative_to(ROOT)}")
    print("run `npm run assets` to add it to the game manifest")


if __name__ == "__main__":
    main()
