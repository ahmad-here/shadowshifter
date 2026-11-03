import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

/**
 * Electric energy portal, fully procedural: a swirling plasma ring of deep blue and cyan, ragged
 * wisps outside it, lightning arcs crawling around and across it, and (core part only) a bright
 * white-cyan centre. Additive, so it glows over anything behind it.
 */
const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCore;
uniform float uVoid;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
/** Thin bright filament where the noise field crosses 0.5. */
float bolt(vec2 p, float width) {
  return smoothstep(width, 0.0, abs(fbm(p) - 0.5));
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  float a = atan(p.y, p.x);
  vec2 dir = vec2(cos(a), sin(a));
  float t = uTime;
  vec3 deep = vec3(0.02, 0.18, 0.75);
  vec3 cyan = vec3(0.25, 0.85, 1.0);
  vec3 white = vec3(0.9, 0.97, 1.0);
  vec3 col = vec3(0.0);

  if (uCore > 0.5) {
    // Bright centre, slowly breathing, with faint inner swirl.
    float core = exp(-r * r * (5.0 + sin(t * 3.0)));
    float swirl = fbm(dir * 2.0 + vec2(r * 4.0 - t * 1.5, t * 0.4));
    col = white * core * 1.2 + cyan * smoothstep(0.75, 0.0, r) * swirl * 0.5;
  } else {
    // Swirl: sample noise along a rotating, twisting angle so the plasma turns.
    float sw = a + t * 0.9 - r * 3.0;
    vec2 sp = vec2(cos(sw), sin(sw)) * (1.5 + r * 2.5);
    float n = fbm(sp + t * 0.3);
    float ringR = 0.62 + 0.07 * (n - 0.5);
    float ring = smoothstep(0.2, 0.0, abs(r - ringR));
    float wisps = smoothstep(1.0, 0.6, r) * smoothstep(0.45, 0.7, r) * fbm(sp * 1.7 - t * 0.6);
    col += deep * (ring * 1.4 + wisps * 1.6);
    col += cyan * pow(ring, 3.0) * (0.6 + n);
    // Lightning around the ring and across the disc.
    float arc = smoothstep(0.012, 0.0, abs(r - ringR - 0.05 * (noise(vec2(a * 6.0, t * 5.0)) - 0.5)));
    float cross = bolt(dir * 3.0 + vec2(r * 5.0, t * 2.5), 0.025) * smoothstep(0.95, 0.4, r);
    float flash = 0.6 + 0.4 * step(0.5, fract(sin(floor(t * 12.0)) * 43758.5));
    col += (white * arc + cyan * cross) * flash;
  }
  float edge = smoothstep(1.0, 0.85, r);
  if (uVoid > 0.5) {
    // Black portal: the swirl turns into dark smoke with a cold blue rim, around a black hole
    // that swallows the light (normal blending, so it really darkens what is behind it).
    float lum = dot(col, vec3(0.3, 0.5, 0.2));
    vec3 rim = vec3(0.1, 0.35, 0.9) * lum * 0.9;
    float hole = smoothstep(0.62, 0.2, r);
    gl_FragColor = vec4(rim * (1.0 - hole), max(hole, min(1.0, lum * 1.4)) * edge);
    return;
  }
  gl_FragColor = vec4(col * edge, 1.0);
}`;

/**
 * One portal layer: the ring (`core` false) or the centre (`core` true). `blackHole`: the black
 * portal's dark variant (a void with a cold rim instead of light).
 */
export function makePortalMaterial(
  time: { value: number },
  core: boolean,
  blackHole = false,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uCore: { value: core ? 1 : 0 }, uVoid: { value: blackHole ? 1 : 0 } },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: blackHole ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
