import { describe, expect, it } from 'vitest';
import { chroniclesActionAudioCue } from './chroniclesActionAudio.js';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';

describe('Chronicles action audio cues', () => {
  it('distinguishes movement, turning and blocked movement from real state transitions', () => {
    const start = createChroniclesState();
    const moved = chroniclesReduce(start, 'forward');
    expect(chroniclesActionAudioCue(start, moved, 'forward')).toBe('step');

    const turned = chroniclesReduce(start, 'turn-left');
    expect(chroniclesActionAudioCue(start, turned, 'turn-left')).toBe('turn');

    const wallState = { ...start, x: 1, y: 1, direction: 0 };
    const blocked = chroniclesReduce(wallState, 'forward');
    expect(chroniclesActionAudioCue(wallState, blocked, 'forward')).toBe('blocked');
  });

  it('distinguishes misses, hits, retaliation and defeats from actual HP changes', () => {
    const start = createChroniclesState();
    const miss = chroniclesReduce(start, { type: 'attack', memberId: 'matthias' });
    expect(chroniclesActionAudioCue(start, miss, { type: 'attack', memberId: 'matthias' })).toBe('miss');

    const rangedHit = chroniclesReduce(start, { type: 'attack', memberId: 'bishop' });
    expect(chroniclesActionAudioCue(start, rangedHit, { type: 'attack', memberId: 'bishop' })).toBe('hit');

    const close = chroniclesReduce(start, 'forward');
    const retaliation = chroniclesReduce(close, { type: 'attack', memberId: 'rook' });
    expect(chroniclesActionAudioCue(close, retaliation, { type: 'attack', memberId: 'rook' })).toBe('retaliation');

    const almostDead = { ...close, enemyHp: 1 };
    const defeated = chroniclesReduce(almostDead, { type: 'attack', memberId: 'matthias' });
    expect(chroniclesActionAudioCue(almostDead, defeated, { type: 'attack', memberId: 'matthias' })).toBe('defeat');
  });

  it('sounds one missile per actual MM3 shooter and differentiates bows, crossbows and slings', () => {
    const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
    const party = { ...base, x: 10, y: 5, direction: 1 };
    const equipped = {
      ...party,
      equipment: {
        matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
        rook: { weapon: 'bronze-mace', missile: 'bronze-crossbow' },
        knight: { weapon: 'bronze-dagger', missile: 'wooden-sling' },
        bishop: { weapon: 'bronze-mace', missile: 'wooden-bow' },
      },
    };
    const shot = chroniclesReduce(equipped, 'volley');
    // The cleric's forged invalid bow is correctly ignored.
    expect(chroniclesActionAudioCue(equipped, shot, 'volley')).toBe('volley:bow,crossbow,sling');
    expect(chroniclesActionAudioCue(equipped, shot, { type: 'volley' })).toBe('volley:bow,crossbow,sling');
    const noArrows = { ...equipped, equipment: {} };
    expect(chroniclesActionAudioCue(noArrows, chroniclesReduce(noArrows, 'volley'), 'volley')).toBeNull();
  });

  it('gives spells, healing and blows on the company their own sounds', () => {
    const start = createChroniclesState();
    const hurtParty = { ...start, party: start.party.map((member, index) => index === 0 ? { ...member, hp: member.hp - 2 } : member) };
    const healedParty = { ...start, party: start.party.map((member) => ({ ...member, hp: member.hp + 1 })) };
    const hitEnemy = { ...start, enemyHp: Number(start.enemyHp || 3) - 1 };
    const cast = { type: 'cast', spellId: 'x' };
    expect(chroniclesActionAudioCue(start, hitEnemy, cast)).toBe('spell-hit');
    expect(chroniclesActionAudioCue(start, healedParty, cast)).toBe('heal');
    expect(chroniclesActionAudioCue(start, { ...start, message: 'Brilla.' }, cast)).toBe('spell');
    expect(chroniclesActionAudioCue(start, start, cast)).toBeNull();
    // A trap or an enemy turn while walking or waiting.
    expect(chroniclesActionAudioCue(start, { ...hurtParty, x: start.x + 1 }, 'forward')).toBe('hurt');
    expect(chroniclesActionAudioCue(start, hurtParty, 'wait')).toBe('hurt');
  });
});
