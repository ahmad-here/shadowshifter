import * as THREE from 'three';
import { CONFIG } from '../game/config';
import { CLIP_SECONDS, type ClipChoice, type ClipName } from './characterState';
import { BodyDrive } from './bodyDrive';
import { COLORS } from './palette';
import type { GameSim } from '../game/sim';

/** Served from public/models; generated from art/ by `npm run convert:runner`. */
export const RUNNER_URL = './models/runner.glb';
const FADE = 0.12;
const SHADOW_BODY = new THREE.Color(0x05080f);
const SHADOW_EDGE = new THREE.Color(0x2a6cff);
const CHAR = new THREE.Color(0x120806);
const EMBER = new THREE.Color(0xff4a0a);

/**
 * The animated runner from runner.glb: one skinned mesh and five in-place clips, scaled to the
 * simulation's runner height, wearing the suit texture baked from art/runner-reference.png.
 */
export class CharacterModel {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<ClipName, THREE.AnimationAction>();
  private current: ClipName | null = null;
  /** Procedural lean, banking and head stabilisation on top of the clips. */
  private drive: BodyDrive;
  private materials: THREE.MeshLambertMaterial[] = [];

  constructor(scene: THREE.Object3D, clips: THREE.AnimationClip[]) {
    // Scale the bind pose to the physics height so poses match the hitbox.
    const box = new THREE.Box3().setFromObject(scene);
    const height = Math.max(0.01, box.max.y - box.min.y);
    scene.scale.multiplyScalar(CONFIG.runnerHeight / height);
    scene.position.y -= box.min.y * (CONFIG.runnerHeight / height);
    scene.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      // Keep the baked suit texture; Lambert is cheaper than the exported PBR material.
      const map = (m.material as THREE.MeshStandardMaterial).map;
      (m.material as THREE.Material).dispose();
      const mat = map
        ? new THREE.MeshLambertMaterial({ map })
        : new THREE.MeshLambertMaterial({ color: COLORS.runner });
      this.materials.push(mat);
      m.material = mat;
      m.frustumCulled = false; // skinned bounds don't follow the animation
    });
    this.root.add(scene);
    this.drive = new BodyDrive(scene);
    this.mixer = new THREE.AnimationMixer(scene);
    for (const clip of clips) {
      if (clip.name in CLIP_SECONDS)
        this.actions.set(clip.name as ClipName, this.mixer.clipAction(clip));
    }
    if (!this.actions.has('run')) throw new Error('runner.glb has no "run" clip');
  }

  /** Play `choice`, cross-fading from the previous clip. `dt` is presentation time. */
  update(choice: ClipChoice, dt: number, sim?: GameSim): void {
    const next = this.actions.get(choice.clip) ?? this.actions.get('run')!;
    if (choice.clip !== this.current) {
      const prev = this.current ? this.actions.get(this.current) : null;
      next.reset();
      next.setLoop(choice.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      next.clampWhenFinished = !choice.loop;
      next.play();
      if (prev && prev !== next) prev.crossFadeTo(next, FADE, false);
      this.current = choice.clip;
    }
    next.timeScale = choice.timeScale;
    this.mixer.update(dt);
    if (sim) this.drive.apply(sim, dt);
  }

  /** Shadow form: 0 = the normal suit, 1 = a pitch-black silhouette with a faint blue edge. */
  setShadow(k: number): void {
    for (const m of this.materials) {
      m.color.setScalar(1).lerp(SHADOW_BODY, k);
      m.emissive.copy(SHADOW_EDGE).multiplyScalar(0);
    }
  }

  /**
   * Burning in a laser: `char` (0..1) blackens the suit, `glow` (0..1) shows hot orange embers
   * through it. Both 0 = normal (call after setShadow, which it overrides while burning).
   */
  setBurn(char: number, glow: number): void {
    if (char <= 0 && glow <= 0) return;
    for (const m of this.materials) {
      m.color.lerp(CHAR, char);
      m.emissive.copy(EMBER).multiplyScalar(glow);
    }
  }

  /** Snap back to the first frame (new run). */
  reset(sim?: GameSim): void {
    if (sim) this.drive.reset(sim);
    this.mixer.stopAllAction();
    this.current = null;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      const material = m.material as THREE.MeshLambertMaterial;
      material.map?.dispose();
      material.dispose();
    });
  }
}

/** Load the runner in the background. Resolves to null (keep the placeholder) on any failure. */
export async function loadCharacter(url = RUNNER_URL): Promise<CharacterModel | null> {
  try {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url);
    return new CharacterModel(gltf.scene, gltf.animations);
  } catch (e) {
    console.warn('[shadow-shift] runner model unavailable, using the placeholder', e);
    return null;
  }
}
