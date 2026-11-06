import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chroniclesActiveEnemies, chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesCampAmbush, chroniclesCampRestStatus } from './chroniclesCampRest.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesAdvanceCombatInitiative } from './chroniclesInitiative.js';
import { chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload } from './chroniclesRunCheckpoint.js';

const initial = () => createChroniclesState('swordhaven-sewers', null, { rules: 'mm3' });
const stocked = (state, count = 4) => ({
  ...state,
  inventory: { ...state.inventory,
    'road-rations': { id: 'road-rations', name: 'Raciones de viaje', quantity: count } },
});
const goblinCamp = () => {
  const state = initial();
  const goblin = chroniclesActiveEnemies(state).find((enemy) => enemy.id === 'sewers-goblin-west');
  expect(goblin).toBeTruthy();
  return {
    ...state,
    ...Object.fromEntries(chroniclesActiveEnemies(state)
      .filter((enemy) => enemy.id !== goblin.id).map((enemy) => [enemy.hpKey, 0])),
    enemyPositions: { ...state.enemyPositions, [goblin.id]: { x: 1, y: 4 } },
  };
};

describe('MM3 R-to-sleep · eight-hour camp and surprise', () => {
  it('allows an already healthy party to sleep eight hours with a single ration charge', () => {
    const before = stocked(initial());
    // Cleared enemies cannot be respawned by merely resting.
    const clear = {
      ...before,
      ...Object.fromEntries(chroniclesActiveEnemies(before).map((enemy) => [enemy.hpKey, 0])),
      runSeed: 'healthy-clear-camp',
    };
    expect(chroniclesCampRestStatus(clear, []).canRest).toBe(true);
    const after = chroniclesReduce(clear, 'camp-rest');
    expect(after.turns).toBe(clear.turns + 1);
    expect(after.worldMinutes - clear.worldMinutes).toBe(8 * 60);
    expect(after.inventory['road-rations']).toBeUndefined();
    expect(after.initiative).toBeFalsy();
    expect(after.message).toBe('8 hours passed - the party rested');
  });

  it('uses a saved run seed and real nearby living enemies for a reproducible ambush', () => {
    const base = stocked(goblinCamp());
    const map = chroniclesMapForState(base);
    // Choose an actual seeded run with a real interruption, not Math.random.
    const candidates = Array.from({ length: 200 }, (_, i) => ({
      ...base, runSeed: `night-raid-${i}`,
    }));
    const before = candidates.find((state) => chroniclesCampAmbush(
      state, chroniclesActiveEnemies(state), map,
    ));
    expect(before).toBeTruthy();
    const ambush = chroniclesCampAmbush(before, chroniclesActiveEnemies(before), map);
    expect(ambush).toEqual(chroniclesCampAmbush(
      JSON.parse(JSON.stringify(before)), chroniclesActiveEnemies(before), map,
    ));
    expect(ambush.elapsedHours).toBeGreaterThanOrEqual(1);
    expect(ambush.elapsedHours).toBeLessThanOrEqual(7);
    const wounded = {
      ...before,
      party: before.party.map((hero) => ({ ...hero, hp: Math.max(1, hero.maxHp - 4) })),
      spellPoints: { ...before.spellPoints, bishop: 0 },
    };
    const after = chroniclesReduce(wounded, { type: 'camp-rest' });
    expect(after.phase).toBe('combat');
    expect(after.initiative).toBeTruthy();
    expect(after.worldMinutes - wounded.worldMinutes).toBe(ambush.elapsedHours * 60);
    expect(after.turns).toBe(wounded.turns + 1);
    expect(after.inventory['road-rations']).toBeUndefined();
    expect(after.party.map((hero) => hero.hp)).toEqual(wounded.party.map((hero) => hero.hp));
    expect(after.spellPoints.bishop).toBe(0);
    expect(after.initiative.order.some((actor) => actor.kind === 'enemy' && actor.id === ambush.enemyId))
      .toBe(true);
    const sleepers = after.initiative.order.filter((actor) => actor.kind === 'party' && actor.asleep);
    expect(sleepers.length).toBeGreaterThanOrEqual(1);
    expect(sleepers.length).toBeLessThan(after.party.length);
    expect(sleepers.map((actor) => actor.id)).toEqual(ambush.asleepIds);
    const checkpoint = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(after, 1)));
    const resumed = chroniclesApplyRunCheckpoint(initial(), checkpoint);
    expect(resumed.worldMinutes).toBe(after.worldMinutes);
    expect(resumed.initiative.order.filter((actor) => actor.asleep).map((actor) => actor.id))
      .toEqual(sleepers.map((actor) => actor.id));
    expect(chroniclesReduce(after, 'camp-rest')).toBe(after);
    const asleepIndex = resumed.initiative.order.findIndex((actor) => actor.asleep);
    const sleepingTurn = {
      ...resumed,
      initiative: { ...resumed.initiative, cursor: asleepIndex },
    };
    const awake = chroniclesAdvanceCombatInitiative(sleepingTurn, chroniclesActiveEnemies(sleepingTurn));
    expect(awake.initiative.order.find((actor) => actor.id === sleepers[0].id).asleep).toBe(false);
    expect(awake.initiative.cursor).not.toBe(asleepIndex);
    expect(awake.party.map((hero) => hero.hp)).toEqual(sleepingTurn.party.map((hero) => hero.hp));
  });

  it('never raids a cleared area or invents a monster in a no-seed local snapshot', () => {
    const clear = stocked({
      ...goblinCamp(), runSeed: 'no-respawn',
      ...Object.fromEntries(chroniclesActiveEnemies(initial()).map((enemy) => [enemy.hpKey, 0])),
    });
    expect(chroniclesCampAmbush(clear, chroniclesActiveEnemies(clear), chroniclesMapForState(clear))).toBe(null);
    expect(chroniclesReduce(clear, 'camp-rest').initiative).toBeFalsy();
    const legacy = stocked(goblinCamp());
    expect(chroniclesCampAmbush(legacy, chroniclesActiveEnemies(legacy), chroniclesMapForState(legacy))).toBe(null);
    expect(chroniclesReduce(legacy, 'camp-rest').worldMinutes - legacy.worldMinutes).toBe(480);
    expect(chroniclesReduce(stocked(createChroniclesState('swordhaven-sewers')), 'camp-rest'))
      .toEqual(stocked(createChroniclesState('swordhaven-sewers')));
  });

  it('keeps the keyboard and fade visibly diegetic, never opening a rest modal', () => {
    const ui = readFileSync(new URL('../components/ChroniclesOfMatthias.jsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../components/ChroniclesCampSleep.css', import.meta.url), 'utf8');
    expect(ui).toContain("event.key === 'r' || event.key === 'R'");
    expect(ui).toContain('if (campPhaseRef.current)');
    expect(ui).toContain("onCampRest={beginCampRest}");
    expect(ui).toContain('data-chronicles-asleep');
    expect(ui).toContain('data-chronicles-camp-phase');
    expect(css).toContain('background: #030304');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
