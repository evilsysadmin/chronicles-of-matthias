import { describe, expect, it } from 'vitest';
import { chroniclesNpcDialogueForState } from './chronicles/chroniclesNpcDialogue.js';
import {
  chroniclesContextualContentAction,
  chroniclesObjective,
  chroniclesReduce,
  createChroniclesState,
} from './chroniclesOfMatthias.js';

function clearedGallery(overrides = {}) {
  return {
    ...createChroniclesState('gallery-of-forks'),
    enemyHp: 0,
    jailerHp: 0,
    ...overrides,
  };
}

describe('Chronicles first-person authored content', () => {
  it('guides the Gallery through lever, relic and only then the exit', () => {
    const beforeLever = clearedGallery();
    expect(chroniclesObjective(beforeLever)).toBe('Bajar contrapeso');

    const afterLever = { ...beforeLever, galleryLeverPulled: true };
    expect(chroniclesObjective(afterLever)).toBe('Recoger reliquia de ceniza');

    const afterRelic = { ...afterLever, galleryRelicCollected: true };
    expect(chroniclesObjective(afterRelic)).toBe('Abrir salida de la galería');
  });

  it('lets first-person use a reachable front-cell mechanism before stepping onto its tile', () => {
    const beforeLever = clearedGallery({ x: 4, y: 5, direction: 1 });

    expect(chroniclesContextualContentAction(beforeLever)).toMatchObject({
      id: 'gallery-lever',
      kind: 'lever',
      label: 'Bajar contrapeso',
    });

    const pulled = chroniclesReduce(beforeLever, 'interact');
    expect(pulled.galleryLeverPulled).toBe(true);
    expect(pulled.x).toBe(4);
    expect(pulled.y).toBe(5);
  });

  it('requires the mechanism tile to be both in front and legally walkable', () => {
    const wrongFacing = clearedGallery({ x: 4, y: 5, direction: 3 });
    expect(chroniclesContextualContentAction(wrongFacing)).toBeNull();

    const blocked = clearedGallery({
      x: 4,
      y: 5,
      direction: 1,
      enemyHp: 3,
      enemyPositions: { 'fork-stalker': { x: 5, y: 5 } },
    });
    expect(chroniclesContextualContentAction(blocked)).toBeNull();
  });

  it('does not extend front-cell reach to pickups', () => {
    const beforeRelic = clearedGallery({
      x: 5,
      y: 5,
      direction: 0,
      galleryLeverPulled: true,
    });
    expect(chroniclesContextualContentAction(beforeRelic)).toBeNull();

    const onRelic = { ...beforeRelic, x: 5, y: 4 };
    expect(chroniclesContextualContentAction(onRelic)).toMatchObject({
      id: 'gallery-relic',
      kind: 'pickup',
    });
  });

  it('lets first-person activate the Gallery lever and collect the revealed relic', () => {
    const atLever = clearedGallery({ x: 5, y: 5 });
    expect(chroniclesContextualContentAction(atLever)).toMatchObject({
      id: 'gallery-lever',
      kind: 'lever',
      label: 'Bajar contrapeso',
    });

    const leverPulled = chroniclesReduce(atLever, 'interact');
    expect(leverPulled.galleryLeverPulled).toBe(true);
    expect(leverPulled.message).toContain('contrapeso');

    const atRelic = { ...leverPulled, x: 5, y: 4 };
    expect(chroniclesContextualContentAction(atRelic)).toMatchObject({
      id: 'gallery-relic',
      kind: 'pickup',
      label: 'Recoger reliquia de ceniza',
    });

    const collected = chroniclesReduce(atRelic, 'interact');
    expect(collected.galleryRelicCollected).toBe(true);
    expect(chroniclesContextualContentAction(collected)).toBeNull();
    expect(chroniclesObjective(collected)).toBe('Abrir salida de la galería');
  });
  it('does not promote optional Menagerie lore over an already-open exit', () => {
    const state = {
      ...createChroniclesState('menagerie-of-ash'),
      ashGoblinHp: 0,
      cryptSpiderHp: 0,
      boneHoundHp: 0,
    };

    expect(chroniclesObjective(state)).toBe('Cruzar hacia el Archivo del Rey Ciego');
  });


});

describe('Swordhaven town entrances remain reachable in first person', () => {
  const at = (x, y, direction) => ({ ...createChroniclesState('swordhaven-first-book'), x, y, direction });

  it('requires stepping onto the weaponsmith entrance even with a sealed letter nearby', () => {
    const street = at(7, 5, 0);
    expect(chroniclesContextualContentAction(street)?.id).not.toBe('first-book-weaponsmith');
    expect(chroniclesReduce(street, 'interact').shop).toBeUndefined();
    const before = chroniclesReduce(street, 'forward');
    expect([before.x, before.y]).toEqual([7, 4]);
    expect(chroniclesContextualContentAction(before)?.id).toBe('first-book-weaponsmith');
    const counter = chroniclesReduce(before, 'interact');
    expect(counter.shop?.id).toBe('first-book-weaponsmith');
    const bought = chroniclesReduce({ ...counter, inventory: { ...counter.inventory, 'crown-gold': { quantity: 200 } } },
      { type: 'shop-buy', itemId: 'wooden-staff' });
    expect(bought.inventory['wooden-staff']?.quantity).toBe(1);
  });

  it('opens the armorer and guild when directly facing their entrance; guild membership works from the same tile', () => {
    const armorerStreet = at(11, 5, 0);
    expect(chroniclesContextualContentAction(armorerStreet)?.id).not.toBe('first-book-armorer');
    const armorer = chroniclesReduce(armorerStreet, 'forward');
    expect([armorer.x, armorer.y]).toEqual([11, 4]);
    expect(chroniclesContextualContentAction(armorer)?.id).toBe('first-book-armorer');
    expect(chroniclesReduce(armorer, 'interact').shop?.id).toBe('first-book-armorer');
    const guild = at(15, 5, 0);
    expect(chroniclesContextualContentAction(guild)?.id).toBe('first-book-guild');
    const counter = chroniclesReduce(guild, 'interact');
    expect(counter.guild?.id).toBe('first-book-guild');
    const joined = chroniclesReduce({ ...counter, inventory: { ...counter.inventory, 'crown-gold': { quantity: 20 } } },
      { type: 'guild-join' });
    expect(joined.guildMemberships?.['first-book-guild']).toBe(true);
  });

  it('lets the party speak to Aldric, Brask and Ilse while facing the entry tile', () => {
    for (const [x, y, direction, id, name] of [
      [11, 9, 2, 'swordhaven-mayor', 'Alcalde Aldric'],
      [4, 5, 2, 'first-book-watch-house', 'Sargento Brask'],
      [14, 5, 2, 'first-book-temple', 'Sacerdotisa Ilse'],
    ]) {
      const before = at(x, y, direction);
      expect(chroniclesContextualContentAction(before)?.id).toBe(id);
      expect(chroniclesNpcDialogueForState(before, chroniclesContextualContentAction(before))?.name).toBe(name);
    }
  });

  it('keeps the mayor available to talk even after all one-shot quest actions have expired', () => {
    const finished = {
      ...at(11, 9, 2),
      swordhavenMayorMet: true, swordhavenSewersReported: true, swordhavenRouteReported: true,
    };
    const npc = chroniclesNpcDialogueForState(finished, chroniclesContextualContentAction(finished));
    expect(npc?.name).toBe('Alcalde Aldric');
    expect(npc.choices.map((choice) => choice.kind)).toEqual(['say', 'say', 'leave']);
  });

  it('lets players enter the inn for free, but only from the proper door', () => {
    const before = at(7, 9, 2);
    expect(chroniclesContextualContentAction(before)).toMatchObject({ id: 'first-book-healer', locked: false });
    const entered = chroniclesReduce(before, 'interact');
    expect(entered.inn?.id).toBe('first-book-healer');
    expect(entered.inventory).toEqual(before.inventory);
    expect(chroniclesReduce(entered, { type: 'inn-rest' }).message).toMatch(/cuesta|oro/i);
    expect(chroniclesContextualContentAction(at(7, 8, 2))).toBeNull();
    expect(chroniclesContextualContentAction(at(11, 5, 1))).toBeNull();
  });
});
