import type { ObstacleKind } from '../game/world';

/**
 * Sci-fi corridor theme: deep navy space, white/pale-blue architecture, cyan-blue light strips,
 * orange accent lights and red lasers. (No purple.)
 */
export const COLORS = {
  sky: 0x0a1830,
  /** Darkness sky: almost black. */
  shadowSky: 0x010307,
  /** Building walls: white-blue panels, darkening downward. */
  side: 0xc6d4e8,
  cyan: 0x2fd8ff,
  /** Red laser: jump barriers, spell glow. (Key kept for the obstacle colour mapping.) */
  magenta: 0xff3048,
  amber: 0xffb02e,
  /** Orange accent lights: wall stripes, exit arrows, leap markers. */
  orange: 0xff8a2a,
  wall: 0x2a3c58,
  runner: 0xeaf4ff,
  tower: 0x1a2a44,
  mirror: 0xbfe9ff,
  /** Rooftop: powder-coated metal, blue-black to sit with the navy theme. */
  panel: 0x0d1522,
} as const;

/** Obstacle colours tell the player what to do: red = jump, cyan = slide, amber = either. */
export const OBSTACLE_COLORS: Record<ObstacleKind, number> = {
  low: COLORS.magenta,
  high: COLORS.cyan,
  mid: COLORS.amber,
  /** Vaulted automatically: pale, so it never reads as an action colour. */
  vault: 0xdfeaff,
  wall: COLORS.wall,
  sideWall: COLORS.wall,
};

/**
 * Buildings (with everything on them) rise into place when their centre is this far ahead, quickly,
 * so the route and its obstacles are solidly there well over 100 m out (6+ s at top speed): you
 * read what is coming instead of having it pop up in front of you.
 */
export const RISE_DISTANCE = 140;
export const RISE_SECONDS = 0.5;
export const RISE_DEPTH = 45;
/** After rising, a building slides from the previous deck's height to its own over this long. */
export const SLIDE_SECONDS = 0.35;
