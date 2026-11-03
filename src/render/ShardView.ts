import * as THREE from 'three';
import { CONFIG } from '../game/config';
import type { World } from '../game/world';
import { COLORS } from './palette';

/** Energy shards: one instanced mesh, spinning and bobbing, hidden once collected. */
export class ShardView {
  readonly mesh: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1.6, 1);

  constructor() {
    const mat = new THREE.MeshLambertMaterial({
      color: COLORS.amber,
      emissive: COLORS.amber,
      emissiveIntensity: 0.8,
    });
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.22), mat, CONFIG.maxShards);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  update(
    world: World,
    elapsed: number,
    riseOf: (platformId: number) => number | null,
    reduced: boolean,
  ): void {
    let n = 0;
    for (const sh of world.shards) {
      if (sh.taken) continue;
      const y = riseOf(sh.platformId);
      if (y === null) continue;
      const bob = reduced ? 0 : Math.sin(elapsed * 4 + sh.id) * 0.08;
      this.e.set(0, elapsed * 3 + sh.id, 0);
      this.q.setFromEuler(this.e);
      this.p.set(sh.x, y + sh.y + bob, sh.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
