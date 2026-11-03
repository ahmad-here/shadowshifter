"""Development-only Blender script: builds the stylized low-poly fire as public/models/fire.glb.
Run with `npm run convert:props` (Blender 4.2+ on PATH, or BLENDER=<path to blender.exe>).
Never part of the game bundle.

Two colours only: a faceted yellow core wrapped by separate orange tongues, with gaps so the
yellow shows from every side. Each facet gets a slight brightness variation (face-corner colours)
so the low-poly facets read under the game's unlit material. 1 m tall, base at y=0, centred.
The game animates it (sway and licking tips) in a vertex shader.
"""
import math
import os
import random
import sys

import bpy
import bmesh

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'public', 'models', 'fire.glb')
ORANGE = (1.0, 0.36, 0.04)
YELLOW = (1.0, 0.78, 0.12)
rng = random.Random(7)


def tongue(bm, colors, cx, cy, radius, height, lean, sides, color):
    """A faceted teardrop flame tongue: round bulb, tapering curved tip, leaning outwards."""
    rings = ((0.0, 0.5), (0.14, 0.92), (0.32, 1.0), (0.52, 0.78), (0.72, 0.45), (0.88, 0.18))
    out = math.atan2(cy, cx) if (cx or cy) else 0.0
    verts = []
    for k, (t, r) in enumerate(rings):
        ring = []
        for i in range(sides):
            a = 2 * math.pi * i / sides + k * 0.2
            rr = radius * r * rng.uniform(0.85, 1.1)
            x = cx + rr * math.cos(a) + lean * t * t * math.cos(out)
            y = cy + rr * math.sin(a) + lean * t * t * math.sin(out)
            ring.append(bm.verts.new((x, y, height * t)))
        verts.append(ring)
    tip = bm.verts.new((cx + lean * math.cos(out), cy + lean * math.sin(out), height))
    for k in range(len(rings) - 1):
        for i in range(sides):
            j = (i + 1) % sides
            f = bm.faces.new((verts[k][i], verts[k][j], verts[k + 1][j], verts[k + 1][i]))
            colors[f] = color
    for i in range(sides):
        f = bm.faces.new((verts[-1][i], verts[-1][(i + 1) % sides], tip))
        colors[f] = color
    f = bm.faces.new(list(reversed(verts[0])))
    colors[f] = color


for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
bm = bmesh.new()
colors = {}
# Yellow core, then three orange tongues around it (different heights, leaning out).
tongue(bm, colors, 0, 0, 0.27, 0.78, 0.0, 7, YELLOW)
for i, (h, r) in enumerate(((1.0, 0.24), (0.8, 0.21), (0.7, 0.2))):
    a = 2 * math.pi / 3 * i + 0.4
    tongue(bm, colors, 0.2 * math.cos(a), 0.2 * math.sin(a), r, h, 0.1, 6, ORANGE)

me = bpy.data.meshes.new('fire')
attr_colors = []
bm.normal_update()
for f in bm.faces:
    shade = rng.uniform(0.86, 1.0)
    attr_colors.append(tuple(c * shade for c in colors[f]))
bm.to_mesh(me)
bm.free()
attr = me.color_attributes.new('Color', 'FLOAT_COLOR', 'CORNER')
for poly, c in zip(me.polygons, attr_colors):
    poly.use_smooth = False
    for li in poly.loop_indices:
        attr.data[li].color = (*c, 1.0)
me.color_attributes.active_color = attr
fire = bpy.data.objects.new('fire', me)
bpy.context.collection.objects.link(fire)

# Normalise to 1 m tall with the base at 0.
zs = [v.co.z for v in me.vertices]
s = 1 / (max(zs) - min(zs))
for v in me.vertices:
    v.co *= s

bpy.ops.object.select_all(action='DESELECT')
fire.select_set(True)
bpy.context.view_layer.objects.active = fire
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=True, export_materials='NONE',
    export_vertex_color='ACTIVE', export_normals=True, export_texcoords=False,
)
print('FIRE', len(me.vertices), 'vertices', len(me.polygons), 'faces',
      os.path.getsize(OUT), 'bytes')
sys.stdout.flush()
