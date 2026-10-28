import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesEnemyVisual } from '../chroniclesEnemyVisualRegistry.js';
import {
  CHRONICLES_OVERWORLD_FRAMES,
  chroniclesOverworldSpriteSpec,
  chroniclesOverworldSpriteR2Url,
  chroniclesOverworldAtlasValid,
  chroniclesOverworldFrameIndex,
  buildChroniclesRemoteOverworldBillboard,
} from './chroniclesRemoteOverworldSprite.js';

const assets = [["dire-wolf","801e6d33ddbec52f"],["bandit-archer","21ac68ee50536c53"],["harpy","5bb6e2c854cc9477"],["troll","70685b89d7e8b264"],["skeleton","a393c5251b4bcd4f"],["ghoul","3bc9ee598b9a92f0"],["silent-acolyte","a4ea19664dff0fc0"],["orc-raider","9bb642b3c535be6e"]];

describe('Chronicles premium overworld enemies', () => {
  it.each(assets)('%s has a pinned, safe R2 URL and eight valid cells', (type, hash) => {
    const url = `https://assets.chronicles.shadowops.dpdns.org/sprites/${type}-${hash}.webp`;
    expect(chroniclesOverworldSpriteSpec(type).url).toBe(url);
    expect(chroniclesOverworldSpriteR2Url(type, url)).toBe(url);
    for (const invalid of [
      'http:' + url.slice(6), url + '?v=2',
      'https://dash.cloudflare.com/sprites/' + type + '-' + hash + '.webp',
      'https://evil.example/sprites/' + type + '-' + hash + '.webp',
      'https://assets.chronicles.shadowops.dpdns.org/sprites/' + type + '.webp',
    ]) expect(chroniclesOverworldSpriteR2Url(type, invalid)).toBeNull();
    expect(chroniclesOverworldSpriteR2Url('not-real', url)).toBeNull();
    expect(chroniclesOverworldAtlasValid({ width: 2560, height: 320 })).toBe(true);
    expect(chroniclesOverworldAtlasValid({ width: 2048, height: 320 })).toBe(false);
    expect(chroniclesOverworldAtlasValid({ width: 2560, height: 256 })).toBe(false);
  });

  it('preserves walk, attack, hurt, dead priorities and reduced motion', () => {
    expect(CHRONICLES_OVERWORLD_FRAMES).toEqual([
      'idle-a', 'idle-b', 'walk-a', 'walk-b', 'walk-c', 'attack', 'hurt', 'dead',
    ]);
    expect([0, 0.12, 0.24].map(time => chroniclesOverworldFrameIndex({ moving: true, time })))
      .toEqual([2, 3, 4]);
    expect(chroniclesOverworldFrameIndex({ attacking: true, moving: true })).toBe(5);
    expect(chroniclesOverworldFrameIndex({ attacking: true, hurt: true })).toBe(6);
    expect(chroniclesOverworldFrameIndex({ dead: true, attacking: true, hurt: true })).toBe(7);
    expect(chroniclesOverworldFrameIndex({ moving: true, reducedMotion: true })).toBe(0);
    expect(chroniclesOverworldFrameIndex({ hurt: true, reducedMotion: true })).toBe(6);
  });

  it('passes cues, opacity and disposal to the visible fallback until R2 decodes', () => {
    const fallback = new THREE.Group();
    const update = vi.fn();
    const opacity = vi.fn();
    const dispose = vi.fn();
    fallback.userData.updateChroniclesSprite = update;
    fallback.userData.setChroniclesSpriteOpacity = opacity;
    fallback.userData.chroniclesDispose = dispose;
    const actor = buildChroniclesRemoteOverworldBillboard('dire-wolf', fallback);
    expect(actor.children[0]).toBe(fallback);
    expect(fallback.visible).toBe(true);
    expect(actor.userData.chroniclesBillboard.sprite.visible).toBe(false);
    actor.userData.updateChroniclesSprite(0.12, { moving: true });
    expect(update).toHaveBeenCalledWith(0.12, { moving: true });
    actor.userData.setChroniclesSpriteOpacity(0.4);
    expect(opacity).toHaveBeenCalledWith(0.4);
    actor.userData.chroniclesDispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('keeps a 3D orc visible until its first-person R2 atlas decodes', () => {
    const firstPerson = buildChroniclesEnemyVisual('orc-raider', { sprites: true });
    const tactics = buildChroniclesEnemyVisual('orc-raider', {});
    expect(firstPerson.model.userData.chroniclesBillboard?.visualType).toBe('orc-raider');
    expect(firstPerson.model.children[0].visible).toBe(true);
    expect(firstPerson.model.children[0].userData.chroniclesBillboard).toBeUndefined();
    expect(firstPerson.model.userData.chroniclesBillboard.sprite.visible).toBe(false);
    expect(tactics.model.userData.chroniclesBillboard).toBeUndefined();
    firstPerson.model.userData.chroniclesDispose();
  });

  it.each(assets.filter(([type]) => type !== 'orc-raider'))('%s uses premium only in first person, keeping Tactics 3D', (type) => {
    const firstPerson = buildChroniclesEnemyVisual(type, { sprites: true });
    const tactics = buildChroniclesEnemyVisual(type, {});
    expect(firstPerson.model.userData.chroniclesBillboard.visualType).toBe(type);
    expect(firstPerson.model.children[0].userData.chroniclesBillboard.visualType).toBe(type);
    expect(tactics.model.userData.chroniclesBillboard).toBeUndefined();
    firstPerson.model.userData.chroniclesDispose();
  });
});
