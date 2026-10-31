import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

// A small cross-floor attrition contract. The three authored campaign floors
// are visited in order; only the spell actions consume turns or PH. A door
// and an API checkpoint must not heal the party or replenish spell points.
describe('MM3 dungeon progression · cross-floor healing budget', () => {
  it('carries real First Aid expenditure through a checkpoint and two deeper floors', () => {
    const fresh = createChroniclesState('gallery-of-forks', null, { rules: 'mm3' });
    const rook = fresh.party.find(({ id }) => id === 'rook');
    const wounded = {
      ...fresh,
      party: fresh.party.map((member) => member.id === 'rook'
        ? { ...member, hp: Math.max(1, member.maxHp - 7) }
        : member),
      spellPoints: { ...fresh.spellPoints, bishop: 2 },
    };
    const caster = (state) => state.party.find(({ id }) => id === 'bishop');
    const target = (state) => state.party.find(({ id }) => id === 'rook');
    const firstAid = { type: 'cast', memberId: 'bishop', spellId: 'first-aid', targetId: 'rook' };

    expect(chroniclesMemberSp(wounded, caster(wounded))).toBe(2);
    const firstCast = chroniclesReduce(wounded, firstAid);
    expect(firstCast.turns).toBe(wounded.turns + 1);
    expect(target(firstCast).hp).toBe(Math.min(rook.maxHp, target(wounded).hp + 6));
    expect(chroniclesMemberSp(firstCast, caster(firstCast))).toBe(1);

    const secondFloor = chroniclesMapTransitionState(firstCast, 'menagerie-of-ash');
    expect(secondFloor.phase).toBe('explore');
    expect(secondFloor.initiative).toBeNull();
    expect(secondFloor.turns).toBe(firstCast.turns);
    expect(secondFloor.party).toEqual(firstCast.party);
    expect(chroniclesMemberSp(secondFloor, caster(secondFloor))).toBe(1);

    // Exercise the same bounded projection that goes to Go/Mongo, rather than
    // a mere JSON clone of the live reducer state.
    const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(secondFloor, 1)));
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('menagerie-of-ash', null, { rules: 'mm3' }), payload,
    );
    expect(restored.mapId).toBe('menagerie-of-ash');
    expect(restored.turns).toBe(secondFloor.turns);
    expect(restored.party.map(({ id, hp }) => [id, hp]))
      .toEqual(secondFloor.party.map(({ id, hp }) => [id, hp]));
    expect(chroniclesMemberSp(restored, caster(restored))).toBe(1);

    const secondCast = chroniclesReduce(restored, firstAid);
    expect(secondCast.turns).toBe(restored.turns + 1);
    expect(target(secondCast).hp).toBe(Math.min(rook.maxHp, target(restored).hp + 6));
    expect(chroniclesMemberSp(secondCast, caster(secondCast))).toBe(0);

    const thirdFloor = chroniclesMapTransitionState(secondCast, 'blind-king-archive');
    expect(thirdFloor.mapId).toBe('blind-king-archive');
    expect(thirdFloor.party.map(({ id, hp }) => [id, hp]))
      .toEqual(secondCast.party.map(({ id, hp }) => [id, hp]));
    expect(thirdFloor.turns).toBe(secondCast.turns);
    expect(chroniclesMemberSp(thirdFloor, caster(thirdFloor))).toBe(0);

    // Exhausted PH cannot become a free third heal after descending.
    const refused = chroniclesReduce(thirdFloor, firstAid);
    expect(refused.turns).toBe(thirdFloor.turns);
    expect(target(refused).hp).toBe(target(thirdFloor).hp);
    expect(chroniclesMemberSp(refused, caster(refused))).toBe(0);
  });
});
