import { describe, expect, it } from 'vitest';

import {
  chroniclesApplyRunCheckpoint,
  chroniclesCheckpointRunProgression,
  chroniclesRunCheckpointFingerprint,
  chroniclesRunCheckpointPayload,
  chroniclesRunHasRuntimeCheckpoint,
  chroniclesWorldFlagsForCheckpoint,
} from './chroniclesRunCheckpoint.js';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from './chroniclesContentRuntime.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';

function anotherWalkableCell(map, occupied = []) {
  const blocked = new Set(occupied.map(({ x, y }) => `${x},${y}`));
  for (let y = 0; y < map.grid.length; y += 1) {
    for (let x = 0; x < map.grid[y].length; x += 1) {
      if (map.grid[y][x] !== '#' && !blocked.has(`${x},${y}`)) return { x, y };
    }
  }
  throw new Error('Chronicles test map needs another walkable cell');
}

describe('Chronicles checkpoint projection', () => {
  it('distinguishes a fresh run from one that already owns runtime checkpoint state', () => {
    expect(chroniclesRunHasRuntimeCheckpoint(null)).toBe(false);
    expect(chroniclesRunHasRuntimeCheckpoint({ worldFlags: {} })).toBe(false);
    expect(chroniclesRunHasRuntimeCheckpoint({
      worldFlags: { '__chrRuntime.version': 1 },
    })).toBe(true);
  });

  it('projects authored world state plus bounded runtime state, never renderer/UI noise', () => {
    const map = chroniclesMapById('gallery-of-forks');
    const enemy = map.enemies[0];
    const state = {
      ...createChroniclesState(map.id),
      galleryLeverPulled: true,
      [enemy.hpKey]: Math.max(0, Number(enemy.maxHp || 1) - 1),
      x: map.partyStart.x,
      y: map.partyStart.y,
      message: 'ephemeral',
      enemyTurnEvents: [{ kind: 'attack' }],
      arbitraryUiFlag: true,
    };

    const flags = chroniclesWorldFlagsForCheckpoint(state);

    expect(flags.galleryLeverPulled).toBe(true);
    expect(flags[enemy.hpKey]).toBe(state[enemy.hpKey]);
    expect(flags).not.toHaveProperty('message');
    expect(flags).not.toHaveProperty('enemyTurnEvents');
    expect(flags).not.toHaveProperty('arbitraryUiFlag');
  });

  it('keeps authored flags from earlier maps because cross-map consequences survive transitions', () => {
    const payload = chroniclesRunCheckpointPayload({
      ...createChroniclesState('gallery-of-forks'),
      sigilAwake: true,
      galleryLeverPulled: true,
    }, 4);

    expect(payload.expectedWorldVersion).toBe(4);
    expect(payload.currentMapId).toBe('gallery-of-forks');
    expect(payload.worldFlags).toMatchObject({
      sigilAwake: true,
      galleryLeverPulled: true,
    });
  });

  it('preserves switches and treasures per dungeon floor across an actual API checkpoint', () => {
    let state = { ...createChroniclesState('crypt-eight-squares'), sigilAwake: true };
    state = chroniclesMapTransitionState(state, 'gallery-of-forks');
    state = { ...state, galleryLeverPulled: true };
    state = chroniclesMapTransitionState(state, 'menagerie-of-ash');
    state = { ...state, emberCacheOpened: true };

    const checkpoint = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(state, 3)));
    const restored = chroniclesApplyRunCheckpoint(createChroniclesState('menagerie-of-ash'), checkpoint);
    expect(restored.emberCacheOpened).toBe(true);
    const gallery = chroniclesMapTransitionState(restored, 'gallery-of-forks');
    expect(gallery.galleryLeverPulled).toBe(true);
    const crypt = chroniclesMapTransitionState(gallery, 'crypt-eight-squares');
    expect(crypt.sigilAwake).toBe(true);
    expect(chroniclesMapTransitionState(crypt, 'menagerie-of-ash').emberCacheOpened).toBe(true);

    for (const [key, value] of Object.entries(checkpoint.worldFlags)) {
      if (key.startsWith('__chrRuntime.mapFlags.part.')) {
        expect(Array.from(value).length).toBeLessThanOrEqual(240);
      }
    }
  });

  it('ignores incomplete floor snapshots without breaking legacy checkpoint recovery', () => {
    const state = chroniclesMapTransitionState(
      { ...createChroniclesState('crypt-eight-squares'), sigilAwake: true },
      'gallery-of-forks',
    );
    const checkpoint = chroniclesRunCheckpointPayload(state, 1);
    const damaged = { ...checkpoint, worldFlags: { ...checkpoint.worldFlags } };
    delete damaged.worldFlags['__chrRuntime.mapFlags.part.0'];
    const recovered = chroniclesApplyRunCheckpoint(createChroniclesState('gallery-of-forks'), damaged);
    expect(recovered.mapFlagsById).toBeUndefined();
    expect(recovered.sigilAwake).toBe(true);
  });

  it('ignores wrongly typed floor flags while preserving valid switches on the same floor', () => {
    const visited = chroniclesMapTransitionState({
      ...createChroniclesState('gallery-of-forks'),
      galleryLeverPulled: true,
      galleryRelicCollected: true,
    }, 'menagerie-of-ash');
    const checkpoint = chroniclesRunCheckpointPayload(visited, 2);
    const corrupt = {
      ...checkpoint,
      worldFlags: {
        ...checkpoint.worldFlags,
        '__chrRuntime.mapFlags.parts': 1,
        '__chrRuntime.mapFlags.part.0': JSON.stringify({
          'gallery-of-forks': {
            galleryLeverPulled: 'true',
            galleryRelicCollected: true,
          },
        }),
      },
    };
    const restored = chroniclesApplyRunCheckpoint(createChroniclesState('menagerie-of-ash'), corrupt);
    const gallery = chroniclesMapTransitionState(restored, 'gallery-of-forks');

    expect(gallery.galleryLeverPulled).toBe(false);
    expect(gallery.galleryRelicCollected).toBe(true);
  });

  it('normalizes explicit monotonic ledgers without inventing entries', () => {
    const payload = chroniclesRunCheckpointPayload({
      ...createChroniclesState(),
      consumedContentIds: ['crypt-lever', 'crypt-lever', '', null],
      claimedRewards: ['reward:a', ' reward:a ', 'reward:b'],
    }, 0);

    expect(payload.consumedContentIds).toEqual(['crypt-lever']);
    expect(payload.claimedRewards).toEqual(['reward:a', 'reward:b']);
  });

  it('terminalizes defeat immediately but leaves successful extraction finalization to the adapter', () => {
    expect(chroniclesRunCheckpointPayload({
      ...createChroniclesState(),
      phase: 'defeated',
    }, 2).terminalStatus).toBe('defeated');

    const escaped = {
      ...createChroniclesState(),
      phase: 'escaped',
    };
    expect(chroniclesRunCheckpointPayload(escaped, 3)).not.toHaveProperty('terminalStatus');
    expect(chroniclesRunCheckpointPayload(
      escaped,
      3,
      { terminalStatus: 'completed' },
    ).terminalStatus).toBe('completed');

    expect(() => chroniclesRunCheckpointPayload(
      createChroniclesState(),
      4,
      { terminalStatus: 'completed' },
    )).toThrow(/escaped phase/i);
    expect(chroniclesRunCheckpointPayload(createChroniclesState(), 4)).not.toHaveProperty('terminalStatus');
  });

  it('rejects missing map identity or invalid CAS versions', () => {
    expect(() => chroniclesRunCheckpointPayload({}, 0)).toThrow(/current map/i);
    expect(() => chroniclesRunCheckpointPayload({ mapId: 'crypt-eight-squares' }, -1)).toThrow(/worldVersion/i);
  });
});

describe('Chronicles run checkpoint recovery', () => {
  it('round-trips runtime state needed for F5/re-entry without resurrecting damage or spent charges', () => {
    const map = chroniclesMapById('gallery-of-forks');
    const enemy = map.enemies[0];
    const initial = createChroniclesState(map.id);
    const partyCell = anotherWalkableCell(map, [{ x: initial.x, y: initial.y }]);
    const enemyCell = anotherWalkableCell(map, [
      { x: initial.x, y: initial.y },
      partyCell,
    ]);
    const woundedParty = initial.party.map((member, index) => (
      index === 0 ? { ...member, hp: Math.max(0, member.maxHp - 3) } : member
    ));
    const enemyHp = Math.max(0, Number(initial[enemy.hpKey] || enemy.maxHp || 1) - 1);
    const snapshot = {
      ...initial,
      x: partyCell.x,
      y: partyCell.y,
      direction: 2,
      turns: 17,
      round: 6,
      explorationEnemySteps: 9,
      turnPhase: 'party',
      phase: 'combat',
      initiative: {
        version: 1,
        die: '1d8',
        round: 2,
        cursor: 1,
        order: [
          { id: 'matthias', kind: 'party', name: 'Matthias', agility: 4, roll: 7, initiative: 11 },
          { id: enemy.id, kind: 'enemy', name: enemy.name, agility: 3, roll: 5, initiative: 8 },
        ],
      },
      party: woundedParty,
      [enemy.hpKey]: enemyHp,
      enemyPositions: { [enemy.id]: enemyCell },
      classAbilityCharges: {
        matthias: 0,
        rook: 1,
        bishop: 0,
        knight: 1,
      },
      consumedContentIds: ['gallery-lever'],
      claimedRewards: ['reward:gallery'],
      message: 'runtime-only narration',
    };
    const payload = chroniclesRunCheckpointPayload(snapshot, 3);

    const recovered = chroniclesApplyRunCheckpoint({
      ...createChroniclesState(map.id),
      round: 1,
      turnPhase: 'party',
      enemyPositions: {},
      enemyTurnEvents: [],
      classAbilityCharges: {
        matthias: 2,
        rook: 2,
        bishop: 2,
        knight: 2,
      },
    }, {
      worldFlags: payload.worldFlags,
      consumedContentIds: payload.consumedContentIds,
      claimedRewards: payload.claimedRewards,
    });

    expect(recovered.x).toBe(snapshot.x);
    expect(recovered.y).toBe(snapshot.y);
    expect(recovered.direction).toBe(2);
    expect(recovered.turns).toBe(17);
    expect(recovered.round).toBe(6);
    expect(recovered.explorationEnemySteps).toBe(9);
    expect(recovered.phase).toBe('combat');
    expect(recovered.initiative).toEqual(snapshot.initiative);
    expect(recovered.party[0].hp).toBe(snapshot.party[0].hp);
    expect(recovered[enemy.hpKey]).toBe(enemyHp);
    expect(recovered.enemyPositions[enemy.id]).toEqual(enemyCell);
    expect(recovered.classAbilityCharges.matthias).toBe(0);
    expect(recovered.classAbilityCharges.bishop).toBe(0);
    expect(recovered.consumedContentIds).toEqual(['gallery-lever']);
    expect(recovered.claimedRewards).toEqual(['reward:gallery']);
    expect(recovered.message).not.toBe('runtime-only narration');
  });

  it('rejects checkpoint enemy overlaps, including a missing foe at its authored spawn', () => {
    const map = chroniclesMapById('swordhaven-sewers');
    const [west, mid] = map.enemies;
    const base = createChroniclesState(map.id);
    const cell = { x: mid.x, y: mid.y };

    const duplicate = chroniclesRunCheckpointPayload({
      ...base,
      enemyPositions: { [west.id]: cell, [mid.id]: cell },
    }, 1);
    const recoveredDuplicate = chroniclesApplyRunCheckpoint(createChroniclesState(map.id), duplicate);
    expect(recoveredDuplicate.enemyPositions?.[west.id]).toBeUndefined();
    expect(recoveredDuplicate.enemyPositions?.[mid.id]).toBeUndefined();

    const missing = chroniclesRunCheckpointPayload({
      ...base,
      enemyPositions: { [west.id]: cell },
    }, 1);
    const recoveredMissing = chroniclesApplyRunCheckpoint(createChroniclesState(map.id), missing);
    expect(recoveredMissing.enemyPositions?.[west.id]).toBeUndefined();

    const distinct = { x: west.x, y: west.y - 1 };
    expect(map.grid[distinct.y][distinct.x]).not.toBe('#');
    const valid = chroniclesRunCheckpointPayload({
      ...base,
      enemyPositions: { [west.id]: distinct, [mid.id]: cell },
    }, 1);
    const recoveredValid = chroniclesApplyRunCheckpoint(createChroniclesState(map.id), valid);
    expect(recoveredValid.enemyPositions[west.id]).toEqual(distinct);
    expect(recoveredValid.enemyPositions[mid.id]).toEqual(cell);
  });

  it('round-trips individual party combat cells across F5/re-entry', () => {
    const base = createChroniclesState();
    const snapshot = {
      ...base,
      phase: 'combat',
      partyPositions: {
        matthias: { x: 1, y: 5 },
        rook: { x: 2, y: 5 },
        bishop: { x: 1, y: 4 },
        knight: { x: 3, y: 4 },
      },
      initiative: {
        version: 1,
        die: '1d8',
        round: 3,
        cursor: 0,
        order: [
          { id: 'matthias', kind: 'party', name: 'Matthias', agility: 4, roll: 5, initiative: 9 },
          { id: 'corrupted-pawn', kind: 'enemy', name: 'Peón', agility: 1, roll: 5, initiative: 6 },
        ],
      },
    };
    const payload = chroniclesRunCheckpointPayload(snapshot, 2);
    const recovered = chroniclesApplyRunCheckpoint(
      { ...base, partyPositions: {} },
      {
        worldFlags: payload.worldFlags,
        consumedContentIds: [],
        claimedRewards: [],
      },
    );

    expect(recovered.phase).toBe('combat');
    expect(recovered.partyPositions).toEqual(snapshot.partyPositions);
    expect(recovered.initiative).toEqual(snapshot.initiative);
    expect(chroniclesRunCheckpointFingerprint(snapshot)).not.toBe(
      chroniclesRunCheckpointFingerprint({ ...snapshot, partyPositions: {} }),
    );
  });

  it('round-trips inventory and quest state across F5/re-entry', () => {
    const base = createChroniclesState('gallery-of-forks');
    const snapshot = {
      ...base,
      inventory: {
        'charred-key': {
          id: 'charred-key',
          name: 'Llave carbonizada',
          description: 'Abre algo que probablemente no debería abrirse.',
          quantity: 2,
        },
      },
      quests: {
        'blind-king-key': {
          id: 'blind-king-key',
          title: 'La llave del rey ciego',
          description: 'Una deuda incómodamente literal.',
          objective: 'Lleva la llave a la capilla.',
          order: 3,
          status: 'active',
        },
      },
    };
    const payload = chroniclesRunCheckpointPayload(snapshot, 2);
    const recovered = chroniclesApplyRunCheckpoint(createChroniclesState(base.mapId), {
      worldFlags: payload.worldFlags,
      inventory: payload.inventory,
      quests: payload.quests,
      consumedContentIds: payload.consumedContentIds,
      claimedRewards: payload.claimedRewards,
    });

    expect(recovered.inventory).toEqual(snapshot.inventory);
    expect(recovered.quests).toEqual(snapshot.quests);
    expect(chroniclesRunCheckpointFingerprint(snapshot)).not.toBe(
      chroniclesRunCheckpointFingerprint({
        ...snapshot,
        inventory: {
          ...snapshot.inventory,
          'charred-key': { ...snapshot.inventory['charred-key'], quantity: 1 },
        },
      }),
    );
  });

  it('recovers playable turns from corrupt checkpoint phases without changing valid combat initiative', () => {
    const base = createChroniclesState('gallery-of-forks');
    const initiative = {
      version: 1, die: '1d8', round: 2, cursor: 0,
      order: [{ id: 'matthias', kind: 'party', name: 'Matthias', agility: 4, roll: 2, initiative: 6 }],
    };
    const restore = (phase, turnPhase, withInitiative = true) => chroniclesApplyRunCheckpoint(base, {
      worldFlags: {
        '__chrRuntime.version': 1,
        '__chrRuntime.phase': phase,
        '__chrRuntime.turnPhase': turnPhase,
        ...(withInitiative ? { '__chrRuntime.initiative': JSON.stringify(initiative) } : {}),
      },
    });

    expect(restore('unrecognized-phase', 'enemy')).toMatchObject({
      phase: 'explore', turnPhase: 'party', initiative: null,
    });
    expect(restore('explore', 'enemy')).toMatchObject({
      phase: 'explore', turnPhase: 'party', initiative: null,
    });
    expect(restore('combat', 'invalid-turn')).toMatchObject({
      phase: 'combat', turnPhase: 'party', initiative,
    });
    expect(restore('combat', 'enemy')).toMatchObject({
      phase: 'combat', turnPhase: 'enemy', initiative,
    });
    expect(restore('combat', 'enemy', false)).toMatchObject({
      phase: 'combat', turnPhase: 'party', initiative: null,
    });
    // Valid old checkpoints omit turnPhase entirely. Recovery must not invent
    // a new fingerprint field and trigger redundant server checkpoint writes.
    expect(Object.hasOwn(restore('explore', undefined, false), 'turnPhase'))
      .toBe(Object.hasOwn(base, 'turnPhase'));
  });

  it('treats authoritative terminal status as stronger than a stale runtime phase', () => {
    const base = createChroniclesState();
    const completed = chroniclesApplyRunCheckpoint(base, {
      runStatus: 'completed',
      worldFlags: {
        '__chrRuntime.version': 1,
        '__chrRuntime.phase': 'explore',
      },
      consumedContentIds: [],
      claimedRewards: [],
    });
    const defeated = chroniclesApplyRunCheckpoint(base, {
      status: 'defeated',
      worldFlags: {
        '__chrRuntime.version': 1,
        '__chrRuntime.phase': 'explore',
      },
      consumedContentIds: [],
      claimedRewards: [],
    });

    expect(completed.phase).toBe('escaped');
    expect(defeated.phase).toBe('defeated');
    expect(defeated.turnPhase).toBe('party');
  });

  it('ignores structural keys in legacy world flags without discarding authored progress', () => {
    const base = createChroniclesState('gallery-of-forks');
    const restored = chroniclesApplyRunCheckpoint(base, {
      worldFlags: {
        galleryLeverPulled: true,
        cryptSigilAwake: true,
        mapId: 'retired-map',
        phase: 'escaped',
        turnPhase: 'enemy',
        x: 999,
        party: 'corrupt-party',
        initiative: 'corrupt-initiative',
        combatRules: 'tactics',
        enemyPositions: 'corrupt-positions',
        mapFlagsById: 'corrupt-floor-state',
      },
    });

    expect(restored.mapId).toBe(base.mapId);
    expect(restored.phase).toBe(base.phase);
    expect(restored.turnPhase).toBe(base.turnPhase);
    expect(restored.x).toBe(base.x);
    expect(restored.party).toEqual(base.party);
    expect(restored.initiative).toEqual(base.initiative);
    expect(restored.combatRules).toBe(base.combatRules);
    expect(restored.enemyPositions).toEqual(base.enemyPositions);
    expect(restored.mapFlagsById).toEqual(base.mapFlagsById);
    expect(restored.galleryLeverPulled).toBe(true);
    expect(restored.cryptSigilAwake).toBe(true);
  });

  it('keeps old checkpoints compatible when no runtime namespace is present', () => {
    const base = createChroniclesState('gallery-of-forks');
    const recovered = chroniclesApplyRunCheckpoint(
      { ...base, message: 'runtime-message' },
      {
        worldFlags: { galleryLeverPulled: true, cryptSigilAwake: true },
        consumedContentIds: ['gallery-lever'],
        claimedRewards: ['reward:gallery'],
      },
    );

    expect(recovered.galleryLeverPulled).toBe(true);
    expect(recovered.cryptSigilAwake).toBe(true);
    expect(recovered.message).toBe('runtime-message');
    expect(recovered.consumedContentIds).toEqual(['gallery-lever']);
    expect(recovered.claimedRewards).toEqual(['reward:gallery']);
  });

  it('fingerprints durable runtime changes but still ignores narration-only churn', () => {
    const base = createChroniclesState('gallery-of-forks');
    const original = chroniclesRunCheckpointFingerprint(base);
    const narrationOnly = chroniclesRunCheckpointFingerprint({ ...base, message: 'dos' });
    expect(narrationOnly).toBe(original);

    const map = chroniclesMapById(base.mapId);
    const moved = anotherWalkableCell(map, [{ x: base.x, y: base.y }]);
    expect(chroniclesRunCheckpointFingerprint({ ...base, ...moved })).not.toBe(original);

    const wounded = {
      ...base,
      party: base.party.map((member, index) => (
        index === 0 ? { ...member, hp: Math.max(0, member.hp - 1) } : member
      )),
    };
    expect(chroniclesRunCheckpointFingerprint(wounded)).not.toBe(original);
  });
});


describe('Chronicles campaign gold recovery', () => {
  it('rehydrates the paid quest, coin balance and single-use reward from the same checkpoint', () => {
    const original = createChroniclesState('swordhaven-campaign');
    const rewarded = chroniclesApplyContentEffects(original, [
      { type: 'grant-item', itemId: 'knight-banner', name: 'Estandarte' },
      { type: 'start-quest', questId: 'banner-contract', title: 'Estandarte perdido' },
      {
        type: 'claim-reward',
        rewardId: 'swordhaven:banner-contract:v1',
        requirements: [
          { itemId: 'knight-banner' },
          { questId: 'banner-contract', questStatus: 'active' },
        ],
        effects: [
          { type: 'consume-item', itemId: 'knight-banner' },
          { type: 'complete-quest', questId: 'banner-contract' },
          { type: 'grant-gold', amount: 18 },
        ],
      },
    ]);
    const payload = chroniclesRunCheckpointPayload(rewarded, 4);
    expect(payload.inventory['crown-gold'].quantity).toBe(18);
    expect(payload.claimedRewards).toContain('swordhaven:banner-contract:v1');
    const restored = chroniclesApplyRunCheckpoint(
      createChroniclesState('swordhaven-campaign'),
      { ...payload, runStatus: 'active' },
    );
    expect(chroniclesGoldBalance(restored)).toBe(18);
    expect(restored.quests['banner-contract'].status).toBe('completed');
    const replayed = chroniclesApplyContentEffects(restored, [{
      type: 'claim-reward', rewardId: 'swordhaven:banner-contract:v1',
      effects: [{ type: 'grant-gold', amount: 18 }],
    }]);
    expect(replayed).toBe(restored);
    expect(chroniclesGoldBalance(replayed)).toBe(18);
    expect(chroniclesRunCheckpointPayload(restored, 5).inventory).toEqual(payload.inventory);
  });
});


describe('Chronicles per-expedition progression isolation', () => {
  it('starts a new four-hero expedition at level 1 without changing old save progress', async () => {
    const {
      chroniclesFreshExpeditionProgression, grantChroniclesXp,
      chroniclesXpThresholdForLevel,
    } = await import('../chroniclesOfMatthiasProgression.js');
    const veteran = grantChroniclesXp(
      chroniclesFreshExpeditionProgression().progression,
      'matthias', chroniclesXpThresholdForLevel(9),
      'old-expedition:reward',
    ).progression;
    const oldState = { ...createChroniclesState(), runProgression: veteran };
    const oldCheckpoint = chroniclesRunCheckpointPayload(oldState, 4);
    const fresh = chroniclesFreshExpeditionProgression().progression;
    for (const hero of Object.values(fresh.heroes)) {
      expect(hero).toMatchObject({
        level: 1, xp: 0, attributePoints: 0, skillPoints: 0, skills: [],
      });
      expect(Object.values(hero.attributes).every((amount) => amount === 0)).toBe(true);
    }
    expect(fresh.claimedAwards).toEqual([]);
    expect(chroniclesCheckpointRunProgression(oldCheckpoint).heroes.matthias.level).toBe(9);
    expect(veteran.heroes.matthias.level).toBe(9);
  });

  it('restores different heroes, builds and XP per run using bounded server flags', async () => {
    const {
      chroniclesFreshExpeditionProgression, grantChroniclesXp,
      chroniclesXpThresholdForLevel, spendChroniclesAttributePoint,
    } = await import('../chroniclesOfMatthiasProgression.js');
    const base = chroniclesFreshExpeditionProgression().progression;
    const evolved = grantChroniclesXp(base, 'rook', chroniclesXpThresholdForLevel(5), 'run-a:xp').progression;
    const invested = spendChroniclesAttributePoint(evolved, 'rook', 'vigor').progression;
    const a = chroniclesRunCheckpointPayload({ ...createChroniclesState(), runProgression: invested }, 0);
    const b = chroniclesRunCheckpointPayload({ ...createChroniclesState(), runProgression: base }, 0);
    const restoredA = chroniclesCheckpointRunProgression(a);
    const restoredB = chroniclesCheckpointRunProgression(b);
    expect(restoredA.heroes.rook.level).toBe(5);
    expect(restoredA.heroes.rook.attributes.vigor).toBe(1);
    expect(restoredA.claimedAwards).toContain('run-a:xp');
    expect(restoredB.heroes.rook).toMatchObject({ level: 1, xp: 0 });
    expect(restoredB.claimedAwards).toEqual([]);
    expect(chroniclesApplyRunCheckpoint(createChroniclesState(), a).runProgression).toEqual(restoredA);
    for (const [key, value] of Object.entries(a.worldFlags)) {
      if (key.startsWith('__chrRuntime.progression.part.')) {
        expect(Array.from(value).length).toBeLessThanOrEqual(240);
      }
    }
    expect(chroniclesRunCheckpointFingerprint({ ...createChroniclesState(), runProgression: invested }))
      .not.toBe(chroniclesRunCheckpointFingerprint({ ...createChroniclesState(), runProgression: base }));
  });

  it('keeps legacy saves readable and declines truncated run progression', async () => {
    const { chroniclesFreshExpeditionProgression } = await import('../chroniclesOfMatthiasProgression.js');
    const fresh = chroniclesFreshExpeditionProgression().progression;
    const payload = chroniclesRunCheckpointPayload({ ...createChroniclesState(), runProgression: fresh }, 0);
    expect(chroniclesCheckpointRunProgression({ worldFlags: {} })).toBeNull();
    const corrupt = { ...payload.worldFlags };
    delete corrupt['__chrRuntime.progression.part.0'];
    expect(chroniclesCheckpointRunProgression({ worldFlags: corrupt })).toBeNull();
    const old = chroniclesApplyRunCheckpoint(createChroniclesState(), { worldFlags: { '__chrRuntime.version': 1 } });
    expect(old.runProgression).toBeUndefined();
  });
});
