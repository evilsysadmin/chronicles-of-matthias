import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildChroniclesEnemyNameplate,
  chroniclesEnemyHealthTint,
  chroniclesEnemyNameplateText,
} from './chroniclesEnemyNameplate.js';

afterEach(() => vi.unstubAllGlobals());

describe('Enemy health nameplates', () => {
  it('uses green only at full HP, amber above half, and red at half or lower', () => {
    expect(chroniclesEnemyHealthTint(10, 10)).toBe('#82dda0');
    expect(chroniclesEnemyHealthTint(9, 10)).toBe('#f3ce68');
    expect(chroniclesEnemyHealthTint(6, 10)).toBe('#f3ce68');
    expect(chroniclesEnemyHealthTint(5, 10)).toBe('#f56d69');
    expect(chroniclesEnemyHealthTint(1, 10)).toBe('#f56d69');
    expect(chroniclesEnemyHealthTint(0, 10)).toBe('#f56d69');
  });

  it('renders the real enemy name and updates its tint without replacing its texture per hit', () => {
    const drawn = [];
    const ctx = {
      clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
      strokeText: vi.fn(), fillText: vi.fn(function (...args) {
        drawn.push({ text: args[0], color: this.fillStyle });
      }),
    };
    const canvas = { width: 0, height: 0, getContext: () => ctx };
    vi.stubGlobal('document', { createElement: () => canvas });
    const plate = buildChroniclesEnemyNameplate({
      id: 'south-bandit', name: 'Ratero de los callejones', maxHp: 10,
    }, 2.5);
    expect(plate.sprite.name).toBe('chronicles-enemy-nameplate-south-bandit');
    expect(plate.sprite.visible).toBe(false);
    expect(plate.sprite.position.y).toBeCloseTo(2.73);
    const texture = plate.sprite.material.map;
    plate.update(10);
    expect(plate.sprite.visible).toBe(true);
    expect(drawn.at(-1)).toEqual({ text: 'RATERO DE LOS CALLEJONES', color: '#82dda0' });
    plate.update(9);
    expect(drawn.at(-1).color).toBe('#f3ce68');
    plate.update(8); // same health band; don't redraw each frame.
    expect(drawn).toHaveLength(2);
    plate.update(5);
    expect(drawn.at(-1).color).toBe('#f56d69');
    plate.update(0);
    expect(plate.sprite.visible).toBe(false);
    expect(plate.sprite.material.map).toBe(texture);
    plate.dispose();
  });

  it('uses an authored enemy type when its name is not present', () => {
    expect(chroniclesEnemyNameplateText({ visualType: 'road-bandit' })).toBe('road-bandit');
    expect(chroniclesEnemyNameplateText({ name: 'A'.repeat(40) }).length).toBeLessThanOrEqual(29);
  });
});
