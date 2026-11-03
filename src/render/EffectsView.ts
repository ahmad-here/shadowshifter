import * as THREE from 'three';
import type { GameSim } from '../game/sim';
import { approach } from './math';
import { COLORS } from './palette';
import { SHADOW_WORLD } from './shaders';

const SHADOW_SKY = new THREE.Color(COLORS.shadowSky);

/**
 * The darkness after a black portal: buildings dim (`SHADOW_WORLD`), the sky goes black and the
 * fog closes in, so visibility really drops. Neon edges and obstacle colours stay lit, so the
 * route can still be read up close.
 */
export class EffectsView {
  readonly fog = new THREE.Fog(COLORS.sky, 40, 130);
  readonly sky = new THREE.Color(COLORS.sky);
  readonly group = new THREE.Group();
  private shadow = 0;

  update(sim: GameSim, dt: number): void {
    this.shadow = approach(this.shadow, sim.effect === 'shadow' ? 1 : 0, 3, dt);
    SHADOW_WORLD.value = this.shadow;
    // Only the last few metres are visible: everything further, neon edges included, is black.
    this.fog.near = THREE.MathUtils.lerp(40, 2, this.shadow);
    this.fog.far = THREE.MathUtils.lerp(130, 12, this.shadow);
    this.sky.setHex(COLORS.sky).lerp(SHADOW_SKY, this.shadow);
    this.fog.color.copy(this.sky);
  }

  reset(): void {
    this.shadow = 0;
    SHADOW_WORLD.value = 0;
  }
}
