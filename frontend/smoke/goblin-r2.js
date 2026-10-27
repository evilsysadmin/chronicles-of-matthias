// Visual QA fixture: genuine 2.5D production goblin billboard & Three.js renderer.
// No mocked frames. Local HTTP origin is used only for the fixture; the
// Playwright driver separately validates the exact R2 response from staging Origin.
import * as THREE from 'three';
import { buildChroniclesEnemyVisual } from '../src/chroniclesEnemyVisualRegistry.js';

const canvas = document.getElementById('stage');
try {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x19252e);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshBasicMaterial({ color: 0x38403c }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  scene.add(ground);
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  const camera = new THREE.PerspectiveCamera(59, innerWidth / innerHeight, 0.1, 50);
  camera.position.set(0, 1.65, innerWidth <= 430 ? 13.5 : 8.2);
  camera.lookAt(0, 1.0, 0);

  const cues = [{}, { attacking: true }, { dead: true }];
  const actors = cues.map((cue, i) => {
    const result = buildChroniclesEnemyVisual('ash-goblin', { sprites: true });
    if (!result?.model?.userData?.chroniclesBillboard) {
      throw new Error('Missing production ash-goblin billboard');
    }
    result.model.position.set((i - 1) * (innerWidth <= 430 ? 2.0 : 2.25), 0, 0);
    scene.add(result.model);
    return { ...result.model.userData, model: result.model, cue };
  });
  const timeout = performance.now() + 20_000;

  function renderWhenLoaded() {
    const loaded = actors.every(({ model }) => {
      const billboard = model.userData.chroniclesBillboard;
      const image = billboard.sprite.material.map?.image;
      return billboard.frames.length === 6 && image?.width === 1536 && image?.height === 256;
    });
    if (!loaded) {
      if (performance.now() > timeout) {
        document.body.dataset.goblinError = 'Remote six-frame atlas did not load';
        return;
      }
      requestAnimationFrame(renderWhenLoaded);
      return;
    }
    const frames = [];
    for (const { model, cue } of actors) {
      model.userData.updateChroniclesSprite(0, cue);
      const info = model.userData.chroniclesBillboard;
      frames.push(Math.round(info.sprite.material.map.offset.x * info.frames.length));
    }
    renderer.render(scene, camera);
    Object.assign(document.body.dataset, {
      goblinReady: 'true',
      goblinCount: String(actors.length),
      goblinFrames: frames.join(','),
      goblinImageWidth: String(actors[0].model.userData.chroniclesBillboard.sprite.material.map.image.width),
      goblinImageHeight: String(actors[0].model.userData.chroniclesBillboard.sprite.material.map.image.height),
    });
  }
  requestAnimationFrame(renderWhenLoaded);
} catch (error) {
  document.body.dataset.goblinError = String(error.message || error);
}
