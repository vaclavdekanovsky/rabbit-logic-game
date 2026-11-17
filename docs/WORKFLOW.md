# Reusable workflow: tiled maps and game assets

Project-independent summary of how this game builds its map and its art. The file names in
brackets point at the working implementation here; copy them as a starting point.

## Principles

1. **One unit for everything: the game cell.** Logic, sprite sizes, background repeat, camera
   and river width are all expressed in cells. Pixels exist only in the asset pipeline and
   in the last line of the draw call. This is what lets art resolution, tile sizes and screen
   size change independently.
2. **Sources are never served.** Raw and intermediate art lives in `art/source/`; the game
   loads only what a build step writes to `public/assets/`, described by one generated
   manifest.
3. **A manifest is the contract.** A hand-written list says what the game uses
   (`pipeline/assets.json`); the build writes a machine manifest with sizes and anchors
   (`src/generated/assets.json`); the game refers to art by id only.
4. **Everything random is seeded by position.** Variation comes from `hash(seed, x, y)`, so
   any piece of the map can be regenerated on demand and neighbours always agree.
5. **Every step is a command.** Generation, cleanup and build are scripts, so a bad result
   is re-rolled, not repaired by hand.

---

## Part 1 — Tiled map

### 1. Separate the two kinds of tiles

| | Game tiles | Background tiles |
|---|---|---|
| Job | where things stand, what blocks | what the world looks like |
| Size | exactly 1 cell | any number of cells per repeat, ideally *not* a multiple of the grid |
| Data | grid of cell codes + occupancy | texture + variation settings |

They share only the coordinate system. Never bake the grid into the background art.

### 2. Logic layer (`src/world/level.js`)

- Grid of cell codes: free, blocked, crossable in one direction only (bridges).
- Things have a **footprint** in cells (1×1, 2×2, …) and an owner map, so multi-cell
  objects are ordinary.
- Terrain features (rivers) are **paths of cells**, not objects.
- Generator: place start and goal, then big features, then small ones; after every
  placement run a path search and undo the placement if the goal became unreachable.

### 3. Background that scales (`src/render/ground.js`)

Bake the world in square chunks (4×4 cells) on demand, cache them, draw only visible ones.
Each chunk is three passes:

1. **Base** – one seamless texture per biome.
2. **Texture bombing** – soft round stamps of the *same* texture at a random offset,
   rotation and mirror. Removes the visible repeat without adding new art.
3. **Macro variation** – low-frequency noise as light, shade and colour drift over several
   cells.

Result: unified (one material, one palette) but never the same. Use large hand-made
pictures as set-pieces on top, not as the ground.

### 4. Terrain features that blend (`src/render/river.js`)

Do not paste a picture of a river. Draw it from its centre line:

1. **Banks** – blurred bands wider than the feature, blended over the ground (multiply for
   wet earth, screen/lighter for snow or glow). The ground changes towards the water, so
   there is no outline.
2. **Body** – a mask with a noisy edge, filled with one or two scrolling seamless textures.
3. **Details and crossings** – small floating sprites, then bridges drawn above the tiles.

Let the feature run past the playable area to the edge of the world; cut-off ends are
what makes features look pasted.

### 5. Layer order (`src/render/renderer.js`)

ground → border shade → terrain features → game tiles → flat props → everything standing,
sorted by the y of its feet. A camera clamps to the world and follows the hero when the map
is larger than the view.

### 6. Characters on the grid (`src/render/actor.js`, `motion.js`)

- Every sprite has an **anchor** computed in the pipeline (feet: centre of mass in x, lowest
  opaque row in y; flat things: centre). The renderer pins the anchor to a point derived
  from the cell centre and scales/rotates around it.
- Logical position only ever tweens between cell centres. Hop height, waddle and flight
  altitude are a **pose** added on top; the shadow stays on the ground.
- Movement profiles (hop, walk, fly) work on a single still image, and are replaced
  automatically when a sprite sheet named `<character>_<state>` exists.

---

## Part 2 — Assets

### Pipeline at a glance

```
prompt jobs ──generate──▶ raw image on white ──clean up──▶ source art ──build──▶ runtime art + manifest
art_jobs.json            gen_staging/                     art/source/            public/assets/
```

| Step | Command here | What it does |
|---|---|---|
| Generate | `npm run generate -- <job>` | One prompt per job: shared style line + layout rules for its kind + subject + optional reference image |
| Sheet | `npm run sheet -- <id> --grid <img> --cutout` | Finds frames, removes background, aligns, packs |
| Build | `npm run assets` | Cutout, speck removal, trim, anchor, resize, WebP, manifest |

### Which tool for what

| Need | Tool | Why |
|---|---|---|
| Characters, props, pose sheets | Image model (Gemini via `agy`) | Style and variety; always on plain white, one subject |
| Seamless ground and liquid textures | MaterialCraft (headless CLI) | Every node wraps at the tile border, so results stay seamless |
| Hard-surface props that must share light and perspective (bridges, buildings) | Blender (script over the MCP socket) | One camera, one sun for the whole set |
| Making 3D renders match painted art; retouching | PhotoCraft (headless CLI) | Dry-brush filter, outline and shadow layer styles |
| Flat, crisp shapes: UI, icons, small decals | VectorCraft (SVG → PNG) | Resolution-independent masters |

### Prompt rules that made generation reliable

- One **style sentence** reused verbatim in every prompt.
- **Sprites:** single centred subject, fully visible, solid pure white background, no ground
  shadow, no text.
- **Animation:** ask for one image with all poses of the cycle, same character, same size,
  strict side view, and pass the existing still as the reference. Expect the wrong number of
  frames and loose spacing — the tooling, not the prompt, fixes that.
- **Ground:** top-down, flat even light, no landmarks, "seamless tileable"; then make it
  truly seamless in MaterialCraft.

### Cleanup rules (what the scripts do so nobody does it by hand)

- **Background removal** by flood fill from the image border, so white inside the subject
  (fur, eyes) survives; then de-fringe the edge.
- **Remove specks** before trimming — a few stray pixels inflate the bounding box and make
  the sprite small and off-centre.
- **Trim, then compute the anchor**, then resize. Art rendered to an exact size in cells
  (bridges) is not trimmed.
- **Animation frames:** detect frames as connected blobs instead of trusting grid cells;
  align every frame to one baseline and one vertical axis; one common scale; allow picking
  and reordering frames (`--pick 0,1,2,1`). Sync the cycle to movement (`--sync step`:
  one cycle per cell).

### Three routes to animation, cheapest first

1. Pose sheet from an image model (used here).
2. Image-to-video on a plain background, extract frames, same sheet tool.
3. Cut the still into parts, rig in Blender, render the cycle.

---

## Starting a new project with this

1. Copy `pipeline/` (generate, make_sheet, build_assets and the two JSON files), and
   `src/core/rng.js`, `src/render/ground.js`, `river.js`, `actor.js`, `motion.js`.
2. Write the style sentence and the job list in `art_jobs.json`.
3. Generate one ground texture and one character; get them through the whole pipeline
   before generating anything else.
4. Describe biomes and things in config files (cells, footprints, weights) — no numbers
   in pixels.
5. Only then add content: more props, animations, terrain features.

## Known limits

- `agy` in headless mode cannot copy files; `generate.py` asks it for the path of the image
  it made and copies it itself.
- MaterialCraft has no noise generator among its atomic nodes; tileable noise seeds are made
  with numpy and processed in the graph.
- Soft river banks use canvas blur, which Safari does not support.
- Blender must be running with the MCP add-on (port 9876) for the bridge renders.
