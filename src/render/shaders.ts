import * as THREE from 'three';
import { COLORS } from './palette';

/**
 * How dark the world is (0..1, after a black portal), shared by every building material: walls
 * and decks sink towards black while neon edges stay lit, so the route still reads up close.
 */
export const SHADOW_WORLD = { value: 0 };

const deckVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  varying float vTopY;
  void main() {
    // Instanced decor towers share these materials: fold the instance transform in.
    #ifdef USE_INSTANCING
      mat4 m = modelMatrix * instanceMatrix;
    #else
      mat4 m = modelMatrix;
    #endif
    vec4 wp = m * vec4(position, 1.0);
    vWorld = wp.xyz;
    vTopY = m[3].y;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;

/**
 * Rooftops: a procedural take on BlendKit's "Powder coated metal black": one continuous matte
 * black surface with a fine powder-coat grain and a soft sheen. No panels, seams or grid.
 */
const topFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 panel;
  uniform float uShadow;
  varying vec3 vWorld;

  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // Smooth value noise.
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x),
               mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec2 p = vWorld.xz;
    // Pixel footprint (m): grain finer than a pixel is faded out so it never shimmers.
    float aa = max(fwidth(p.x), fwidth(p.y));
    float grainFade = 1.0 - smoothstep(0.015, 0.06, aa);
    float grain = (noise(p * 45.0) - 0.5) * 0.5 + (noise(p * 110.0) - 0.5) * 0.35;
    // Broad, gentle tonal variation, like a real coated sheet.
    float broad = noise(p * 0.35) * 0.5 + noise(p * 1.3) * 0.25;
    vec3 c = panel * (0.85 + broad * 0.3);
    c *= 1.0 + grain * 0.7 * grainFade;
    // Soft wide sheen sweeping across the deck.
    float sheen = pow(noise(p * 0.12 + 3.7), 3.0) * 0.035;
    c += vec3(sheen * 0.8, sheen * 0.9, sheen);
    // Darkness: the deck sinks to near black (a touch above the runner so they never merge).
    c = mix(c, vec3(0.035, 0.04, 0.055) * (0.9 + broad * 0.2), uShadow);

    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

/**
 * Building walls, styled after a sci-fi corridor: white panels with vertical seams, an orange
 * accent line, a cyan light strip and a dark rail under the deck edge; below that, floors of
 * windows (dark glass, some lit warm or cyan), fading to steel blue and deep navy further down.
 */
const sideFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 side;
  uniform vec3 glow;
  uniform vec3 accent;
  uniform vec3 steel;
  uniform vec3 navy;
  uniform float uShadow;
  varying vec3 vWorld;
  varying float vTopY;

  float line(float d, float at, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d - at)); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float d = vTopY - vWorld.y; // depth below the deck edge (m)
    vec3 c = mix(side, steel, smoothstep(0.6, 8.0, d));
    c = mix(c, navy, smoothstep(8.0, 24.0, d) * 0.9);
    // Vertical panel seams every 2.4 m along the wall.
    float u = fract((vWorld.x + vWorld.z) / 2.4);
    c *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.02, min(u, 1.0 - u))) * step(d, 8.0);
    // Dark rail, cyan light strip, orange accent line.
    c = mix(c, navy * 1.6, step(1.55, d) * step(d, 2.0));
    c = mix(c, glow * 1.25, line(d, 1.2, 0.07));
    c = mix(c, accent, line(d, 0.55, 0.06) * 0.95);
    // Windows: floors every 3.2 m from below the rail, one per 2.4 m panel.
    float along = (vWorld.x + vWorld.z) / 2.4;
    float fl = (d - 2.6) / 3.2;
    vec2 cell = vec2(floor(along), floor(fl));
    vec2 f = vec2(fract(along), fract(fl));
    float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.2, f.y) * step(f.y, 0.78) * step(2.6, d);
    float lit = hash2(cell + floor(vTopY));
    vec3 glass = mix(navy * 0.55, steel * 0.5, f.y * 0.4);
    vec3 light = lit > 0.86 ? vec3(1.0, 0.78, 0.45) : lit > 0.74 ? glow * 0.8 : glass;
    c = mix(c, light, win * (1.0 - smoothstep(18.0, 30.0, d)));
    // Darkness: walls fade to black (lit windows survive as faint points).
    c = mix(c, vec3(0.006, 0.008, 0.012) + light * win * 0.15, uShadow);
    // Neon edge right under the deck (kept in the darkness: it outlines the route).
    c = mix(c, glow, 1.0 - smoothstep(0.08, 0.18, d));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

export interface BuildingLook {
  side: number;
  /** Wall colour further down, and at the very bottom. */
  steel: number;
  navy: number;
  glow: number;
  accent: number;
  panel: number;
}

/** Route buildings: white corridor walls with a neon cyan rim. Only these can be stood on. */
export const ROUTE_LOOK: BuildingLook = {
  side: COLORS.side,
  steel: 0x8aa1c2,
  navy: 0x3a4f75,
  glow: COLORS.cyan,
  accent: COLORS.orange,
  panel: COLORS.panel,
};

/**
 * Decorative city: navy-steel walls, darker roofs and no neon rim, so scenery can never be
 * mistaken for a building you could land on.
 */
export const DECOR_LOOK: BuildingLook = {
  side: 0x24344e,
  steel: 0x182538,
  navy: 0x0d1626,
  glow: 0x24344e,
  accent: 0x1f6f9a,
  panel: 0x070b12,
};

function uniforms(look: BuildingLook) {
  const u = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      side: { value: new THREE.Color(look.side) },
      steel: { value: new THREE.Color(look.steel) },
      navy: { value: new THREE.Color(look.navy) },
      glow: { value: new THREE.Color(look.glow) },
      accent: { value: new THREE.Color(look.accent) },
      panel: { value: new THREE.Color(look.panel) },
    },
  ]);
  // Shared, not cloned: one value switches every building at once.
  u.uShadow = SHADOW_WORLD;
  return u;
}

/**
 * Building materials, indexed by geometry group: [0] powder-coated rooftop, [1] walls.
 */
export function makeBuildingMaterials(look: BuildingLook = ROUTE_LOOK): THREE.ShaderMaterial[] {
  const make = (fragmentShader: string, side: THREE.Side) =>
    new THREE.ShaderMaterial({
      fog: true,
      uniforms: uniforms(look),
      vertexShader: deckVertex,
      fragmentShader,
      side,
    });
  // Walls are drawn from both sides: a building never shows through, whatever the angle.
  return [make(topFragment, THREE.FrontSide), make(sideFragment, THREE.DoubleSide)];
}
