import { autopilot } from './autopilot';
import { CONFIG, jumpDistance } from './config';
import {
  DIR_X,
  DIR_Z,
  runAlong,
  runLateral,
  turnDir,
  World,
  type Dir,
  type Exit,
  type Platform,
  type Spell,
  type Turn,
  type Wall,
} from './world';

export type Phase = 'ready' | 'playing' | 'paused' | 'dying' | 'gameover';
export type DeathCause = 'fell' | 'hit';
/** 'shadow': darkness after a black portal; 'auto': the reward for surviving it (pilot plays). */
export type Effect = 'none' | 'shadow' | 'auto';
/** Parkour move in progress (presentation reads it to pick poses). */
export type Move = 'none' | 'vault' | 'wallrun' | 'climb' | 'flip';
export type Action =
  'left' | 'right' | 'jump' | 'slide' | 'start' | 'pause' | 'resume' | 'restart' | 'menu';

export interface SimOptions {
  /** Build the world; defaults to a generated one. Tests pass hand-made worlds. */
  world?: (seed: number) => World;
}

/** A black portal's gate: centre (x, y, z), heading, and extent along and across the run. */
export type Gate = Pick<Spell, 'x' | 'y' | 'z' | 'dir' | 'a' | 'b' | 'halfWidth'>;

/**
 * Pure gameplay simulation: movement, jumping between buildings, side jumps, sliding,
 * collision, trampolines, portals, parkour moves and game state. No rendering or DOM code.
 */
export class GameSim {
  phase: Phase = 'ready';
  deathCause: DeathCause | null = null;
  seed: number;
  world!: World;

  x = 0;
  z = 0;
  y = 0;
  vy = 0;
  dir: Dir = 0;
  speed: number = CONFIG.startSpeed;
  grounded = true;
  /** Seconds of slide remaining. */
  slideTime = 0;
  /** Last platform the runner stood on; defines route progress and the centring axis. */
  platform: Platform | null = null;

  effect: Effect = 'none';
  effectTime = 0;
  move: Move = 'none';
  /** The wall being run along (wall-run only). */
  wall: Wall | null = null;
  /** Deck height of the building being climbed (climb only). */
  private climbTop = 0;

  distance = 0;
  time = 0;
  dyingTime = 0;
  /** Event counters; the renderer watches them to trigger one-shot animations. */
  jumps = 0;
  sideJumps = 0;
  bounces = 0;
  /** Black portals run through, and times the darkness lifted (for feedback and sound). */
  spellsTaken = 0;
  shadowExits = 0;
  /** Obstacles cleared by a hair (over a barrier or under a beam): rewarded with feedback. */
  nearMisses = 0;
  private lastNear = -1;
  /** Parkour moves started: vaults, wall-runs and climbs. */
  vaults = 0;
  wallRuns = 0;
  climbs = 0;
  /** Airborne-to-grounded transitions (for landing feedback). */
  landings = 0;
  /** Side leaps refused by `leapAllowed`, and which way the last one was. */
  leapsRefused = 0;
  lastRefused: Turn | null = null;
  portalsTaken = 0;
  /** Energy shards collected this run. */
  shards = 0;
  /** Seconds of mirror mode left: the runner runs backwards and jump/slide are swapped. */
  mirrorTime = 0;

  private coyote = 0;
  /** True from a trampoline bounce until touchdown (mid-air steering allowed). */
  private bounced = false;
  /** Lane hop in progress: unit sideways direction and distance still to drift. */
  private hopX = 0;
  private hopZ = 0;
  private hopLeft = 0;
  /** True from a leap until touchdown: only a real jump can catch a ledge. */
  private leapt = false;
  private jumpBuffer = 0;
  private slideOnLand = false;
  private sideBuffer: Turn | null = null;
  private sideBufferTtl = 0;
  private readonly makeWorld: (seed: number) => World;

  constructor(seed: number, options: SimOptions = {}) {
    this.seed = seed;
    this.makeWorld = options.world ?? ((s) => new World(s));
    this.reset(seed);
  }

  get score(): number {
    return Math.floor(this.distance);
  }

  get sliding(): boolean {
    return this.slideTime > 0;
  }

  get height(): number {
    return this.sliding ? CONFIG.slideHeight : CONFIG.runnerHeight;
  }

  /** Distance along the main route; drives generation and recycling. */
  get progress(): number {
    const p = this.platform;
    return p ? p.run.route + runAlong(p.run, this.x, this.z) : 0;
  }

  /** Reset the whole world in place (no page reload). Leaves the sim in 'ready'. */
  reset(seed: number = this.seed): void {
    this.seed = seed;
    this.world = this.makeWorld(seed);
    this.phase = 'ready';
    this.deathCause = null;
    this.x = 0;
    this.z = 0;
    this.y = 0;
    this.vy = 0;
    this.dir = 0;
    this.speed = CONFIG.startSpeed;
    this.grounded = true;
    this.slideTime = 0;
    this.platform = this.world.supportAt(0, 0);
    this.y = this.platform?.top ?? 0;
    this.effect = 'none';
    this.effectTime = 0;
    this.move = 'none';
    this.wall = null;
    this.distance = 0;
    this.time = 0;
    this.dyingTime = 0;
    this.jumps = 0;
    this.sideJumps = 0;
    this.bounces = 0;
    this.spellsTaken = 0;
    this.shadowExits = 0;
    this.nearMisses = 0;
    this.lastNear = -1;
    this.vaults = 0;
    this.wallRuns = 0;
    this.climbs = 0;
    this.landings = 0;
    this.leapsRefused = 0;
    this.lastRefused = null;
    this.portalsTaken = 0;
    this.shards = 0;
    this.mirrorTime = 0;
    this.coyote = 0;
    this.leapt = false;
    this.bounced = false;
    this.hopLeft = 0;
    this.jumpBuffer = 0;
    this.slideOnLand = false;
    this.sideBuffer = null;
    this.sideBufferTtl = 0;
  }

  /** In the air after a trampoline bounce (mid-air steering is possible). */
  get bouncing(): boolean {
    return this.bounced && !this.grounded;
  }

  get mirrored(): boolean {
    return this.mirrorTime > 0;
  }

  /**
   * Player input. While mirrored every move is reversed: jump and slide swap, and left and
   * right swap.
   */
  act(action: Action): boolean {
    // On auto-run the pilot plays; the player's moves wait until control is handed back.
    if (this.effect === 'auto' && isMove(action)) return false;
    if (this.mirrored) action = MIRROR[action] ?? action;
    return this.apply(action);
  }

  /** Input that means exactly what it says, bypassing mirror swaps (for bots). */
  control(action: Action): boolean {
    return this.apply(action);
  }

  private apply(action: Action): boolean {
    // Moves mean nothing while climbing or running along a wall.
    const busy = this.move === 'climb' || this.move === 'wallrun';
    if (busy && isMove(action)) return false;
    switch (action) {
      case 'start':
        if (this.phase !== 'ready') return false;
        this.phase = 'playing';
        return true;
      case 'pause':
        if (this.phase !== 'playing') return false;
        this.phase = 'paused';
        return true;
      case 'resume':
        if (this.phase !== 'paused') return false;
        this.phase = 'playing';
        return true;
      case 'menu':
        if (this.phase !== 'paused' && this.phase !== 'gameover') return false;
        this.reset(this.seed);
        return true;
      case 'restart':
        if (this.phase === 'ready') return false;
        this.reset(this.seed);
        this.phase = 'playing';
        return true;
      case 'jump':
        if (this.phase !== 'playing') return false;
        this.jumpBuffer = CONFIG.jumpBufferSeconds;
        return true;
      case 'slide':
        if (this.phase !== 'playing') return false;
        if (this.grounded) {
          this.slideTime = CONFIG.slideSeconds;
          this.jumpBuffer = 0;
        } else {
          this.vy = Math.min(this.vy, -CONFIG.slamVelocity);
          this.slideOnLand = true;
        }
        return true;
      case 'left':
      case 'right':
        if (this.phase !== 'playing') return false;
        this.sideBuffer = action;
        this.sideBufferTtl = CONFIG.sideBufferSeconds;
        return true;
    }
  }

  step(dt: number): void {
    if (this.phase === 'playing') this.stepPlaying(dt);
    else if (this.phase === 'dying') this.stepDying(dt);
  }

  private stepPlaying(dt: number): void {
    this.time += dt;
    if (this.effect === 'auto') {
      const a = autopilot(this);
      if (a) this.apply(a);
    }

    const canLeap = this.grounded || this.coyote > 0;
    if (this.jumpBuffer > 0) {
      if (canLeap) this.leap(this.dir, CONFIG.jumpVelocity);
      else this.jumpBuffer -= dt;
    }
    if (this.sideBuffer) {
      const turn = this.sideBuffer;
      const target = turnDir(this.dir, turn);
      const { hold, exit } = this.exitFor(turn);
      if (hold === 'go' && exit?.kind === 'air') {
        this.airTurn(target);
        this.sideBuffer = null;
      } else if (hold === 'go' && exit?.kind === 'hop' && canLeap) {
        this.hop(turn);
        this.sideBuffer = null;
      } else if (canLeap && hold === 'go') {
        if (this.leapAllowed(target)) {
          this.sideJumps += 1;
          this.leap(target, CONFIG.jumpVelocity);
        } else {
          this.leapsRefused += 1;
          this.lastRefused = this.sideBuffer;
        }
        this.sideBuffer = null;
      } else if (hold !== 'platform') {
        this.sideBufferTtl -= dt;
        if (this.sideBufferTtl <= 0) this.sideBuffer = null;
      }
    }
    if (this.mirrorTime > 0) this.mirrorTime = Math.max(0, this.mirrorTime - dt);

    this.speed = Math.min(CONFIG.maxSpeed, this.speed + CONFIG.acceleration * dt);
    if (this.slideTime > 0) this.slideTime = Math.max(0, this.slideTime - dt);
    if (this.coyote > 0) this.coyote -= dt;

    const travel = this.speed * dt;
    const n = Math.max(1, Math.ceil(travel / CONFIG.maxSubstep));
    const sdt = dt / n;
    for (let i = 0; i < n && this.phase === 'playing'; i++) this.substep(sdt);
    if (this.phase !== 'playing') return;

    if (this.move !== 'climb') this.distance += travel;
    this.centre(dt);
    this.updateEffect(dt);
    this.world.update(this.progress);
  }

  private substep(dt: number): void {
    if (this.move === 'climb') return this.climb(dt);
    const w = this.world;
    this.x += DIR_X[this.dir]! * this.speed * dt;
    this.z += DIR_Z[this.dir]! * this.speed * dt;
    if (this.hopLeft > 0) {
      // Cover the lane offset over one normal jump's airtime.
      const rate = CONFIG.laneOffset / ((2 * CONFIG.jumpVelocity) / CONFIG.gravity);
      const step = Math.min(this.hopLeft, rate * dt);
      this.x += this.hopX * step;
      this.z += this.hopZ * step;
      this.hopLeft -= step;
    }

    const support = w.supportAt(this.x, this.z);
    // Height of the building last stood on: the reference for bridges and falling.
    const ground = this.platform?.top ?? 0;

    if (!this.grounded) {
      const prevY = this.y;
      if (this.move === 'wallrun') this.alongWall();
      else {
        this.vy -= CONFIG.gravity * dt;
        this.y += this.vy * dt;
      }
      if (support && this.y <= support.top && prevY >= support.top - 1e-6) this.land(support);
      else if (!support && this.leapt && this.move === 'none') this.catchWall();
    }

    if (this.grounded) {
      if (support && support.top > this.y + 0.05) {
        // Ran into the face of a taller building: climb it if it is a climb, else crash.
        if (support.approach === 'climb') return this.startClimb(support);
        return this.die('hit');
      }
      if (support && support.top < this.y - 0.05) {
        this.fallOff(); // stepped off onto a lower building
      } else if (support) {
        this.platform = support;
        this.y = support.top;
      } else {
        this.fallOff();
      }
    }

    if (support && !this.grounded && this.y < support.top - 1e-6) {
      // Jumped into a climb building's face: grab it and climb.
      if (support.approach === 'climb' && this.y > support.top - CONFIG.climbRise - 1.5)
        return this.startClimb(support);
      // Below a deck means inside the building volume. A jump that falls barely short catches
      // the ledge; running off an edge never does, so every gap must really be jumped. Deeper is
      // dropping into the gap against the building's side: a fall, not a crash.
      if (this.leapt && this.y > support.top - CONFIG.ledgeCatch && this.vy <= 0)
        this.land(support);
      else return this.die('fell');
    }
    if (this.y < ground + CONFIG.fallDeathY) return this.die('fell');

    const pad = w.padAt(this.x, this.z);
    if (pad && this.y <= pad.top + 0.05) {
      this.bounces += 1;
      this.leap(this.dir, CONFIG.trampolineVelocity);
      this.bounced = true;
    }

    if (this.grounded && this.move === 'none' && this.vaultAhead()) {
      this.leap(this.dir, CONFIG.vaultVelocity);
      this.move = 'vault';
      this.vaults += 1;
    }
    if (this.hitsObstacle()) return this.die('hit');
    const near = this.nearMiss();
    if (near !== null && near !== this.lastNear) {
      this.lastNear = near;
      this.nearMisses += 1;
    }

    const r2 = CONFIG.shardRadius * CONFIG.shardRadius;
    for (const s of w.shards) {
      if (s.taken) continue;
      const dy = this.y + 0.8 - s.y;
      if ((this.x - s.x) ** 2 + dy * dy + (this.z - s.z) ** 2 < r2) {
        s.taken = true;
        this.shards += 1;
      }
    }

    for (const p of w.portals) {
      if (p.taken) continue;
      if (
        this.x > p.minX &&
        this.x < p.maxX &&
        this.z > p.minZ &&
        this.z < p.maxZ &&
        this.y < p.maxY
      ) {
        p.taken = true;
        this.portalsTaken += 1;
        this.mirrorTime = CONFIG.mirrorSeconds;
      }
    }

    // Black portals span the whole lane and every jump height: running through one brings on
    // the darkness (a fresh one restarts it).
    for (const s of w.spells) {
      if (s.taken || !this.inGate(s)) continue;
      s.taken = true;
      this.spellsTaken += 1;
      this.effect = 'shadow';
      this.effectTime = CONFIG.shadowSeconds;
    }
  }

  inGate(p: Gate): boolean {
    const dx = this.x - p.x;
    const dz = this.z - p.z;
    const along = dx * DIR_X[p.dir]! + dz * DIR_Z[p.dir]!;
    const lat = dz * DIR_X[p.dir]! - dx * DIR_Z[p.dir]!;
    return (
      Math.abs(along) < (p.b - p.a) / 2 &&
      Math.abs(lat) < p.halfWidth + CONFIG.runnerRadius &&
      this.y < p.y + 4
    );
  }

  /** A vault ledge right ahead on the runner's line. */
  private vaultAhead(): boolean {
    const dx = DIR_X[this.dir]!;
    const dz = DIR_Z[this.dir]!;
    for (const o of this.world.obstacles) {
      if (o.kind !== 'vault') continue;
      const onLine =
        dx !== 0 ? this.z > o.minZ && this.z < o.maxZ : this.x > o.minX && this.x < o.maxX;
      if (!onLine) continue;
      const ahead =
        (dx > 0
          ? o.minX - this.x
          : dx < 0
            ? this.x - o.maxX
            : dz > 0
              ? o.minZ - this.z
              : this.z - o.maxZ) - CONFIG.runnerRadius;
      if (ahead > -0.2 && ahead < CONFIG.vaultReach) return true;
    }
    return false;
  }

  /**
   * In the air over a wall-run gap after a real jump, with a side step toward the wall pressed
   * (←/→, held in the side buffer): plant the feet on the wall and run along it.
   */
  private catchWall(): void {
    if (!this.sideBuffer) return;
    for (const w of this.world.walls) {
      if (w.run.dir !== this.dir || this.sideBuffer !== (w.side === 1 ? 'right' : 'left')) continue;
      const along = runAlong(w.run, this.x, this.z);
      const lat = Math.abs(runLateral(w.run, this.x, this.z));
      if (along < w.a || along > w.b - CONFIG.wallKickLead || lat > CONFIG.pathHalfWidth + 0.5)
        continue;
      if (this.y < w.deck - 1.5) continue;
      this.move = 'wallrun';
      this.wall = w;
      this.wallRuns += 1;
      this.sideBuffer = null;
      this.vy = 0;
      this.y = Math.max(this.y, w.deck + 0.3);
      return;
    }
  }

  /** On the wall: hold height, then kick off near its end toward the next building. */
  private alongWall(): void {
    const w = this.wall!;
    if (runAlong(w.run, this.x, this.z) < w.b - CONFIG.wallKickLead) return;
    this.move = 'none';
    this.wall = null;
    this.vy = CONFIG.wallKick;
    this.jumps += 1;
  }

  /** Grab the face of a climb building, right where the runner meets it. */
  private startClimb(p: Platform): void {
    const back = p.a - CONFIG.runnerRadius - 0.05 - runAlong(p.run, this.x, this.z);
    this.x += DIR_X[this.dir]! * back;
    this.z += DIR_Z[this.dir]! * back;
    this.move = 'climb';
    this.climbs += 1;
    this.climbTop = p.top;
    this.grounded = false;
    this.vy = 0;
    this.slideTime = 0;
    this.jumpBuffer = 0;
    this.sideBuffer = null;
    this.slideOnLand = false;
  }

  /** Climb straight up; at the top, flip over the edge onto the deck. */
  private climb(dt: number): void {
    this.y += CONFIG.climbSpeed * dt;
    if (this.y < this.climbTop) return;
    this.y = this.climbTop + 0.05;
    this.x += DIR_X[this.dir]! * 0.6;
    this.z += DIR_Z[this.dir]! * 0.6;
    this.leap(this.dir, CONFIG.flipVelocity);
    this.move = 'flip';
  }

  private leap(dir: Dir, vy: number): void {
    this.dir = dir;
    this.vy = vy;
    this.grounded = false;
    this.leapt = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.slideTime = 0;
    this.slideOnLand = false;
    this.jumps += 1;
  }

  /** Leave the ground without jumping (ran off an edge): no ledge catch for this one. */
  private fallOff(): void {
    this.grounded = false;
    this.vy = 0;
    this.coyote = CONFIG.coyoteSeconds;
  }

  private land(support: Platform | null): void {
    this.landings += 1;
    this.move = 'none';
    this.wall = null;
    this.leapt = false;
    this.bounced = false;
    this.hopLeft = 0;
    // On a building: its deck. On a phantom bridge: the height of the run's last building.
    this.y = support ? support.top : (this.platform?.top ?? 0);
    this.vy = 0;
    this.grounded = true;
    if (support) this.platform = support;
    if (this.slideOnLand) {
      this.slideOnLand = false;
      this.slideTime = CONFIG.slideSeconds;
    }
  }

  /**
   * Refuse leaps that could only land on a dead end: heading south (the route never does), or
   * onto a building whose route runs another way (you would run off its side or back down a
   * branch). Leaps into empty air are allowed; that is the player's call.
   */
  private leapAllowed(target: Dir): boolean {
    if (target === 2) return false;
    const R = jumpDistance(this.speed);
    const s = this.world.supportAt(this.x + DIR_X[target]! * R, this.z + DIR_Z[target]! * R);
    return !s || s.run.dir === target;
  }

  /**
   * Leap assist. 'go' leaps now. 'soon' waits because the exit window for this turn is just
   * ahead. 'platform' waits however long it takes, because the window is on the building
   * underfoot (an early press there would otherwise fly past the side building).
   */
  private exitFor(turn: Turn): { hold: 'go' | 'soon' | 'platform'; exit: Exit | null } {
    const look = this.speed * CONFIG.sideBufferSeconds;
    const bouncing = this.bounced && !this.grounded;
    let hold: 'go' | 'soon' | 'platform' = 'go';
    for (const e of this.world.exits) {
      if (e.fromDir !== this.dir || e.turn !== turn) continue;
      // Mid-air steering only works during a trampoline bounce.
      const usable = e.kind === 'air' ? bouncing : true;
      if (usable && this.inExit(e)) return { hold: 'go', exit: e };
      const d = this.distanceToExit(e);
      if (d <= 0) continue;
      const onItsBuilding = this.grounded && e.platformId === this.platform?.id;
      // Pressed early on the building with the window, or during the bounce: wait for it.
      if (onItsBuilding || (e.kind === 'air' && bouncing)) hold = 'platform';
      else if (d <= look && hold === 'go') hold = 'soon';
    }
    return { hold, exit: null };
  }

  /** Mid-air steer during a trampoline bounce: change heading, keep the flight. */
  private airTurn(dir: Dir): void {
    this.dir = dir;
    this.sideJumps += 1;
  }

  /** Lane hop: jump while drifting one lane to the side; the heading stays the same. */
  private hop(turn: Turn): void {
    this.leap(this.dir, CONFIG.jumpVelocity);
    this.sideJumps += 1;
    const s = turn === 'right' ? 1 : -1;
    this.hopX = -DIR_Z[this.dir]! * s;
    this.hopZ = DIR_X[this.dir]! * s;
    this.hopLeft = CONFIG.laneOffset;
  }

  /**
   * The next legal (non-optional first, then fork) exit ahead on the current heading within
   * `lookahead`, and the building a leap from its centre lands on. Read-only; for presentation.
   */
  upcomingExit(lookahead: number): { exit: Exit; target: Platform | null } | null {
    let best: Exit | null = null;
    let bestD = Infinity;
    for (const e of this.world.exits) {
      if (e.fromDir !== this.dir) continue;
      const d = this.inExit(e) ? 0 : this.distanceToExit(e);
      if (d < 0 || d > lookahead) continue;
      if (d < bestD || (d === bestD && best?.optional)) {
        best = e;
        bestD = d;
      }
    }
    if (!best) return null;
    const cx = (best.minX + best.maxX) / 2;
    const cz = (best.minZ + best.maxZ) / 2;
    const to = turnDir(this.dir, best.turn);
    let x: number;
    let z: number;
    if (best.kind === 'hop') {
      // A hop lands one lane over and a jump's length ahead.
      const R = jumpDistance(this.speed);
      x = cx + DIR_X[this.dir]! * R + DIR_X[to]! * CONFIG.laneOffset;
      z = cz + DIR_Z[this.dir]! * R + DIR_Z[to]! * CONFIG.laneOffset;
    } else {
      // A side leap or mid-air steer lands on the building off to that side.
      const R = best.kind === 'air' ? CONFIG.airEntryStart + 4 : jumpDistance(this.speed);
      x = cx + DIR_X[to]! * R;
      z = cz + DIR_Z[to]! * R;
    }
    return { exit: best, target: this.world.supportAt(x, z) };
  }

  inExit(e: Exit): boolean {
    return this.x >= e.minX && this.x <= e.maxX && this.z >= e.minZ && this.z <= e.maxZ;
  }

  /** Distance ahead until the runner enters `e`, or -1 if not on its line. */
  distanceToExit(e: Exit): number {
    const dx = DIR_X[this.dir]!;
    const dz = DIR_Z[this.dir]!;
    if (dx !== 0) {
      if (this.z < e.minZ || this.z > e.maxZ) return -1;
      return dx > 0 ? e.minX - this.x : this.x - e.maxX;
    }
    if (this.x < e.minX || this.x > e.maxX) return -1;
    return dz > 0 ? e.minZ - this.z : this.z - e.maxZ;
  }

  /** Id of an obstacle the runner is passing over or under with under `nearMiss` to spare. */
  private nearMiss(): number | null {
    const r = CONFIG.runnerRadius;
    const top = this.y + this.height;
    for (const o of this.world.obstacles) {
      if (o.kind !== 'low' && o.kind !== 'high' && o.kind !== 'mid') continue;
      const over =
        this.x + r > o.minX && this.x - r < o.maxX && this.z + r > o.minZ && this.z - r < o.maxZ;
      if (!over) continue;
      const spare = this.y >= o.maxY ? this.y - o.maxY : o.minY - top;
      if (spare >= 0 && spare < CONFIG.nearMiss) return o.id;
    }
    return null;
  }

  hitsObstacle(): boolean {
    const r = CONFIG.runnerRadius;
    const top = this.y + this.height;
    for (const o of this.world.obstacles) {
      if (
        this.x + r > o.minX &&
        this.x - r < o.maxX &&
        this.z + r > o.minZ &&
        this.z - r < o.maxZ &&
        o.kind !== 'vault' &&
        top > o.minY &&
        this.y < o.maxY
      ) {
        return true;
      }
    }
    return false;
  }

  /** Ease toward the centre line of the run underfoot so later narrow buildings line up. */
  private centre(dt: number): void {
    const p = this.platform;
    if (!this.grounded || !p || p.run.dir !== this.dir) return;
    const lat = runLateral(p.run, this.x, this.z);
    const k = 1 - Math.exp(-CONFIG.centeringRate * dt);
    // Lateral axis is +X for north, +Z for east, -Z for west.
    const shift = -lat * k;
    this.x += -DIR_Z[this.dir]! * shift;
    this.z += DIR_X[this.dir]! * shift;
  }

  private updateEffect(dt: number): void {
    if (this.effect === 'none') return;
    this.effectTime = Math.max(0, this.effectTime - dt);
    if (this.effectTime > 0) return;
    if (this.effect === 'shadow') {
      // Survived the darkness: auto-run as the reward.
      this.effect = 'auto';
      this.effectTime = CONFIG.autoSeconds;
      this.shadowExits += 1;
      this.sideBuffer = null;
      this.jumpBuffer = 0;
      return;
    }
    // Control comes back only standing on a building, clear of obstacles and of any move.
    if (
      this.grounded &&
      this.move === 'none' &&
      this.world.supportAt(this.x, this.z) &&
      !this.hitsObstacle()
    )
      this.effect = 'none';
  }

  private die(cause: DeathCause): void {
    this.phase = 'dying';
    this.deathCause = cause;
    this.dyingTime = 0;
    this.sideBuffer = null;
    this.jumpBuffer = 0;
    this.slideTime = 0;
    this.effect = 'none';
    this.move = 'none';
    this.wall = null;
    this.mirrorTime = 0;
    if (cause === 'hit') {
      this.speed = 0;
      this.vy = Math.max(this.vy, 3);
    }
    this.grounded = false;
  }

  private stepDying(dt: number): void {
    this.dyingTime += dt;
    // Falling runners keep their momentum; struck runners bounce back off what they hit.
    const v = this.deathCause === 'fell' ? this.speed : -2;
    const nx = this.x + DIR_X[this.dir]! * v * dt;
    const nz = this.z + DIR_Z[this.dir]! * v * dt;
    // A runner dropping into a gap stops at the next building's face instead of passing through.
    const ahead = this.world.supportAt(nx, nz);
    if (!(this.deathCause === 'fell' && ahead && this.y < ahead.top)) {
      this.x = nx;
      this.z = nz;
    }
    this.vy -= CONFIG.gravity * dt;
    this.y += this.vy * dt;
    const under = this.world.supportAt(this.x, this.z);
    if (this.deathCause === 'hit' && under && this.y < under.top && this.y > under.top - 0.5) {
      this.y = under.top;
      this.vy = 0;
    }
    if (this.dyingTime >= CONFIG.dyingSeconds) this.phase = 'gameover';
  }
}

const MIRROR: Partial<Record<Action, Action>> = {
  jump: 'slide',
  slide: 'jump',
  left: 'right',
  right: 'left',
};

function isMove(a: Action): boolean {
  return a === 'left' || a === 'right' || a === 'jump' || a === 'slide';
}
