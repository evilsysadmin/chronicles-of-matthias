import { describe, expect, it } from 'vitest';
import { createChroniclesState, chroniclesReduce } from '../chroniclesOfMatthias.js';
import { chroniclesAreaTransitionIntent } from './chroniclesAreaTransitionIntent.js';

describe('MM3 area travel confirmations', () => {
  it('offers the real destination before leaving a settlement without spending a turn', () => {
    const state = createChroniclesState('swordhaven-square');
    const intent = chroniclesAreaTransitionIntent(state, 'backward');
    expect(intent?.sourceId).toBe('swordhaven-square');
    expect(intent?.destinationId).toBe('crypt-eight-squares');
    expect(intent?.question).toContain('Cripta de las Ocho Casillas');
    expect(state.mapId).toBe('swordhaven-square');
    expect(state.turns).toBe(0);
    expect(state.y).toBe(16);
  });

  it('moves onto the exit, keeps the party there on No, and reoffers the crossing with F', () => {
    const start = createChroniclesState('swordhaven-square');
    const intent = chroniclesAreaTransitionIntent(start, 'backward');
    expect(intent?.exitId).toBe('swordhaven-south-gate');
    // The UI chooses the deferred reducer action on this exact exit tile.
    const standing = chroniclesReduce(start, { type: 'backward', deferAreaTransition: true });
    expect(standing).toMatchObject({ mapId: 'swordhaven-square', x: 9, y: 17, phase: 'explore' });
    expect(standing.turns).toBe(start.turns + 1);
    // Choosing No only dismisses the UI and does not dispatch a reducer action.
    const declined = standing;
    expect(declined.x).toBe(standing.x);
    expect(declined.y).toBe(standing.y);
    expect(declined.turns).toBe(standing.turns);
    const retried = chroniclesAreaTransitionIntent(declined, 'interact');
    expect(retried).toMatchObject({ exitId: intent.exitId, destinationId: intent.destinationId, atThreshold: true });
    expect(retried.question).toBe(intent.question);
    const crossed = chroniclesReduce(declined, { type: 'cross-area-threshold', exitId: retried.exitId });
    expect(crossed.mapId).toBe('crypt-eight-squares');
    expect(crossed.turns).toBe(standing.turns);
    // A stale/wrong exit identifier must not trigger a different crossing.
    expect(chroniclesReduce(declined, { type: 'cross-area-threshold', exitId: 'nonexistent' })).toBe(declined);
  });

  it('reoffers a legacy dungeon completion on the exit tile after declining', () => {
    const base = createChroniclesState('crypt-eight-squares');
    const state = { ...base, x: 4, y: 1, direction: 3, sigilAwake: true,
      jailerHp: 0, scavengerHp: 0, blackGateKey: true };
    expect(chroniclesAreaTransitionIntent(state, 'forward')?.exitId).toBe('black-gate');
    const standing = chroniclesReduce(state, { type: 'forward', deferAreaTransition: true });
    expect(standing).toMatchObject({ mapId: 'crypt-eight-squares', x: 3, y: 1, phase: 'explore' });
    const retried = chroniclesAreaTransitionIntent(standing, 'interact');
    expect(retried).toMatchObject({ exitId: 'black-gate', atThreshold: true, destinationId: null });
    const crossed = chroniclesReduce(standing, { type: 'cross-area-threshold', exitId: 'black-gate' });
    expect(crossed.phase).toBe('escaped');
    expect(crossed.turns).toBe(standing.turns);
  });

  it('does not offer an on-tile retry when the exit requirements are unmet', () => {
    const state = createChroniclesState('crypt-eight-squares');
    const blocked = { ...state, x: 3, y: 1, sigilAwake: false };
    expect(chroniclesAreaTransitionIntent(blocked, 'interact')?.exitId).not.toBe('black-gate');
    expect(chroniclesReduce(blocked, { type: 'cross-area-threshold', exitId: 'black-gate' })).toBe(blocked);
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
    const unlocked = { ...locked, sigilAwake: true, jailerHp: 0, scavengerHp: 0, blackGateKey: true };
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
