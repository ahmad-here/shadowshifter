import type * as THREE from 'three';

interface Entity {
  id: number;
}

/**
 * Pooled meshes for one kind of world entity, keyed by entity *object* as well as id: if a new
 * world reuses an id for a different entity, the mesh is re-placed instead of kept stale.
 */
export class Layer<E extends Entity, O extends THREE.Object3D> {
  readonly items = new Map<number, { entity: E; obj: O }>();
  private pool: O[] = [];

  constructor(private readonly place: (pooled: O | undefined, e: E) => O) {}

  /** Make the layer match `list`, parenting each mesh under `parentOf(entity)`. */
  sync(list: readonly E[], parentOf: (e: E) => THREE.Object3D, live: Set<number>): void {
    live.clear();
    for (const e of list) {
      live.add(e.id);
      const cur = this.items.get(e.id);
      if (cur && cur.entity === e) {
        const parent = parentOf(e);
        if (cur.obj.parent !== parent) parent.add(cur.obj);
        continue;
      }
      if (cur) this.release(e.id, cur.obj);
      const obj = this.place(this.pool.pop(), e);
      parentOf(e).add(obj);
      this.items.set(e.id, { entity: e, obj });
    }
    for (const [id, cur] of this.items) if (!live.has(id)) this.release(id, cur.obj);
  }

  clear(): void {
    for (const [id, cur] of this.items) this.release(id, cur.obj);
  }

  /** Every object this layer owns, live or pooled (for disposal). */
  all(): O[] {
    return [...[...this.items.values()].map((c) => c.obj), ...this.pool];
  }

  private release(id: number, obj: O): void {
    obj.removeFromParent();
    this.pool.push(obj);
    this.items.delete(id);
  }
}
