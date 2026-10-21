import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesAreaTransitionIntent } from './chroniclesAreaTransitionIntent.js';

describe('MM3 area travel confirmations', () => {
  it('offers the actual destination before leaving a settlement', () => {
    const state = createChroniclesState('swordhaven-square');
    const intent = chroniclesAreaTransitionIntent(state, 'backward');
    expect(intent?.sourceId).toBe('swordhaven-square');
    expect(intent?.destinationId).toBe('crypt-eight-squares');
    expect(intent?.question).toContain('Swordhaven');
    expect(intent?.question).toContain('¿Quieres');
    // An invitation is pure: no premature turn, movement or map switch.
    expect(state.mapId).toBe('swordhaven-square');
    expect(state.turns).toBe(0);
    expect(state.y).toBe(16);
  });

  it('does not open confirmations for ordinary movement, turning or combat', () => {
    const state = createChroniclesState('swordhaven-square');
    expect(chroniclesAreaTransitionIntent(state, 'forward')).toBeNull();
    expect(chroniclesAreaTransitionIntent(state, 'turn-left')).toBeNull();
    expect(chroniclesAreaTransitionIntent({ ...state, initiative: { cursor: 0 } }, 'backward')).toBeNull();
  });

  it('does not invite entry when an enemy blocks the destination', () => {
    const state = createChroniclesState('swordhaven-square');
    // The authored exit is at (9, 17). A blocked tile is not a valid transition.
    const inCombat = { ...state, phase: 'defeated' };
    expect(chroniclesAreaTransitionIntent(inCombat, 'backward')).toBeNull();
  });

  it('includes dungeon departure when the authored exit ends the expedition', () => {
    const state = createChroniclesState('crypt-eight-squares');
    const explored = { ...state, x: -100, y: -100 };
    expect(chroniclesAreaTransitionIntent(explored, 'turn-left')).toBeNull();
  });
});
