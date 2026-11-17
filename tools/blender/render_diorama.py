"""Blender diorama renderer for the Rabbit Logic Game themes.

Runs INSIDE Blender (sent via tools/blender/blender_exec.py). Builds an isolated scene
"LogicGame_<theme>" so the user's open scenes are left untouched, renders it, then
restores the previously active scene.

Globals that may be injected with --set: THEME (grass|ice|volcanic), OUT_DIR, RES ("1600x900").
"""
import math
import os

import bmesh
import bpy

ROOT = "C:/Vasa/Programming/rabbit_logic_game"
PUB = f"{ROOT}/art/source"
THEME = globals().get("THEME", "grass")
OUT_DIR = globals().get("OUT_DIR", f"{ROOT}/art/blender")
RES = tuple(int(v) for v in globals().get("RES", "1600x900").split("x"))

THEMES = {
    "grass": dict(
        tile="tile_grass.png", hero="happy_rabbit_nobg.png", goal="carrot_nobg.png",
        obstacles=["fox_nobg.png", "rock_nobg.png", "pond_nobg.png"],
        world=(0.55, 0.78, 1.0), world_strength=0.9, sun=(1.0, 0.95, 0.85), sun_strength=4.0,
        ground_tint=(0.55, 0.65, 0.5), pad_tint=(1.25, 1.25, 1.1), roughness=0.75, glow=None,
    ),
    "ice": dict(
        tile="tile_ice.png", hero="polar_bear_happy_nobg.png", goal="fish_goal_nobg.png",
        obstacles=["ice_block_nobg.png", "snowman_nobg.png", "rock_nobg.png"],
        world=(0.7, 0.85, 1.0), world_strength=1.1, sun=(0.9, 0.95, 1.0), sun_strength=3.5,
        ground_tint=(0.7, 0.8, 0.95), pad_tint=(1.1, 1.15, 1.2), roughness=0.15, glow=None,
    ),
    "volcanic": dict(
        tile="tile_lava.png", hero="dragon_happy_nobg.png", goal="volcanic_gem_nobg.png",
        obstacles=["obsidian_spikes_nobg.png", "lava_vent_nobg.png", "rock_nobg.png"],
        world=(0.35, 0.12, 0.08), world_strength=0.6, sun=(1.0, 0.7, 0.5), sun_strength=2.5,
        ground_tint=(0.5, 0.45, 0.45), pad_tint=(1.0, 0.95, 0.9), roughness=0.8, glow=(1.0, 0.35, 0.05),
    ),
}
cfg = THEMES[THEME]

# Sample layout on a 4x4 board: (col, row) with row 0 = far side.
GRID = 4
HERO_CELL, GOAL_CELL = (0, 3), (3, 0)
OBSTACLE_CELLS = [(1, 1), (2, 3), (3, 2)]


def img(name):
    path = f"{PUB}/{name}"
    if not os.path.exists(path):  # fall back to a generic obstacle if a themed one is missing
        path = f"{PUB}/rock_nobg.png"
    return bpy.data.images.load(path, check_existing=True)


def cell_to_xy(c, r):
    return (c - (GRID - 1) / 2, (GRID - 1) / 2 - r)


def tiled_material(name, tile, tint, roughness, scale, glow=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    n = nt.nodes
    bsdf = n["Principled BSDF"]
    coord = n.new("ShaderNodeTexCoord")
    mapping = n.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    tex = n.new("ShaderNodeTexImage")
    tex.image = img(tile)
    mul = n.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    mul.inputs["B"].default_value = (*tint, 1.0)
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    nt.links.new(coord.outputs["UV"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], mul.inputs["A"])
    nt.links.new(mul.outputs["Result"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = roughness
    if glow:
        # Bright (lava) parts of the texture emit light.
        ramp = n.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.55
        ramp.color_ramp.elements[1].position = 0.85
        nt.links.new(tex.outputs["Color"], ramp.inputs["Fac"])
        emit_col = n.new("ShaderNodeMix")
        emit_col.data_type = "RGBA"
        emit_col.blend_type = "MULTIPLY"
        emit_col.inputs["Factor"].default_value = 1.0
        emit_col.inputs["B"].default_value = (*glow, 1.0)
        nt.links.new(ramp.outputs["Color"], emit_col.inputs["A"])
        nt.links.new(emit_col.outputs["Result"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 3.0
    return m


def sprite_material(image):
    m = bpy.data.materials.new(f"sprite_{image.name}")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.9
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = "DITHERED"
    else:
        m.blend_method = "HASHED"
    return m


def link(obj, coll):
    coll.objects.link(obj)
    return obj


def add_sprite(coll, image_name, cell, height, cam_tilt):
    image = img(image_name)
    w, h = image.size
    mesh = bpy.data.meshes.new(f"sprite_{image_name}")
    aspect = w / h
    hw = height * aspect / 2
    mesh.from_pydata([(-hw, 0, 0), (hw, 0, 0), (hw, 0, height), (-hw, 0, height)], [], [(0, 1, 2, 3)])
    mesh.uv_layers.new().data.foreach_set("uv", [0, 0, 1, 0, 1, 1, 0, 1])
    mesh.materials.append(sprite_material(image))
    ob = link(bpy.data.objects.new(mesh.name, mesh), coll)
    x, y = cell_to_xy(*cell)
    ob.location = (x, y - 0.15, PAD_H)
    ob.rotation_euler = (-cam_tilt, 0, 0)  # lean back toward the camera
    return ob


# ---------------------------------------------------------------- build scene
prev_scene = bpy.context.window.scene
scene_name = f"LogicGame_{THEME}"
if scene_name in bpy.data.scenes:
    old = bpy.data.scenes[scene_name]
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new(scene_name)
coll = scene.collection

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = RES
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Punchy" if THEME != "volcanic" else "AgX - Base Contrast"
if hasattr(scene.eevee, "use_raytracing"):
    scene.eevee.use_raytracing = True
scene.eevee.taa_render_samples = 64

world = bpy.data.worlds.new(f"world_{THEME}")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (*cfg["world"], 1)
bg.inputs["Strength"].default_value = cfg["world_strength"]
scene.world = world

# Ground
def prim_mesh(name, kind):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    if kind == "cube":
        bmesh.ops.create_cube(bm, size=1.0, calc_uvs=True)
    else:
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, calc_uvs=True)
    bm.to_mesh(me)
    bm.free()
    return me


ground = link(bpy.data.objects.new("ground", prim_mesh("ground", "plane")), coll)
ground.scale = (40, 40, 1)
ground.data.materials.append(
    tiled_material("ground", cfg["tile"], cfg["ground_tint"], cfg["roughness"], 10, cfg["glow"])
)

# Stepping-stone pads
PAD_H = 0.22
pad_mat = tiled_material("pad", cfg["tile"], cfg["pad_tint"], cfg["roughness"], 0.5)
pad_mesh = prim_mesh("pad", "cube")
pad_mesh.materials.append(pad_mat)
pad_mesh.shade_smooth() if hasattr(pad_mesh, "shade_smooth") else None
for r in range(GRID):
    for c in range(GRID):
        pad = link(bpy.data.objects.new(f"pad_{c}_{r}", pad_mesh), coll)
        x, y = cell_to_xy(c, r)
        pad.location = (x, y, PAD_H / 2)
        pad.scale = (0.9, 0.9, PAD_H)
        bev = pad.modifiers.new("bevel", "BEVEL")
        bev.width = 0.06
        bev.segments = 4
        bev.affect = "EDGES"
        bev.harden_normals = False

# Camera (3/4 top-down) + lights
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 36
cam = link(bpy.data.objects.new("cam", cam_data), coll)
cam.location = (0, -6.4, 6.0)
target = link(bpy.data.objects.new("target", None), coll)
target.location = (0, 0.25, 0)
tr = cam.constraints.new("TRACK_TO")
tr.target = target
tr.track_axis = "TRACK_NEGATIVE_Z"
tr.up_axis = "UP_Y"
scene.camera = cam
cam_tilt = math.atan2(cam.location.z, -cam.location.y) * 0.55

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = cfg["sun_strength"]
sun_data.color = cfg["sun"]
sun_data.angle = math.radians(8)
sun = link(bpy.data.objects.new("sun", sun_data), coll)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))

# Characters and props as camera-facing sprites
add_sprite(coll, cfg["hero"], HERO_CELL, 1.0, cam_tilt)
add_sprite(coll, cfg["goal"], GOAL_CELL, 0.75, cam_tilt)
for cell, name in zip(OBSTACLE_CELLS, cfg["obstacles"]):
    add_sprite(coll, name, cell, 0.85, cam_tilt)

# ---------------------------------------------------------------- render
os.makedirs(OUT_DIR, exist_ok=True)
out = f"{OUT_DIR}/diorama_{THEME}.png"
scene.render.filepath = out
scene.render.image_settings.file_format = "PNG"
bpy.context.window.scene = scene
try:
    bpy.ops.render.render(write_still=True)
finally:
    bpy.context.window.scene = prev_scene
print(f"rendered {out}")
