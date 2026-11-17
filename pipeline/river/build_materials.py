"""River surface materials, authored in MaterialCraft.

    npm run river:materials

For every biome this builds a small MaterialCraft graph (kept in materials/river_<biome>.sbs
so it can be opened and tweaked in the app) and renders two seamless 512 px textures into
art/source/:

    river_<biome>.png        the liquid itself (colour)
    river_<biome>_shine.png  moving highlights: light ripples / floating ice / glowing veins

MaterialCraft has no noise generator among its atomic nodes, so two tileable noise seeds are
made here with numpy and everything visual happens in the graph, where every node wraps
around the tile border - which is what keeps the result seamless:

    seed A (soft clouds) --> blur ------------------------------+--> warp field
    seed B (cells)  --> warp by field --> levels --> gradient map --> colour
    seed B (cells)  --> warp by field (stronger) --> levels (thin lines) --> shine
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MC = Path(r"C:\Program Files\MaterialCraft\materialcraft-cli.exe")
MAT = ROOT / "materials"
OUT = ROOT / "art" / "source"
SIZE = 512


def rgb(hex_: str) -> list[float]:
    h = hex_.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)] + [1.0]


def keys(*stops: tuple[float, str]) -> list[dict]:
    return [{"pos": p, "midpoint": 0.5, "color": rgb(c)} for p, c in stops]


BIOMES = {
    # deep -> shallow; `shine` = how thin the highlight lines are (higher in_low = thinner)
    "grass": dict(
        gradient=keys((0.0, "#12509c"), (0.6, "#1f7fd0"), (0.9, "#45aeea"), (1.0, "#c8f0ff")),
        warp=6.0, shine_low=0.80, shine_warp=10.0,
    ),
    "ice": dict(
        gradient=keys((0.0, "#04223c"), (0.78, "#0c4a72"), (0.95, "#2a7fa8"), (1.0, "#bfeaf5")),
        warp=4.0, shine_low=0.70, shine_warp=5.0,
    ),
    "volcanic": dict(
        gradient=keys((0.0, "#2a0702"), (0.45, "#8a1604"), (0.75, "#e84f08"), (0.92, "#ffa51f"), (1.0, "#fff0a0")),
        warp=9.0, shine_low=0.74, shine_warp=14.0,
    ),
}


def tileable_noise(seed: int, freqs: tuple[int, ...]) -> np.ndarray:
    """Sum of random periodic waves: smooth, and wraps exactly at the borders."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE * 2 * np.pi
    out = np.zeros((SIZE, SIZE))
    for f in freqs:
        for _ in range(6):
            kx, ky = rng.integers(-f, f + 1, 2)
            if kx == 0 and ky == 0:
                kx = f
            out += np.cos(kx * x + ky * y + rng.uniform(0, 2 * np.pi)) / f
    out -= out.min()
    return out / out.max()


def tileable_cells(seed: int, points: int) -> np.ndarray:
    """Worley noise (distance to the nearest of some random points) on a torus."""
    rng = np.random.default_rng(seed)
    pts = rng.uniform(0, 1, (points, 2))
    y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    best = np.full((SIZE, SIZE), 9.0)
    second = np.full((SIZE, SIZE), 9.0)
    for px, py in pts:
        dx = np.abs(x - px); dx = np.minimum(dx, 1 - dx)
        dy = np.abs(y - py); dy = np.minimum(dy, 1 - dy)
        d = np.hypot(dx, dy)
        second = np.minimum(second, np.maximum(best, d))
        best = np.minimum(best, d)
    edge = second - best          # 0 on the cell borders -> bright ridges after inversion
    edge = 1 - edge / edge.max()
    return edge


def save_gray(arr: np.ndarray, path: Path) -> None:
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "L").convert("RGB").save(path)


def mc(*args: str) -> str:
    res = subprocess.run([str(MC), *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        sys.exit(f"materialcraft-cli {' '.join(args[:2])} failed:\n{res.stdout}\n{res.stderr}")
    return res.stdout


def node(def_: str, at: tuple[int, int], params: dict | None = None, src: int | None = None) -> dict:
    p: dict = {"def": def_, "at": list(at)}
    if params:
        p["params"] = params
    if src:
        p["connectFrom"] = {"node": src, "port": "output"}
    return {"id": "graph.node.add", "params": p}


def connect(a: int, b: int, port: str) -> dict:
    return {"id": "graph.connect", "params": {"from": a, "fromPort": "output", "to": b, "toPort": port}}


def build(biome: str, cfg: dict, clouds: Path, cells: Path) -> None:
    sbs = MAT / f"river_{biome}.sbs"
    mc("new", "empty", str(sbs), "--size", str(SIZE), "--name", f"river_{biome}")
    g = lambda v: [v, v, v, 1.0]
    steps = [
        {"id": "file.importBitmap", "params": {"path": str(clouds), "name": "clouds"}},
        {"id": "file.importBitmap", "params": {"path": str(cells), "name": "cells"}},
        node("bitmap", (-900, 0), {"resource": "clouds", "color_mode": False}),                 # 1
        node("bitmap", (-900, 220), {"resource": "cells", "color_mode": False}),                # 2
        node("blur", (-700, 0), {"intensity": 6.0}, src=1),                                     # 3 warp field
        node("warp", (-500, 120), {"intensity": cfg["warp"]}),                                  # 4 liquid shapes
        connect(2, 4, "input"), connect(3, 4, "gradient"),
        node("blend", (-320, 60), {"mode": 11, "opacity": 0.75}),                               # 5 clouds soft-light over cells
        connect(1, 5, "foreground"), connect(4, 5, "background"),
        node("blur", (-140, 60), {"intensity": 1.2}, src=5),                                    # 6
        node("gradient_map", (40, 60), {"gradient": {"t": "gradient", "v": {"keys": cfg["gradient"]}}}, src=6),  # 7 colour
        node("warp", (-500, 380), {"intensity": cfg["shine_warp"]}),                            # 8 shine shapes
        connect(2, 8, "input"), connect(3, 8, "gradient"),
        node("levels", (-320, 380), {"in_low": g(cfg["shine_low"]), "in_high": g(0.98)}, src=8),  # 9 thin bright lines
        node("blur", (-140, 380), {"intensity": 0.6}, src=9),                                   # 10 shine
    ]
    script = MAT / f"river_{biome}.json"
    script.write_text(json.dumps({"open": str(sbs), "steps": steps, "save": str(sbs)}, indent=1), encoding="utf-8")
    result = json.loads(mc("batch", str(script)))
    if result.get("failed") is not None:
        sys.exit(f"{biome}: MaterialCraft step {result['failed']} failed: {json.dumps(result)[:600]}")
    mc("render", str(sbs), str(OUT / f"river_{biome}.png"), "--size", f"{SIZE}x{SIZE}", "--view", "2d", "--node", "7", "--full")
    mc("render", str(sbs), str(OUT / f"river_{biome}_shine.png"), "--size", f"{SIZE}x{SIZE}", "--view", "2d", "--node", "10", "--full")
    print(f"river_{biome}: colour + shine rendered, graph saved to {sbs.relative_to(ROOT)}")


def main() -> None:
    if not MC.exists():
        sys.exit(f"MaterialCraft CLI not found at {MC}")
    clouds, cells = MAT / "river_seed_clouds.png", MAT / "river_seed_cells.png"
    save_gray(tileable_noise(7, (1, 2, 3)), clouds)
    save_gray(tileable_cells(11, 22), cells)
    for biome, cfg in BIOMES.items():
        build(biome, cfg, clouds, cells)


if __name__ == "__main__":
    main()
