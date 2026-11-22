import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  LEGACY, TARGET, ORIGIN, PINS, CutoverError, validateManifest, proveCutover,
} from '../scripts/chronicles-media-cutover-gate.mjs';

const actual = JSON.parse(readFileSync(
  new URL('../frontend/src/assets/r2-assets-manifest.json', import.meta.url), 'utf8'));

function canonicalUrl(host, key) {
  return host + '/' + key.split('/').map(encodeURIComponent).join('/');
}
function fixture(host = TARGET, pins = PINS) {
  return { version: 1, baseUrl: host, assets: Object.fromEntries(
    Object.entries(pins).map(([id, pin]) => [id, {
      key: pin.key, bytes: pin.bytes, sha256: pin.sha256,
      contentType: pin.contentType, url: canonicalUrl(host, pin.key),
    }]),
  ) };
}
function synthetic() {
  const samples = [
    Buffer.from('first-verse'), Buffer.from('second-verse'),
    Buffer.from('party-master'), Buffer.from('party-runtime'),
  ];
  const pins = Object.fromEntries(
    Object.entries(PINS).map(([id, source], index) => [id, {
      ...source,
      bytes: samples[index].length,
      sha256: createHash('sha256').update(samples[index]).digest('hex'),
    }]),
  );
  return { pins, samples };
}
function responses(pins, samples, mutate = x => x) {
  const calls = [];
  const transfer = async (method, pin) => {
    const index = Object.values(pins).indexOf(pin);
    calls.push({ method, key: pin.key });
    const value = {
      status: 200,
      headers: {
        'content-type': pin.contentType,
        'access-control-allow-origin': ORIGIN,
        'content-length': String(pin.bytes),
        'cache-control': pin.versioned
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=3600',
      },
      body: method === 'GET' ? samples[index] : Buffer.alloc(0),
    };
    return mutate(value, method, pin);
  };
  return { transfer, calls };
}

test('current source manifest remains the four pinned legacy objects; zero HTTP', async () => {
  assert.equal(validateManifest(actual), 'legacy');
  let touched = false;
  assert.deepEqual(await proveCutover(actual, async () => { touched = true; }), {
    mode: 'legacy', objects: 4, requests: 0, bytes: 0,
  });
  assert.equal(touched, false);
});

test('target cutover requires HEAD and GET with exact byte/hash/cors/cache proofs', async () => {
  const { pins, samples } = synthetic();
  const doc = fixture(TARGET, pins);
  const { transfer, calls } = responses(pins, samples);
  assert.deepEqual(await proveCutover(doc, transfer, pins), {
    mode: 'target', objects: 4, requests: 8,
    bytes: samples.reduce((n, buffer) => n + buffer.length, 0),
  });
  assert.deepEqual(calls.map(x => x.method), [
    'HEAD','GET','HEAD','GET','HEAD','GET','HEAD','GET',
  ]);
  for (const [id, pin] of Object.entries(pins)) {
    assert.equal(doc.assets[id].url, canonicalUrl(TARGET, pin.key));
  }
});

test('reject foreign domain, partial list, incorrect metadata, mixed origins and URL parameter injection', () => {
  const violations = [
    doc => { doc.baseUrl = 'https://assets.chronicles.shadowops.dpdns.org.attacker.invalid'; },
    doc => { doc.assets['chronicles.music.firstVerse'].url = canonicalUrl(LEGACY, PINS['chronicles.music.firstVerse'].key); },
    doc => { doc.assets['chronicles.music.firstVerse'].url += '?malicious=1'; },
    doc => { doc.assets['chronicles.music.firstVerse'].bytes += 1; },
    doc => { doc.assets['chronicles.music.firstVerse'].sha256 = '0'.repeat(64); },
    doc => { doc.assets['chronicles.music.firstVerse'].key = 'chronicles/../foreign.mp3'; },
    doc => { delete doc.assets['chronicles.tactics.party.master']; },
    doc => { doc.assets['other'] = {}; },
    doc => { doc.version = 2; },
    doc => { doc.extra = true; },
  ];
  for (const change of violations) {
    const doc = fixture();
    change(doc);
    assert.throws(() => validateManifest(doc), CutoverError);
  }
});

test('reject corrupted full-sized bytes and incorrect public metadata; do not accept partial batch', async () => {
  const { pins, samples } = synthetic();
  const doc = fixture(TARGET, pins);
  const cases = [
    x => { x.status = 302; },
    x => { x.headers['content-type'] = 'text/html'; },
    x => { x.headers['access-control-allow-origin'] = 'https://attacker.invalid'; },
    x => { x.headers['cache-control'] = 'private, max-age=3600'; },
    x => { x.headers['content-length'] = '9999'; },
    x => { x.body = Buffer.alloc(x.body.length, 123); },
  ];
  for (const bad of cases) {
    const { transfer, calls } = responses(pins, samples, (response, method) => {
      if (method === 'GET') bad(response);
      return response;
    });
    await assert.rejects(proveCutover(doc, transfer, pins), CutoverError);
    assert.ok(calls.length < 8);
  }
});

test('immutable model cache and mutable music cache cannot be reversed', async () => {
  const { pins, samples } = synthetic();
  const doc = fixture(TARGET, pins);
  for (const targetType of [false, true]) {
    const { transfer } = responses(pins, samples, (response, method, pin) => {
      if (pin.versioned === targetType) {
        response.headers['cache-control'] = targetType
          ? 'public, max-age=3600' : 'public, max-age=31536000, immutable';
      }
      return response;
    });
    await assert.rejects(proveCutover(doc, transfer, pins), CutoverError);
  }
});

test('target filenames with spaces must be canonical percent-encoded', () => {
  const doc = fixture();
  const entry = doc.assets['chronicles.music.firstVerse'];
  assert.equal(new URL(entry.url).origin, TARGET);
  assert.ok(new URL(entry.url).pathname.includes('First%20verse.mp3'));
  entry.url = TARGET + '/' + PINS['chronicles.music.firstVerse'].key;
  assert.throws(() => validateManifest(doc), CutoverError);
});

test('cutover only uses verified literal pinned source catalog', () => {
  assert.deepEqual(Object.keys(PINS).sort(), [
    'chronicles.music.firstVerse', 'chronicles.music.secondVerse',
    'chronicles.tactics.party.master', 'chronicles.tactics.party.runtime',
  ]);
  assert.equal(Object.values(PINS).reduce((sum, pin) => sum + pin.bytes, 0), 12793710);
  const script = readFileSync(
    new URL('../scripts/chronicles-media-cutover-gate.mjs', import.meta.url), 'utf8');
  assert.ok(script.includes("canonicalUrl(TARGET, pin.key)"));
  assert.ok(!script.includes('put_object'));
  assert.ok(!script.includes('workflow_dispatch'));
});
