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

  it('falls back cleanly while an asset has not migrated to R2', () => {
    expect(r2AssetEntry('pawnSlug.notMigrated')).toBeNull();
    expect(r2AssetUrl('pawnSlug.notMigrated', '/local.webp')).toBe('/local.webp');
  });

  it('rejects empty logical ids', () => {
    expect(r2AssetEntry('')).toBeNull();
    expect(r2AssetUrl('', '/safe.webp')).toBe('/safe.webp');
  });
});
