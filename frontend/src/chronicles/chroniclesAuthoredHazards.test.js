import { describe, expect, it } from 'vitest';
import { chroniclesReduce, createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesMapById, chroniclesMapTransitionState } from './chroniclesMapCatalog.js';
import { chroniclesTacticsMove } from '../chroniclesOfMatthiasTactics.js';

describe('Chronicles authored environmental hazards', () => {
  it('keeps Ash Vault and Chain Basilica hazards one-shot and damaging', () => {
    const vault = chroniclesMapById('ash-vault');
    expect(vault.traps).toEqual([
      expect.objectContaining({ id: 'vault-slag-vent', visualType: 'slag-vent', x: 5, y: 5 }),
    ]);
    let vaultState = chroniclesMapTransitionState(createChroniclesState(), 'ash-vault');
    vaultState = { ...vaultState, x: 4, y: 5 };
    const vaultHp = vaultState.party.map((member) => member.hp);
    const scorched = chroniclesTacticsMove(vaultState, { x: 5, y: 5 });
    expect(scorched.vaultSlagVentSpent).toBe(true);
    expect(scorched.party.map((member) => member.hp)).toEqual(
      vaultHp.map((hp) => (hp > 0 ? Math.max(0, hp - 1) : hp)),
    );

    const basilica = chroniclesMapById('chain-basilica');
    expect(basilica.traps).toEqual([
      expect.objectContaining({ id: 'basilica-chain-plate', visualType: 'chain-plate', x: 8, y: 3 }),
    ]);
    let basilicaState = chroniclesMapTransitionState(createChroniclesState(), 'chain-basilica');
    basilicaState = { ...basilicaState, x: 7, y: 3 };
    const basilicaHp = basilicaState.party.map((member) => member.hp);
    const chained = chroniclesTacticsMove(basilicaState, { x: 8, y: 3 });
    expect(chained.basilicaChainPlateSpent).toBe(true);
    expect(chained.party.map((member) => member.hp)).toEqual(
      basilicaHp.map((hp) => (hp > 0 ? Math.max(0, hp - 2) : hp)),
    );
  });

  it('makes the optional Menagerie vent damage once in MM3 and persist across dungeon travel', () => {
    const map = chroniclesMapById('menagerie-of-ash');
    expect(map.traps).toEqual([
      expect.objectContaining({ id: 'menagerie-ember-vent', visualType: 'slag-vent', x: 5, y: 3 }),
    ]);
    expect(map.grid[3][4]).toBe('.');
    expect(map.grid[3][5]).toBe('.');

    const fresh = chroniclesMapTransitionState(createChroniclesState(), map.id);
    const defeatedEnemies = Object.fromEntries(map.enemies.map((enemy) => [enemy.hpKey, 0]));
    const before = { ...fresh, ...defeatedEnemies, x: 4, y: 3, direction: 1 };
    const hp = before.party.map((member) => member.hp);
    const scorched = chroniclesReduce(before, 'forward');
    expect({ x: scorched.x, y: scorched.y }).toEqual({ x: 5, y: 3 });
    expect(scorched.menagerieEmberVentSpent).toBe(true);
    expect(scorched.party.map((member) => member.hp)).toEqual(
      hp.map((value) => (value > 0 ? Math.max(0, value - 1) : value)),
    );

    const again = chroniclesReduce({ ...scorched, x: 4, y: 3, direction: 1 }, 'forward');
    expect(again.party).toEqual(scorched.party);
    const away = chroniclesMapTransitionState(again, 'gallery-of-forks');
    const restored = chroniclesMapTransitionState(JSON.parse(JSON.stringify(away)), map.id);
    expect(restored.menagerieEmberVentSpent).toBe(true);
    expect(restored.party).toEqual(scorched.party);

    // The same authored hazard must also work in the Tactics movement path.
    const tactics = chroniclesTacticsMove(before, { x: 5, y: 3 });
    expect(tactics.menagerieEmberVentSpent).toBe(true);
    expect(tactics.party.map((member) => member.hp)).toEqual(
      hp.map((value) => (value > 0 ? Math.max(0, value - 1) : value)),
    );
  });
});
