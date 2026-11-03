import * as THREE from 'three';
import { hash } from './math';
import { COLORS } from './palette';

const CELL = 26;
const PER_SHAPE = 40;

/**
 * Decorative city far below the decks: square, triangular and hexagonal towers on a grid that
 * recentres on the runner, plus magenta star specks. Purely visual; never collides.
 */
export class Backdrop {
  readonly group = new THREE.Group();
  private towers: THREE.InstancedMesh[] = [];
  private stars: THREE.Points;
  private cell = { x: NaN, z: NaN };
  private m = new THREE.Matrix4();
  private density = 1;

  constructor(box: THREE.BufferGeometry) {
    const mat = new THREE.MeshLambertMaterial({
      color: COLORS.tower,
      emissive: 0x0c2a4d,
      emissiveIntensity: 0.45,
    });
    const geos = [
      box,
      new THREE.CylinderGeometry(0.6, 0.6, 1, 3),
      new THREE.CylinderGeometry(0.55, 0.55, 1, 6),
    ];
    for (const g of geos) {
      const mesh = new THREE.InstancedMesh(g, mat, PER_SHAPE);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.towers.push(mesh);
      this.group.add(mesh);
    }
    this.stars = makeStars();
    this.group.add(this.stars);
  }

  /** Quality: fraction of towers drawn, and whether stars show. Rebuilds on the next update. */
  setQuality(density: number, stars: boolean): void {
    this.density = density;
    this.stars.visible = stars;
    this.cell.x = NaN;
  }

  update(x: number, z: number): void {
    this.stars.position.set(x, 0, z);
    const cx = Math.round(x / (CELL * 3));
    const cz = Math.round(z / (CELL * 3));
    if (cx === this.cell.x && cz === this.cell.z) return;
    this.cell.x = cx;
    this.cell.z = cz;
    const counts = [0, 0, 0];
    for (let gx = -5; gx <= 5; gx++) {
      for (let gz = -5; gz <= 5; gz++) {
        const wx = cx * 3 + gx;
        const wz = cz * 3 + gz;
        const kind = Math.floor(hash(wx + 3, wz - 9) * 3);
        if (counts[kind]! >= PER_SHAPE || hash(wx - 11, wz + 5) > this.density) continue;
        const h = hash(wx, wz);
        const w = 3 + hash(wx + 7, wz) * 6;
        // Tops sit 14+ m below the decks so they can never be mistaken for a walkable building.
        const top = -14 - h * 20;
        this.m.makeScale(w, 80, w);
        this.m.setPosition(
          wx * CELL + (hash(wz, wx) - 0.5) * CELL * 0.6,
          top - 40,
          wz * CELL + (h - 0.5) * CELL * 0.6,
        );
        this.towers[kind]!.setMatrixAt(counts[kind]!++, this.m);
      }
    }
    this.towers.forEach((t, i) => {
      t.count = counts[i]!;
      t.instanceMatrix.needsUpdate = true;
    });
  }
}

function makeStars(): THREE.Points {
  const n = 500;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (hash(i, 1) - 0.5) * 320;
    pos[i * 3 + 1] = -40 + hash(i, 2) * 110;
    pos[i * 3 + 2] = (hash(i, 3) - 0.5) * 320;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0x9fd0ff,
      size: 0.6,
      fog: false,
      transparent: true,
      opacity: 0.7,
    }),
  );
  pts.frustumCulled = false;
  return pts;
}
