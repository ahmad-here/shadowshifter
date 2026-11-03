import { autopilot } from '../game/autopilot';
import { InputController, intentToAction, type Intent } from '../game/input';
import { randomSeed } from '../game/rng';
import { GameSim, type Action } from '../game/sim';
import { FixedStepper } from '../game/stepper';
import { DIR_X, DIR_Z } from '../game/world';

/** Freeze at the moment of a crash (presentation; nothing can be input while dying). */
const HIT_STOP_SECONDS = 0.09;
import { AdaptiveQuality, initialProfile } from '../render/AdaptiveQuality';
import { GameRenderer } from '../render/GameRenderer';
import { reportError } from '../ui/errors';
import { DEBUG, type DebugOptions } from './debug';
import { GameAudio } from './audio';
import { SettingsStore } from './settings';
import { Tutorial } from './tutorial';
import { initialSnapshot, loadBest, saveBest, saveTotalShards, UiStore } from './store';

/** Everything the UI may touch: read-only state and player intents. No access to game logic. */
export interface GameApi {
  readonly store: UiStore;
  readonly settings: SettingsStore;
  readonly intent: (intent: Intent) => void;
  readonly resetBest: () => void;
  readonly resetTutorial: () => void;
}

/** Glues sim, renderer, input and the UI store together and runs the rAF loop. */
export class GameController {
  private hitStop = 0;
  private crashSeen = false;
  private readonly sim: GameSim;
  private readonly store: UiStore;
  private renderer: GameRenderer;
  private input: InputController;
  private stepper = new FixedStepper();
  private raf = 0;
  private last = 0;
  private lastUiPush = 0;
  private fps = 0;
  private stopped = false;
  private resizeObserver: ResizeObserver;
  private settings = new SettingsStore();
  private tutorial = new Tutorial();
  private audio = new GameAudio(window);
  private adaptive = new AdaptiveQuality(
    initialProfile(navigator, window.matchMedia?.('(pointer: coarse)').matches ?? false),
  );
  private unsubSettings: () => void;
  readonly api: GameApi;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: DebugOptions,
  ) {
    this.sim = new GameSim(opts.seed ?? randomSeed());
    this.store = new UiStore(initialSnapshot(loadBest()));
    this.renderer = new GameRenderer(canvas);
    this.input = new InputController(window);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(canvas);
    this.resize();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.applySettings();
    this.unsubSettings = this.settings.subscribe(() => this.applySettings());
    this.api = Object.freeze({
      store: this.store,
      settings: this.settings,
      intent: (i: Intent) => this.intent(i),
      resetTutorial: () => this.tutorial.reset(),
      resetBest: () => {
        saveBest(0);
        this.store.set({ best: 0, newBest: false });
      },
    });
    this.raf = requestAnimationFrame(this.frame);
  }

  dispose(): void {
    this.stopped = true;
    this.unsubSettings();
    this.audio.dispose();
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.input.dispose();
    this.renderer.dispose();
  }

  /** Snapshot for e2e tests (only wired up in debug builds). */
  /**
   * Snapshot for e2e tests. The whole body is compiled out of production builds (DEBUG is a
   * build-time constant), which `npm run check:prod` verifies.
   */
  /** Debug only: switch the autopilot on or off mid-run (e.g. to film a crash). */
  readonly setAutopilot = DEBUG
    ? (on: boolean) => {
        this.opts.autopilot = on;
      }
    : undefined;

  readonly debugState = DEBUG
    ? () => {
        const sim = this.sim;
        return {
          phase: sim.phase,
          score: sim.score,
          seed: sim.seed,
          ...{ x: sim.x, y: sim.y, z: sim.z, dir: sim.dir, speed: sim.speed },
          ...{ grounded: sim.grounded, sliding: sim.sliding, mirror: sim.mirrorTime },
          ...{ jumps: sim.jumps, sideJumps: sim.sideJumps, bounces: sim.bounces },
          effect: sim.effect,
          move: sim.move,
          obstacleAhead: nearestObstacle(sim),
          cause: sim.deathCause,
          role: sim.platform?.role ?? null,
          worldPlatforms: sim.world.platforms.length,
          fps: Math.round(this.fps),
          render: this.renderer.stats(),
          mismatches: this.renderer.verify(sim),
          audio: { state: this.audio.state, played: this.audio.played },
          character: this.renderer.character,
          skinned: this.renderer.skinnedCount(),
          quality:
            this.settings.get().quality === 'auto'
              ? this.adaptive.profile
              : this.settings.get().quality,
        };
      }
    : undefined;

  private intent(intent: Intent): void {
    this.apply(intentToAction(intent, this.sim.phase));
  }

  private apply(action: Action | null): void {
    if (!action) return;
    // Every new run gets a new random world, unless a debug seed pins it.
    if ((action === 'restart' || action === 'menu') && this.opts.seed === undefined) {
      this.sim.seed = randomSeed();
    }
    const phase = this.sim.phase;
    if (!this.sim.act(action)) return;
    if (action !== 'left' && action !== 'right' && action !== 'jump' && action !== 'slide') {
      this.stepper.reset();
    }
    if (phase === 'gameover' || action === 'restart') this.store.set({ newBest: false });
    this.pushUi(true);
  }

  private frame = (now: number): void => {
    if (this.stopped) return;
    try {
      const dt = this.last ? (now - this.last) / 1000 : 0;
      this.last = now;
      if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;
      for (const i of this.input.drain()) this.intent(i);
      const sim = this.sim;
      // Hit-stop: hold the world for a beat at the moment of a crash, so impacts land with weight.
      const crashed = sim.phase === 'dying' && sim.deathCause !== 'fell';
      if (crashed && !this.crashSeen) this.hitStop = HIT_STOP_SECONDS;
      this.crashSeen = crashed;
      this.hitStop = Math.max(0, this.hitStop - dt);
      if (this.hitStop <= 0)
        this.stepper.advance(dt, (step) => {
          const a = this.opts.autopilot ? autopilot(sim) : null;
          if (a && sim.control(a)) this.pushUi(true);
          sim.step(step);
        });
      this.renderer.render(sim, dt);
      this.adaptQuality(dt);
      this.store.set({ hint: this.tutorial.update(sim) });
      this.audio.update(sim);
      this.pushUi(false, now);
      this.raf = requestAnimationFrame(this.frame);
    } catch (e) {
      // Stop cleanly with a visible message rather than freezing on a broken frame.
      this.stopped = true;
      reportError(
        `The game hit an unexpected problem. ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  private pushUi(force: boolean, now = performance.now()): void {
    const sim = this.sim;
    const prev = this.store.get();
    const changed =
      sim.phase !== prev.phase ||
      sim.effect !== prev.effect ||
      sim.mirrored !== prev.mirrorLeft > 0;
    if (!force && !changed && now - this.lastUiPush < 100) return;
    this.lastUiPush = now;
    let { best, newBest, totalShards } = prev;
    if (sim.phase === 'gameover' && prev.phase !== 'gameover') {
      if (sim.score > best) {
        best = sim.score;
        newBest = true;
        saveBest(best);
      }
      totalShards += sim.shards;
      saveTotalShards(totalShards);
    }
    this.store.set({
      phase: sim.phase,
      score: sim.score,
      best,
      newBest,
      shards: sim.shards,
      totalShards,
      cause: sim.deathCause,
      effect: sim.effect,
      effectLeft: Math.max(0, Math.ceil(sim.effectTime)),
      mirrorLeft: Math.ceil(sim.mirrorTime),
    });
  }

  /** Auto quality: measure only real gameplay frames; never touches the simulation. */
  private adaptQuality(dt: number): void {
    if (this.settings.get().quality !== 'auto') return;
    if (this.sim.phase !== 'playing') {
      this.adaptive.hold();
      return;
    }
    const next = this.adaptive.sample(dt);
    if (next) this.renderer.setQuality(next);
  }

  /** Settings change presentation only (quality, effects); the simulation never sees them. */
  private applySettings(): void {
    const s = this.settings.get();
    this.renderer.setQuality(s.quality === 'auto' ? this.adaptive.profile : s.quality);
    this.adaptive.hold();
    this.renderer.reducedEffects = s.reducedEffects;
    this.audio.enabled = s.sound;
    document.documentElement.classList.toggle('reduced-effects', s.reducedEffects);
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.resize(w, h);
  };

  private onVisibility = (): void => {
    if (document.hidden && this.sim.phase === 'playing') this.apply('pause');
    this.last = 0;
  };

  private onBlur = (): void => {
    if (this.sim.phase === 'playing' && !this.opts.autopilot) this.apply('pause');
  };

  /** Phones can drop the GPU context (backgrounding, memory pressure). Pause and wait for it. */
  private onContextLost = (e: Event): void => {
    e.preventDefault();
    if (this.sim.phase === 'playing') this.apply('pause');
    this.store.set({ notice: 'Graphics were paused by your device. Waiting for them to return…' });
  };

  private onContextRestored = (): void => {
    this.store.set({ notice: null });
  };
}

/** Kind and distance of the nearest obstacle ahead on the runner's line (debug snapshot only). */
function nearestObstacle(sim: GameSim): { kind: string; d: number } | null {
  let best: { kind: string; d: number } | null = null;
  const dx = DIR_X[sim.dir]!;
  const dz = DIR_Z[sim.dir]!;
  for (const o of sim.world.obstacles) {
    const d = ((o.minX + o.maxX) / 2 - sim.x) * dx + ((o.minZ + o.maxZ) / 2 - sim.z) * dz;
    const lat = Math.abs(
      ((o.minX + o.maxX) / 2 - sim.x) * dz - ((o.minZ + o.maxZ) / 2 - sim.z) * dx,
    );
    if (d > 0 && lat < 2 && (!best || d < best.d)) best = { kind: o.kind, d };
  }
  return best;
}
