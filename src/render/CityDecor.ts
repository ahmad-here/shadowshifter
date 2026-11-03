import * as THREE from 'three';
import type { World } from '../game/world';
import type { Assets } from './assets';
import { MAX_SIGILS, MAX_TOWERS, planCity, type Sigil, type Tower } from './cityPlan';
import { prismGeometry } from './geometry';
import { COLORS } from './palette';

const TOWER_DEPTH = 45;

/**
 * Renders the decorative city from `planCity`: instanced towers (in the distinct scenery look), glowing caps and flat deck sigils. About seven draw calls in total. Each piece
 * rises with the building it belongs to. Purely visual.
 */
export class CityDecor {
  readonly group = new THREE.Group();
  private rect: THREE.InstancedMesh;
  private hex: THREE.InstancedMesh;
  private diamonds: THREE.InstancedMesh;
  private pyramids: THREE.InstancedMesh;
  private sigilMeshes: Record<Sigil['kind'], THREE.InstancedMesh>;
  private plan: { towers: Tower[]; sigils: Sigil[] } = { towers: [], sigils: [] };
  private key = '';
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  enabled = true;

  constructor(assets: Assets) {
    // Unit prisms centred on their footprint (the route prisms start at their front edge).
    const centred = (k: 'rect' | 'hex') => prismGeometry(k).translate(0, 0, 0.5);
    this.rect = this.instanced(centred('rect'), assets.decorBuilding, MAX_TOWERS);
    this.hex = this.instanced(centred('hex'), assets.decorBuilding, MAX_TOWERS);
    const glow = (color: number) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const flat = (segments: number, inner: number) =>
      new THREE.RingGeometry(inner, 0.6, segments).rotateX(-Math.PI / 2);
    this.diamonds = this.instanced(flat(4, 0.32), glow(COLORS.orange), MAX_TOWERS);
    this.pyramids = this.instanced(
      new THREE.ConeGeometry(0.45, 0.8, 4).translate(0, 0.4, 0),
      new THREE.MeshLambertMaterial({
        color: COLORS.amber,
        emissive: COLORS.orange,
        emissiveIntensity: 0.5,
      }),
      MAX_TOWERS,
    );
    this.sigilMeshes = {
      ring: this.instanced(flat(32, 0.42), glow(COLORS.orange), MAX_SIGILS),
      octagon: this.instanced(flat(8, 0.46), glow(COLORS.cyan), MAX_SIGILS),
      diamond: this.instanced(flat(4, 0.36), glow(COLORS.cyan), MAX_SIGILS),
    };
  }

  update(world: World, elapsed: number, riseOf: (platformId: number) => number | null): void {
    this.group.visible = this.enabled;
    if (!this.enabled) return;
    const ps = world.platforms;
    const key = `${ps.length}:${ps[0]?.id ?? 0}:${ps[ps.length - 1]?.id ?? 0}`;
    if (key !== this.key) {
      this.key = key;
      this.plan = planCity(world);
    }
    const n = { rect: 0, hex: 0, diamond: 0, pyramid: 0 };
    for (const t of this.plan.towers) {
      const off = riseOf(t.platformId);
      if (off === null) continue;
      const y = t.top + off;
      const w = t.shape === 'hex' ? t.size * 0.42 : t.size / 2;
      this.place(t.x, y, t.z, t.yaw, w, TOWER_DEPTH, t.size);
      const im = t.shape === 'hex' ? this.hex : this.rect;
      im.setMatrixAt(n[t.shape]++, this.m);
      if (t.cap === 'diamond') {
        this.place(t.x, y + 0.03, t.z, elapsed * 0.6 + t.yaw, t.size * 0.55, 1, t.size * 0.55);
        this.diamonds.setMatrixAt(n.diamond++, this.m);
      } else if (t.cap === 'pyramid') {
        this.place(t.x, y, t.z, elapsed * 0.8 + t.yaw, 1, 1, 1);
        this.pyramids.setMatrixAt(n.pyramid++, this.m);
      }
    }
    const sn = { ring: 0, octagon: 0, diamond: 0 };
    for (const sg of this.plan.sigils) {
      const off = riseOf(sg.platformId);
      if (off === null) continue;
      this.place(sg.x, sg.y + off, sg.z, elapsed * 0.4, 1, 1, 1);
      this.sigilMeshes[sg.kind].setMatrixAt(sn[sg.kind]++, this.m);
    }
    this.commit(this.rect, n.rect);
    this.commit(this.hex, n.hex);
    this.commit(this.diamonds, n.diamond);
    this.commit(this.pyramids, n.pyramid);
    for (const k of ['ring', 'octagon', 'diamond'] as const)
      this.commit(this.sigilMeshes[k], sn[k]);
  }

  private instanced(
    geo: THREE.BufferGeometry,
    mat: THREE.Material | THREE.Material[],
    max: number,
  ): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(geo, mat, max);
    im.frustumCulled = false;
    im.count = 0;
    this.group.add(im);
    return im;
  }

  private place(
    x: number,
    y: number,
    z: number,
    yaw: number,
    sx: number,
    sy: number,
    sz: number,
  ): void {
    this.e.set(0, yaw, 0);
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz));
  }

  private commit(im: THREE.InstancedMesh, count: number): void {
    im.count = count;
    im.instanceMatrix.needsUpdate = true;
  }
}
