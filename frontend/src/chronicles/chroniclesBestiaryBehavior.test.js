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
      expect(enemy.ai, `${mapId}/${enemy.id}`).toMatchObject({
        movement: 'cardinal-roam',
        engagedMovement: 'cardinal-chase',
        engageRange: 2,
      });
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

  it('keeps monster-heavy rooms from collapsing into one repeated pursuit pattern', () => {
    chroniclesMapIds().forEach((mapId) => {
      const map = chroniclesMapById(mapId);
      if (map.enemies.length < 4) return;
      const signatures = new Set(map.enemies.map(movementSignature));
      expect(signatures.size, mapId).toBeGreaterThanOrEqual(3);
    });
  });
});