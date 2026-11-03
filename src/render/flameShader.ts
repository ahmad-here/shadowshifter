import type * as THREE from 'three';

/**
 * Animates a flame material in the vertex shader: the body sways and the tips lick upwards, more
 * the higher the vertex (the model's base stays planted at y=0). Each instance gets its own phase
 * from its position, so a row of fires never moves in lockstep. Drive it with `time.value`.
 */
export function animateFlame(material: THREE.Material, time: { value: number }): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float phase = dot(instanceMatrix[3].xz, vec2(1.7, 2.3));
      #else
        float phase = 0.0;
      #endif
      float k = clamp(position.y, 0.0, 1.0);
      float t = uTime * 2.6 + phase;
      // Smooth, slow burn: low frequencies only, growing with height so the base stays planted.
      transformed.x += k * k * (0.06 * sin(t + position.y * 3.0) + 0.02 * sin(t * 1.7 + position.z * 6.0));
      transformed.z += k * k * (0.06 * cos(t * 0.9 + position.y * 2.5) + 0.02 * sin(t * 1.9 + position.x * 6.0));
      transformed.y *= 1.0 + 0.1 * k * sin(t * 1.4 + position.x * 4.0 + position.z * 3.0);`,
    );
  };
}
