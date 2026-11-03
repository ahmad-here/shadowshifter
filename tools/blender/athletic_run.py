"""Development-only Blender script: makes the Mixamo run cycle more athletic (like the user's
reference footage, art/sample.mp4): a harder arm pump and a longer, more driven stride.

For each limb bone, every frame's rotation is split into the bone's average pose over the cycle
and its swing away from it; the swing angle is scaled (axis-angle, so it stays a true rotation)
and the keys rewritten. Writes art/Running-athletic.fbx; the original stays untouched.
Run: blender -b --factory-startup --python tools/blender/athletic_run.py
"""
import os
import sys

import bpy
from mathutils import Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'art', 'Running.fbx')
OUT = os.path.join(ROOT, 'art', 'Running-athletic.fbx')
# Bone name suffix -> swing multiplier.
GAIN = {
    'LeftArm': 1.3, 'RightArm': 1.3, 'LeftForeArm': 1.3, 'RightForeArm': 1.3,
    'LeftUpLeg': 1.15, 'RightUpLeg': 1.15, 'LeftLeg': 1.15, 'RightLeg': 1.15,
}

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
bpy.ops.import_scene.fbx(filepath=SRC, automatic_bone_orientation=False)
arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
action = arm.animation_data.action
start, end = (int(v) for v in action.frame_range)
print('ACTION', action.name, start, end)


def channel_curves(action, anim):
    """F-curves of the armature's slot (Blender 4.4+ slotted actions; older: action.fcurves)."""
    if hasattr(action, 'fcurves'):
        return action.fcurves
    for layer in action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(anim.action_slot)
            if bag:
                return bag.fcurves
    raise RuntimeError('no f-curves for the armature')


fcurves = channel_curves(action, arm.animation_data)

changed = []
for pb in arm.pose.bones:
    gain = next((g for k, g in GAIN.items() if pb.name.endswith(k)), None)
    if gain is None:
        continue
    pb.rotation_mode = 'QUATERNION'
    path = f'pose.bones["{pb.name}"].rotation_quaternion'
    curves = [fcurves.find(path, index=i) for i in range(4)]
    if any(c is None for c in curves):
        continue
    frames = sorted({int(round(k.co.x)) for c in curves for k in c.keyframe_points})
    qs = [Quaternion([c.evaluate(f) for c in curves]).normalized() for f in frames]
    # Average orientation (sign-aligned to the first key), then each key's swing from it.
    ref = qs[0]
    acc = [0.0, 0.0, 0.0, 0.0]
    for q in qs:
        s = 1 if q.dot(ref) >= 0 else -1
        for i in range(4):
            acc[i] += q[i] * s
    mean = Quaternion(acc).normalized()
    for c in curves:
        c.keyframe_points.clear()
    for f, q in zip(frames, qs):
        d = mean.inverted() @ q
        axis, angle = d.to_axis_angle()
        if angle > 3.14159:
            angle -= 2 * 3.14159
        q2 = (mean @ Quaternion(axis, angle * gain)).normalized()
        for i, c in enumerate(curves):
            c.keyframe_points.insert(f, q2[i], options={'FAST'})
    for c in curves:
        c.update()
    changed.append(pb.name)

print('AMPLIFIED', changed)
# Export exactly the cycle, not Blender's default 250-frame scene range.
bpy.context.scene.frame_start = start
bpy.context.scene.frame_end = end
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.fbx(
    filepath=OUT, use_selection=True, bake_anim=True, bake_anim_use_all_actions=False,
    bake_anim_use_nla_strips=False, bake_anim_simplify_factor=0.0, add_leaf_bones=False,
    primary_bone_axis='Y', secondary_bone_axis='X', armature_nodetype='NULL',
    apply_unit_scale=True, apply_scale_options='FBX_SCALE_NONE', object_types={'ARMATURE', 'MESH'},
)
print('WROTE', OUT, os.path.getsize(OUT))
sys.stdout.flush()
