/** Gameplay tuning. All distances are world units (~1 unit = 1 metre), times in seconds. */
export const CONFIG = Object.freeze({
  /** Fixed simulation step. Gameplay never depends on render frame rate. */
  stepSeconds: 1 / 120,
  /** Longest frame we will simulate; anything longer (tab switch, debugger) is clamped. */
  maxFrameSeconds: 0.25,
  /** Movement inside one step is split into sub-steps no longer than this (anti-tunnelling). */
  maxSubstep: 0.2,

  startSpeed: 10,
  maxSpeed: 19,
  acceleration: 0.3,

  jumpVelocity: 9,
  gravity: 25,
  /** A bounce is high and long (~1.44 s airborne) so there is time to steer in mid-air. */
  trampolineVelocity: 18,
  /** A jump pressed this long before landing still fires on landing. */
  jumpBufferSeconds: 0.12,
  /** Grace period after running off an edge during which a jump still works. */
  coyoteSeconds: 0.1,
  slideSeconds: 0.65,
  /** Speed of the slam when sliding in mid-air. */
  slamVelocity: 14,

  runnerRadius: 0.3,
  runnerHeight: 1.6,
  slideHeight: 0.7,
  /** Below this height the runner is dead (fell between buildings). */
  fallDeathY: -2.5,
  /** Landing up to this far below the deck still catches the ledge. */
  ledgeCatch: 0.45,
  /** Lateral re-centering rate on a run's axis, per second. */
  centeringRate: 6,
  /** A side jump pressed this long before an exit window is held until the window. */
  sideBufferSeconds: 0.45,

  // ---- generation
  pathHalfWidth: 1.5,
  junctionHalfWidth: 3,
  /** Gap between a junction and the side building; short enough for a leap at min speed. */
  maxExitGap: 3.2,
  minGap: 3.0,
  maxGap: 4.6,
  plainMinLength: 13,
  plainMaxLength: 20,
  obstacleMinLength: 34,
  obstacleMaxLength: 48,
  /**
   * Obstacles are this far from a platform's start: beyond the farthest landing point at top
   * speed plus time to react (otherwise a slide beam can arrive while still in the air)...
   */
  obstacleStartMargin: 22,
  /** Minimum time between landing and reaching an obstacle, at any speed. */
  obstacleReactionSeconds: 0.45,
  /** ...and this far from its end (room to land after clearing it before the edge). */
  obstacleEndMargin: 12,
  obstacleSpacing: 12,
  endMinLength: 18,
  endMaxLength: 22,
  entryLength: 20,
  lookAhead: 170,
  keepBehind: 40,
  maxPlatforms: 90,
  maxObstacles: 80,
  maxShards: 120,
  /** Collection radius around the runner's chest. */
  shardRadius: 1.0,

  /**
   * Route distance (m) at which each mechanic is first introduced, one at a time, so the player
   * learns them in stages rather than all in the first few seconds.
   */
  intro: {
    obstacles: 60,
    slideBeams: 160,
    midBars: 260,
    trampolines: 150,
    forks: 500,
    /** Buildings at different heights. */
    heights: 220,
    /** Parallel-lane hops. */
    hops: 250,
    /** Vault ledges, wall-runs and climbs (parkour moves). */
    vaults: 100,
    wallRuns: 180,
    climbs: 280,
  },

  /** Wall-run gaps are longer than any jump: only a wall-run crosses them. */
  wallRunMinGap: 15,
  wallRunMaxGap: 17,
  /** Chance that a gap inside a stretch is a wall-run (once unlocked). */
  wallRunChance: 0.35,
  /** The wall stands this far outside the lane edge and rises this high above the deck. */
  wallOffset: 0.6,
  wallHeight: 5,
  /** Leaving the wall: upward kick (m/s) this far before its end (m). */
  wallKick: 6,
  wallKickLead: 1.5,
  /** Climb buildings are this much taller than the one before (beyond any jump). */
  climbRise: 2.5,
  climbChance: 0.3,
  /** Climb speed up a face (m/s); the flip over the top starts with this upward speed. */
  climbSpeed: 7,
  flipVelocity: 5.5,
  /** Side leaps carve round a quarter circle of this radius (m) instead of snapping 90 degrees. */
  turnRadius: 1.2,
  /** Clearing an obstacle (over or under) by less than this (m) counts as a near miss. */
  nearMiss: 0.3,
  /** Vault: triggered this far before a ledge, with this upward speed. */
  vaultReach: 1.4,
  vaultVelocity: 6.5,
  /** Rise (must jump up) and drop range for building height changes, and the overall band. */
  minRise: 0.4,
  maxRise: 0.8,
  minDrop: 0.5,
  maxDrop: 1.0,
  maxLevel: 3,
  /** Obstacle-free platforms after a trampoline or fork, to recover before the next challenge. */
  calmPlatforms: 2,

  spellMinRoute: 200,
  spellSpacing: 120,
  /** Seconds of darkness after running through a black portal. */
  shadowSeconds: 8,
  /** Surviving the darkness earns this long on auto-run (the pilot plays). */
  autoSeconds: 5,
  /** After surviving the darkness, black portals stay harmless for this long. */
  darkCooldown: 25,
  /** A black portal's gate: this deep along the run, across the whole lane and every jump. */
  gateDepth: 1.2,
  /** A black portal stands this far into its building. */
  gateInset: 6,

  portalMinRoute: 300,
  portalSpacing: 140,
  /** A trampoline is forced if none came for this long. */
  trampolineMaxGap: 250,
  /** Target spacing for forks and lane hops; past it they are scheduled first. */
  forkEvery: 350,
  hopEvery: 250,
  /**
   * Trampoline dead end: the pad sits near the end of the building, nothing lies ahead, and the
   * side building starts `trampolineGap` past the end, `airWindow` wide. A normal jump or side
   * leap can't reach it: only a bounce plus a mid-air steer can.
   */
  trampolineLength: 22,
  padFromEnd: 4,
  trampolineGap: 2.5,
  airWindow: 12,
  airEntryStart: 4,
  airEntryLength: 32,
  /** Distance between the axes of two parallel lanes (lane width + a gap). */
  laneOffset: 4.8,
  /** Length of the stretch where the two lanes run side by side (the hop window). */
  hopWindow: 9,
  /** Spells/portals are forced once this many times their spacing has passed without one. */
  overdueFactor: 1.5,
  mirrorSeconds: 10,

  /** Seconds between a fatal event and the game-over screen. */
  dyingSeconds: 1.1,
} as const);

/** Horizontal distance a normal jump covers at a given speed. */
export function jumpDistance(speed: number): number {
  return speed * ((2 * CONFIG.jumpVelocity) / CONFIG.gravity);
}

/** Vertical band an obstacle blocks, by kind. */
export const OBSTACLE_BANDS = {
  /** Jump over. */
  low: { minY: 0, maxY: 0.8, depth: 0.5 },
  /** Slide under. */
  high: { minY: 1.0, maxY: 3.2, depth: 0.6 },
  /** Jump over or slide under. */
  mid: { minY: 0.9, maxY: 1.3, depth: 0.4 },
  /** Knee-high ledge: the runner vaults it automatically (a parkour flourish, never fatal). */
  vault: { minY: 0, maxY: 0.9, depth: 0.6 },
  /** Only a trampoline gets you over. */
  wall: { minY: 0, maxY: 2.2, depth: 0.8 },
  sideWall: { minY: 0, maxY: 3, depth: 0 },
} as const;
for (const band of Object.values(OBSTACLE_BANDS)) Object.freeze(band);
Object.freeze(OBSTACLE_BANDS);
