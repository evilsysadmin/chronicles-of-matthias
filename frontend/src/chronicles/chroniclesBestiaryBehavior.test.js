import { describe, expect, it } from 'vitest';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';

function catalogEnemies() {
  return chroniclesMapIds().flatMap((mapId) => (
    chroniclesMapById(mapId).enemies.map((enemy) => ({ mapId, enemy }))
  ));
}

function movementSignature(enemy) {
  const movement = enemy.ai?.movement || 'cardinal-chase';
  const engagedMovement = enemy.ai?.engagedMovement || '-';
  const reach = Number(enemy.ai?.attackReach ?? enemy.retaliationReach ?? 1);
  // Pursuit activation distance changes enemy behavior even when the step
  // geometry is the same: goblins, spiders and hounds remain distinct.
  const engageRange = enemy.ai?.engageRange ?? '-';
  return `${movement}>${engagedMovement}@${reach}~${engageRange}`;
}

describe('Chronicles Tactics bestiary behavior', () => {
  it('gives recurring fantasy species a recognizable tactical identity', () => {
    const enemies = catalogEnemies();

    const goblins = enemies.filter(({ enemy }) => enemy.visualType === 'ash-goblin');
    expect(goblins.length).toBeGreaterThanOrEqual(3);
    goblins.forEach(({ mapId, enemy }) => {
      // Sewer pack goblins ambush in place; lone goblins in other regions
      // still roam and pursue. Both must keep cardinal combat movement.
      if (enemy.squadId) {
        expect(mapId).toBe('swordhaven-sewers');
        expect(enemy.killXp).toBe(2);
        expect(enemy.ai, `${mapId}/${enemy.id}`).toMatchObject({
          movement: 'hold',
          engagedMovement: 'cardinal-chase',
          engageRange: 3,
        });
      } else {
        expect(enemy.ai, `${mapId}/${enemy.id}`).toMatchObject({
          movement: 'cardinal-roam',
          engagedMovement: 'cardinal-chase',
          engageRange: 2,
        });
      }
    });

    const spiders = enemies.filter(({ enemy }) => enemy.visualType === 'crypt-spider');
    expect(spiders.length).toBeGreaterThanOrEqual(6);
    spiders.forEach(({ mapId, enemy }) => {
      // Hand-authored old maps can still carry the original chess-derived
      // movement tag, but MM3's organic-creature resolver normalizes it to
      // one cardinal tile. New maps must use the explicit cardinal policy.
      expect(['cardinal-chase', 'knight-chase'], `${mapId}/${enemy.id}`)
        .toContain(enemy.ai?.engagedMovement);
      if (mapId === 'swordhaven-sewers') {
        expect(enemy.ai?.engagedMovement, enemy.id).toBe('cardinal-chase');
      }
      expect(enemy.ai?.engageRange, `${mapId}/${enemy.id}`).toBe(3);
    });

    const hounds = enemies.filter(({ enemy }) => enemy.visualType === 'bone-hound');
    expect(hounds.length).toBeGreaterThanOrEqual(5);
    hounds.forEach(({ mapId, enemy }) => {
      expect(enemy.ai, `${mapId}/${enemy.id}`).toMatchObject({
        movement: 'cardinal-roam',
        engagedMovement: 'cardinal-chase',
        engageRange: 4,
      });
    });

    const wisps = enemies.filter(({ enemy }) => enemy.visualType === 'ember-wisp');
    expect(wisps.length).toBeGreaterThanOrEqual(6);
    wisps.forEach(({ mapId, enemy }) => {
      expect(enemy.ai?.movement, `${mapId}/${enemy.id}`).toBe('hold');
      expect(Number(enemy.ai?.attackReach ?? enemy.retaliationReach ?? 1), `${mapId}/${enemy.id}`).toBeGreaterThanOrEqual(2);
    });
  });

  it('deploys the new hill orc as a real pursuing encounter without changing original goblins', () => {
    const b2 = chroniclesMapById('terra-b2');
    const orc = b2.enemies.find((enemy) => enemy.id === 'terra-b2-foe-2');
    expect(orc?.visualType).toBe('orc-raider');
    expect(orc?.hpKey).toBe('terra_b2Foe2Hp');
    expect(orc?.ai).toMatchObject({
      movement: 'cardinal-chase', engagedMovement: 'cardinal-chase',
      engageRange: 3, attackReach: 1,
    });
    expect(b2.enemies.find((enemy) => enemy.id === 'terra-b2-foe-1')?.visualType).toBe('ash-goblin');
  });

  it('deploys gnoll and hellhound as distinct exterior encounters without changing their saved slots', () => {
    for (const [mapId, id, visual, hp] of [
      ['terra-b2', 'terra-b2-foe-3', 'gnoll', 'terra_b2Foe3Hp'],
      ['terra-f3', 'terra-f3-foe-3', 'hellhound', 'terra_f3Foe3Hp'],
    ]) {
      const foe = chroniclesMapById(mapId).enemies.find((enemy) => enemy.id === id);
      expect(foe?.visualType).toBe(visual);
      expect(foe?.hpKey).toBe(hp);
      expect(foe?.ai?.engagedMovement).toBe('cardinal-chase');
      expect(foe?.ai?.engageRange).toBe(4);
    }
  });

  it('keeps monster-heavy rooms from collapsing into one repeated pursuit pattern', () => {
    chroniclesMapIds().forEach((mapId) => {
      const map = chroniclesMapById(mapId);
      if (map.enemies.length < 4) return;
      const signatures = new Set(map.enemies.map(movementSignature));
      expect(signatures.size, mapId).toBeGreaterThanOrEqual(3);
    });
  });
});