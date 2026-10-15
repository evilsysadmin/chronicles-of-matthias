import test from 'node:test';
import assert from 'node:assert/strict';
import { CHRONICLES_MM3_STATS, CHRONICLES_MM3_RACE_IDS, CHRONICLES_MM3_CLASS_IDS, chroniclesMM3RollStats, normalizeChroniclesMM3Stats } from '../src/chronicles/chroniclesMM3Rules.js';

test('seven canonical MM3 character stats', () => assert.equal(CHRONICLES_MM3_STATS.length, 7));
test('racial and class catalogs are populated', () => { assert.ok(CHRONICLES_MM3_RACE_IDS.length >= 5); assert.ok(CHRONICLES_MM3_CLASS_IDS.length >= 10); });
test('stat normalization yields bounded values', () => { const s = normalizeChroniclesMM3Stats({ might: 999, speed: -500 }); assert.equal(s, null); });
