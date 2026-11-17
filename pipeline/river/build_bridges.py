"""Bridge props: modelled and lit in Blender, finished in PhotoCraft.

    npm run river:bridges            (Blender must be running with the MCP add-on on :9876)

1. Blender   tools/blender/render_bridge.py renders each bridge top-down with alpha
             -> art/source/bridge_<kind>.png
2. PhotoCraft gives the clean 3D render the hand-painted look of the other props:
             Dry Brush filter (brush strokes), a dark outline (Stroke layer style) and a
             soft contact shadow (Drop Shadow layer style)
             -> art/source/bridge_<kind>_painted.png   (this is what the game uses)
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PHOTOCRAFT = Path(r"C:\Program Files\ArtCraft\PhotoCraft\photocraft-cli.exe")
SRC = ROOT / "art" / "source"

KINDS = {  # outline colour per bridge
    "wood": "#2b1608",
    "ice": "#1d4f73",
    "stone": "#0c090d",
}


def run(cmd: list[str], what: str) -> str:
    res = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.returncode != 0:
        sys.exit(f"{what} failed:\n{res.stdout}\n{res.stderr}")
    return res.stdout


def main() -> None:
    skip_render = "--no-render" in sys.argv
    for kind, outline in KINDS.items():
        raw = SRC / f"bridge_{kind}.png"
        if not skip_render:
            run([sys.executable, "tools/blender/blender_exec.py", "tools/blender/render_bridge.py", "--set", f"KIND={kind}"],
                f"Blender render ({kind})")
        steps = [
            ("filter.gallery.dryBrush", {"brushSize": 3, "brushDetail": 7, "texture": 1}),
            ("layer.layerStyle.stroke", {"size": 5, "position": "outside", "color": outline, "opacity": 92}),
            ("layer.layerStyle.dropShadow", {"color": "#000000", "opacity": 45, "angle": 135, "distance": 7, "size": 12, "add": True}),
        ]
        cmd = [str(PHOTOCRAFT), "run", str(raw)]
        for cid, params in steps:
            cmd += ["--cmd", cid, "--params", json.dumps(params)]
        cmd += ["--out", str(SRC / f"bridge_{kind}_painted.png")]
        run(cmd, f"PhotoCraft finish ({kind})")
        print(f"bridge_{kind}: rendered + painted")


if __name__ == "__main__":
    main()
