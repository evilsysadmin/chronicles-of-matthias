import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { buildChroniclesEnemyVisual } from '../chroniclesEnemyVisualRegistry.js';
import {
  buildChroniclesRemoteSmugglerBillboard,
  chroniclesSmugglerR2Url,
  chroniclesSmugglerAtlasValid,
  chroniclesSmugglerFrameIndex,
  CHRONICLES_SMUGGLER_FRAMES,
  CHRONICLES_SMUGGLER_R2_URL,
} from './chroniclesRemoteSmugglerSprite.js';

describe('premium sewer smuggler 8-frame atlas', () => {
  it('pins an immutable and validated HTTPS R2 location', () => {
    expect(CHRONICLES_SMUGGLER_R2_URL).toBe(
      'https://assets.chronicles.shadowops.dpdns.org/sprites/sewer-smuggler-f90352c98469f3b3.webp',
    );
    expect(chroniclesSmugglerR2Url(CHRONICLES_SMUGGLER_R2_URL)).toBe(CHRONICLES_SMUGGLER_R2_URL);
    for (const bad of [
      'http://assets.chronicles.shadowops.dpdns.org/sprites/sewer-smuggler-f90352c98469f3b3.webp',
      CHRONICLES_SMUGGLER_R2_URL + '?cache=0',
      'https://dash.cloudflare.com/sprites/sewer-smuggler-f90352c98469f3b3.webp',
      'https://assets.chronicles.shadowops.dpdns.org/sprites/sewer-smuggler.webp',
      'https://evil.example/sprites/sewer-smuggler-f90352c98469f3b3.webp',
    ]) expect(chroniclesSmugglerR2Url(bad)).toBeNull();
    expect(chroniclesSmugglerAtlasValid({ width: 2560, height: 320 })).toBe(true);
    expect(chroniclesSmugglerAtlasValid({ width: 1280, height: 320 })).toBe(false);
    expect(chroniclesSmugglerAtlasValid({ width: 2560, height: 256 })).toBe(false);
  });

  it('provides 3 walk frames, attack, hurt and dead with correct priority', () => {
    expect(CHRONICLES_SMUGGLER_FRAMES).toEqual([
      'idle-a', 'idle-b', 'walk-a', 'walk-b', 'walk-c', 'attack', 'hurt', 'dead',
    ]);
    expect([0, .12, .24].map(time => chroniclesSmugglerFrameIndex({ moving: true, time })))
      .toEqual([2, 3, 4]);
    expect(chroniclesSmugglerFrameIndex({ moving: true, attacking: true })).toBe(5);
    expect(chroniclesSmugglerFrameIndex({ attacking: true, hurt: true })).toBe(6);
    expect(chroniclesSmugglerFrameIndex({ attacking: true, hurt: true, dead: true })).toBe(7);
    expect(chroniclesSmugglerFrameIndex({ moving: true, reducedMotion: true })).toBe(0);
    expect(chroniclesSmugglerFrameIndex({ hurt: true, reducedMotion: true })).toBe(6);
  });

  it('keeps the existing 5-frame bandit visible while R2 is unavailable', () => {
    const update = vi.fn();
    const opacity = vi.fn();
    const dispose = vi.fn();
    const fallback = new THREE.Group();
    fallback.userData.updateChroniclesSprite = update;
    fallback.userData.setChroniclesSpriteOpacity = opacity;
    fallback.userData.chroniclesDispose = dispose;
    const actor = buildChroniclesRemoteSmugglerBillboard(fallback);
    expect(actor.children[0]).toBe(fallback);
    expect(fallback.visible).toBe(true);
    expect(actor.userData.chroniclesBillboard.visualType).toBe('road-bandit');
    expect(actor.userData.chroniclesBillboard.sprite.visible).toBe(false);
    actor.userData.updateChroniclesSprite(0.2, { moving: true });
    expect(update).toHaveBeenCalledWith(0.2, { moving: true });
    actor.userData.setChroniclesSpriteOpacity(0.5);
    expect(opacity).toHaveBeenCalledWith(0.5);
    actor.userData.chroniclesDispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('uses premium only in first person; Tactics keeps its normal 3D model', () => {
    const firstPerson = buildChroniclesEnemyVisual('road-bandit', { sprites: true });
    const tactics = buildChroniclesEnemyVisual('road-bandit', {});
    expect(firstPerson.model.userData.chroniclesBillboard?.visualType).toBe('road-bandit');
    expect(firstPerson.model.children[0].userData.chroniclesBillboard?.visualType).toBe('road-bandit');
    expect(tactics.model.userData.chroniclesBillboard).toBeUndefined();
    firstPerson.model.userData.chroniclesDispose();
  });
});
