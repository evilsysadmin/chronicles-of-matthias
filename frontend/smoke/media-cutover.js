// Exercises the ACTUAL Chronicles media URLs in a real browser.
// The Playwright runner first verifies public CDN headers, size and hash,
// then adapts only CORS for the localhost Vite fixture.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { r2AssetUrl } from '../src/r2Assets.js';

async function run() {
  const audio = new AudioContext();
  const tracks = [];
  try {
    for (const id of ['chronicles.music.firstVerse', 'chronicles.music.secondVerse']) {
      const url = r2AssetUrl(id);
      if (!url) throw new Error('Chronicles soundtrack missing URL: ' + id);
      const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error('Chronicles MP3 fetch failed: ' + id);
      // A successful HTTP response is not sufficient: Chromium must decode
      // actual audio frames instead of accepting corrupt or unsupported MP3.
      const decoded = await audio.decodeAudioData(await response.arrayBuffer());
      if (!(decoded.duration > 0) || !(decoded.sampleRate > 0) || decoded.numberOfChannels < 1) {
        throw new Error('Chronicles MP3 cannot be decoded: ' + id);
      }
      tracks.push({
        id, seconds: decoded.duration, sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
      });
    }
  } finally {
    await audio.close();
  }

  const url = r2AssetUrl('chronicles.tactics.party.runtime');
  if (!url) throw new Error('Chronicles tactics GLB missing URL');
  const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error('Chronicles tactics GLB fetch failed');
  const bytes = await response.arrayBuffer();
  const model = await new Promise((resolve, reject) => {
    new GLTFLoader().parse(bytes, '', resolve, reject);
  });
  let meshCount = 0;
  model.scene.traverse(object => { if (object.isMesh) meshCount += 1; });
  if (meshCount < 1) throw new Error('Chronicles tactics GLB decoded without meshes');
  return { tracks, meshCount };
}

document.getElementById('exercise').addEventListener('click', () => {
  run().then(result => {
    window.__chroniclesMediaDecodeResult = result;
  }).catch(error => {
    window.__chroniclesMediaDecodeError = String(error?.message || error);
  });
});
window.__chroniclesMediaDecodeReady = true;
