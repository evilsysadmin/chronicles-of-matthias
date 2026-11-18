// Keep the real public-staging rear shooter smoke on open authored tiles.
// A fresh Swordhaven party cannot cross the sewer grate without the key.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  REAR_SHOOTER_MAP_ID, REAR_SHOOTER_ENEMY_ID, REAR_SHOOTER_START,
  REAR_SHOOTER_ROUTE, REAR_SHOOTER_VANTAGE,
} from '../frontend/smoke/public-rear-shooter-route.mjs';

const map = JSON.parse(readFileSync(
  new URL('../frontend/src/chronicles/maps/swordhaven-first-book.json', import.meta.url),
  'utf8',
));
const vectors = [[0, -1], [1, 0], [0, 1], [-1, 0]];

test('rear shooter golden route crosses only open tiles and never locked exits', () => {
  assert.equal(map.id, REAR_SHOOTER_MAP_ID);
  const blockedExits = new Set(
    map.exits.filter(exit => exit.requirements?.length).map(exit => `${exit.x},${exit.y}`),
  );
  assert.ok(blockedExits.has('13,13'), 'sewer grate must remain a locked exit');
  let { x, y, direction } = REAR_SHOOTER_START;
  assert.equal(map.grid[y]?.[x], '.', 'initial tile is walkable');

  for (const [index, step] of REAR_SHOOTER_ROUTE.entries()) {
    switch (step.action) {
      case 'ArrowRight':
        direction = (direction + 1) % 4;
        break;
      case 'ArrowLeft':
        direction = (direction + 3) % 4;
        break;
      case 'ArrowUp':
        x += vectors[direction][0];
        y += vectors[direction][1];
        break;
      case 'e': // MM3 strafe right, with facing unchanged
        x += vectors[(direction + 1) % 4][0];
        y += vectors[(direction + 1) % 4][1];
        break;
      default:
        assert.fail(`Unexpected exploration input ${step.action}`);
    }
    const where = `route step ${index + 1} (${step.action})`;
    assert.deepEqual({ x, y, direction }, {
      x: step.x, y: step.y, direction: step.direction,
    }, where);
    assert.equal(map.grid[y]?.[x], '.', where + ' must be walkable');
    assert.equal(blockedExits.has(`${x},${y}`), false,
      where + ' must not cross a locked exit');
  }

  assert.deepEqual({ x, y, direction }, REAR_SHOOTER_VANTAGE);
  const shooter = map.enemies.find(enemy => enemy.id === REAR_SHOOTER_ENEMY_ID);
  assert.ok(shooter, 'authored rear shooter still exists');
  assert.equal(shooter.y, y, 'vantage must share the real shooter corridor');
  assert.equal(shooter.x - x, 2, 'shooter is exactly two cells east, behind west-facing party');
  assert.equal(direction, 3, 'party still faces west at vantage');
});
