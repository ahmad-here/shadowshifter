"""Development-only Blender script: builds the real-world obstacle models into
public/models/obstacles.glb. Run with `npm run convert:props` (Blender 4.2+). Never shipped.

One body (shaded metal, vertex colours) and one glow part (drawn in the obstacle's action
colour) per kind, authored at real size in the obstacle's frame (x across the lane, y up from the
deck, z along the run) and then normalised into its collision box, so the game scales each model
exactly onto the box physics uses:
  low   laser gate (jump):          two emitter posts, three red beams      box 0.0-0.8 m
  high  overhead pipe bundle (slide): pipes on supports, cyan bands          box 1.0-3.2 m
  mid   single pipe (either):       pipe on two posts, amber valve wheel    box 0.9-1.3 m
  vault rooftop AC units (vaulted):  two outdoor units with fan grilles      box 0.0-0.9 m
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'models', 'obstacles.glb')
WIDTH = 3.0  # lane width (2 x pathHalfWidth)
# kind: (minY, maxY, depth), matching OBSTACLE_BANDS in src/game/config.ts
BOXES = {'low': (0.0, 0.8, 0.5), 'high': (1.0, 3.2, 0.6), 'mid': (0.9, 1.3, 0.4), 'vault': (0.0, 0.9, 0.6)}
METAL = (0.16, 0.19, 0.24)
STEEL = (0.42, 0.47, 0.55)
DARK = (0.06, 0.07, 0.09)
PALE = (0.78, 0.82, 0.86)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)


def paint(obj, color):
    attr = obj.data.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
    for i in range(len(attr.data)):
        attr.data[i].color = (*color, 1.0)
    obj.data.color_attributes.active_color = attr
    return obj


def box(size, at, color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o = bpy.context.active_object
    o.scale = size
    return paint(o, color)


def pipe(a, b, r, color, verts=12):
    """Cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return paint(o, color)


def ring(at, axis, r, thick, color):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=thick, major_segments=16,
                                     minor_segments=6, location=at)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(axis))
    return paint(o, color)


# Blender is Z-up: author with (x across, y along the run, z up); glTF export turns Z-up into Y-up.
def P(x, up, along=0.0):
    return (x, along, up)


def laser():
    body, glow = [], []
    for s in (-1, 1):
        x = s * 1.42
        body.append(box((0.16, 0.16, 0.86), P(x, 0.43), METAL))
        body.append(box((0.28, 0.28, 0.05), P(x, 0.025), DARK))
        body.append(box((0.2, 0.2, 0.06), P(x, 0.88), STEEL))
        for h in (0.18, 0.42, 0.66):
            glow.append(box((0.06, 0.18, 0.06), P(x - s * 0.08, h), (1, 1, 1)))
    for h in (0.18, 0.42, 0.66):
        glow.append(pipe(P(-1.34, h), P(1.34, h), 0.022, (1, 1, 1), 6))
    return body, glow


def pipes_high():
    body, glow = [], []
    for s in (-1, 1):
        x = s * 1.62
        body.append(pipe(P(x, 0), P(x, 1.75), 0.11, STEEL))
        body.append(box((0.34, 0.34, 0.06), P(x, 0.03), DARK))
    for h, r in ((1.18, 0.16), (1.52, 0.13)):
        body.append(pipe(P(-1.7, h), P(1.7, h), r, METAL, 14))
        for x in (-1.1, 0.0, 1.1):
            glow.append(ring(P(x, h), (1, 0, 0), r + 0.015, 0.03, (1, 1, 1)))
    body.append(pipe(P(-1.7, 1.78), P(1.7, 1.78), 0.07, STEEL))
    return body, glow


def pipe_mid():
    body, glow = [], []
    for s in (-1, 1):
        x = s * 1.58
        body.append(pipe(P(x, 0), P(x, 1.12), 0.08, STEEL))
        body.append(box((0.3, 0.3, 0.05), P(x, 0.025), DARK))
    body.append(pipe(P(-1.7, 1.1), P(1.7, 1.1), 0.17, METAL, 14))
    glow.append(ring(P(0, 1.38), (0, 0, 1), 0.16, 0.03, (1, 1, 1)))
    body.append(pipe(P(0, 1.1), P(0, 1.36), 0.035, STEEL, 6))
    for x in (-1.0, 1.0):
        glow.append(ring(P(x, 1.1), (1, 0, 0), 0.185, 0.025, (1, 1, 1)))
    return body, glow


def ac_units():
    body, glow = [], []
    for x in (-0.72, 0.72):
        body.append(box((1.3, 0.55, 0.78), P(x, 0.41), PALE))
        body.append(box((1.36, 0.6, 0.04), P(x, 0.82), STEEL))
        body.append(box((1.2, 0.45, 0.04), P(x, 0.02), DARK))
        # Fan grille on the front face (facing the runner, -along).
        glow.append(ring(P(x - 0.18, 0.42, -0.28), (0, 1, 0), 0.26, 0.022, (1, 1, 1)))
        glow.append(ring(P(x - 0.18, 0.42, -0.28), (0, 1, 0), 0.14, 0.018, (1, 1, 1)))
        body.append(box((0.04, 0.02, 0.5), P(x - 0.18, 0.42, -0.28), DARK))
        body.append(box((0.5, 0.02, 0.04), P(x - 0.18, 0.42, -0.28), DARK))
        for k in range(4):
            body.append(box((0.22, 0.02, 0.03), P(x + 0.38, 0.62 - k * 0.1, -0.28), DARK))
    return body, glow


def finish(parts, name, kind):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(parts) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    for p in obj.data.polygons:
        p.use_smooth = True
    # Normalise into the collision box: centre (0, mid-height, 0), unit size.
    lo, hi, depth = BOXES[kind]
    for v in obj.data.vertices:
        v.co = Vector((v.co.x / WIDTH, v.co.y / depth, (v.co.z - (lo + hi) / 2) / (hi - lo)))
    return obj


made = []
for kind, build in (('low', laser), ('high', pipes_high), ('mid', pipe_mid), ('vault', ac_units)):
    body, glow = build()
    made.append(finish(body, f'{kind}_body', kind))
    made.append(finish(glow, f'{kind}_glow', kind))

bpy.ops.object.select_all(action='DESELECT')
for o in made:
    o.select_set(True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True,
                          export_materials='NONE', export_vertex_color='ACTIVE',
                          export_normals=True, export_texcoords=False)
print('OBSTACLES', [(o.name, len(o.data.polygons)) for o in made], os.path.getsize(OUT), 'bytes')
sys.stdout.flush()
