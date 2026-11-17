# Rabbit Logic Game 🐇🥕

A logic puzzle for young children: build a sequence of arrows, press GO, and the hero walks
it. Three biomes — grass (bunny → carrot), ice (polar bear → fish), volcanic (dragon → gem).

```bash
npm run dev        # play
npm run assets     # rebuild runtime art from pipeline/assets.json
```

## Architecture

Everything is measured in **game cells** (1 unit = 1 cell, cell centre = x+0.5, y+0.5).
Pixels only appear in the asset pipeline and at the very last step of drawing, so art
resolution, background tile size and screen size are all independent.

```
pipeline/            art in  -> game-ready assets out (Python, run through uv)
  art_jobs.json        what to generate (prompts)            -> npm run generate -- <job>
  generate.py          Gemini via the `agy` CLI              -> gen_staging/<job>.png
  make_sheet.py        frames -> aligned sprite sheet        -> npm run sheet -- <id> ...
  assets.json          what the game uses (sources, anchors)
  build_assets.py      cutout, trim, anchor, resize, WebP    -> npm run assets
src/
  generated/assets.json  manifest written by the pipeline (never edit by hand)
  config/biomes.js       look of each biome: ground, pads, border, props, texts
  config/entities.js     heroes, goals, blockers, enemies (sizes in cells, footprints)
  world/level.js         grid, multi-tile occupancy, movement rules, BFS, level generator
  render/ground.js       chunked background with variation
  render/river.js        rivers blended into the ground: banks, flowing liquid, bridges
  render/renderer.js     layers, camera, anchored sprites
  render/actor.js        hero position tweening, cell centre to cell centre
  render/motion.js       hop / walk / fly profiles
  main.js                game flow + DOM controls
legacy/                the previous DOM-grid implementation, kept for reference
```

### Two kinds of tiles

| | Game tiles | Background tiles |
|---|---|---|
| Purpose | where the hero stands, what blocks | what the world looks like |
| Size | always 1 cell | `ground.cells` per repeat (3.4 / 4.2 / 3.8 — deliberately not a multiple of the grid) |
| Defined in | `world/level.js` (logic), `biome.pad` (look) | `biome.ground` |
| Drawn by | `drawPads()` | `render/ground.js` |

They fit together because both live in the same cell coordinate system; neither knows
the other's pixel size.

### Background for large maps

`render/ground.js` bakes the world in 4×4-cell chunks on demand and caches them, so cost
follows the visible area, not the map size (the "Big map" preset is 14×9 and scrolls).
Each chunk is three passes, all seeded by world position so neighbouring chunks agree:

1. **Base** – the seamless biome texture.
2. **Patches** – soft round stamps of the *same* texture at a random offset / rotation /
   mirror ("texture bombing"). Same material, but the repeat can no longer be seen.
3. **Macro** – slow light / shade / colour drift over several cells.

Unified because one material and one palette per biome; never the same because passes 2–3
depend on the level seed. Big hand-made pictures are best used *on top* of this as
set-pieces or border scenery (props with a large footprint), not as the ground itself:
a single picture cannot grow with the map and repeats visibly when tiled.

### Characters stay centred

Every sprite gets an **anchor** in the pipeline (feet: centre of mass horizontally, lowest
opaque row vertically; flat things: centre). The renderer pins that anchor to a ground
point derived from the cell centre, and scales / rotates around it. The hero's logical
position only ever tweens between cell centres (`actor.js`); hop height, waddle and flight
altitude are a *pose* on top (`motion.js`) while the shadow stays on the ground line.

| Hero | Profile | Motion |
|---|---|---|
| Bunny | `hop` | one hop per cell: crouch, stretch in the air, squash on landing |
| Polar bear | `walk` | steady, two steps per cell, body rolls side to side |
| Dragon | `fly` | takes off, glides over cells without landing, wing-beat pulse, lands at the end |

These procedural poses work with a single still image. When a sprite sheet named
`<hero>_<state>` exists (`bunny_move`, `bear_move`, `dragon_move`, `*_idle`, …) it is used
automatically instead.

### Blockers, enemies, multi-tile things

`config/entities.js`:

```js
boulder: { kind: 'blocker', sprite: 'rock', footprint: [2, 2], layer: 'standing' }
fox:   { kind: 'enemy', sprite: 'fox', footprint: [1, 1], layer: 'standing', fill: 0.62,
         bumpMsg: 'Watch out, a fox!' }
```

`footprint` is in game cells (`boulder` is 2×2). `layer: 'ground'` art is
stretched over the footprint, `'standing'` art is anchored at its feet and depth-sorted with
the hero. The generator only keeps a placement if the goal is still reachable. Add a prop
to a biome through its weighted `props` list.

### Rivers

A river is terrain, not a prop. `Level.addRiver()` lays a winding path of cells from one side
of the board to the other and marks it blocked except at its bridges, which can only be
crossed straight. The centre line keeps going through the border and off the map, so there
are no cut-off ends. `render/river.js` draws it in layers:

1. **Banks** – blurred bands wider than the water, blended over the ground texture (damp
   earth on grass, a snow drift on ice, heat glow and black crust on lava). This is what
   makes the river sit in the map instead of on it.
2. **Liquid** – two seamless textures scrolling at different speeds, cut out with a mask
   whose edge wobbles with noise, plus a light shallow rim.
3. **Details** – floating lily pads / ice floes / crust plates, then the bridge on top of
   the pads.

| Part | Tool | Command | Source kept in |
|---|---|---|---|
| Water, arctic water, lava (colour + shine) | MaterialCraft | `npm run river:materials` | `materials/river_<biome>.sbs` |
| Bridges (wood, ice, stone) | Blender, finished in PhotoCraft (dry brush, outline, shadow) | `npm run river:bridges` | `tools/blender/render_bridge.py` |
| Floating details | VectorCraft (SVG → PNG) | `vectorcraft-cli convert art/vector/floaters_<biome>.svg art/source/river_floaters_<biome>.png` | `art/vector/` |

Look and width per biome are in `biome.river` (`config/biomes.js`); run `npm run assets`
after regenerating any of the art. Blender must be running with its MCP add-on on port 9876
for the bridges.

## Art pipeline

| Step | Tool | Result |
|---|---|---|
| 1. Generate | Gemini (`npm run generate -- <job>`), jobs in `pipeline/art_jobs.json` | raw PNG on white in `gen_staging/` (kept sources live in `art/source/`, never in `public/`) |
| 2a. Ground | MaterialCraft (`materials/build_seamless_tiles.ps1`): make the raw texture wrap, derive height / normal | seamless `tile_<biome>.png` |
| 2b. Sprites | PhotoCraft for retouching / clean cutouts when the automatic one is not enough; VectorCraft for crisp UI art (arrows, footprints, pad frames) | clean source image |
| 2c. Animation | `npm run sheet -- <hero>_<state> --grid gen_staging/<job>.png --cutout` (finds the frames itself) | aligned sheet in `public/assets/sheets/` |
| 2d. Set-pieces | Blender (`tools/blender/`): render props / dioramas from one fixed camera and light so everything shares perspective and shadows | PNG with alpha |
| 3. Register | add the source to `pipeline/assets.json` (anchor, size) | |
| 4. Build | `npm run assets` | WebP + `src/generated/assets.json` |
| 5. Use | reference the id in `config/biomes.js` / `config/entities.js` | |

### Animated characters from AI images

Three routes, cheapest first. All end in `make_sheet.py`, which removes the background,
puts every frame on one baseline and one vertical axis (AI frames never line up) and
packs the strip.

1. **Pose sheet** – one image with 8 poses of the cycle, using the existing still as the
   character reference (`bunny_move`, `bear_move`, `dragon_move` jobs). This is how the
   current bunny hop was made. Fast; re-roll if the character drifts.
2. **Image → video** – animate the still with a video model on a plain background, then
   `ffmpeg -i clip.mp4 -vf fps=12 frames/%03d.png` and `npm run sheet -- bunny_move --frames frames --cutout`.
   Best consistency for run / walk / fly loops.
3. **Cut-out puppet** – split the still into parts (PhotoCraft), rig them in Blender and
   render the cycle. Most work, fully controllable, identical style to the still.

Use `--align feet` (default) for most cycles; `--align canvas` (with `--frames` or a strict
`--cols/--rows` grid) keeps the drawn up-and-down movement. `--pick 0,1,2,1` keeps only the
listed frames in that order — drop bad frames or ping-pong a wing beat. `--sync step` plays exactly one cycle per
cell moved (one hop on screen = one hop cycle); without it the sheet runs freely at `--fps`.

`agy` in headless mode cannot copy files, so `generate.py` asks it for the path of the
image it made and copies it into `gen_staging/` itself.

## Game rules

- Sizes: Easy 4×4, Medium 5×5 (sometimes a river), Hard 6×6 with a river and two bridges, Big map 14×9 with two rivers (scrolling).
- Every level is solvable (BFS); Medium and up block the straight route.
- Arrow keys add moves, Backspace removes the last one, Enter runs.
- Print PDF: the board with the answer key, plus a sheet of arrow cut-outs.
