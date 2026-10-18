import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_NARRATION_LOG_LIMIT,
  chroniclesAppendNarration,
  chroniclesLoadNarrationLog,
  chroniclesNarrationDurationMs,
  chroniclesSaveNarrationLog,
} from './chroniclesNarrationLog.js';

describe('Chronicles narration log', () => {
  it('keeps lines newest first, skips repeats and blanks, and caps its length', () => {
    let log = chroniclesAppendNarration([], 'Uno', 1);
    log = chroniclesAppendNarration(log, 'Uno', 2);
    log = chroniclesAppendNarration(log, '   ', 3);
    log = chroniclesAppendNarration(log, 'Dos', 4);
    expect(log.map((entry) => entry.text)).toEqual(['Dos', 'Uno']);
    for (let i = 0; i < 100; i += 1) log = chroniclesAppendNarration(log, `L${i}`, i);
    expect(log).toHaveLength(CHRONICLES_NARRATION_LOG_LIMIT);
    expect(log[0].text).toBe('L99');
  });

  it('remembers each run separately', () => {
    chroniclesSaveNarrationLog('run-a', [{ text: 'A', at: 1 }]);
    chroniclesSaveNarrationLog('run-b', [{ text: 'B', at: 1 }]);
    expect(chroniclesLoadNarrationLog('run-a').map((entry) => entry.text)).toEqual(['A']);
    expect(chroniclesLoadNarrationLog('run-b').map((entry) => entry.text)).toEqual(['B']);
    expect(chroniclesLoadNarrationLog(null)).toEqual([]);
  });

  it('gives long lines more time on screen, within limits', () => {
    expect(chroniclesNarrationDurationMs('Corto.')).toBe(4000);
    expect(chroniclesNarrationDurationMs('x'.repeat(120))).toBe(8400);
    expect(chroniclesNarrationDurationMs('x'.repeat(1000))).toBe(12000);
  });
});
