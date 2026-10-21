import { describe, expect, it } from 'vitest';
import { createChroniclesState } from '../chroniclesOfMatthias.js';
import { chroniclesAreaTransitionIntent } from './chroniclesAreaTransitionIntent.js';

describe('MM3 area travel confirmations', () => {
  it('offers the real destination before leaving a settlement without spending a turn', () => {
    const state = createChroniclesState('swordhaven-square');
    const intent = chroniclesAreaTransitionIntent(state, 'backward');
    expect(intent?.sourceId).toBe('swordhaven-square');
    expect(intent?.destinationId).toBe('crypt-eight-squares');
    expect(intent?.question).toContain('Swordhaven');
    expect(intent?.question).toContain('Cripta de las Ocho Casillas');
    expect(state.mapId).toBe('swordhaven-square');
    expect(state.turns).toBe(0);
    expect(state.y).toBe(16);
  });

  it('does not prompt for ordinary movement, turning or initiative combat', () => {
    const state = createChroniclesState('swordhaven-square');
    expect(chroniclesAreaTransitionIntent(state, 'forward')).toBeNull();
    expect(chroniclesAreaTransitionIntent(state, 'turn-left')).toBeNull();
    expect(chroniclesAreaTransitionIntent({ ...state, initiative: { cursor: 0 } }, 'backward')).toBeNull();
  });

  it('refuses the locked Black Gate, and prompts only when the guard and seal are cleared', () => {
    const locked = { ...createChroniclesState('crypt-eight-squares'), x: 4, y: 1, direction: 3 };
    expect(chroniclesAreaTransitionIntent(locked, 'forward')).toBeNull();
    const unlocked = { ...locked, sigilAwake: true, jailerHp: 0, blackGateKey: true };
    const intent = chroniclesAreaTransitionIntent(unlocked, 'forward');
    expect(intent?.exitId).toBe('black-gate');
    expect(intent?.destinationId).toBeNull(); // Legacy dungeon exit completes the adventure.
    expect(intent?.question).toContain('¿Quieres abandonar Cripta de las Ocho Casillas?');
  });

  it('handles interacting with a reciprocal dungeon portal', () => {
    const state = createChroniclesState('swordhaven-sewers');
    const intent = chroniclesAreaTransitionIntent(state, 'interact');
    expect(intent?.destinationId).toBe('swordhaven-first-book');
    expect(intent?.question).toContain('¿Quieres salir hacia');
  });

  it('never invites travel while inside a shop or after a defeat', () => {
    const state = createChroniclesState('swordhaven-square');
    expect(chroniclesAreaTransitionIntent({ ...state, shop: { id: 'vendor' } }, 'backward')).toBeNull();
    expect(chroniclesAreaTransitionIntent({ ...state, phase: 'defeated' }, 'backward')).toBeNull();
  });
});
