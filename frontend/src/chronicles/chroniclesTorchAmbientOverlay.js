import * as THREE from 'three';
import './chroniclesTorchAmbientOverlay.css';

// Stable projection for a 2D compositor glow; no WebGL draw call is required
// as long as neither the camera nor the torch anchor changes.
export function chroniclesTorchGlowProjection(camera, position, width, height) {
  if (!camera || !position || width <= 0 || height <= 0) return null;
  const distance = camera.position.distanceTo(position);
  if (distance < 0.45 || distance > 28) return null;
  const ndc = position.clone().project(camera);
  if (![ndc.x, ndc.y, ndc.z].every(Number.isFinite)
    || ndc.z <= -1 || ndc.z >= 1
    || Math.abs(ndc.x) > 0.98 || Math.abs(ndc.y) > 0.98) return null;
  const focalPixels = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
    size: THREE.MathUtils.clamp(focalPixels * 0.55 / distance, 10, 86),
    distance,
  };
}

// A CSS glow must never shine through a solid corridor wall. We raycast only
// when the world/camera changes, not continuously during ambient idle time.
export function chroniclesTorchGlowOccluded(raycaster, camera, position, walls) {
  if (!walls.length) return false;
  const direction = position.clone().sub(camera.position);
  const distance = direction.length();
  if (distance <= 0.35) return false;
  raycaster.set(camera.position, direction.multiplyScalar(1 / distance));
  raycaster.near = 0;
  raycaster.far = Math.max(0, distance - 0.28);
  return raycaster.intersectObjects(walls, false).length > 0;
}

export function createChroniclesTorchAmbientOverlay(host, camera, scene, torches, { coarse = false } = {}) {
  if (!torches?.length) return { update() {}, setVisible() {}, dispose() {} };

  const previousPosition = host.style.position;
  const changedPosition = getComputedStyle(host).position === 'static';
  if (changedPosition) host.style.position = 'relative';

  const layer = document.createElement('div');
  layer.className = 'chronicles-torch-ambient-layer';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);

  const maxGlows = coarse ? 4 : 8;
  const glows = Array.from({ length: Math.min(maxGlows, torches.length) }, (_, index) => {
    const element = document.createElement('span');
    element.className = 'chronicles-torch-ambient-glow';
    element.style.animationDelay = `${index * -0.47}s`;
    layer.appendChild(element);
    return element;
  });
  const walls = [];
  scene.traverse((node) => {
    if (node.isMesh && node.name?.startsWith('chronicles-first-person-wall-')) walls.push(node);
  });
  const raycaster = new THREE.Raycaster();
  const position = new THREE.Vector3();
  let disposed = false;

  function update() {
    if (disposed || layer.hidden) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    camera.updateMatrixWorld(true);

    const projected = torches.map((torch) => {
      if (!torch.flame?.visible || !torch.root?.visible) return null;
      torch.flame.getWorldPosition(position);
      const anchor = position.clone();
      const screen = chroniclesTorchGlowProjection(camera, anchor, width, height);
      return screen && { anchor, screen };
    }).filter(Boolean).sort((a, b) => a.screen.distance - b.screen.distance);

    let shown = 0;
    for (const candidate of projected) {
      if (shown >= glows.length) break;
      if (chroniclesTorchGlowOccluded(raycaster, camera, candidate.anchor, walls)) continue;
      const glow = glows[shown];
      glow.style.left = `${candidate.screen.x}px`;
      glow.style.top = `${candidate.screen.y}px`;
      glow.style.width = `${candidate.screen.size}px`;
      glow.style.height = `${candidate.screen.size * 1.26}px`;
      glow.hidden = false;
      shown++;
    }
    for (let i = shown; i < glows.length; i++) glows[i].hidden = true;
  }

  function setVisible(visible) {
    if (!disposed) layer.hidden = !visible;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    layer.remove();
    if (changedPosition) host.style.position = previousPosition;
  }

  return { update, setVisible, dispose };
}
