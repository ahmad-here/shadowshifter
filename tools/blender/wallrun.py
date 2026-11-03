"""Development-only Blender script: authors wall-run clips on the Mixamo rig (like the wall-runs in
the user's reference footage, art/sample.mp4), for a wall on the right and on the left.

Built from the athletic run cycle, keyed on every frame in armature space:
  - hips rolled HIP_ROLL toward the wall, so the legs run on the wall face;
  - spine counter-rolled, so the torso stays more upright (a held core);
  - the arm away from the wall swung up and out for balance, the near arm tucked in.
Writes art/Wall Run Right.fbx and art/Wall Run Left.fbx (plus check renders with --render).
Run: blender -b --factory-startup --python tools/blender/wallrun.py [-- --render <dir>]
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art', 'Running-athletic.fbx')
HIP_ROLL = math.radians(55)
SPINE_COUNTER = math.radians(-22)
OUTER_ARM = math.radians(55)
NEAR_ARM = math.radians(-15)
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = args[args.index('--render') + 1] if '--render' in args else None


def channel_curves(action, anim):
    if hasattr(action, 'fcurves'):
        return action.fcurves
    for layer in action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(anim.action_slot)
            if bag:
                return bag.fcurves
    raise RuntimeError('no f-curves')


def build(side):
    """side = +1: wall on the runner's right; -1: on the left."""
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    bpy.ops.import_scene.fbx(filepath=SRC, automatic_bone_orientation=False)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    action = arm.animation_data.action
    start, end = (int(round(v)) for v in action.frame_range)
    scene = bpy.context.scene
    bones = arm.pose.bones
    p = 'mixamorig:'
    hips, spine2 = bones[p + 'Hips'], bones[p + 'Spine2']
    outer = bones[p + ('LeftArm' if side > 0 else 'RightArm')]
    near = bones[p + ('RightArm' if side > 0 else 'LeftArm')]
    # Armature space (the FBX rig is Y-up; the object carries the turn to Blender's Z-up): up is
    # +Y and the character faces along +Z, so a roll is a rotation about Z.
    forward = Vector((0, 0, 1))

    def roll(pb, angle):
        """Rotate a pose bone by `angle` about the forward axis, around its own head."""
        m = pb.matrix.copy()
        r = Matrix.Rotation(angle, 3, forward)
        pb.matrix = Matrix.LocRotScale(m.translation, r @ m.to_3x3(), m.to_scale())

    # Bake every frame: read the run pose, bend it, key it.
    poses = []
    for f in range(start, end + 1):
        scene.frame_set(f)
        bpy.context.view_layer.update()
        # A negative roll about +Z tips the feet toward the runner's right.
        roll(hips, -side * HIP_ROLL)
        bpy.context.view_layer.update()
        roll(spine2, -side * SPINE_COUNTER)
        bpy.context.view_layer.update()
        roll(outer, side * OUTER_ARM)
        roll(near, side * NEAR_ARM)
        poses.append({b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in bones})
    curves = channel_curves(action, arm.animation_data)
    for c in list(curves):
        curves.remove(c)
    for f, pose in zip(range(start, end + 1), poses):
        for b in bones:
            b.rotation_mode = 'QUATERNION'
            b.location, b.rotation_quaternion = pose[b.name]
            b.keyframe_insert('location', frame=f)
            b.keyframe_insert('rotation_quaternion', frame=f)
    scene.frame_start, scene.frame_end = start, end
    name = 'Wall Run Right' if side > 0 else 'Wall Run Left'
    if RENDER:
        render_check(arm, os.path.join(RENDER, name.replace(' ', '_') + '.png'), start)
    out = os.path.join(ROOT, 'art', name + '.fbx')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.fbx(
        filepath=out, use_selection=True, bake_anim=True, bake_anim_use_all_actions=False,
        bake_anim_use_nla_strips=False, bake_anim_simplify_factor=0.0, add_leaf_bones=False,
        primary_bone_axis='Y', secondary_bone_axis='X', armature_nodetype='NULL',
        apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE',
        object_types={'ARMATURE', 'MESH'},
    )
    print('WROTE', out, start, end)


def render_check(arm, path, frame):
    """Front view (the camera looks at the runner's face) of one frame, for checking the pose."""
    scene = bpy.context.scene
    scene.frame_set(frame + 5)
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = scene.render.resolution_y = 500
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    # Frame the character's posed bounds (the FBX rig imports at centimetre scale).
    mesh = next(o for o in scene.objects if o.type == 'MESH')
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(dg)
    pts = [ev.matrix_world @ v.co for v in ev.to_mesh().vertices]
    lo = Vector([min(q[i] for q in pts) for i in range(3)])
    hi = Vector([max(q[i] for q in pts) for i in range(3)])
    c = (lo + hi) / 2
    size = max(hi - lo)
    cam.data.ortho_scale = size * 1.3
    cam.data.clip_start, cam.data.clip_end = size * 0.01, size * 20
    # Behind the runner (they face -Y, so the camera sits at +Y), looking along -Y.
    cam.location = (c.x, c.y + size * 4, c.z)
    cam.rotation_euler = (math.radians(90), 0, math.radians(180))
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


for s in (1, -1):
    build(s)
sys.stdout.flush()
