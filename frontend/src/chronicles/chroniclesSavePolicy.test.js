import { describe, expect, it } from 'vitest';
import { chroniclesCanCheckpoint, chroniclesCheckpointReason } from './chroniclesSavePolicy.js';

describe('Chronicles first-person · MM3 save policy', () => {
  it('does not checkpoint ordinary movement, combat, dialogue or other changes within one area', () => {
    for (const map of ['swordhaven-first-book', 'swordhaven-sewers', 'banner-road-first-book']) {
      expect(chroniclesCheckpointReason(map, map)).toBeNull();
    }
  });

  it('does not automatically checkpoint the initial bootstrap', () => {
    expect(chroniclesCheckpointReason(null, 'swordhaven-first-book')).toBeNull();
    expect(chroniclesCheckpointReason('', 'swordhaven-first-book')).toBeNull();
  });

  it('checkpoints a real area transition and never a mere coordinate change', () => {
    expect(chroniclesCheckpointReason('swordhaven-first-book', 'swordhaven-sewers')).toBe('area-change');
    expect(chroniclesCheckpointReason('swordhaven-sewers', 'swordhaven-first-book')).toBe('area-change');
    expect(chroniclesCheckpointReason('swordhaven-first-book', 'swordhaven-first-book')).toBeNull();
  });


  it('refuses manual, save-exit, save-before-load and area-change writes while initiative is active', () => {
    const ready = { mapId: 'swordhaven-first-book', initiative: null };
    expect(chroniclesCanCheckpoint(ready)).toBe(true);
    expect(chroniclesCanCheckpoint({ ...ready, initiative: { round: 1, order: [], cursor: 0 } })).toBe(false);
    expect(chroniclesCanCheckpoint({ ...ready, initiative: { round: 2 } })).toBe(false);
    expect(chroniclesCanCheckpoint(null)).toBe(false);
    // Checkpoint reasons do not bypass the shared state-based guard.
    for (const reason of ['manual', 'area-change', 'epilogue']) {
      expect(chroniclesCanCheckpoint({ ...ready, initiative: { order: ['enemy'], reason } })).toBe(false);
    }
    // An encounter is complete only once the initiative state is cleared.
    expect(chroniclesCanCheckpoint({ ...ready, initiative: null })).toBe(true);
  });

  it('honors deliberate Save even when the area is unchanged', () => {
    expect(chroniclesCheckpointReason('swordhaven-first-book', 'swordhaven-first-book', true)).toBe('manual');
  });
});
