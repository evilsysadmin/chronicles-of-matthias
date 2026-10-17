import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesTacticsInteractions, chroniclesTacticsUse } from '../chroniclesOfMatthiasTactics.js';
import { chroniclesApplyContentEffects } from './chroniclesContentRuntime.js';
import { CHRONICLES_EQUIPMENT } from './chroniclesEquipment.js';
import { CHRONICLES_SPELLS } from './chroniclesMagic.js';
import { chroniclesMapById, chroniclesMapIds, chroniclesMapInitialEnemyState } from './chroniclesMapCatalog.js';
import { chroniclesCampaignEpilogue } from './chroniclesCampaignEpilogue.js';

const at = (state, mapId, group, id) => {
  const entry = chroniclesMapById(mapId)[group].find((candidate) => candidate.id === id);
  expect(entry, `${mapId}/${id}`).toBeTruthy();
  return { ...state, mapId, x: entry.x, y: entry.y };
};
const use = (state, id) => {
  const offered = chroniclesTacticsInteractions(state).find((entry) => entry.id === id);
  expect(offered, `${id} offered`).toBeTruthy();
  expect(offered.locked, `${id} locked`).toBeFalsy();
  return chroniclesTacticsUse(state, id);
};
const defeat = (state, mapId, enemyId) => {
  const enemy = chroniclesMapById(mapId).enemies.find((entry) => entry.id === enemyId);
  return chroniclesApplyContentEffects({ ...state, [enemy.hpKey]: 0 }, enemy.onDefeat.effects);
};

describe('Terra, second wave', () => {
  it('ships three new towns and three new dungeons, reachable from their areas', () => {
    const ids = chroniclesMapIds();
    for (const id of ['molinoviejo', 'pinohelado', 'vinarrey', 'cripta-del-obispo', 'guarida-del-dragon', 'faro-roto']) {
      expect(ids).toContain(id);
    }
    expect(chroniclesMapById('terra-b5').exits.some((exit) => exit.id === 'b5-to-town')).toBe(true);
    expect(chroniclesMapById('terra-f5').exits.some((exit) => exit.id === 'f5-to-dungeon')).toBe(true);
  });

  it('sells only real equipment and real spells everywhere', () => {
    chroniclesMapIds().forEach((mapId) => {
      chroniclesMapById(mapId).interactables.forEach((entry) => {
        (entry.shop?.stock || []).forEach((itemId) => expect(CHRONICLES_EQUIPMENT[itemId], `${mapId}: ${itemId}`).toBeTruthy());
        (entry.guild?.spells || []).forEach((spellId) => expect(CHRONICLES_SPELLS[spellId], `${mapId}: ${spellId}`).toBeTruthy());
      });
    });
  });

  it('El viento prestado: a pact keeps the mills turning and sends the harpy away', () => {
    let state = at(createChroniclesState('molinoviejo'), 'molinoviejo', 'interactables', 'fermin-wind-brief');
    state = use(state, 'fermin-wind-brief');
    expect(state.inventory['blessed-grain']).toBeTruthy();
    state = use(at(chroniclesApplyContentEffects(state, [{ type: 'transition-map', mapId: 'terra-b2' }]), 'terra-b2', 'interactables', 'b2-wind-nest'), 'b2-wind-nest');
    expect(state.molinoviejoWindPact).toBe(true);
    const matron = chroniclesMapById('terra-b2').enemies.find((enemy) => enemy.id === 'b2-wind-matron');
    expect(chroniclesMapInitialEnemyState('terra-b2', state)[matron.hpKey]).toBe(0);
    state = use(at(state, 'molinoviejo', 'interactables', 'fermin-wind-pact'), 'fermin-wind-pact');
    expect(state.quests['molinoviejo-wind'].status).toBe('completed');
    expect(chroniclesCampaignEpilogue({ ...state, lostKingEnding: 'regency' }).lines.join(' ')).toMatch(/molinos siguen girando/);
  });

  it('La leñadora y el trol: moss heals Grum; killing him is the other road', () => {
    let state = use(at(createChroniclesState('pinohelado'), 'pinohelado', 'interactables', 'joris-greta-brief'), 'joris-greta-brief');
    state = use(at(state, 'terra-e2', 'interactables', 'e2-greta'), 'e2-greta');
    expect(chroniclesTacticsInteractions(at(state, 'terra-e2', 'interactables', 'e2-grum-cure')))
      .toContainEqual(expect.objectContaining({ id: 'e2-grum-cure', locked: true }));
    const healed = use(at(use(at(state, 'terra-e1', 'treasures', 'e1-frost-moss'), 'e1-frost-moss'), 'terra-e2', 'interactables', 'e2-grum-cure'), 'e2-grum-cure');
    const thanked = use(at(healed, 'pinohelado', 'interactables', 'joris-greta-healed'), 'joris-greta-healed');
    expect(thanked.inventory['steel-axe']).toBeTruthy();

    const slain = defeat(state, 'terra-e2', 'e2-grum');
    expect(slain.pinoheladoGrumSlain).toBe(true);
    const paid = use(at(slain, 'pinohelado', 'interactables', 'joris-greta-slain'), 'joris-greta-slain');
    expect(paid.quests['pinohelado-greta'].status).toBe('completed');
  });

  it('El diezmo del Canciller: the Obispo Hueco carries the proof; judge Orsino or sell it to him', () => {
    let state = use(at(createChroniclesState('vinarrey'), 'vinarrey', 'interactables', 'calixta-tithe-brief'), 'calixta-tithe-brief');
    expect(chroniclesTacticsInteractions(at(state, 'vinarrey', 'interactables', 'orsino-bribe')).some((entry) => entry.id === 'orsino-bribe')).toBe(false);
    state = defeat(state, 'cripta-del-obispo', 'cripta-del-obispo-foe-9');
    expect(state.inventory['tithe-ledger']).toBeTruthy();
    const judged = use(at(state, 'vinarrey', 'interactables', 'calixta-tithe-judge'), 'calixta-tithe-judge');
    expect(judged.vinarreyOrsinoJudged).toBe(true);
    const bribed = use(at(state, 'vinarrey', 'interactables', 'orsino-bribe'), 'orsino-bribe');
    expect(bribed.vinarreyOrsinoBribed).toBe(true);
    // Either way the ledger is gone and the other road closes.
    expect(chroniclesTacticsInteractions(at(bribed, 'vinarrey', 'interactables', 'calixta-tithe-judge')).some((entry) => entry.id === 'calixta-tithe-judge')).toBe(false);
  });
});
