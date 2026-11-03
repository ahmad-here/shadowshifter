import * as THREE from 'three';
import type { ObstacleKind, ShapeKind } from '../game/world';
import { arrowGeometry, outlineGeometry, prismGeometry, SHAPES } from './geometry';
import { COLORS, OBSTACLE_COLORS } from './palette';
import type { ObstacleModel } from './props';
import { makePortalMaterial } from './portalShader';
import { DECOR_LOOK, makeBuildingMaterials } from './shaders';

/** Every geometry and material shared between meshes. Created once, disposed once. */
export class Assets {
  readonly box = new THREE.BoxGeometry(1, 1, 1);
  /** Unit box hanging below its origin (top at y = 0), like a building: for wall-run walls. */
  readonly wallGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0);
  readonly prisms = new Map<ShapeKind, THREE.BufferGeometry>();
  readonly outlines = new Map<ShapeKind, THREE.BufferGeometry>();
  readonly building = makeBuildingMaterials();
  /** Scenery towers: a distinct, non-neon look (see DECOR_LOOK). */
  readonly decorBuilding = makeBuildingMaterials(DECOR_LOOK);
  readonly outline = new THREE.LineBasicMaterial({ color: COLORS.cyan });
  readonly obstacle = new Map<ObstacleKind, THREE.Material>();
  /** Real-world obstacle models (see props.ts), once loaded; plain boxes until then. */
  obstacleModels: Map<string, ObstacleModel> | null = null;
  /** Their shaded metal bodies, and each kind's glowing part in its action colour. */
  readonly obstacleBody = new THREE.MeshLambertMaterial({ vertexColors: true });
  readonly obstacleGlow = new Map<ObstacleKind, THREE.MeshBasicMaterial>();

  readonly padGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
  readonly pad = new THREE.MeshBasicMaterial({ color: COLORS.cyan });
  /** Light beam above trampoline pads so they read from far away. */
  readonly beamGeo = new THREE.CylinderGeometry(0.45, 0.6, 1, 16, 1, true);
  readonly beam = translucent(COLORS.cyan, 0.28, true);
  /** Animated electric portal (see portalShader.ts): ring layer plus a centre that goes dark once used. */
  readonly portalTime = { value: 0 };
  readonly portalGeo = new THREE.PlaneGeometry(3.6, 3.6);
  readonly portalRing = makePortalMaterial(this.portalTime, false);
  readonly portalCore = makePortalMaterial(this.portalTime, true);
  /** Black portal (darkness): the same energy gate, in its void variant. */
  readonly blackRing = makePortalMaterial(this.portalTime, false, true);
  readonly blackCore = makePortalMaterial(this.portalTime, true, true);
  readonly arrowGeo = arrowGeometry();
  readonly arrow = translucent(COLORS.orange, 0.9);
  readonly forkArrow = translucent(COLORS.cyan, 0.55);

  constructor() {
    for (const k of SHAPES) {
      this.prisms.set(k, prismGeometry(k));
      this.outlines.set(k, outlineGeometry(k));
    }
    for (const [kind, color] of Object.entries(OBSTACLE_COLORS) as [ObstacleKind, number][]) {
      const wallish = kind === 'wall' || kind === 'sideWall';
      this.obstacleGlow.set(kind, new THREE.MeshBasicMaterial({ color }));
      this.obstacle.set(
        kind,
        new THREE.MeshLambertMaterial({
          color,
          emissive: color,
          emissiveIntensity: wallish ? 0.35 : 0.7,
          transparent: kind === 'sideWall',
          opacity: kind === 'sideWall' ? 0.75 : 1,
        }),
      );
    }
  }

  dispose(): void {
    this.obstacleModels?.forEach((m) => {
      m.body.dispose();
      m.glow.dispose();
    });
    for (const v of Object.values(this)) {
      if (v instanceof THREE.BufferGeometry || v instanceof THREE.Material) v.dispose();
      if (v instanceof Map && v !== this.obstacleModels)
        v.forEach((x: { dispose(): void }) => x.dispose());
      if (Array.isArray(v)) v.forEach((x: { dispose(): void }) => x.dispose());
    }
  }
}

function translucent(color: number, opacity: number, doubleSided = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
}
