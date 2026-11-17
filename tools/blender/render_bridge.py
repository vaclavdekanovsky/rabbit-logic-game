"""Top-down bridge props for the river, rendered in Blender.

Runs INSIDE Blender, sent through the Blender MCP socket:

    python tools/blender/blender_exec.py tools/blender/render_bridge.py --set KIND=wood
    (or `npm run river:bridges` for all three)

KIND: wood (grass) | ice (ice) | stone (volcanic). 1 Blender unit = 1 game cell. The bridge
crosses a river that flows left-right, so the deck runs along Y and is walked north-south;
the game rotates it for vertical rivers. Orthographic camera straight down, one sun from the
top-left for every prop, transparent film -> art/source/bridge_<KIND>.png.

Builds its own scene "LogicGame_bridge" and restores the scene that was active.
"""
import math
import os
import random

import bmesh
import bpy

ROOT = "C:/Vasa/Programming/rabbit_logic_game"
KIND = globals().get("KIND", "wood")
OUT = f"{ROOT}/art/source/bridge_{KIND}.png"
RES = 512
VIEW = 1.5          # cells covered by the image
random.seed({"wood": 3, "ice": 5, "stone": 8}[KIND])

prev_scene = bpy.context.window.scene
name = "LogicGame_bridge"
if name in bpy.data.scenes:
    old = bpy.data.scenes[name]
    for ob in list(old.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.scenes.remove(old)
scene = bpy.data.scenes.new(name)
coll = scene.collection


def material(label, base, rough=0.8, tex_scale=None, dark=0.6, emission=None):
    """Principled material; `tex_scale` adds stretched noise streaks (grain / frost / cracks)."""
    m = bpy.data.materials.new(label)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    if tex_scale:
        coord = nt.nodes.new("ShaderNodeTexCoord")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = tex_scale
        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 6.0
        noise.inputs["Detail"].default_value = 6.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = (*[c * dark for c in base], 1)
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[1].color = (*base, 1)
        nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
        nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*base, 1)
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission[0], 1)
        bsdf.inputs["Emission Strength"].default_value = emission[1]
    return m


def box(label, size, loc, rot_z=0.0, mat=None, bevel=0.012):
    me = bpy.data.meshes.new(label)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(label, me)
    coll.objects.link(ob)
    ob.scale = size
    ob.location = loc
    ob.rotation_euler = (random.uniform(-0.03, 0.03), random.uniform(-0.03, 0.03), rot_z)
    if mat:
        me.materials.append(mat)
    b = ob.modifiers.new("bevel", "BEVEL")
    b.width = bevel
    b.segments = 3
    return ob


def log(label, radius, length, loc, mat):
    me = bpy.data.meshes.new(label)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=radius, radius2=radius, depth=length)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(label, me)
    coll.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (math.radians(90), 0, random.uniform(-0.02, 0.02))
    me.materials.append(mat)
    return ob


HALF_LEN = 0.60     # the deck reaches a little past the banks of a ~0.62 cell wide river

if KIND == "wood":
    browns = [(0.36, 0.20, 0.08), (0.30, 0.16, 0.06), (0.42, 0.24, 0.10), (0.26, 0.14, 0.055)]
    mats = [material(f"plank{i}", c, 0.85, (1.5, 14.0, 1.0)) for i, c in enumerate(browns)]
    n = 8
    for i in range(n):
        y = -HALF_LEN + (i + 0.5) * (2 * HALF_LEN / n)
        box(f"plank{i}", (random.uniform(0.66, 0.74), 2 * HALF_LEN / n * 0.9, 0.05),
            (random.uniform(-0.015, 0.015), y, 0.05), random.uniform(-0.04, 0.04), random.choice(mats))
    rail = material("rail", (0.20, 0.11, 0.045), 0.9, (14.0, 1.5, 1.0))
    for sx in (-1, 1):
        log(f"rail{sx}", 0.042, 2 * HALF_LEN + 0.12, (sx * 0.36, 0, 0.11), rail)
        for sy in (-1, 1):
            box(f"post{sx}{sy}", (0.085, 0.085, 0.2), (sx * 0.36, sy * (HALF_LEN + 0.02), 0.1), 0.0, rail, 0.02)

elif KIND == "ice":
    ice = [material(f"ice{i}", c, 0.25, (0.6, 0.6, 1.0), dark=0.8) for i, c in
           enumerate([(0.42, 0.72, 0.95), (0.52, 0.80, 0.98), (0.34, 0.64, 0.90)])]
    snow = material("snow", (0.82, 0.90, 0.97), 0.9)
    y = -HALF_LEN
    i = 0
    while y < HALF_LEN - 0.05:
        d = min(random.uniform(0.26, 0.4), HALF_LEN - y)
        box(f"slab{i}", (random.uniform(0.62, 0.74), d * 0.93, 0.09), (random.uniform(-0.03, 0.03), y + d / 2, 0.06),
            random.uniform(-0.07, 0.07), ice[i % 3], 0.03)
        y += d
        i += 1
    for k in range(7):  # little snow caps along the edges
        sx = random.choice((-1, 1))
        box(f"snow{k}", (random.uniform(0.08, 0.16), random.uniform(0.1, 0.2), 0.05),
            (sx * random.uniform(0.27, 0.34), random.uniform(-HALF_LEN, HALF_LEN), 0.12), random.uniform(0, 3), snow, 0.03)

else:  # stone
    rock = [material(f"rock{i}", c, 0.9, (0.5, 0.5, 1.0), dark=0.6) for i, c in
            enumerate([(0.13, 0.11, 0.15), (0.17, 0.15, 0.19), (0.10, 0.09, 0.12)])]
    glow = material("glow", (0.05, 0.02, 0.01), 0.9, emission=((1.0, 0.22, 0.02), 1.6))
    box("ember_bed", (0.56, 2 * HALF_LEN - 0.04, 0.02), (0, 0, 0.02), 0.0, glow, 0.005)   # glows through the gaps
    y = -HALF_LEN
    i = 0
    while y < HALF_LEN - 0.05:
        d = min(random.uniform(0.2, 0.32), HALF_LEN - y)
        box(f"slab{i}", (random.uniform(0.6, 0.74), d * 0.86, 0.1), (random.uniform(-0.04, 0.04), y + d / 2, 0.07),
            random.uniform(-0.1, 0.1), rock[i % 3], 0.035)
        y += d
        i += 1

# camera, light, render settings
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = VIEW
cam = bpy.data.objects.new("cam", cam_data)
coll.objects.link(cam)
cam.location = (0, 0, 5)
scene.camera = cam

sun_data = bpy.data.lights.new("sun", "SUN")
sun_data.energy = 2.2
sun_data.angle = math.radians(12)
sun = bpy.data.objects.new("sun", sun_data)
coll.objects.link(sun)
sun.rotation_euler = (math.radians(55), 0, math.radians(-40))   # light from the top-left

world = bpy.data.worlds.new("bridge_world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
scene.world = world

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = scene.render.resolution_y = RES
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"
scene.render.filepath = OUT
os.makedirs(os.path.dirname(OUT), exist_ok=True)

bpy.context.window.scene = scene
try:
    bpy.ops.render.render(write_still=True)
finally:
    bpy.context.window.scene = prev_scene
print(f"rendered {OUT}")
