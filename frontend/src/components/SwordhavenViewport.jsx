import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildSwordhavenScene } from '../chronicles/chroniclesSwordhaven3D.js';
import { SWORDHAVEN_DIRECTIONS } from '../chronicles/swordhavenWalk.js';

// An isolated React host of the ORIGINAL authored Swordhaven builder.
// Until the full first-person engine migrates, this mounts its real meshes,
// materials, lighting, sky, and camera, but deliberately does not simulate
// inventory, merchants, encounters, quest progression or saved runs.
const CELL = 4;
const CAMERA_Y = 1.62;
const CENTER = Object.freeze({ x: 9, y: 9 });
const MAX_HFOV = 96;
const MAX_VFOV = 67;

function cappedFov(aspect) {
  const safe = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const halfHorizontal = THREE.MathUtils.degToRad(MAX_HFOV / 2);
  return Math.min(MAX_VFOV,
    THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(halfHorizontal) / safe)));
}

function cameraForState(camera, state) {
  const direction = SWORDHAVEN_DIRECTIONS[state.direction];
  if (!direction) return;
  camera.position.set((state.x - CENTER.x) * CELL, CAMERA_Y, (state.y - CENTER.y) * CELL);
  camera.rotation.set(0, Math.atan2(-direction.dx, -direction.dy), 0);
}

function disposeVisuals(scene) {
  const geometries = new Set();
  const materials = new Set();
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) {
      const all = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of all) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  // Texture objects are cached by the authentic material factory, shared across
  // scenes and intentionally not disposed on a temporary React unmount.
  for (const material of materials) material.dispose();
}

export default function SwordhavenViewport({ state }) {
  const hostRef = useRef(null);
  const runtimeRef = useRef(null);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer = null;
    let scene = null;
    let observer = null;
    let onWindowResize = null;
    try {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches === true;
      renderer = new THREE.WebGLRenderer({
        antialias: !coarse,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = coarse ? 1.15 : 1.10;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.2 : 1.65));
      renderer.shadowMap.enabled = !coarse;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute('aria-hidden', 'true');
      renderer.domElement.className = 'react-swordhaven-canvas';
      host.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      // Original builder supplies the detailed geometry, pixel textures, lighting
      // and sky, with original center/size. No reimplemented mock scenery.
      buildSwordhavenScene(scene, {
        coarsePointer: coarse,
        scenePlan: {
          mapId: 'swordhaven-square',
          regionKind: 'settlement',
          center: CENTER,
          width: 19,
          height: 19,
          content: [], // interactive buildings will be enabled with world runtime
        },
      });

      const camera = new THREE.PerspectiveCamera(MAX_VFOV, 1, 0.08, 100);
      camera.rotation.order = 'YXZ';
      function paint(nextState) {
        if (!renderer || !scene || !nextState) return;
        cameraForState(camera, nextState);
        renderer.render(scene, camera);
      }
      function resize() {
        if (!renderer) return;
        const width = Math.max(1, host.clientWidth || 1);
        const height = Math.max(1, host.clientHeight || 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = cappedFov(camera.aspect);
        camera.updateProjectionMatrix();
        paint(runtimeRef.current?.state);
      }
      runtimeRef.current = { state, paint, resize };
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(resize);
        observer.observe(host);
      } else {
        onWindowResize = () => resize();
        window.addEventListener('resize', onWindowResize);
      }
      resize();
      paint(state);
      setFailure('');
    } catch {
      setFailure('No se pudo inicializar WebGL. La vista 3D no está disponible en este navegador.');
    }
    return () => {
      runtimeRef.current = null;
      observer?.disconnect();
      if (onWindowResize) window.removeEventListener('resize', onWindowResize);
      if (scene) disposeVisuals(scene);
      renderer?.dispose();
      renderer?.forceContextLoss?.();
      renderer?.domElement.remove();
    };
    // Mounted only for the Swordhaven view. State updates reuse the same WebGL
    // renderer/scene and do not rebuild the original town on every turn.
  }, []);

  useEffect(() => {
    if (!runtimeRef.current) return;
    runtimeRef.current.state = state;
    runtimeRef.current.paint(state);
  }, [state]);

  return (
    <div className="react-swordhaven-host" ref={hostRef}
      role="img" aria-label="Ciudad tridimensional original de Swordhaven vista desde los ojos de la compañía">
      {failure && <p className="react-swordhaven-error" role="alert">{failure}</p>}
    </div>
  );
}
