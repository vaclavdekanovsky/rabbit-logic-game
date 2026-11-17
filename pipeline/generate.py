"""Generate raw art with Gemini through the `agy` CLI.

    npm run generate -- bunny_move                 # one job from pipeline/art_jobs.json
    npm run generate -- bear_sleep bear_dizzy      # several, one agy call each
    npm run generate -- --list
    npm run generate -- --dry-run bunny_move       # print the prompt only

agy saves images in its own artifact folder; if it cannot copy the file into the project
itself (headless mode has no shell permission), this script asks it for the path and copies
the image over.

Each job becomes one self-contained prompt (shared style + the rules for its kind + the
subject) and must come back as gen_staging/<job>.png. Raw images keep their white
background; cutting them out, aligning and packing is done afterwards by make_sheet.py /
build_assets.py, so a bad generation can simply be re-rolled without touching the game.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / "gen_staging"


def build_prompt(name: str, job: dict, spec: dict) -> str:
    rules = spec["rules"][job["kind"]].format(cols=job.get("cols", 1), rows=job.get("rows", 1))
    ref = f"Use the image {job['ref']} as the visual reference so the character looks identical. " if job.get("ref") else ""
    return (
        "Use your image generation tool to create exactly ONE image.\n"
        f"Subject: {job['prompt']}\n"
        f"Style: {spec['style']}\n"
        f"Layout: {rules}\n"
        f"{ref}\n"
        f"When the image exists, copy it to gen_staging/{name}.png in this project (create the folder if needed). "
        "Wait for the image generation to finish before you answer; do not hand the work to a background agent. "
        "Do not modify any other file. Finally print the path of the saved file."
    )


def collect(agy: str, out: Path, log: Path) -> None:
    """Headless agy may not run shell commands, so it often cannot copy the image itself.
    Ask the same conversation where the file is and bring it over from here."""
    from PIL import Image

    ask = ("If the image generation is still running, wait for it. Do not run any command. "
           "Then tell me the absolute file path of the image you generated in this conversation, on a line by itself.")
    for _ in range(3):
        res = subprocess.run([agy, "--continue", "--print", ask, "--print-timeout", "3m"],
                             cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
        with log.open("a", encoding="utf-8") as fh:
            fh.write(res.stdout + res.stderr)
        for line in reversed(res.stdout.splitlines()):
            path = Path(line.strip().strip("`\"'"))
            if path.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp") and path.is_file():
                Image.open(path).convert("RGB").save(out)
                return


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("jobs", nargs="*")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--timeout", default="10m", help="agy --print-timeout per job")
    args = ap.parse_args()

    spec = json.loads((ROOT / "pipeline" / "art_jobs.json").read_text(encoding="utf-8"))
    if args.list or not args.jobs:
        for name, job in spec["jobs"].items():
            print(f"{name:20s} {job['kind']:7s} {job['prompt'][:70]}")
        return

    agy = shutil.which("agy")
    if not agy and not args.dry_run:
        sys.exit("agy CLI not found on PATH")
    STAGING.mkdir(exist_ok=True)
    failed = []
    for name in args.jobs:
        job = spec["jobs"].get(name) or sys.exit(f"unknown job {name!r} (see --list)")
        prompt = build_prompt(name, job, spec)
        if args.dry_run:
            print(f"--- {name}\n{prompt}\n")
            continue
        out = STAGING / f"{name}.png"
        out.unlink(missing_ok=True)
        print(f"[{name}] generating ...", flush=True)
        log = STAGING / f"{name}.log"
        with log.open("w", encoding="utf-8") as fh:
            subprocess.run([agy, "--print", prompt, "--print-timeout", args.timeout],
                           cwd=ROOT, stdout=fh, stderr=subprocess.STDOUT)
        if not out.exists():
            collect(agy, out, log)
        if out.exists():
            print(f"[{name}] ok -> {out.relative_to(ROOT)}")
            if job.get("then"):
                print(f"[{name}] next: {job['then']}")
        else:
            failed.append(name)
            print(f"[{name}] no image came back, see {log.relative_to(ROOT)}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
