import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsInteractions, chroniclesTacticsUse } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapInitialEnemyState } from './chroniclesMapCatalog.js';
import { chroniclesRunCheckpointPayload, chroniclesApplyRunCheckpoint } from './chroniclesRunCheckpoint.js';
import {
  chroniclesCampaignEpilogue,
  chroniclesCampaignEpiloguePending,
} from './chroniclesCampaignEpilogue.js';

function walkTo(state, x, y) { return { ...state, x, y }; }

function interactionIds(state) {
  return chroniclesTacticsInteractions(state).map((entry) => entry.id);
}

function use(state, id, { x, y } = {}) {
  const at = Number.isInteger(x) ? walkTo(state, x, y) : state;
  const available = chroniclesTacticsInteractions(at).find((entry) => entry.id === id);
  expect(available, `${id} at ${at.mapId} ${at.x},${at.y}`).toBeTruthy();
  expect(available.locked, `${id} locked`).toBeFalsy();
  return chroniclesTacticsUse(at, id);
}

function defeat(state, enemyId) {
  const enemy = chroniclesMapById(state.mapId).enemies.find((entry) => entry.id === enemyId);
  expect(enemy, enemyId).toBeTruthy();
  return chroniclesApplyContentEffects({ ...state, [enemy.hpKey]: 0 }, enemy.onDefeat.effects);
}

function position(mapId, group, id) {
  const entry = chroniclesMapById(mapId)[group].find((candidate) => candidate.id === id);
  expect(entry, `${mapId}/${id}`).toBeTruthy();
  return { x: entry.x, y: entry.y };
}

// The company arrives at the Corte de Bronce with Osric's report and the
// oath tablet, exactly as the fourth act leaves it.
function atTheDamasCourt() {
  const state = createChroniclesState('corte-de-bronce');
  return {
    ...state,
    vigiliaOsricReported: true,
    inventory: {
      'oath-tablet': { id: 'oath-tablet', name: 'Tablilla del juramento', description: '', quantity: 1 },
    },
    quests: { 'lost-king': { id: 'lost-king', title: 'El rey desaparecido', status: 'active', objective: '', order: 1 } },
  };
}

function throughTheCrypt({ freeKnights }) {
  let state = use(atTheDamasCourt(), 'dama-audience', position('corte-de-bronce', 'interactables', 'dama-audience'));
  expect(state.lostKingFinalActOpen).toBe(true);
  expect(state.quests['lost-king'].objective).toMatch(/Templo Bajo la Corona/);

  state = use(state, 'town-gate', position('corte-de-bronce', 'exits', 'town-gate'));
  expect(state.mapId).toBe('terra-d6');
  state = use(state, 'd6-to-e6', position('terra-d6', 'exits', 'd6-to-e6'));
  state = use(state, 'e6-to-f6', position('terra-e6', 'exits', 'e6-to-f6'));
  expect(state.mapId).toBe('terra-f6');
  state = use(state, 'f6-to-temple', position('terra-f6', 'exits', 'f6-to-temple'));
  expect(state.mapId).toBe('templo-corona-atrio');

  // The seal refuses until all three erased crowns are in hand.
  const seal = position('templo-corona-atrio', 'interactables', 'temple-atrium-seal');
  expect(chroniclesTacticsInteractions(walkTo(state, seal.x, seal.y)))
    .toContainEqual(expect.objectContaining({ id: 'temple-atrium-seal', locked: true }));
  expect(chroniclesTacticsInteractions(walkTo(state, 9, 1)))
    .toContainEqual(expect.objectContaining({ id: 'temple-atrium-down', locked: true }));
  for (const crown of ['temple-crown-iron', 'temple-crown-salt', 'temple-crown-ash']) {
    state = use(state, crown, position('templo-corona-atrio', 'treasures', crown));
  }
  state = use(state, 'temple-atrium-seal', seal);
  expect(state.templeAtriumSealOpen).toBe(true);
  expect(state.inventory).not.toHaveProperty('temple-crown-iron');
  state = use(state, 'temple-atrium-down', position('templo-corona-atrio', 'exits', 'temple-atrium-down'));
  expect(state.mapId).toBe('templo-corona-cripta');

  state = use(state, 'crypt-edric-ghost', position('templo-corona-cripta', 'interactables', 'crypt-edric-ghost'));
  if (freeKnights) {
    state = use(state, 'crypt-oath-altar', position('templo-corona-cripta', 'interactables', 'crypt-oath-altar'));
    expect(state.templeKnightsFreed).toBe(true);
    expect(state.inventory).not.toHaveProperty('oath-tablet');
  }
  const down = position('templo-corona-cripta', 'exits', 'crypt-down');
  expect(chroniclesTacticsInteractions(walkTo(state, down.x, down.y)))
    .toContainEqual(expect.objectContaining({ id: 'crypt-down', locked: true }));
  state = defeat(state, 'templo-corona-cripta-jailer');
  expect(state.inventory['throne-key']).toBeTruthy();
  state = use(state, 'crypt-down', down);
  expect(state.mapId).toBe('templo-corona-trono');
  return state;
}

describe('El rey desaparecido · acto V', () => {
  it('opens the temple only after the Dama has spoken', () => {
    const f6 = chroniclesMapById('terra-f6');
    const gate = f6.exits.find((entry) => entry.id === 'f6-to-temple');
    const closed = walkTo(createChroniclesState('terra-f6'), gate.x, gate.y);
    expect(chroniclesTacticsInteractions(closed)).toContainEqual(expect.objectContaining({ id: 'f6-to-temple', locked: true }));
  });

  it('frees the knights with the tablet, so the throne has no oathbound guard and only the regency remains', () => {
    let state = throughTheCrypt({ freeKnights: true });
    const enemies = chroniclesMapInitialEnemyState('templo-corona-trono', state);
    const knights = chroniclesMapById('templo-corona-trono').enemies.filter((enemy) => enemy.visualType === 'oathbound-knight');
    expect(knights).toHaveLength(2);
    knights.forEach((knight) => expect(enemies[knight.hpKey]).toBe(0));

    expect(interactionIds(walkTo(state, 9, 1))).toContain('throne-varren-before');
    state = defeat(state, 'templo-corona-trono-varren');
    expect(state.varrenDefeated).toBe(true);
    expect(chroniclesTacticsInteractions(walkTo(state, 8, 2)))
      .toContainEqual(expect.objectContaining({ id: 'throne-oath-restore', locked: true }));

    state = use(state, 'throne-king-stone', { x: 9, y: 1 });
    expect(state.lostKingEnding).toBe('regency');
    expect(state.quests['lost-king'].status).toBe('completed');
    expect(chroniclesCampaignEpiloguePending(state)).toBe(true);
    const epilogue = chroniclesCampaignEpilogue(state);
    expect(epilogue.title).toBe('La regencia de la Dama');
    expect(epilogue.lines.join(' ')).toMatch(/caballeros de la Dama descansan/);
    // The ending is claimed once: no second choice is offered.
    expect(interactionIds(walkTo(state, 9, 1))).toEqual(['throne-after']);
  });

  it('keeps the tablet for the King: the knights fight, and the oath can be restored or broken', () => {
    let state = throughTheCrypt({ freeKnights: false });
    const enemies = chroniclesMapInitialEnemyState('templo-corona-trono', state);
    expect(enemies.temploCoronaTronoKnightWestHp).toBeGreaterThan(0);
    state = defeat(state, 'templo-corona-trono-knight-west');
    state = defeat(state, 'templo-corona-trono-varren');

    const restored = use(state, 'throne-oath-restore', { x: 8, y: 2 });
    expect(restored.lostKingEnding).toBe('restored');
    expect(restored.inventory).not.toHaveProperty('oath-tablet');
    expect(chroniclesCampaignEpilogue(restored).lines.join(' ')).toMatch(/Hadric y Dama Ysolde cayeron/);

    const broken = use(state, 'throne-oath-break', { x: 10, y: 2 });
    expect(broken.lostKingEnding).toBe('broken');
    expect(chroniclesCampaignEpilogue(broken).title).toBe('Sin corona');
  });

  it('checkpoints the ending and the epilogue choice', () => {
    let state = throughTheCrypt({ freeKnights: true });
    state = defeat(state, 'templo-corona-trono-varren');
    state = use(state, 'throne-king-stone', { x: 9, y: 1 });
    const seen = { ...state, lostKingEpilogueSeen: true };
    const payload = chroniclesRunCheckpointPayload(seen, 7);
    expect(payload.worldFlags).toMatchObject({ lostKingEnding: 'regency', lostKingEpilogueSeen: true, varrenDefeated: true });
    expect(payload.quests['lost-king'].status).toBe('completed');
    const restored = chroniclesApplyRunCheckpoint(createChroniclesState('templo-corona-trono'), {
      ...payload, runStatus: 'active',
    });
    expect(chroniclesCampaignEpiloguePending(restored)).toBe(false);
    expect(chroniclesCampaignEpilogue(restored).ending).toBe('regency');
  });
});
