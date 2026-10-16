import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLandscapeGameSession, isHandheldPortrait } from '../src/chronicles/landscapeSession.js';

function browser({ coarse = true, portrait = true, fullscreen = true, lock = true, reject = false } = {}) {
  const calls = [];
  const element = {};
  const doc = {
    documentElement: element,
    fullscreenElement: null,
    exitFullscreen: async () => { calls.push('exit-fullscreen'); doc.fullscreenElement = null; },
  };
  if (fullscreen) element.requestFullscreen = async () => {
    calls.push('request-fullscreen');
    if (reject) throw Error('Denied');
    doc.fullscreenElement = element;
  };
  const orientation = {};
  if (lock) {
    orientation.lock = async direction => {
      calls.push('lock-' + direction);
      if (reject) throw Error('Denied');
    };
    orientation.unlock = () => calls.push('unlock');
  }
  const win = {
    innerWidth: portrait ? 390 : 844,
    innerHeight: portrait ? 844 : 390,
    matchMedia: query => ({ matches: query === '(pointer: coarse)' ? coarse : portrait }),
    screen: { orientation },
  };
  return { calls, doc, win };
}

test('portrait phone requests real fullscreen then landscape after an explicit Play click', async () => {
  const { win, doc, calls } = browser();
  const changes = [];
  const game = createLandscapeGameSession({ win, doc, onChange: status => changes.push(status) });
  await game.enter();
  assert.deepEqual(calls, ['request-fullscreen', 'lock-landscape']);
  assert.equal(changes.at(-1).needsRotation, true); // fake screen is still portrait
  game.leave();
  assert.deepEqual(calls.slice(-2), ['unlock', 'exit-fullscreen']);
});

test('landscape phone and portrait desktop never hijack fullscreen', async () => {
  for (const props of [{ portrait: false }, { coarse: false }]) {
    const { win, doc, calls } = browser(props);
    assert.equal(isHandheldPortrait(win), false);
    const game = createLandscapeGameSession({ win, doc });
    await game.enter();
    game.leave();
    assert.deepEqual(calls, []);
  }
});

test('unsupported browser fails safely and manual rotation remains available', async () => {
  const { win, doc, calls } = browser({ fullscreen: false, lock: false });
  const game = createLandscapeGameSession({ win, doc });
  const status = await game.enter();
  assert.equal(status.needsRotation, true);
  assert.equal(status.failure, 'orientation-unsupported');
  assert.deepEqual(calls, []);
  game.leave();
});

test('denied fullscreen and orientation lock preserve manual rotation fallback', async () => {
  const { win, doc, calls } = browser({ reject: true });
  const game = createLandscapeGameSession({ win, doc });
  const status = await game.enter();
  assert.equal(status.needsRotation, true);
  assert.equal(status.failure, 'orientation-denied');
  assert.deepEqual(calls, ['request-fullscreen', 'lock-landscape']);
  game.leave();
  assert.ok(calls.includes('unlock'));
  assert.equal(calls.includes('exit-fullscreen'), false); // not our fullscreen
});

test('leave cannot close someone else’s existing fullscreen', async () => {
  const { win, doc, calls } = browser();
  doc.fullscreenElement = doc.documentElement; // host fullscreen predates us
  const game = createLandscapeGameSession({ win, doc });
  await game.enter();
  game.leave();
  assert.deepEqual(calls, ['lock-landscape', 'unlock']);
});

test('no landscape API invocation on load; React starts only from real game entry events', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const hook = readFileSync(new URL('../src/chronicles/useLandscapeGameplay.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.match(app, /landscape\.start\(\);\s*setTown\(createSwordhavenWalkState\(\)\);/);
  assert.match(app, /landscape\.start\(\);\s*setPage\('explore'\)/);
  assert.match(app, /landscape\.needsRotation/);
  assert.match(app, /onClick=\{landscape\.retry\}/);
  assert.match(hook, /session\.current\?\.leave\(\)/);
  assert.match(hook, /window\.addEventListener\('orientationchange'/);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.equal(manifest.orientation, 'landscape');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});
