import { describe, expect, it } from 'vitest';
import {
  chroniclesClearSessionResume,
  chroniclesLoadSessionResume,
  chroniclesSaveSessionResume,
} from './chroniclesSessionResume.js';

describe('Chronicles resume after reload', () => {
  const state = { mapId: 'swordhaven-first-book', x: 9, y: 4, direction: 2 };

  it('brings back where the company was in this tab', () => {
    chroniclesSaveSessionResume('run-1', { state, worldVersion: 3, progression: { heroes: {} }, automap: { m: ['1:1'] } });
    expect(chroniclesLoadSessionResume('run-1', 3)).toMatchObject({ state, automap: { m: ['1:1'] } });
  });

  it('gives way to a newer server save and is gone once cleared', () => {
    chroniclesSaveSessionResume('run-2', { state, worldVersion: 3 });
    expect(chroniclesLoadSessionResume('run-2', 4)).toBeNull();
    chroniclesClearSessionResume('run-2');
    expect(chroniclesLoadSessionResume('run-2', 3)).toBeNull();
    expect(chroniclesLoadSessionResume(null, 0)).toBeNull();
  });
});
