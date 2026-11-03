/**
 * Development-only tool: converts the Mixamo FBX files in art/ into one optimized
 * public/models/runner.glb (one simplified skinned character + all clips, root motion removed).
 * Run with `npm run convert:runner`. Never part of the game bundle.
 */
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const loader = new FBXLoader();
const load = (f: string) => loader.loadAsync(encodeURI(`/art/${f}`));

/** The character mesh (skin, skeleton, UVs) comes from this file. */
const MESH_FILE = 'Running.fbx';
/**
 * Game clip name → source file. The run is the athletic version made in Blender
 * (tools/blender/athletic_run.py: harder arm pump, longer stride).
 */
const CLIPS: [string, string][] = [
  ['run', 'Running-athletic.fbx'],
  ['runBack', 'Running Backward.fbx'],
  ['jumpUp', 'Jumping Up.fbx'],
  ['jumpDown', 'Jumping Down.fbx'],
  ['slide', 'Running Slide.fbx'],
  ['wallRunR', 'Wall Run Right.fbx'],
  ['wallRunL', 'Wall Run Left.fbx'],
];

function findSkinned(root: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !found) found = o as THREE.SkinnedMesh;
  });
  if (!found) throw new Error('no skinned mesh');
  return found;
}

/** Weld, simplify (keeping skin weights: only the index buffer is rewritten), then compact. */
function simplify(src: THREE.BufferGeometry, targetTris: number): THREE.BufferGeometry {
  const welded = mergeVertices(src, 1e-4);
  const pos = welded.getAttribute('position').array as Float32Array;
  const idx = new Uint32Array(welded.getIndex()!.array);
  const [simplified] = MeshoptSimplifier.simplify(idx, pos, 3, targetTris * 3, 0.05, ['Prune']);
  // Keep only the vertices still referenced.
  const remap = new Map<number, number>();
  const order: number[] = [];
  const index = new Uint32Array(simplified.length);
  for (let i = 0; i < simplified.length; i++) {
    const v = simplified[i]!;
    let n = remap.get(v);
    if (n === undefined) {
      n = order.length;
      remap.set(v, n);
      order.push(v);
    }
    index[i] = n;
  }
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) {
    const a = welded.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const Arr = a.array.constructor as new (n: number) => THREE.TypedArray;
    const data = new Arr(order.length * a.itemSize);
    for (let i = 0; i < order.length; i++) {
      for (let k = 0; k < a.itemSize; k++)
        data[i * a.itemSize + k] = a.array[order[i]! * a.itemSize + k]!;
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, a.itemSize, a.normalized));
  }
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

/** Character sheet (FRONT, SIDE, BACK, 3/4 in four equal columns) projected onto the mesh. */
const REFERENCE = '/art/runner-reference.png';
const TEXTURE_SIZE = 1024;

interface Panel {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Bounding box of the figure in sheet column `col` (labels in the bottom rows are skipped). */
function findFigure(img: ImageData, col: number, bg: number[]): Panel {
  const w = img.width / 4;
  const maxY = Math.floor(img.height * 0.88);
  const fg = (x: number, y: number) => {
    const i = (y * img.width + x) * 4;
    const d = img.data;
    return (
      Math.max(
        Math.abs(d[i]! - bg[0]!),
        Math.abs(d[i + 1]! - bg[1]!),
        Math.abs(d[i + 2]! - bg[2]!),
      ) > 40
    );
  };
  let x0 = Infinity,
    x1 = -1,
    y0 = Infinity,
    y1 = -1;
  for (let y = 0; y < maxY; y++) {
    for (let x = Math.floor(col * w); x < Math.floor((col + 1) * w); x++) {
      if (!fg(x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, x1, y0, y1 };
}

/**
 * Bakes the reference sheet into a texture through the mesh UVs: each surface point is projected
 * orthographically into the front, back and side views and the samples are blended by how
 * squarely the surface faces each view. Mesh space: Y up, character faces +Z.
 */
async function bakeTexture(geo: THREE.BufferGeometry): Promise<THREE.Texture> {
  const bitmap = await createImageBitmap(await (await fetch(REFERENCE)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  const bg = [img.data[0]!, img.data[1]!, img.data[2]!];
  const front = findFigure(img, 0, bg);
  const side = findFigure(img, 1, bg);
  const back = findFigure(img, 2, bg);

  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const height = box.max.y - box.min.y;

  /** Average a 3x3 block at sheet position (u = horizontal offset from centre, v = height). */
  const sample = (p: Panel, u: number, v: number, out: number[]) => {
    const scale = (p.y1 - p.y0) / height;
    const mid = (p.x0 + p.x1) / 2;
    let px = Math.round(mid + u * scale);
    const py = Math.round(p.y1 - v * scale);
    const isBg = (x: number) => {
      const i = (py * img.width + x) * 4;
      const d = img.data;
      return (
        Math.abs(d[i]! - bg[0]!) + Math.abs(d[i + 1]! - bg[1]!) + Math.abs(d[i + 2]! - bg[2]!) < 90
      );
    };
    // Silhouettes never line up exactly (and their edges are anti-aliased into the background):
    // move to the nearest figure pixel on this row, then a few pixels into the figure.
    for (let k = 1; k < 40 && isBg(px); k++) {
      const dir = !isBg(px - k) ? -1 : !isBg(px + k) ? 1 : 0;
      if (dir) {
        px += dir * (k + 3);
        break;
      }
    }
    out[0] = out[1] = out[2] = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = ((py + dy) * img.width + px + dx) * 4;
        for (let c = 0; c < 3; c++) out[c]! += img.data[i + c]! / 9 / 255;
      }
    }
  };

  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  const out = new ImageData(TEXTURE_SIZE, TEXTURE_SIZE);
  const f = [0, 0, 0],
    b = [0, 0, 0],
    s = [0, 0, 0];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  /** Colour for a surface point `p` with normal `n`, written to texel `t`. */
  const shade = (t: number) => {
    const wf = Math.max(0, n.z) ** 1.5 + 0.02;
    const wb = Math.max(0, -n.z) ** 1.5 + 0.02;
    const ws = 0.35 * n.x ** 2;
    const y = p.y - box.min.y;
    sample(front, p.x - cx, y, f);
    sample(back, cx - p.x, y, b);
    sample(side, p.z - cz, y, s);
    const sum = wf + wb + ws;
    for (let c = 0; c < 3; c++)
      out.data[t * 4 + c] = (255 * (f[c]! * wf + b[c]! * wb + s[c]! * ws)) / sum;
    out.data[t * 4 + 3] = 255;
  };

  // Rasterize every triangle in UV space, interpolating position and normal per texel.
  const index = geo.getIndex();
  const tris = (index ? index.count : pos.count) / 3;
  const vi = (k: number) => (index ? index.getX(k) : k);
  const S = TEXTURE_SIZE;
  for (let tri = 0; tri < tris; tri++) {
    const [i0, i1, i2] = [vi(tri * 3), vi(tri * 3 + 1), vi(tri * 3 + 2)];
    const ax = uv.getX(i0) * S,
      ay = (1 - uv.getY(i0)) * S;
    const bx = uv.getX(i1) * S,
      by = (1 - uv.getY(i1)) * S;
    const qx = uv.getX(i2) * S,
      qy = (1 - uv.getY(i2)) * S;
    const area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, qx)));
    const maxX = Math.min(S - 1, Math.ceil(Math.max(ax, bx, qx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, qy)));
    const maxY = Math.min(S - 1, Math.ceil(Math.max(ay, by, qy)));
    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const px = tx + 0.5,
          py = ty + 0.5;
        const w1 = ((px - ax) * (qy - ay) - (qx - ax) * (py - ay)) / area;
        const w2 = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / area;
        const w0 = 1 - w1 - w2;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        p.set(0, 0, 0)
          .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, i0), w0)
          .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, i1), w1)
          .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, i2), w2);
        n.set(0, 0, 0)
          .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, i0), w0)
          .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, i1), w1)
          .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, i2), w2)
          .normalize();
        shade(ty * S + tx);
      }
    }
  }
  // Grow islands a few texels so mipmapping never pulls in the empty background at UV seams.
  for (let pass = 0; pass < 4; pass++) {
    const src = new Uint8ClampedArray(out.data);
    for (let t = 0; t < S * S; t++) {
      if (src[t * 4 + 3]) continue;
      for (const d of [1, -1, S, -S]) {
        const u = t + d;
        if (u < 0 || u >= S * S || !src[u * 4 + 3]) continue;
        out.data.set(src.subarray(u * 4, u * 4 + 4), t * 4);
        break;
      }
    }
  }
  const canvasOut = new OffscreenCanvas(S, S);
  canvasOut.getContext('2d')!.putImageData(out, 0, 0);
  const texture = new THREE.CanvasTexture(canvasOut as unknown as HTMLCanvasElement);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * The game moves the runner, so clips must run in place: the hips keep their first-frame X/Z.
 * Jump clips also lose their vertical hip travel, because the simulation already provides the
 * jump height (otherwise the character would visibly double-jump).
 */
function stripRootMotion(clip: THREE.AnimationClip, name: string, restY: number): void {
  const t = clip.tracks.find((tr) => /Hips\.position$/.test(tr.name));
  if (!t) return;
  const v = t.values;
  const x0 = v[0]!;
  const z0 = v[2]!;
  const lockY = name === 'jumpUp' || name === 'jumpDown';
  for (let i = 0; i < v.length; i += 3) {
    v[i] = x0;
    v[i + 2] = z0;
    if (lockY) v[i + 1] = restY;
  }
}

/**
 * Guard for clips re-exported from Blender: a bone the edit did not touch must animate exactly
 * as in the original (same names, same bone orientations), or the clip would twist the rig.
 */
function checkRig(original: THREE.AnimationClip, edited: THREE.AnimationClip): void {
  const a = original.tracks.find((t) => /Spine\.quaternion$/.test(t.name));
  const b = edited.tracks.find((t) => t.name === a?.name);
  if (!a || !b) throw new Error(`edited run clip has no ${a?.name ?? 'Spine'} track`);
  const qa = new THREE.Quaternion().fromArray(a.values, 0);
  const qb = new THREE.Quaternion().fromArray(b.values, 0);
  const deg = (qa.angleTo(qb) * 180) / Math.PI;
  if (deg > 2) throw new Error(`edited run clip: Spine differs by ${deg.toFixed(1)} deg`);
  rigCheck = `Spine matches original within ${deg.toFixed(2)} deg`;
}
let rigCheck = 'not checked';

async function convert(targetTris: number) {
  await MeshoptSimplifier.ready;
  const base = await load(MESH_FILE);
  const mesh = findSkinned(base);
  const before = mesh.geometry.getAttribute('position').count;
  const map = await bakeTexture(mesh.geometry);
  mesh.geometry = simplify(mesh.geometry, targetTris);
  mesh.material = new THREE.MeshStandardMaterial({ map, roughness: 0.6 });
  mesh.name = 'runner';

  const runHips = base.animations[0]!.tracks.find((tr) => /Hips\.position$/.test(tr.name))!;
  const restY = runHips.values[1]!;
  const clips: THREE.AnimationClip[] = [];
  for (const [name, file] of CLIPS) {
    const src = file === MESH_FILE ? base : await load(file);
    const clip = src.animations[0]!.clone();
    if (name === 'run') checkRig(base.animations[0]!, clip);
    clip.name = name;
    stripRootMotion(clip, name, restY);
    clips.push(clip);
  }
  // Only the character and its skeleton: drop any other nodes the FBX carried.
  const keep = new Set<THREE.Object3D>();
  mesh.traverseAncestors((a) => keep.add(a));
  base.children = base.children.filter(
    (c) => keep.has(c) || (c as THREE.Bone).isBone || c === mesh,
  );

  const exporter = new GLTFExporter();
  const glb = (await exporter.parseAsync(base, { binary: true, animations: clips })) as ArrayBuffer;
  const bytes = new Uint8Array(glb);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return {
    base64: btoa(bin),
    report: {
      verticesBefore: before,
      verticesAfter: mesh.geometry.getAttribute('position').count,
      triangles: mesh.geometry.getIndex()!.count / 3,
      bytes: bytes.length,
      clips: clips.map((c) => `${c.name} ${c.duration.toFixed(2)}s`),
      restHipsY: restY,
      rigCheck,
    },
  };
}

(window as unknown as Record<string, unknown>).convertRunner = convert;
