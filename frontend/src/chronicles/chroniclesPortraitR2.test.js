import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHRONICLES_PORTRAIT_R2_HOST, chroniclesPortraitR2Url } from './chroniclesPortraitR2.js';
import {
  CHRONICLES_PARTY_PORTRAITS, CHRONICLES_GALLERY_PORTRAITS,
  chroniclesPartyPortraitId, chroniclesPartyPortraitUrl,
  chroniclesPartyPortraitLocalUrl, chroniclesPartyPortraitRemoteUrl,
  chroniclesPortraitImageFallback,
} from './chroniclesPartyPortraitAssets.js';

const base = `https://${CHRONICLES_PORTRAIT_R2_HOST}`;
const valid = `${base}/portraits/matthias/awake-0123456789abcdef.webp`;
const manifest = { matthias: { awake: valid,
  sleep: `${base}/portraits/matthias/sleep-fedcba9876543210.webp`,
  tired: `${base}/portraits/matthias/tired-0123456789abcdef.webp` } };

describe('MM3 immutable R2 portrait manifest', () => {
  it('rejects all unverified objects, origins, query strings and malformed identities', () => {
    expect(chroniclesPortraitR2Url('matthias', 'awake', manifest)).toBe(valid);
    expect(chroniclesPortraitR2Url('matthias', 'sleep', manifest)).toBe(manifest.matthias.sleep);
    expect(chroniclesPortraitR2Url('matthias', 'tired', manifest)).toBe(manifest.matthias.tired);
    const bad = [
      valid.replace('https:', 'http:'),
      valid.replace(CHRONICLES_PORTRAIT_R2_HOST, 'evil.example'),
      valid + '?v=2',
      valid + '#foo',
      valid.replace('0123456789abcdef', 'latest'),
      valid.replace('/awake-', '/sleep-'),
      valid.replace('/portraits/', '/sprites/'),
      valid.replace('/matthias/', '/rook/'),
      valid.replace('https://', 'https://user:pass@'),
    ];
    for (const candidate of bad) {
      expect(chroniclesPortraitR2Url('matthias', 'awake', { matthias: { awake: candidate } })).toBeNull();
    }
    expect(chroniclesPortraitR2Url('../matthias', 'awake', manifest)).toBeNull();
    expect(chroniclesPortraitR2Url('matthias', 'injured', manifest)).toBeNull();
    expect(chroniclesPortraitR2Url('missing', 'awake', manifest)).toBeNull();
  });

  it('keeps 24 historical IDs and bundled portraits while no R2 manifest entry is approved', () => {
    expect(Object.keys(CHRONICLES_PARTY_PORTRAITS)).toEqual(['matthias', 'rook', 'bishop', 'knight']);
    expect(Object.keys(CHRONICLES_GALLERY_PORTRAITS)).toHaveLength(20);
    for (const id of ['matthias', 'rook', 'bishop', 'knight',
      ...Object.keys(CHRONICLES_GALLERY_PORTRAITS)]) {
      expect(chroniclesPartyPortraitId(id)).toBe(id);
      expect(chroniclesPartyPortraitUrl(id)).toBe(chroniclesPartyPortraitLocalUrl(id));
      expect(chroniclesPartyPortraitUrl(id, 'sleep')).toBe(chroniclesPartyPortraitLocalUrl(id));
      expect(chroniclesPartyPortraitUrl(id, 'tired')).toBe(chroniclesPartyPortraitLocalUrl(id));
      expect(chroniclesPartyPortraitRemoteUrl(id)).toBeNull();
    }
    expect(chroniclesPartyPortraitId({ slotId: 'rook', portraitId: 'female-04' })).toBe('female-04');
    expect(chroniclesPartyPortraitId({ slotId: 'rook', portraitId: 'unknown' })).toBe('rook');
    expect(chroniclesPartyPortraitId('unknown')).toBe('matthias');
  });

  it('falls back once from unavailable R2 to the existing local WebP', () => {
    const node = {
      src: valid,
      removed: [],
      removeAttribute(name) { this.removed.push(name); },
    };
    expect(chroniclesPortraitImageFallback(node, 'matthias')).toBe(true);
    expect(node.src).toBe(CHRONICLES_PARTY_PORTRAITS.matthias);
    expect(node.removed).toEqual(['data-chronicles-sleep-ready', 'data-chronicles-tired-ready']);
    expect(chroniclesPortraitImageFallback(node, 'matthias')).toBe(false);
  });
});

describe('R2 operator pack', () => {
  it('produces exactly 24 immutable WebPs with genuine bytes and SHA-256 keys', () => {
    const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    execFileSync(process.execPath, [join(frontend, 'scripts', 'prepare-portrait-r2.mjs')], {
      cwd: frontend, stdio: 'pipe',
    });
    const stage = join(frontend, '.portrait-r2-stage');
    const manifest = JSON.parse(readFileSync(join(stage, 'manifest.candidate.json'), 'utf8'));
    const sums = JSON.parse(readFileSync(join(stage, 'sha256sums.json'), 'utf8'));
    expect(manifest.schema).toBe(1);
    expect(Object.keys(manifest.portraits)).toHaveLength(24);
    expect(sums).toHaveLength(24);
    for (const item of sums) {
      const path = join(stage, item.key);
      expect(existsSync(path)).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
      expect(bytes.length).toBe(item.size);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.sha256);
      expect(item.key).toContain(item.sha256.slice(0, 16));
      const id = item.key.split('/')[1];
      expect(manifest.portraits[id].awake).toBe(`${base}/${item.key}`);
      expect(chroniclesPortraitR2Url(id, 'awake', manifest.portraits)).toBe(`${base}/${item.key}`);
    }
  });
});
