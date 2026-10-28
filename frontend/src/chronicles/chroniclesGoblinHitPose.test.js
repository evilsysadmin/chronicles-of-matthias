import { describe, expect, it } from 'vitest';
import {
  chroniclesGoblinHitPose,
  CHRONICLES_GOBLIN_HURT_SECONDS,
  CHRONICLES_GOBLIN_LETHAL_HURT_SECONDS,
} from './chroniclesGoblinHitPose.js';

describe('Chronicles goblin damage reaction', () => {
  it('holds a visible pain pose after nonlethal HP loss then returns to combat', () => {
    expect(chroniclesGoblinHitPose({ hitElapsed: 0, hp: 6 })).toEqual({ hurt: true, dead: false });
    expect(chroniclesGoblinHitPose({ hitElapsed: CHRONICLES_GOBLIN_HURT_SECONDS - 0.01, hp: 2 }).hurt).toBe(true);
    expect(chroniclesGoblinHitPose({ hitElapsed: CHRONICLES_GOBLIN_HURT_SECONDS, hp: 2 })).toEqual({ hurt: false, dead: false });
  });

  it('plays hurt before the dead frame for a fatal hit', () => {
    expect(chroniclesGoblinHitPose({ hitElapsed: 0.15, deathElapsed: 0.15, hp: 0 })).toEqual({ hurt: true, dead: false });
    expect(chroniclesGoblinHitPose({ hitElapsed: CHRONICLES_GOBLIN_LETHAL_HURT_SECONDS, deathElapsed: 0.30, hp: 0 }))
      .toEqual({ hurt: false, dead: true });
  });

  it('never produces pain after a miss, healing or initial spawn', () => {
    expect(chroniclesGoblinHitPose()).toEqual({ hurt: false, dead: false });
    expect(chroniclesGoblinHitPose({ hitElapsed: -1, hp: 4 })).toEqual({ hurt: false, dead: false });
    expect(chroniclesGoblinHitPose({ hitElapsed: Number.POSITIVE_INFINITY, hp: 4 })).toEqual({ hurt: false, dead: false });
  });
});
