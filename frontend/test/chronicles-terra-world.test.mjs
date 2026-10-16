import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const base = new URL('../src/chronicles/maps/', import.meta.url);
function gitBlob(name) {
  const bytes = readFileSync(new URL(name, base));
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

test('all 61 original authored MM3 and Terra regions are present, including 44 missing return-link dependencies', () => {
  const names = readdirSync(base).filter(name => name.endsWith('.json'));
  assert.equal(names.length, 61);
  const entries = names.map(name => JSON.parse(readFileSync(new URL(name, base), 'utf8')));
  assert.equal(new Set(entries.map(map => map.id)).size, names.length);
  for (const m of entries) {
    assert.ok(Array.isArray(m.grid) && m.grid.length, m.id);
    assert.ok(m.grid.every(line => line.length === m.grid[0].length), m.id);
    assert.ok(names.includes(m.id + '.json'), m.id);
  }
  assert.equal(gitBlob('terra-c2.json'), '74294a79546004b870a4031552823384bcdc064c');
  assert.equal(gitBlob('terra-d4.json'), 'd4bafd106add0efc16774d71408a5273d7874a76');
  assert.equal(gitBlob('terra-f6.json'), 'cc351c1fae7830f17dbbb09cfcbdfc3018c3bcb3');
  assert.equal(gitBlob('ascuafria.json'), 'd92595d9f5c35c51cfa547a909d65c19628a9539');
});

test('bidirectional authored overworld gates never lead to missing maps', () => {
  const maps = Object.fromEntries(
    readdirSync(base).filter(name => name.endsWith('.json')).map(name => {
      const m = JSON.parse(readFileSync(new URL(name, base), 'utf8'));
      return [m.id, m];
    })
  );
  let checked = 0;
  for (const source of Object.values(maps)) {
    for (const exit of source.exits || []) {
      const transitions = (exit.action?.effects || []).filter(effect => effect.type === 'transition-map');
      for (const to of transitions) {
        assert.ok(maps[to.mapId], source.id + '/' + exit.id + ' points to missing ' + to.mapId);
        if (exit.requiresReturn) {
          assert.equal(transitions.length, 1);
          const reciprocal = (maps[to.mapId].exits || []).some(other =>
            other.requiresReturn && (other.action?.effects || []).some(effect =>
              effect.type === 'transition-map' && effect.mapId === source.id));
          assert.ok(reciprocal, source.id + '/' + exit.id + ' needs return link from ' + to.mapId);
        }
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 6, 'must validate the six Terra exits missing from previous extraction');
});
