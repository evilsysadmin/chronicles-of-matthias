import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function blob(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

test('full canonical MM3 world reducer is byte-exact from Chess Studio, not the old party stub', () => {
  const path = '../src/chroniclesOfMatthias.js';
  assert.equal(blob(path), '4021a49e0465279700da5ccda31effdcdb97f18e');
  const code = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const entry of [
    'createChroniclesState(', 'chroniclesReduce(', 'chroniclesObjective(',
    'chroniclesPartyAttackStats(', 'chroniclesJournalEntries(',
    "actionType === 'attack'", "actionType === 'cast'",
    "actionType === 'shop-buy'", "actionType === 'equip-item'",
    "actionType === 'guild-learn'",
  ]) assert.ok(code.includes(entry), entry);
  assert.ok(code.length > 30000);
});

test('new React uses the authentic map bootstrap and derives initial HP/PH from that world', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /createChroniclesState\('swordhaven-square', build, \{ rules: 'mm3' \}\)/);
  assert.match(app, /initialTownRun\.party\.map\(member =>/);
  assert.match(app, /\{member\.hp\}\/\{member\.maxHp\} PV/);
  assert.match(app, /chroniclesMemberSp\(initialTownRun, member\)/);
  assert.match(app, /data-chronicles-map-id=\{initialTownRun\.mapId\}/);
  assert.match(app, /paseo visual no actualiza combate ni guardados/);
});
