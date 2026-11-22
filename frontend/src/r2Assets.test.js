import { describe, expect, it } from 'vitest';
import manifest from './assets/r2-assets-manifest.json';
import { R2_ASSET_BASE_URL, r2AssetEntry, r2AssetUrl } from './r2Assets.js';

describe('R2 runtime assets', () => {
  it('pins the public R2 origin from the validated manifest', () => {
    expect(R2_ASSET_BASE_URL).toBe('https://assets.chess-studio.shadowops.dpdns.org');
  });

  it('owns only Chronicles asset keys after the repository split', () => {
    expect(Object.keys(manifest.assets).sort()).toEqual([
      'chronicles.music.firstVerse',
      'chronicles.music.secondVerse',
      'chronicles.tactics.party.master',
      'chronicles.tactics.party.runtime',
    ]);
    expect(r2AssetEntry('warRoom.v4.runtime')).toBeNull();
    expect(r2AssetEntry('pawnSlug.matthias.motion')).toBeNull();
    expect(r2AssetUrl('home.scene.runtime', '/local.glb')).toBe('/local.glb');
  });

  it('accepts all four pinned Chronicles URLs with their percent-encoded object paths', () => {
    for (const logicalId of Object.keys(manifest.assets)) {
      expect(r2AssetUrl(logicalId, '/local')).toBe(new URL(manifest.assets[logicalId].url).href);
    }
    expect(r2AssetUrl('chronicles.music.firstVerse')).toContain('First%20verse.mp3');
  });

  it('rejects foreign hosts and mixed or tampered CDN URLs during an origin cutover', () => {
    const entry = manifest.assets['chronicles.music.firstVerse'];
    const original = entry.url;
    const parsed = new URL(original);
    const untrustedUrls = [
      `https://${parsed.hostname}.attacker.invalid${parsed.pathname}`,
      `http://${parsed.hostname}${parsed.pathname}`,
      `https://${parsed.hostname}${parsed.pathname}?v=1`,
      `https://${parsed.hostname}${parsed.pathname}#fragment`,
      `https://${parsed.hostname}/chronicles/music/other.mp3`,
      `https://guest@${parsed.hostname}${parsed.pathname}`,
    ];
    try {
      for (const url of untrustedUrls) {
        entry.url = url;
        expect(r2AssetUrl('chronicles.music.firstVerse', '/safe.mp3')).toBe('/safe.mp3');
      }
    } finally {
      entry.url = original;
    }
  });

  it('rejects foreign or traversing manifest object keys independently of the URL', () => {
    const entry = manifest.assets['chronicles.tactics.party.runtime'];
    const original = entry.key;
    try {
      for (const key of ['warRoom/scene.glb', 'chronicles/../scene.glb', 'chronicles//scene.glb']) {
        entry.key = key;
        expect(r2AssetUrl('chronicles.tactics.party.runtime', '/local.glb')).toBe('/local.glb');
      }
    } finally {
      entry.key = original;
    }
  });

  it('falls back cleanly while an asset has not migrated to R2', () => {
    expect(r2AssetEntry('pawnSlug.notMigrated')).toBeNull();
    expect(r2AssetUrl('pawnSlug.notMigrated', '/local.webp')).toBe('/local.webp');
  });

  it('rejects empty logical ids', () => {
    expect(r2AssetEntry('')).toBeNull();
    expect(r2AssetUrl('', '/safe.webp')).toBe('/safe.webp');
  });
});
