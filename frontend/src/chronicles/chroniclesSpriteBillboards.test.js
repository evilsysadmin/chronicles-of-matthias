import { describe, expect, it } from 'vitest';
import spriteManifest from '../assets/chronicles/sprites/sprites.json';
import { buildChroniclesEnemyVisual } from '../chroniclesEnemyVisualRegistry.js';
import {
  chroniclesHasSpriteBillboard,
  chroniclesGoblinR2Url,
  chroniclesGoblinR2AtlasValid,
  CHRONICLES_ASH_GOBLIN_R2_FRAMES,
  chroniclesSpriteFrameIndex,
} from './chroniclesSpriteBillboards.js';

describe('Chronicles 2.5D billboards', () => {
  it('ships sheets for the bone hound and Edda with the frames the runtime asks for', () => {
    expect(spriteManifest['bone-hound'].frames).toEqual(['idle-a', 'idle-b', 'menace', 'attack', 'hurt', 'dead']);
    expect(spriteManifest['rookwood-mourner'].frames).toEqual(['idle-a', 'idle-b', 'speak', 'grateful']);
    expect(chroniclesHasSpriteBillboard('bone-hound')).toBe(true);
    expect(chroniclesHasSpriteBillboard('crypt-spider')).toBe(false);
  });

  it('validates the six-pose remote goblin and rejects private dashboard URLs or invalid sheets', () => {
    expect(CHRONICLES_ASH_GOBLIN_R2_FRAMES).toEqual(['idle-a', 'idle-b', 'menace', 'attack', 'hurt', 'dead']);
    expect(chroniclesGoblinR2Url('https://assets.example.org/sprites/ash-goblin.webp'))
      .toBe('https://assets.example.org/sprites/ash-goblin.webp');
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
    expect(buildChroniclesEnemyVisual('crypt-spider', { sprites: true }).model.userData.chroniclesBillboard).toBeUndefined();
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
