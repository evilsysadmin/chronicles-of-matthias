import { describe, expect, it } from 'vitest';
import { chroniclesContextualContentAction, chroniclesObjective, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsInteractions, chroniclesTacticsUse } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesGoldBalance, chroniclesInventoryEntries, chroniclesQuestEntries } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const QUEST = 'names-in-wood';
const PLAQUE = 'rookwood-name-plaque';
// Facing: 0 north, 1 east, 2 south, 3 west.
const face = (state, x, y, direction) => ({ ...state, x, y, direction });
const interact = (state) => chroniclesReduce(state, 'interact');

function enterRookwood() {
  let state = createChroniclesState('banner-road-first-book');
  state = chroniclesTacticsUse({ ...state, x: 19, y: 10 }, 'to-banner-road-rookwood');
  return state;
}

function collectPlaques(state) {
  let next = interact(face(state, 5, 4, 0));
  next = interact(face(next, 17, 1, 1));
  // The den plaque sits behind an optional hound; remove it for the loot path.
  next = interact(face({ ...next, rookwoodHoundHp: 0 }, 19, 12, 2));
  return next;
}

describe('Chronicles first book · Rookwood side quest «Los nombres del bosque»', () => {
  it('opens Rookwood from Banner Road with a reciprocal return road', () => {
    const road = chroniclesMapById('banner-road-first-book');
    const wood = chroniclesMapById('rookwood-first-book');
    expect(wood.regionKind).toBe('wilderness');
    expect(road.exits.find((exit) => exit.id === 'to-banner-road-rookwood').action.effects[0]).toMatchObject({
      type: 'transition-map', mapId: wood.id, entryExitId: 'to-rookwood-banner-road',
    });

    let state = enterRookwood();
    expect(state.mapId).toBe('rookwood-first-book');
    expect({ x: state.x, y: state.y }).toEqual({ x: 1, y: 7 });
    state = chroniclesTacticsUse(state, 'to-rookwood-banner-road');
    expect(state.mapId).toBe('banner-road-first-book');
    expect({ x: state.x, y: state.y }).toEqual({ x: 19, y: 10 });
  });

  it('points the HUD objective at Edda, then at the quest, not at the way out', () => {
    let state = enterRookwood();
    expect(chroniclesObjective(state)).toBe('Hablar con Edda, la leñadora');
    state = interact(face(state, 3, 7, 1));
    expect(chroniclesObjective(state)).toMatch(/placas/);
  });

  it('keeps the plaques hidden until Edda gives the side quest', () => {
    const state = enterRookwood();
    expect(chroniclesContextualContentAction(face(state, 5, 4, 0))).toBeNull();
    expect(chroniclesContextualContentAction(face(state, 3, 7, 1))?.id).toBe('rookwood-mourner');
  });

  it('completes the side quest once: accept, gather three plaques, hang them, get paid', () => {
    let state = interact(face(enterRookwood(), 3, 7, 1));
    expect(state.quests[QUEST]).toMatchObject({ status: 'active', title: 'Los nombres del bosque' });
    expect(chroniclesQuestEntries(state, 'active').map((quest) => quest.id)).toContain(QUEST);

    // The oak refuses half the names and pays nothing.
    const early = interact(face(state, 15, 5, 1));
    expect(early.quests[QUEST].status).toBe('active');
    expect(chroniclesGoldBalance(early)).toBe(0);

    state = collectPlaques(state);
    expect(chroniclesInventoryEntries(state)).toContainEqual(expect.objectContaining({ id: PLAQUE, quantity: 3 }));
    // A recovered plaque is consumed from the world, not re-lootable.
    expect(chroniclesContextualContentAction(face(state, 5, 4, 0))?.id).not.toBe('rookwood-plaque-hollow');

    state = face(state, 15, 5, 1);
    expect(chroniclesContextualContentAction(state)?.id).toBe('rookwood-name-oak');
    state = interact(state);
    expect(state.quests[QUEST].status).toBe('completed');
    expect(chroniclesGoldBalance(state)).toBe(15);
    for (const key of ['rookwoodNorthDitchHoundHp', 'rookwoodSouthRootWeaverHp',
      'rookwoodEastTrollHp', 'rookwoodNorthPlaqueSpiderHp']) {
      expect(state[key], key + ' must not gate plaque redemption').toBeGreaterThan(0);
    }
    expect(state.inventory).not.toHaveProperty(PLAQUE);
    expect(state.claimedRewards).toEqual(['rookwood:names-in-wood:v1']);

    // Replaying the turn-in cannot pay twice.
    const replay = chroniclesTacticsUse({ ...state, x: 16, y: 5 }, 'rookwood-name-oak');
    expect(chroniclesGoldBalance(replay)).toBe(15);

    // Edda closes the thread and points toward the crypt.
    const thanks = interact(face(state, 3, 7, 1));
    expect(thanks.rookwoodMournerThanked).toBe(true);
    expect(thanks.message).toMatch(/Ilse/);
  });

  it('recovers the side quest mid-way and after completion across F5', () => {
    let state = interact(face(enterRookwood(), 3, 7, 1));
    state = interact(face(state, 5, 4, 0));
    const mid = chroniclesApplyRunCheckpoint(createChroniclesState('rookwood-first-book'), chroniclesRunCheckpointPayload(state, 3));
    expect(mid.quests[QUEST].status).toBe('active');
    expect(mid.inventory[PLAQUE].quantity).toBe(1);
    expect(chroniclesTacticsInteractions({ ...mid, x: 5, y: 3 }).some((entry) => entry.id === 'rookwood-plaque-hollow')).toBe(false);

    state = collectPlaques(state);
    state = interact(face(state, 15, 5, 1));
    const snapshot = chroniclesRunCheckpointPayload(state, 4);
    expect(snapshot.claimedRewards).toEqual(['rookwood:names-in-wood:v1']);
    const restored = chroniclesApplyRunCheckpoint(createChroniclesState('rookwood-first-book'), snapshot);
    expect(restored.quests[QUEST].status).toBe('completed');
    expect(chroniclesGoldBalance(restored)).toBe(15);
    const again = chroniclesTacticsUse({ ...restored, x: 16, y: 5 }, 'rookwood-name-oak');
    expect(chroniclesGoldBalance(again)).toBe(15);
  });

  it('populates the remote forest without occupying quest plaques, gates or arrival squares', () => {
    const wood = chroniclesMapById('rookwood-first-book');
    const originals = [
      'rookwood-hollow-hound', 'rookwood-weaver', 'rookwood-bramble-hound',
      'rookwood-hollow-spider', 'rookwood-trail-hound',
      'rookwood-shadow-weaver', 'rookwood-tangle-hound',
    ];
    const added = [
      ['rookwood-north-ditch-hound', 1, 1, 'rookwood-bramble-hound'],
      ['rookwood-south-root-weaver', 6, 12, 'rookwood-hollow-spider'],
      ['rookwood-east-troll', 13, 3, 'rookwood-shadow-weaver'],
      ['rookwood-north-plaque-spider', 19, 2, 'rookwood-hollow-spider'],
    ];
    expect(wood.enemies.map((enemy) => enemy.id)).toEqual([
      ...originals, ...added.map(([id]) => id),
    ]);
    expect(new Set(wood.enemies.map((enemy) => enemy.id)).size).toBe(11);
    expect(new Set(wood.enemies.map((enemy) => enemy.hpKey)).size).toBe(11);
    const taken = new Set([
      wood.partyStart, ...wood.enemies.slice(0, originals.length),
      ...['triggers', 'interactables', 'treasures', 'traps', 'exits']
        .flatMap((group) => wood[group] || []),
    ].filter((entry) => Number.isInteger(entry.x) && Number.isInteger(entry.y))
      .map(({ x, y }) => `${x},${y}`));
    const reached = new Set([`${wood.partyStart.x},${wood.partyStart.y}`]);
    const queue = [wood.partyStart];
    for (const { x, y } of queue) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (wood.grid[ny]?.[nx] && wood.grid[ny][nx] !== '#' && !reached.has(key)) {
          reached.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }
    const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    for (const [id, x, y, sourceId] of added) {
      const enemy = wood.enemies.find((entry) => entry.id === id);
      const source = wood.enemies.find((entry) => entry.id === sourceId);
      const position = `${x},${y}`;
      expect(enemy, id).toMatchObject({
        x, y, optional: true, activation: 'always',
        visualType: source.visualType,
      });
      expect(enemy.ai).toEqual(source.ai);
      expect(enemy.enemyBuild.archetype).toBe(source.enemyBuild.archetype);
      expect(enemy.onDefeat?.effects || [], id).toEqual([]);
      expect(enemy.defeatedFlag, id).toBeUndefined();
      expect(wood.grid[y][x]).toBe('.');
      expect(reached.has(position), id).toBe(true);
      expect(taken.has(position), id).toBe(false);
      expect(distance(enemy, wood.partyStart), id).toBeGreaterThanOrEqual(5);
      expect(wood.exits.filter((gate) => Number.isInteger(gate.x) && Number.isInteger(gate.y))
        .every((gate) => distance(enemy, gate) >= 4), id).toBe(true);
      taken.add(position);
    }
    const storyDrops = wood.enemies.filter((enemy) => enemy.onDefeat?.effects?.some(
      (effect) => effect.type === 'grant-item' && ['weaver-silk', 'bronze-mace'].includes(effect.itemId),
    )).map((enemy) => enemy.id);
    expect(storyDrops).toEqual(['rookwood-hollow-hound', 'rookwood-weaver']);
  });

  it('preserves slain forest reinforcements when leaving Rookwood or reloading a checkpoint', () => {
    const wood = chroniclesMapById('rookwood-first-book');
    for (const foe of wood.enemies.slice(7)) {
      const entered = chroniclesMapTransitionState(
        createChroniclesState('banner-road-first-book', null, { rules: 'mm3' }),
        wood.id,
      );
      expect(entered[foe.hpKey], foe.id).toBeGreaterThan(0);
      const departed = chroniclesMapTransitionState(
        { ...entered, [foe.hpKey]: 0 }, 'banner-road-first-book',
      );
      const returned = chroniclesMapTransitionState(departed, wood.id);
      expect(returned[foe.hpKey], foe.id).toBe(0);
      expect(returned.rookwoodHoundHp).toBeGreaterThan(0);
      const checkpoint = chroniclesRunCheckpointPayload(departed, 1);
      const restored = chroniclesApplyRunCheckpoint(
        createChroniclesState('banner-road-first-book', null, { rules: 'mm3' }),
        { ...checkpoint, worldVersion: 1 },
      );
      const afterLoad = chroniclesMapTransitionState(restored, wood.id);
      expect(afterLoad[foe.hpKey], foe.id).toBe(0);
      expect(afterLoad.rookwoodHoundHp).toBeGreaterThan(0);
    }
  });
});
