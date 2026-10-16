import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  SWORDHAVEN_BUILDINGS, SWORDHAVEN_SPAWN,
  SWORDHAVEN_GATE_CELL, createSwordhavenWalkGrid,
} from '../src/chronicles/chroniclesSwordhaven3D.js';
import {
  createSwordhavenWalkState, swordhavenWalkStep, SWORDHAVEN_WALK_GRID,
} from '../src/chronicles/swordhavenWalk.js';

function originalBlob(path) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  return createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
}

test('Swordhaven builder and pixel textures are byte-identical to original Chess Studio source', () => {
  // Source: chess-studio@86036ea3b1799e2b5ce927b8746eb0567a6ac4bc
  assert.equal(originalBlob('../src/chronicles/chroniclesSwordhaven3D.js'),
    'dbdc3e7975dc46720d70bf050e24932bf8453a3c');
  assert.equal(originalBlob('../src/chronicles/chroniclesPixelTextures.js'),
    '3c4599b733d30402c5022e9fb514fd956e121fbe');
});

test('real authored city and 19x19 collision grid remain intact', () => {
  assert.equal(SWORDHAVEN_BUILDINGS.length, 5);
  assert.deepEqual(SWORDHAVEN_SPAWN, { x: 9, y: 16, direction: 0 });
  assert.deepEqual(SWORDHAVEN_GATE_CELL, { x: 9, y: 17 });
  const grid = createSwordhavenWalkGrid();
  assert.equal(grid.length, 19);
  assert.ok(grid.every(row => row.length === 19));
  assert.deepEqual(grid, SWORDHAVEN_WALK_GRID);
  assert.equal(grid[9][9], '#'); // Actual fountain collider
  assert.equal(grid[16][9], '.'); // Walkable spawn
  assert.equal(grid[18][9], '#'); // Town boundary
  for (const b of SWORDHAVEN_BUILDINGS) assert.equal(grid[b.y][b.x], '#');
});

test('first-person movement respects original building, fountain and perimeter collisions', () => {
  const start = createSwordhavenWalkState();
  const forward = swordhavenWalkStep(start, 'forward');
  assert.deepEqual([forward.x, forward.y, forward.direction, forward.turns], [9, 15, 0, 1]);
  const gate = swordhavenWalkStep(start, 'backward');
  assert.deepEqual([gate.x, gate.y], [9, 17]);
  assert.match(gate.message, /salida/i);
  const boundary = swordhavenWalkStep(gate, 'backward');
  assert.deepEqual([boundary.x, boundary.y, boundary.turns], [9, 17, 2]);
  assert.match(boundary.message, /bloquea/);
  const fountain = swordhavenWalkStep({ ...start, x: 9, y: 10 }, 'forward');
  assert.deepEqual([fountain.x, fountain.y], [9, 10]);
  assert.equal(start.turns, 0); // no mutation
});

test('orientation, strafing and unknown actions cannot bypass the grid', () => {
  const start = createSwordhavenWalkState();
  assert.equal(swordhavenWalkStep(start, 'unsupported'), start);
  assert.equal(swordhavenWalkStep({ ...start, direction: 99 }, 'forward').turns, 0);
  assert.equal(swordhavenWalkStep(start, 'turn-left').direction, 3);
  assert.equal(swordhavenWalkStep(start, 'turn-right').direction, 1);
  const sideways = swordhavenWalkStep(start, 'strafe-right');
  assert.equal(sideways.x, 10);
  assert.equal(sideways.y, 16);
});

test('React is wired to the original 3D builder with controlled lifecycle and no invented gameplay', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const viewport = readFileSync(new URL('../src/components/SwordhavenViewport.jsx', import.meta.url), 'utf8');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies.three, '0.186.1');
  assert.match(app, /<SwordhavenViewport state=\{town\}/);
  assert.match(app, /Recorrer Swordhaven original en 3D/);
  assert.match(app, /chroniclesPartyPortraitUrl/);
  assert.match(viewport, /buildSwordhavenScene\(scene/);
  assert.match(viewport, /new THREE.WebGLRenderer/);
  assert.match(viewport, /Math.atan2\(-direction.dx, -direction.dy\)/);
  assert.match(viewport, /ResizeObserver/);
  assert.match(viewport, /disposeVisuals\(scene\)/);
  assert.match(viewport, /renderer\?\.dispose\(\)/);
  assert.match(app, /todavía no hay comerciantes, misiones, combate, transición de mapas ni guardados/);
});
