import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newPreviewParty, PREVIEW_PARTY, rerollPreviewCharacter, updatePreviewCharacter } from '../web/game/party-preview.js';
import {
  CHRONICLES_CHARACTER_BUILD_VERSION,
  createCanonicalChroniclesCharacterBuild, validateChroniclesCharacterBuild,
} from '../web/game/chroniclesCharacterBuilds.js';
import { CHRONICLES_MM3_CLASS_IDS, chroniclesMM3ClassAllowed, chroniclesMM3Derived,
  chroniclesMM3MaxSpellPoints } from '../web/game/chroniclesMM3Rules.js';

test('independent browser imports retain actual Chronicles MM3 company classes and stats', () => {
  const canonical = createCanonicalChroniclesCharacterBuild(PREVIEW_PARTY);
  assert.equal(canonical.version, CHRONICLES_CHARACTER_BUILD_VERSION);
  assert.deepEqual(canonical.characters.map(hero => hero.classId), ['knight','paladin','cleric','archer']);
  assert.equal(CHRONICLES_MM3_CLASS_IDS.length, 10);
  assert.deepEqual(validateChroniclesCharacterBuild(canonical), { valid: true, errors: [] });
  const derived = chroniclesMM3Derived('paladin', canonical.characters[1].stats, { raceId: 'dwarf' });
  assert.equal(derived.maxHp, 11);
});

test('preview rolls exactly the same reproducible company as the legacy game rules', () => {
  const one = newPreviewParty('sample-001');
  assert.deepEqual(one, newPreviewParty('sample-001'));
  assert.equal(one.mode, 'custom');
  assert.equal(validateChroniclesCharacterBuild(one).valid, true);
  for (const hero of one.characters) {
    assert.ok(chroniclesMM3ClassAllowed(hero.classId, hero.stats));
    for (const v of Object.values(hero.stats)) assert.ok(v >= 3 && v <= 18);
  }
});

test('editing identity and race retains real derived HP/SP and never mutates source', () => {
  const canonical = createCanonicalChroniclesCharacterBuild(PREVIEW_PARTY);
  const renamed = updatePreviewCharacter(canonical, 'bishop', 'name', '  Laila   ');
  const elven = updatePreviewCharacter(renamed, 'bishop', 'raceId', 'elf');
  assert.equal(elven.mode, 'custom');
  assert.equal(elven.characters[2].name, 'Laila');
  assert.equal(elven.characters[2].raceId, 'elf');
  assert.equal(canonical.characters[2].raceId, 'human');
  assert.equal(chroniclesMM3MaxSpellPoints('cleric', elven.characters[2].stats, 'elf'),
    chroniclesMM3MaxSpellPoints('cleric', elven.characters[2].stats, 'human'));
  assert.equal(validateChroniclesCharacterBuild(elven).valid, true);
});

test('impossible class and unknown identity values are rejected', () => {
  const canonical = createCanonicalChroniclesCharacterBuild(PREVIEW_PARTY);
  for (const [field, value] of [
    ['classId', 'druid'], ['raceId', 'dragon'], ['sex', 'banana'],
    ['alignment', 'chaotic'], ['slotId', 'evil'], ['stats', { might: 99 }],
  ]) {
    assert.throws(() => updatePreviewCharacter(canonical, 'matthias', field, value), RangeError);
  }
  assert.throws(() => updatePreviewCharacter(canonical, 'absent', 'name', 'x'), RangeError);
  const same = updatePreviewCharacter(canonical, 'rook', 'name', 'Matthias');
  assert.equal(validateChroniclesCharacterBuild(same).valid, false);
});

test('reroll only changes one hero and keeps a legal first class', () => {
  const old = createCanonicalChroniclesCharacterBuild(PREVIEW_PARTY);
  const rerolled = rerollPreviewCharacter(old, 'knight', () => 0.999);
  assert.equal(rerolled.mode, 'custom');
  assert.deepEqual(rerolled.characters.slice(0,3), old.characters.slice(0,3));
  assert.ok(Object.values(rerolled.characters[3].stats).every(x => x === 18));
  assert.equal(validateChroniclesCharacterBuild(rerolled).valid, true);
  assert.equal(old.characters[3].stats.intellect, 13);
});

test('browser widget uses no storage, network calls or Chess Studio authentication', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../web/game/party-preview.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|WebSocket|chess-study-auth/);
  assert.match(src, /document\.createElement/);
  assert.match(src, /textContent/);
});
