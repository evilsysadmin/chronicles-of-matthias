import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import spriteManifest from '../assets/chronicles/sprites/sprites.json';
import { buildChroniclesEnemyVisual } from '../chroniclesEnemyVisualRegistry.js';
import {
  chroniclesHasSpriteBillboard,
  chroniclesGoblinR2Url,
  chroniclesGoblinR2AtlasValid,
  CHRONICLES_ASH_GOBLIN_R2_FRAMES,
  CHRONICLES_ASH_GOBLIN_R2_URL,
  chroniclesSpriteFrameIndex,
} from './chroniclesSpriteBillboards.js';
import {
  buildChroniclesRemoteSpiderBillboard,
  chroniclesSpiderR2Url,
  chroniclesSpiderAtlasValid,
  chroniclesSpiderFrameIndex,
  CHRONICLES_SEWER_SPIDER_R2_URL,
  CHRONICLES_SEWER_SPIDER_FRAMES,
} from './chroniclesRemoteSpiderSprite.js';

describe('Chronicles 2.5D billboards', () => {
  it('ships sheets for the bone hound and Edda with the frames the runtime asks for', () => {
    expect(spriteManifest['bone-hound'].frames).toEqual(['idle-a', 'idle-b', 'menace', 'attack', 'hurt', 'dead']);
    expect(spriteManifest['rookwood-mourner'].frames).toEqual(['idle-a', 'idle-b', 'speak', 'grateful']);
    expect(chroniclesHasSpriteBillboard('bone-hound')).toBe(true);
    expect(chroniclesHasSpriteBillboard('crypt-spider')).toBe(false);
  });

  it('validates the six-pose remote goblin and rejects private dashboard URLs or invalid sheets', () => {
    expect(CHRONICLES_ASH_GOBLIN_R2_FRAMES).toEqual(['idle-a', 'idle-b', 'menace', 'attack', 'hurt', 'dead']);
    expect(CHRONICLES_ASH_GOBLIN_R2_URL).toBe(
      'https://assets.chronicles.shadowops.dpdns.org/sprites/ash-goblin-96ed70aafe94827f.webp',
    );
    expect(chroniclesGoblinR2Url(CHRONICLES_ASH_GOBLIN_R2_URL)).toBe(CHRONICLES_ASH_GOBLIN_R2_URL);
    expect(chroniclesGoblinR2Url('https://assets.example.org/sprites/ash-goblin.webp')).toBeNull();
    expect(chroniclesGoblinR2Url(CHRONICLES_ASH_GOBLIN_R2_URL + '?rev=2')).toBeNull();
    expect(chroniclesGoblinR2Url('https://dash.cloudflare.com/example/r2/default/buckets/chronicles/objects/sprites%2Fash-goblin.webp/details'))
      .toBeNull();
    expect(chroniclesGoblinR2Url('http://assets.example.org/sprites/ash-goblin.webp')).toBeNull();
    expect(chroniclesGoblinR2Url('https://assets.example.org/sprites/other.webp')).toBeNull();
    expect(chroniclesGoblinR2AtlasValid({ width: 1536, height: 256 })).toBe(true);
    expect(chroniclesGoblinR2AtlasValid({ width: 1280, height: 256 })).toBe(false);
    expect(chroniclesGoblinR2AtlasValid(null)).toBe(false);
    expect(chroniclesSpriteFrameIndex(CHRONICLES_ASH_GOBLIN_R2_FRAMES, { menace: true })).toBe(2);
    expect(chroniclesSpriteFrameIndex(CHRONICLES_ASH_GOBLIN_R2_FRAMES, { attacking: true })).toBe(3);
    expect(chroniclesSpriteFrameIndex(CHRONICLES_ASH_GOBLIN_R2_FRAMES, { hurt: true })).toBe(4);
    expect(chroniclesSpriteFrameIndex(CHRONICLES_ASH_GOBLIN_R2_FRAMES, { dead: true })).toBe(5);
  });

  it('retains the local five-frame goblin and procedural Tactics representation as fallback', () => {
    const billboard = buildChroniclesEnemyVisual('ash-goblin', { sprites: true });
    expect(billboard.model.userData.chroniclesBillboard.frames).toEqual(spriteManifest['ash-goblin'].frames);
    expect(buildChroniclesEnemyVisual('ash-goblin').model.userData.chroniclesBillboard).toBeUndefined();
    billboard.model.userData.chroniclesDispose();
  });

  it('orders cues dead > hurt > attack > menace, and alternates idle frames over time', () => {
    const frames = spriteManifest['bone-hound'].frames;
    expect(chroniclesSpriteFrameIndex(frames, { dead: true, hurt: true })).toBe(5);
    expect(chroniclesSpriteFrameIndex(frames, { hurt: true, attacking: true, menace: true })).toBe(4);
    expect(chroniclesSpriteFrameIndex(frames, { attacking: true, menace: true })).toBe(3);
    expect(chroniclesSpriteFrameIndex(frames, { menace: true })).toBe(2);
    const edda = spriteManifest['rookwood-mourner'].frames;
    expect(chroniclesSpriteFrameIndex(edda, { grateful: true, speaking: true })).toBe(3);
    expect(chroniclesSpriteFrameIndex(edda, { speaking: true })).toBe(2);
    // Cues a sheet lacks fall back to idle.
    expect(chroniclesSpriteFrameIndex(edda, { menace: true, time: 0 })).toBe(0);
    expect(chroniclesSpriteFrameIndex(frames, { time: 0, idleFps: 2 })).toBe(0);
    expect(chroniclesSpriteFrameIndex(frames, { time: 0.6, idleFps: 2 })).toBe(1);
  });

  it('uses a billboard only when first-person asks and keeps 3D models as fallback', () => {
    const billboard = buildChroniclesEnemyVisual('bone-hound', { sprites: true });
    expect(billboard.model.userData.chroniclesBillboard?.visualType).toBe('bone-hound');
    expect(typeof billboard.model.userData.updateChroniclesSprite).toBe('function');
    expect(buildChroniclesEnemyVisual('bone-hound').model.userData.chroniclesBillboard).toBeUndefined();
    const spider = buildChroniclesEnemyVisual('crypt-spider', { sprites: true });
    expect(spider.model.userData.chroniclesBillboard?.visualType).toBe('crypt-spider');
    expect(spider.model.children.length).toBeGreaterThanOrEqual(2); // full 3D fallback + hidden premium sprite
    expect(buildChroniclesEnemyVisual('crypt-spider').model.userData.chroniclesBillboard).toBeUndefined();
    spider.model.userData.chroniclesDispose?.();
  });
});

describe('procedural placeholder creatures', () => {
  it('every procedural sprite has a packed sheet and a 3D fallback for Tactics', async () => {
    const procedural = (await import('../../../scripts/art/chronicles_sprites/procedural-sprites.json')).default;
    const { chroniclesEnemyVisualSpec } = await import('../chroniclesEnemyVisualRegistry.js');
    expect(procedural.sprites.length).toBeGreaterThanOrEqual(5);
    // Creatures fight (attack/hurt/dead frames + a Tactics model); the
    // final act's NPCs (a king of stone, an empty throne) only idle.
    const npcs = new Set(['stone-king', 'empty-throne']);
    npcs.forEach((id) => {
      expect(chroniclesHasSpriteBillboard(id), id).toBe(true);
      expect(spriteManifest[id].frames, id).toEqual(['idle-a', 'idle-b']);
    });
    procedural.sprites.filter((id) => !npcs.has(id)).forEach((id) => {
      expect(chroniclesHasSpriteBillboard(id), id).toBe(true);
      expect(spriteManifest[id].frames, id).toEqual(['idle-a', 'idle-b', 'attack', 'hurt', 'dead']);
      expect(chroniclesEnemyVisualSpec(id), id).not.toBeNull();
    });
  });
});

describe('premium sewer spider · approved eight-pose R2 atlas', () => {
  it('uses a versioned, public HTTPS asset path; rejects dashboard, mutable or wrong files', () => {
    expect(CHRONICLES_SEWER_SPIDER_R2_URL).toBe(
      'https://assets.chronicles.shadowops.dpdns.org/sprites/sewer-spider-4e1324b3827c789a.webp',
    );
    expect(chroniclesSpiderR2Url(CHRONICLES_SEWER_SPIDER_R2_URL)).toBe(CHRONICLES_SEWER_SPIDER_R2_URL);
    for (const invalid of [
      'https://dash.cloudflare.com/account/r2/default/buckets/chronicles/objects/sprites/sewer-spider.webp',
      'http://assets.chronicles.shadowops.dpdns.org/sprites/sewer-spider-4e1324b3827c789a.webp',
      'https://assets.chronicles.shadowops.dpdns.org/sprites/sewer-spider.webp',
      CHRONICLES_SEWER_SPIDER_R2_URL + '?cache=0',
      'https://example.org/sprites/sewer-spider-4e1324b3827c789a.webp',
    ]) expect(chroniclesSpiderR2Url(invalid)).toBeNull();
    expect(chroniclesSpiderAtlasValid({ width: 2560, height: 320 })).toBe(true);
    expect(chroniclesSpiderAtlasValid({ width: 2560, height: 400 })).toBe(false);
    expect(chroniclesSpiderAtlasValid({ width: 1280, height: 320 })).toBe(false);
  });

  it('has three distinct walking poses and explicit attack, hurt and dead with priority', () => {
    expect(CHRONICLES_SEWER_SPIDER_FRAMES).toEqual([
      'idle-a', 'idle-b', 'walk-a', 'walk-b', 'walk-c', 'attack', 'hurt', 'dead',
    ]);
    expect([0, 0.12, 0.24].map(time => chroniclesSpiderFrameIndex({ moving: true, time })))
      .toEqual([2, 3, 4]);
    expect(chroniclesSpiderFrameIndex({ moving: true, hurt: true, time: 0.2 })).toBe(6);
    expect(chroniclesSpiderFrameIndex({ moving: true, attacking: true, time: 0.2 })).toBe(5);
    expect(chroniclesSpiderFrameIndex({ dead: true, hurt: true, attacking: true })).toBe(7);
    expect(chroniclesSpiderFrameIndex({ reducedMotion: true, moving: true })).toBe(0);
    expect(chroniclesSpiderFrameIndex({ reducedMotion: true, hurt: true })).toBe(6);
    expect(chroniclesSpiderFrameIndex({ reducedMotion: true, dead: true })).toBe(7);
  });

  it('keeps real procedural spider fully visible until a validated R2 image loads', () => {
    const oldModel = new THREE.Group();
    const result = buildChroniclesRemoteSpiderBillboard(oldModel);
    expect(result.children).toContain(oldModel);
    expect(oldModel.visible).toBe(true);
    const premiumSprite = result.userData.chroniclesBillboard.sprite;
    expect(premiumSprite.visible).toBe(false);
    expect(typeof result.userData.updateChroniclesSprite).toBe('function');
    expect(typeof result.userData.setChroniclesSpriteOpacity).toBe('function');
    result.userData.updateChroniclesSprite(0.35, { moving: true });
    result.userData.chroniclesDispose();
  });
});
