import * as THREE from 'three';
import { unitShape, type ShapeKind } from '../game/world';

export const SHAPES: readonly ShapeKind[] = ['rect', 'hex', 'tri', 'triBack', 'wedgeL', 'wedgeR'];

/**
 * Unit prism for a footprint: top at y=0, bottom at y=-1, local -Z is along the run and +X is
 * the runner's right. Uses the same unit polygon as the physics, so what you see is what you
 * stand on. Group 0 is the top, group 1 the sides.
 */
export function prismGeometry(kind: ShapeKind): THREE.BufferGeometry {
  const pts = unitShape(kind).map(([u, v]) => new THREE.Vector3(u, 0, -v));
  const pos: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    for (const p of [pts[0]!, pts[i + 1]!, pts[i]!]) pos.push(p.x, 0, p.z);
  }
  const topCount = pos.length / 3;
  // Underside (reversed winding), so a building is a closed solid from every angle.
  for (let i = 1; i < pts.length - 1; i++) {
    for (const p of [pts[0]!, pts[i]!, pts[i + 1]!]) pos.push(p.x, -1, p.z);
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    pos.push(a.x, 0, a.z, b.x, -1, b.z, b.x, 0, b.z);
    pos.push(a.x, 0, a.z, a.x, -1, a.z, b.x, -1, b.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Flip winding if needed so every face points outward regardless of polygon orientation.
  if (g.getAttribute('normal').getY(0) < 0) {
    for (let i = 0; i < pos.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        [pos[i + 3 + k], pos[i + 6 + k]] = [pos[i + 6 + k]!, pos[i + 3 + k]!];
      }
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
  }
  g.addGroup(0, topCount, 0);
  g.addGroup(topCount, pos.length / 3 - topCount, 1);
  return g;
}

/** Deck outline, a hair above the top so it never z-fights. */
export function outlineGeometry(kind: ShapeKind): THREE.BufferGeometry {
  const pts = unitShape(kind).map(([u, v]) => new THREE.Vector3(u, 0.0008, -v));
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/** Flat floor arrow pointing along local -Z. */
export function arrowGeometry(): THREE.BufferGeometry {
  const tri = new THREE.Shape();
  tri.moveTo(0, 0.8); // tip at +Y becomes -Z (forward) once laid flat
  tri.lineTo(-0.6, -0.4);
  tri.lineTo(0.6, -0.4);
  tri.closePath();
  const g = new THREE.ShapeGeometry(tri);
  g.rotateX(-Math.PI / 2);
  return g;
}
