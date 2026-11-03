import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { pointInPoly, runPoint, type Platform, type World } from '../game/world';
import { hash } from './math';
import { COLORS } from './palette';
import { animateFlame } from './flameShader';

const MAX_FLAMES = 48;
const MAX_HOLOS = 24;
const SPARKS_PER_FLAME = 3;
/** Seconds for one spark to rise from the flame and burn out. */
const SPARK_LIFE = 1.6;
const DECORATED = new Set<Platform['role']>(['plain', 'entry', 'start']);

interface Spot {
  x: number;
  z: number;
  platformId: number;
  seed: number;
  /** Deck height of the building it decorates. */
  top: number;
}

/**
 * Reference-art decoration: low-poly fire (with rising sparks) on building corners and wireframe
 * holograms floating above some buildings. Three instanced meshes in total. Purely visual: placed deterministically per
 * building, always outside the runner's lane, and it rises with its building.
 */
export class DecorView {
  readonly group = new THREE.Group();
  private flames: THREE.InstancedMesh;
  private holos: THREE.InstancedMesh;
  private sparks: THREE.InstancedMesh;
  /** True once the fire model replaced the fallback cone (base at y=0 instead of centred). */
  private fireModel = false;
  private flameSpots: Spot[] = [];
  /** Shader clock for the flame sway (see `animateFlame`). */
  private flameTime = { value: 0 };
  private holoSpots: Spot[] = [];
  private key = '';
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private e = new THREE.Euler();
  enabled = true;

  constructor() {
    // Opaque and unlit: the model's two baked colours (orange, yellow) stay crisp.
    const flameMat = new THREE.MeshBasicMaterial({ color: COLORS.orange });
    animateFlame(flameMat, this.flameTime);
    this.flames = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.22, 0.9, 6),
      flameMat,
      MAX_FLAMES,
    );
    const holoMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan, wireframe: true });
    this.holos = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.55, 0),
      holoMat,
      MAX_HOLOS,
    );
    this.sparks = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.035, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      MAX_FLAMES * SPARKS_PER_FLAME,
    );
    const spark = new THREE.Color();
    for (let i = 0; i < MAX_FLAMES * SPARKS_PER_FLAME; i++)
      this.sparks.setColorAt(i, spark.setHex(i % 2 ? 0xffc21f : 0xff6a10));
    for (const im of [this.flames, this.holos, this.sparks]) {
      im.frustumCulled = false;
      im.count = 0;
      this.group.add(im);
    }
  }

  update(
    world: World,
    elapsed: number,
    riseOf: (platformId: number) => number | null,
    reduced: boolean,
  ): void {
    this.group.visible = this.enabled;
    if (!this.enabled) return;
    this.layout(world);
    this.flameTime.value = reduced ? 0 : elapsed;
    this.flames.count = this.draw(this.flames, this.flameSpots, riseOf, (sp, y) => {
      // Slow, smooth breathing; the shader adds the sway and licking tips.
      const t = elapsed + sp.seed * 13;
      const flicker = reduced ? 1 : 1 + 0.07 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 5.3);
      this.e.set(0, elapsed * 0.3 + sp.seed * 20, 0);
      if (this.fireModel) {
        // The model is 1 m tall with its base at 0: stand it on the deck and flicker its height.
        this.s.set(0.85, 0.85 * flicker, 0.85);
        this.p.set(sp.x, sp.top + y, sp.z);
      } else {
        this.s.set(1, flicker, 1);
        this.p.set(sp.x, sp.top + y + 0.45 * flicker, sp.z);
      }
    });
    this.sparks.count = reduced ? 0 : this.drawSparks(elapsed, riseOf);
    this.holos.count = this.draw(this.holos, this.holoSpots, riseOf, (sp, y) => {
      const bob = reduced ? 0 : Math.sin(elapsed * 1.6 + sp.seed * 9) * 0.25;
      this.e.set(elapsed * 0.6, elapsed * (0.8 + sp.seed), 0);
      this.s.set(1, 1, 1);
      this.p.set(sp.x, sp.top + y + 3 + bob, sp.z);
    });
  }

  /** Embers that drift up from each flame, wobbling and shrinking until they burn out. */
  private drawSparks(elapsed: number, riseOf: (platformId: number) => number | null): number {
    let n = 0;
    this.q.identity();
    for (const sp of this.flameSpots) {
      const y = riseOf(sp.platformId);
      if (y === null) continue;
      for (let k = 0; k < SPARKS_PER_FLAME; k++) {
        const life = (elapsed / SPARK_LIFE + k / SPARKS_PER_FLAME + sp.seed * 7) % 1;
        const a = sp.seed * 31 + k * 2.1;
        const drift = 0.12 + 0.25 * life;
        this.p.set(
          sp.x + Math.cos(a) * drift + 0.06 * Math.sin(elapsed * 4 + a),
          sp.top + y + 0.5 + life * 1.3,
          sp.z + Math.sin(a) * drift,
        );
        this.s.setScalar(1 - life * life);
        this.m.compose(this.p, this.q, this.s);
        this.sparks.setMatrixAt(n++, this.m);
      }
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    return n;
  }

  /** Swap the fallback cone for the fire model (vertex colours: orange tongues, yellow core). */
  setFlameGeometry(geo: THREE.BufferGeometry): void {
    const old = this.flames.geometry;
    this.flames.geometry = geo;
    const mat = this.flames.material as THREE.MeshBasicMaterial;
    mat.vertexColors = true;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
    this.fireModel = true;
    if (old !== geo) old.dispose();
  }

  /** Recompute spots only when the set of buildings changes. */
  private layout(world: World): void {
    const ps = world.platforms;
    const key = `${ps.length}:${ps[0]?.id ?? 0}:${ps[ps.length - 1]?.id ?? 0}`;
    if (key === this.key) return;
    this.key = key;
    this.flameSpots.length = 0;
    this.holoSpots.length = 0;
    for (const p of ps) {
      const h = hash(p.id, 3);
      // Never near obstacles, trampolines or the side-leap windows of dead ends and forks.
      if (!DECORATED.has(p.role)) continue;
      if (h < 0.45 && this.flameSpots.length < MAX_FLAMES - 1) this.addFlames(p, h);
      if (h > 0.8 && this.holoSpots.length < MAX_HOLOS) {
        const c = runPoint(p.run, (p.a + p.b) / 2, (h > 0.9 ? 1 : -1) * (p.hw + 1.2));
        this.holoSpots.push({ x: c.x, z: c.z, platformId: p.id, seed: h, top: p.top });
      }
    }
  }

  /** A pair of flames on the far corners, just outside the lane edge. */
  private addFlames(p: Platform, h: number): void {
    const lat = p.hw - 0.25;
    if (lat < CONFIG.pathHalfWidth - 0.3) return;
    const along = p.b - 1.2;
    for (const side of [-1, 1]) {
      const c = runPoint(p.run, along, side * lat);
      // Triangles and wedges narrow toward their ends: skip corners that are not on the deck.
      if (!pointInPoly(p.poly, c.x, c.z)) continue;
      this.flameSpots.push({ x: c.x, z: c.z, platformId: p.id, seed: h + side * 0.1, top: p.top });
    }
  }

  private draw(
    im: THREE.InstancedMesh,
    spots: Spot[],
    riseOf: (platformId: number) => number | null,
    pose: (sp: Spot, y: number) => void,
  ): number {
    let n = 0;
    for (const sp of spots) {
      const y = riseOf(sp.platformId);
      if (y === null) continue;
      pose(sp, y);
      this.q.setFromEuler(this.e);
      this.m.compose(this.p, this.q, this.s);
      im.setMatrixAt(n++, this.m);
    }
    im.instanceMatrix.needsUpdate = true;
    return n;
  }
}
