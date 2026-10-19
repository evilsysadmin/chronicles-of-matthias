import { describe, expect, it } from 'vitest';
import {
  chroniclesActiveEnemies,
  chroniclesOpeningVolleyShots,
  chroniclesReduce,
  createChroniclesState,
} from '../chroniclesOfMatthias.js';
import { chroniclesVolleyPresentationShooterIds } from './chroniclesVolleyPresentation.js';
import { chroniclesVolleyProjectileKinds } from './chroniclesVolleyProjectileArt.js';
import { chroniclesActionAudioCue } from './chroniclesActionAudio.js';

function readyParty() {
  const initial = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  return {
    ...initial, x: 10, y: 5, direction: 1,
    equipment: {
      matthias: { weapon: 'bronze-sword', missile: 'wooden-bow' },
      rook: { weapon: 'bronze-mace', missile: 'bronze-crossbow' },
      knight: { weapon: 'bronze-dagger', missile: 'wooden-sling' },
      bishop: { weapon: 'bronze-mace', missile: 'wooden-bow' },
    },
  };
}
function emptyCorridor(party) {
  return {
    ...party,
    ...Object.fromEntries(chroniclesActiveEnemies(party).map((enemy) => [enemy.hpKey, 0])),
  };
}

describe('Chronicles S · visible pre-contact shots even without a target (#134)', () => {
  it('shows one visual projectile for each living, legal armed hero into empty space', () => {
    const empty = emptyCorridor(readyParty());
    expect(chroniclesOpeningVolleyShots(empty).shots).toEqual([]);
    expect(chroniclesVolleyPresentationShooterIds(empty))
      .toEqual(['matthias', 'rook', 'knight']);
    expect(chroniclesVolleyProjectileKinds(empty, chroniclesVolleyPresentationShooterIds(empty)))
      .toEqual(['bow', 'crossbow', 'sling']);
    const resolved = chroniclesReduce(empty, { type: 'volley' });
    expect(resolved.message).toBe('');
    expect(resolved.turns).toBe(empty.turns + 1);
    expect(chroniclesActionAudioCue(empty, resolved, 'volley'))
      .toBe('volley:bow,crossbow,sling');
  });

  it('keeps real target range: visual count mirrors the actual resolved shots', () => {
    const party = readyParty();
    const result = chroniclesOpeningVolleyShots(party);
    expect(result.target).toBeTruthy();
    expect(chroniclesVolleyPresentationShooterIds(party))
      .toEqual(result.shots.map(({ memberId }) => memberId));
  });

  it('never renders shots for class-illegal arms, fallen heroes or unarmed companies', () => {
    const empty = emptyCorridor(readyParty());
    const fallen = {
      ...empty,
      party: empty.party.map((member) => member.id === 'rook' ? { ...member, hp: 0 } : member),
    };
    expect(chroniclesVolleyPresentationShooterIds(fallen))
      .toEqual(['matthias', 'knight']);
    const unarmed = { ...empty, equipment: { bishop: { missile: 'wooden-bow' } } };
    expect(chroniclesVolleyPresentationShooterIds(unarmed)).toEqual([]);
    expect(chroniclesActionAudioCue(unarmed, chroniclesReduce(unarmed, 'volley'), 'volley'))
      .toBeNull();
    expect(chroniclesVolleyPresentationShooterIds({ ...empty, initiative: { order: [] } }))
      .toEqual([]);
    expect(chroniclesVolleyPresentationShooterIds({ ...empty, phase: 'defeated' })).toEqual([]);
  });
});
