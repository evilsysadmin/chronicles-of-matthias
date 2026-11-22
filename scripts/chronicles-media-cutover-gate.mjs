#!/usr/bin/env node
// Source-owned, secretless R2 cutover gate. No uploads or secrets.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const LEGACY = 'https://assets.chess-studio.shadowops.dpdns.org';
export const TARGET = 'https://assets.chronicles.shadowops.dpdns.org';
export const ORIGIN = 'https://staging.chronicles.shadowops.dpdns.org';
export const PRODUCTION_ORIGIN = 'https://chronicles.shadowops.dpdns.org';
// The first-party runtime serves users on both staging and production.
// A CDN reflecting only staging CORS can pass integrity checks yet break the
// production Tactics GLB. Require exact public CORS for both consumers.
export const BROWSER_ORIGINS = Object.freeze([ORIGIN, PRODUCTION_ORIGIN]);
export const PINS = Object.freeze({
  'chronicles.music.firstVerse': Object.freeze({
    key: 'chronicles/music/Chronicles of matthias - First verse.mp3',
    bytes: 4871666, sha256: '5e545865cf16504e93482d380ead4c33dd77b794e85d7ee5afb400d3d0fbe2c5',
    contentType: 'audio/mpeg', versioned: false,
  }),
  'chronicles.music.secondVerse': Object.freeze({
    key: 'chronicles/music/Chronicles of matthias - Second verse.mp3',
    bytes: 4997378, sha256: '1f55001289415bfe1c6b01b7d1d73b8d963b0dbbadc90b07505efa2ffa263af4',
    contentType: 'audio/mpeg', versioned: false,
  }),
  'chronicles.tactics.party.master': Object.freeze({
    key: 'chronicles/tactics/party/master/chronicles-tactics-party-2f6ef378ef7ea982.blend',
    bytes: 501446, sha256: '2f6ef378ef7ea9823d70bdf289fa05c0656448e0cc3802b3aeb3679353d54e48',
    contentType: 'application/octet-stream', versioned: true,
  }),
  'chronicles.tactics.party.runtime': Object.freeze({
    key: 'chronicles/tactics/party/runtime/chronicles-tactics-party-0d12bb3c3ec92d55.glb',
    bytes: 2423220, sha256: '0d12bb3c3ec92d55b3e4af7b64cade1dede55537ff118c360ec260f788ff640c',
    contentType: 'model/gltf-binary', versioned: true,
  }),
});
export class CutoverError extends Error {}
function fail(reason) { throw new CutoverError(reason); }
function exactKeys(obj, keys) {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).sort().join('|') === [...keys].sort().join('|');
}
function canonicalUrl(host, key) {
  return host + '/' + key.split('/').map(encodeURIComponent).join('/');
}
export function validateManifest(manifest, pins = PINS) {
  if (!exactKeys(manifest, ['assets', 'baseUrl', 'version']) || manifest.version !== 1 ||
    (manifest.baseUrl !== LEGACY && manifest.baseUrl !== TARGET) ||
    Object.keys(pins).length !== 4 || !exactKeys(manifest.assets, Object.keys(pins))) {
    fail('Manifest schema, origin or four-asset inventory differs');
  }
  for (const [id, pin] of Object.entries(pins)) {
    const item = manifest.assets[id];
    if (!exactKeys(item, ['key','bytes','contentType','sha256','url']) ||
      item.key !== pin.key || item.bytes !== pin.bytes ||
      item.contentType !== pin.contentType || item.sha256 !== pin.sha256) {
      fail('Manifest media pin differs: ' + id);
    }
    const canonical = canonicalUrl(manifest.baseUrl, pin.key);
    const legacyRaw = LEGACY + '/' + pin.key;
    if (item.url !== canonical && !(manifest.baseUrl === LEGACY && item.url === legacyRaw)) {
      fail('Manifest URL differs from base/key: ' + id);
    }
  }
  return manifest.baseUrl === TARGET ? 'target' : 'legacy';
}
export function validateResponse(pin, result, method, origin = ORIGIN) {
  if (!BROWSER_ORIGINS.includes(origin)) fail('Unexpected first-party browser origin');
  if (result?.status !== 200) fail('Unexpected public HTTP status');
  const h = result.headers || {};
  if ((h['content-type'] || '').split(';',1)[0].trim().toLowerCase() !== pin.contentType) {
    fail('Public MIME mismatch');
  }
  if (h['access-control-allow-origin'] !== origin &&
    h['access-control-allow-origin'] !== '*') fail('Public CORS mismatch for ' + origin);
  const cache = (h['cache-control'] || '').toLowerCase().split(',').map(x => x.trim());
  if (!cache.includes('public') || cache.includes('private') || cache.includes('no-store')) {
    fail('Public cache scope mismatch');
  }
  const ages = cache.filter(x => x.startsWith('max-age='));
  if (ages.length !== 1 || !/^max-age=\d+$/.test(ages[0])) fail('Public max-age missing');
  const age = Number(ages[0].slice(8));
  if (pin.versioned) {
    if (age !== 31536000 || !cache.includes('immutable')) fail('Versioned cache mismatch');
  } else if (age > 86400 || cache.includes('immutable')) fail('Music cache mismatch');
  if (h['content-length'] !== undefined && (
    !/^\d+$/.test(String(h['content-length'])) ||
    Number(h['content-length']) !== pin.bytes)) fail('Public Content-Length mismatch');
  if (method === 'GET') {
    if (!Buffer.isBuffer(result.body) || result.body.length !== pin.bytes) {
      fail('Public byte length differs');
    }
    if (createHash('sha256').update(result.body).digest('hex') !== pin.sha256) {
      fail('Public SHA-256 mismatch');
    }
  }
}
export function requestAsset(method, pin, origin = ORIGIN) {
  if (!BROWSER_ORIGINS.includes(origin) || !['HEAD','GET'].includes(method) ||
    !Object.values(PINS).includes(pin)) fail('Unexpected public proof request');
  // Destination is fixed by the pinned key and the literal Chronicles host.
  const target = canonicalUrl(TARGET, pin.key);
  return new Promise((resolve, reject) => {
    const request = https.request(target, {
      method, timeout: 25000,
      headers: {
        Origin: origin,
        'Accept-Encoding': 'identity',
        'User-Agent': 'chronicles-source-media-cutover-gate/1',
      },
    }, response => {
      let total = 0;
      const parts = [];
      response.on('data', part => {
        total += part.length;
        if (total > pin.bytes) {
          request.destroy(new CutoverError('Public response over byte budget'));
          return;
        }
        if (method === 'GET') parts.push(part);
      });
      response.on('end', () => resolve({
        status: response.statusCode, headers: response.headers,
        body: method === 'GET' ? Buffer.concat(parts) : Buffer.alloc(0),
      }));
    });
    request.on('timeout', () => request.destroy(new CutoverError('Public proof timeout')));
    request.on('error', reject);
    request.end();
  });
}
export async function proveCutover(manifest, transfer = requestAsset, pins = PINS) {
  const mode = validateManifest(manifest, pins);
  if (mode === 'legacy') return { mode, objects: 4, requests: 0, bytes: 0 };
  let bytes = 0;
  for (const pin of Object.values(pins)) {
    for (const origin of BROWSER_ORIGINS) {
      for (const method of ['HEAD', 'GET']) {
        validateResponse(pin, await transfer(method, pin, origin), method, origin);
      }
    }
    bytes += pin.bytes;
  }
  return { mode, objects: 4, requests: 16, bytes };
}
async function main() {
  const manifest = JSON.parse(readFileSync(
    new URL('../frontend/src/assets/r2-assets-manifest.json', import.meta.url), 'utf8'));
  const report = await proveCutover(manifest);
  console.log('CHRONICLES_MEDIA_CUTOVER_GATE mode=' + report.mode +
    ' objects=' + report.objects + ' requests=' + report.requests + ' verified_bytes=' + report.bytes);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('CHRONICLES_MEDIA_CUTOVER_BLOCKED',
      error instanceof CutoverError ? error.message : 'public proof unavailable');
    process.exitCode = 1;
  });
}
