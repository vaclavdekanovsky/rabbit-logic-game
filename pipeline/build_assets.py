"""Build runtime art from pipeline/assets.json.

    npm run assets          (= uv run --with pillow --with numpy --with scipy python pipeline/build_assets.py)

For every sprite: optional white-background cutout -> optional crop -> trim to the opaque
bounding box -> resize -> WebP, plus an *anchor* (the point of the image that the game pins
to the map). Standing things are anchored at their feet, flat things at their centre; that
anchor is what keeps characters centred on game tiles no matter how the art was framed.

Ground textures are only resized/encoded here; making them seamless is MaterialCraft's job
(materials/build_seamless_tiles.ps1).

Outputs: public/assets/sprites/*.webp, public/assets/ground/*.webp, and
src/generated/assets.json (the manifest the game imports). Sprite-sheet metadata written
by pipeline/make_sheet.py (pipeline/sheets/*.json) is merged into the same manifest.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets"
MANIFEST = ROOT / "src" / "generated" / "assets.json"
SHEET_META = ROOT / "pipeline" / "sheets"

sys.path.insert(0, str(ROOT / "scripts"))

DEFAULT_PX = 384
ALPHA_MIN = 8


def load_sprite(spec: dict) -> Image.Image:
    img = Image.open(ROOT / spec["src"])
    if spec.get("cutout"):
        from process_assets import cutout  # white-background removal + defringe
        img = cutout(img)
    img = img.convert("RGBA")
    if "crop" in spec:
        x0, y0, x1, y1 = spec["crop"]
        w, h = img.size
        img = img.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    return img


def trim(img: Image.Image) -> Image.Image:
    """Crop to the art. Stray specks left over from background removal are erased first:
    a few forgotten pixels in a corner would otherwise inflate the bounding box and make
    the sprite look small and off-centre in the game."""
    from scipy import ndimage

    rgba = np.asarray(img).copy()
    labels, n = ndimage.label(rgba[..., 3] > 32)
    if n > 1:
        areas = ndimage.sum(np.ones(labels.shape), labels, range(1, n + 1))
        specks = [i + 1 for i, a in enumerate(areas) if a < 0.003 * areas.max()]
        rgba[np.isin(labels, specks)] = 0
        img = Image.fromarray(rgba, "RGBA")
    bbox = img.getchannel("A").point(lambda v: 255 if v > ALPHA_MIN else 0).getbbox()
    return img.crop(bbox) if bbox else img


def anchor_of(img: Image.Image, kind: str) -> tuple[float, float]:
    """Normalised (x, y) anchor inside the trimmed image."""
    if kind == "center":
        return 0.5, 0.5
    # feet: horizontally the centre of mass (so a tail or a wing does not pull the body
    # off the tile), vertically just above the lowest opaque row.
    alpha = np.asarray(img.getchannel("A"), dtype=np.float32)
    cols = alpha.sum(axis=0)
    cx = float((cols * np.arange(alpha.shape[1])).sum() / max(cols.sum(), 1.0))
    return round((cx + 0.5) / alpha.shape[1], 4), 0.97


def build_sprite(sid: str, spec: dict) -> dict:
    img = load_sprite(spec)
    if spec.get("trim", True):
        img = trim(img)
    px = spec.get("px", DEFAULT_PX)
    scale = px / max(img.size)
    if scale < 1:
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    ax, ay = anchor_of(img, spec.get("anchor", "feet"))
    dst = OUT / "sprites" / f"{sid}.webp"
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, quality=90, method=6)
    return {"url": f"/assets/sprites/{sid}.webp", "w": img.width, "h": img.height, "ax": ax, "ay": ay}


def build_ground(gid: str, spec: dict) -> dict:
    img = Image.open(ROOT / spec["src"]).convert("RGB")
    px = spec.get("px", 1024)
    if img.width != px:
        img = img.resize((px, round(img.height * px / img.width)), Image.LANCZOS)
    dst = OUT / "ground" / f"{gid}.webp"
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, quality=88, method=6)
    return {"url": f"/assets/ground/{gid}.webp", "w": img.width, "h": img.height}


def main() -> None:
    spec = json.loads((ROOT / "pipeline" / "assets.json").read_text(encoding="utf-8"))
    manifest = {"sprites": {}, "grounds": {}, "sheets": {}}
    for sid, s in spec["sprites"].items():
        manifest["sprites"][sid] = m = build_sprite(sid, s)
        print(f"sprite {sid:14s} {m['w']:4d}x{m['h']:<4d} anchor=({m['ax']:.2f},{m['ay']:.2f})")
    for gid, g in spec["grounds"].items():
        manifest["grounds"][gid] = m = build_ground(gid, g)
        print(f"ground {gid:14s} {m['w']}x{m['h']}")
    if SHEET_META.exists():
        for f in sorted(SHEET_META.glob("*.json")):
            manifest["sheets"][f.stem] = json.loads(f.read_text(encoding="utf-8"))
            print(f"sheet  {f.stem}")
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
