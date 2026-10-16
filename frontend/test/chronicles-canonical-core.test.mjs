import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CHRONICLES_EQUIPMENT, chroniclesEquipItem, chroniclesUnequipItem } from '../src/chronicles/chroniclesEquipment.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp, chroniclesMemberSpells } from '../src/chronicles/chroniclesMagic.js';
import { createDefaultChroniclesEnemyBuild, normalizeChroniclesEnemyBuild, chroniclesEnemyBuildModifiers } from '../src/chronicles/chroniclesEnemyBuilds.js';

const original = 'chess-studio@55e95f75d5c417e95dbe39f87c9e2732bf3736fa';
const mapIds = [
  'crypt-eight-squares', 'swordhaven-square', 'swordhaven-campaign',
  'banner-road', 'swordhaven-first-book', 'banner-road-first-book',
  'rookwood-first-book', 'swordhaven-sewers', 'gallery-of-forks',
  'menagerie-of-ash', 'ash-vault', 'blind-king-archive', 'iron-foundry',
  'chain-basilica', 'hollow-bell-tower', 'black-glass-chapel', 'echo-cistern',
];

function originalGitBlob(path) {
  const bytes = readFileSync(new URL('../src/chronicles/' + path, import.meta.url));
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

test('all 17 canonical authored area manifests are original, distinct and internally rectangular', () => {
  const ids = new Set();
  for (const id of mapIds) {
    const map = JSON.parse(readFileSync(new URL('../src/chronicles/maps/' + id + '.json', import.meta.url), 'utf8'));
    assert.equal(map.id, id);
    assert.ok(Array.isArray(map.grid) && map.grid.length > 2, id);
    assert.ok(map.grid.every(row => typeof row === 'string' && row.length === map.grid[0].length), id);
    assert.ok(map.partyStart && Number.isInteger(map.partyStart.x) && Number.isInteger(map.partyStart.y), id);
    assert.ok(!ids.has(id), id);
    ids.add(id);
  }
  assert.equal(ids.size, 17);
  assert.equal(originalGitBlob('maps/swordhaven-square.json'), '3ec1fbc76c8ffc232a0a4dfb7b850a735796f64e');
  assert.equal(originalGitBlob('maps/swordhaven-first-book.json'), '595559996dc72373ce630dfd727a25fb449c50ca');
  assert.equal(originalGitBlob('maps/swordhaven-sewers.json'), '9cfc57c31fa167b97d0060177688ea90d134c3e9');
});

test('original core economy, magic and map modules have verifiable source identity', () => {
  for (const [name, sha] of [
    ['chroniclesMapCatalog.js','9b955ca14482faef4f8468d5f5c7924fbd1e1b4f'],
    ['chroniclesContentRuntime.js','b9feb9347a3bd22e6edd750ec0c30d61e6b2a23d'],
    ['chroniclesEquipment.js','28698bdae7198a2971247f1101472a16725a1fcd'],
    ['chroniclesMagic.js','66f9ca99c70a851a2b5e1473e0c604a256a25a17'],
    ['chroniclesEnemyBuilds.js','4ffd3879e95714ffbcf91cf750db626738b12600'],
  ]) assert.equal(originalGitBlob(name), sha, name + ' differs from ' + original);
});

test('original equipment catalog has normal weapons and equipped items belong to run state', () => {
  const sword = CHRONICLES_EQUIPMENT['iron-sword'];
  assert.ok(sword, 'iron sword must be a real item');
  assert.equal(sword.slot, 'weapon');
  const initial = {
    phase: 'explore', initiative: null,
    party: [{ id: 'matthias', name: 'Matthias', hp: 8, mm3: { classId: 'knight' } }],
    inventory: { 'iron-sword': { id: 'iron-sword', quantity: 1, name: sword.name } },
    equipment: {},
  };
  const equipped = chroniclesEquipItem(initial, 'matthias', 'iron-sword');
  assert.notEqual(equipped, initial);
  assert.equal(equipped.equipment.matthias.weapon, 'iron-sword');
  assert.equal(equipped.inventory['iron-sword'], undefined);
  const restored = chroniclesUnequipItem(equipped, 'matthias', 'weapon');
  assert.equal(restored.inventory['iron-sword'].quantity, 1);
  assert.equal(restored.equipment.matthias.weapon, undefined);
  assert.equal(initial.inventory['iron-sword'].quantity, 1);
  assert.equal(chroniclesEquipItem({ ...initial, phase: 'combat' }, 'matthias', 'iron-sword').phase, 'combat');
});

test('original MM3 spellpoints depend on actual character class and learned spell school', () => {
  const member = { id: 'bishop', mm3: {
    classId: 'cleric', raceId: 'human',
    stats: { might: 10, intellect: 14, personality: 17, endurance: 12, speed: 13, accuracy: 11, luck: 12 },
  }};
  const state = { rpgModifiers: { bishop: { level: 2 } }, spellPoints: { bishop: 2 } };
  const max = chroniclesMemberMaxSp(state, member);
  assert.ok(max >= 2);
  assert.equal(chroniclesMemberSp(state, member), 2);
  assert.ok(chroniclesMemberSpells(state, member).some(spell => spell.id === 'first-aid'));
  assert.equal(chroniclesMemberMaxSp(state, { ...member, mm3: { ...member.mm3, classId: 'knight' } }), 0);
});

test('enemy skill modifiers come from authored EnemyBuild; no fabricated combat AI', () => {
  const baseline = createDefaultChroniclesEnemyBuild('bandit');
  assert.equal(baseline.level, 1);
  const build = normalizeChroniclesEnemyBuild({
    archetype: 'bandit', level: 3,
    attributes: { vigor: 2, power: 4, agility: 3 },
    skills: ['brutal-strike', 'thick-hide'],
  });
  const mods = chroniclesEnemyBuildModifiers(build);
  assert.equal(mods.bonusMaxHp, 4);
  assert.equal(mods.damageBonus, 3);
  assert.equal(mods.initiativeBonus, 3);
});
