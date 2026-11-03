import * as THREE from 'three';
import type { GameSim } from '../game/sim';
import type { World } from '../game/world';
import { Assets } from './assets';
import { Backdrop } from './Backdrop';
import { CameraRig } from './CameraRig';
import { EffectsView } from './EffectsView';
import { WindView } from './WindView';
import { DustView } from './DustView';
import { loadCharacter } from './CharacterModel';
import { loadFireGeometry, loadObstacleModels } from './props';
import { CityDecor } from './CityDecor';
import { DecorView } from './DecorView';
import { ShardView } from './ShardView';
import { FeedbackView } from './FeedbackView';
import { QUALITY, type QualityParams } from './quality';
import type { QualityProfile } from '../app/settings';
import { RunnerView } from './RunnerView';
import { WorldView } from './WorldView';

/**
 * Three.js view of a GameSim. Composes the world, runner, effects, camera and backdrop views.
 * Reads the sim, never writes it.
 */
export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private assets = new Assets();
  private world = new WorldView(this.assets);
  private runner = new RunnerView(this.assets.box);
  private effects = new EffectsView();
  private rig = new CameraRig();
  private backdrop = new Backdrop(this.assets.box);
  private feedback = new FeedbackView();
  private decor = new DecorView();
  private city = new CityDecor(this.assets);
  private shards = new ShardView();
  private wind = new WindView();
  private dust = new DustView();
  /** Reduced visual effects (setting / prefers-reduced-motion): no flicker or pulsing. */
  reducedEffects = false;
  private quality: QualityParams = QUALITY.medium;
  private size = { w: 1, h: 1 };
  private elapsed = 0;
  private lastWorld: World | null = null;
  private lastBounces = 0;
  private bounceT = 1;
  private tmp = new THREE.Vector3();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: 'high-performance',
    });
    this.applyPixelRatio();
    this.scene.background = this.effects.sky;
    this.scene.fog = this.effects.fog;
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x0a1830, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(20, 40, 10);
    this.scene.add(
      sun,
      this.world.group,
      this.runner.group,
      this.runner.trailObject,
      this.effects.group,
      this.feedback.group,
      this.decor.group,
      this.city.group,
      this.shards.mesh,
      this.wind.lines,
      this.dust.points,
      this.backdrop.group,
    );
    // The animated character loads once, in the background; the placeholder runs until then.
    void loadCharacter().then((model) => {
      if (model && !this.disposed) this.runner.setModel(model);
      else model?.dispose();
    });
    void loadFireGeometry().then((geo) => {
      if (geo && !this.disposed) this.decor.setFlameGeometry(geo);
    });
    // Optional art (fire, real-world obstacles); the fallbacks stay if it fails to load.
    void loadObstacleModels().then((models) => {
      if (models && !this.disposed) this.assets.obstacleModels = models;
    });
  }

  /** Switch graphics profile. Presentation only; the simulation never sees it. */
  setQuality(profile: QualityProfile): void {
    this.quality = QUALITY[profile];
    this.backdrop.setQuality(this.quality.towerDensity, this.quality.stars);
    const on = this.quality.decorations;
    this.decor.enabled = this.city.enabled = this.wind.enabled = this.dust.enabled = on;
    this.applyPixelRatio();
    this.renderer.setSize(this.size.w, this.size.h, false);
  }

  private applyPixelRatio(): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio));
  }

  resize(width: number, height: number): void {
    this.size = { w: width, h: height };
    this.renderer.setSize(width, height, false);
    this.rig.resize(width, height);
  }

  render(sim: GameSim, frameSeconds: number): void {
    const dt = Math.min(Math.max(frameSeconds, 0), 0.1);
    this.elapsed += dt;
    // A new world object means a new run: snap everything instead of animating from the old one.
    const fresh = sim.world !== this.lastWorld || sim.phase === 'ready';
    if (fresh) {
      this.lastWorld = sim.world;
      this.runner.reset(sim);
      this.rig.reset(sim);
      this.effects.reset();
      this.feedback.reset(sim);
      this.dust.reset(sim);
      this.lastBounces = sim.bounces;
    }
    if (sim.bounces !== this.lastBounces) {
      this.lastBounces = sim.bounces;
      this.bounceT = 0;
    }
    this.bounceT = Math.min(1, this.bounceT + dt * 3);

    this.world.sync(sim.world, sim.x, sim.z, this.elapsed, fresh);
    this.world.animate(this.elapsed, 1 - Math.sin(this.bounceT * Math.PI) * 0.6);
    this.runner.update(sim, dt, this.reducedEffects);
    this.effects.update(sim, dt);
    this.feedback.update(sim, dt, this.elapsed, this.reducedEffects);
    const rise = (id: number) => this.world.riseOffset(id);
    this.decor.update(sim.world, this.elapsed, rise, this.reducedEffects);
    this.shards.update(sim.world, this.elapsed, rise, this.reducedEffects);
    this.city.update(sim.world, this.elapsed, rise);
    this.wind.update(sim, dt, this.reducedEffects);
    this.dust.update(sim, dt, this.reducedEffects);
    this.rig.update(sim, dt, this.reducedEffects);
    this.backdrop.update(sim.x, sim.z);
    this.renderer.render(this.scene, this.rig.camera);
  }

  /** Runner's chest position on screen, as fractions of the canvas (0..1, origin top-left). */
  screenPosition(sim: GameSim): { x: number; y: number } {
    this.tmp.set(sim.x, sim.y + 0.9, sim.z).project(this.rig.camera);
    return { x: (this.tmp.x + 1) / 2, y: (1 - this.tmp.y) / 2 };
  }

  /** Mismatches between meshes and physics; empty when the view is faithful. */
  verify(sim: GameSim): string[] {
    return this.world.verify(sim.world);
  }

  stats() {
    return { ...this.world.stats(), calls: this.renderer.info.render.calls };
  }

  /** 'model' once the animated character is in, else 'placeholder'. */
  get character(): 'model' | 'placeholder' {
    return this.runner.hasModel ? 'model' : 'placeholder';
  }

  /** Skinned meshes in the scene (debug: there must only ever be one runner). */
  skinnedCount(): number {
    let n = 0;
    this.scene.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) n++;
    });
    return n;
  }

  dispose(): void {
    this.disposed = true;
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const collect = (o: THREE.Object3D) =>
      o.traverse((c) => {
        if (c instanceof THREE.Mesh || c instanceof THREE.Line || c instanceof THREE.Points) {
          geos.add(c.geometry);
          const m = c.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((x) => mats.add(x));
        }
      });
    collect(this.scene);
    this.world.objects().forEach(collect);
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    this.assets.dispose();
    this.renderer.dispose();
  }
}
