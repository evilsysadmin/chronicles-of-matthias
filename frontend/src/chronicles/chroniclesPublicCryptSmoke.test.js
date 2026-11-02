import { describe, expect, it } from 'vitest';
import { chroniclesMapById, chroniclesMapIds } from './chroniclesMapCatalog.js';

describe('public crypt combat smoke prerequisites', () => {
  it('keeps the authored crypt playable without the retired Swordhaven map', () => {
    expect(chroniclesMapIds()).not.toContain('swordhaven-square');
    const crypt = chroniclesMapById('crypt-eight-squares');
    expect(crypt).toBeTruthy();
    expect(crypt.partyStart).toMatchObject({ x: 1, y: 5, direction: 1 });
    const pawn = crypt.enemies.find((enemy) => enemy.id === 'corrupted-pawn');
    expect(pawn).toMatchObject({
      x: 3, y: 5, maxHp: 5,
      ai: { engagedMovement: 'cardinal-chase', engageRange: 1 },
    });
    expect(crypt.grid[5][2]).toBe('.');
  });
});
