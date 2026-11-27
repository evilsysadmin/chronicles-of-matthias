// One phase uniform per existing grass material, updated only when Three
// renders that batch. No timers, scene traversal per frame, or CPU matrix
// updates. Reduced-motion users keep the original static silhouettes.
export function applyChroniclesBannerWind(mesh, {
  now = () => globalThis.performance?.now?.() ?? 0,
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
} = {}) {
  if (!mesh?.isInstancedMesh || !mesh.material || mesh.castShadow) return false;
  const material = mesh.material;
  const phase = { value: 0 };
  const strength = { value: 0 };
  const previousCompile = material.onBeforeCompile.bind(material);
  const previousRender = mesh.onBeforeRender.bind(mesh);
  const cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    previousCompile(shader);
    shader.uniforms.chroniclesWindPhase = phase;
    shader.uniforms.chroniclesWindStrength = strength;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      uniform float chroniclesWindPhase;
      uniform float chroniclesWindStrength;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 windRoot = instanceMatrix[3].xyz;
        float windWave = sin(chroniclesWindPhase + windRoot.x * 0.23 + windRoot.z * 0.19);
        float windGust = sin(chroniclesWindPhase * 2.0 + windRoot.z * 0.51);
        float tip = smoothstep(0.025, 0.33, position.y);
        vec3 windDelta = vec3(0.085, 0.0, 0.040) *
          (0.62 * windWave + 0.38 * windGust) * tip * tip * chroniclesWindStrength;
        vec3 windX = instanceMatrix[0].xyz;
        vec3 windZ = instanceMatrix[2].xyz;
        transformed.x += dot(windDelta, windX) / max(dot(windX, windX), 0.00001);
        transformed.z += dot(windDelta, windZ) / max(dot(windZ, windZ), 0.00001);
      #endif`);
  };
  material.customProgramCacheKey = () => cacheKey + ':chronicles-banner-wind-v1';
  mesh.onBeforeRender = (...args) => {
    previousRender(...args);
    const elapsed = now();
    phase.value = Number.isFinite(elapsed) ? (elapsed * 0.0017) % (Math.PI * 2) : 0;
    strength.value = reducedMotion?.matches ? 0 : 1;
  };
  // A 9.4cm maximum displacement stays inside the padded batch bounds.
  mesh.computeBoundingSphere();
  if (mesh.boundingSphere) mesh.boundingSphere.radius += 0.10;
  material.needsUpdate = true;
  return true;
}

export function attachChroniclesBannerWind(scenery) {
  for (const part of ['tuft', 'meadowSedge', 'forestHerb', 'flower']) {
    const mesh = scenery.getObjectByName('chronicles-terra-' + part);
    applyChroniclesBannerWind(mesh);
  }
}
