// CI-only visual window into the REAL B3 Three.js scene. The first-person
// camera is parked at a known unobstructed observation tile to photograph the
// goblin; the real expedition stays at its original spawn while the production
// exploration entry point advances enemy positions. No simulated enemy steps,
// special production route or server writes.
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesMapById } from '../src/chronicles/chroniclesMapCatalog.js';
import { chroniclesGridExplorationStep } from '../src/chronicles/chroniclesGridExplorationStep.js';
import { chroniclesRuntimeEnemyPosition } from '../src/chroniclesOfMatthiasTurns.js';
import { createChroniclesOfMatthiasGame } from '../src/chroniclesOfMatthiasThree.js';

const MAP = 'terra-b3';
const PATROL = 'terra-b3-foe-8';
const route = [{ x: 15, y: 9 }, { x: 15, y: 10 },
  { x: 14, y: 10 }, { x: 14, y: 9 }];
const map = chroniclesMapById(MAP);
const goblin = map.enemies.find(enemy => enemy.id === PATROL);
if (!goblin || goblin.ai?.movement !== 'patrol-route') {
  throw new Error('The saved B3 patrol is not available in authored map content');
}
const rest = Object.fromEntries(map.enemies.filter(enemy => enemy.id !== PATROL)
  .map(enemy => [enemy.hpKey, 0]));
let expedition = { ...createChroniclesState(MAP, null, { rules: 'mm3' }), ...rest };
let count = 0;
let engine = null;
const host = document.getElementById('scene');
const button = document.getElementById('next');
const output = document.getElementById('status');

// The screenshot camera is not the player's gameplay location. Preserve
// simulation position/direction and use the real renderer solely for observing
// the same state from (15,6) south toward the four authored patrol cells.
const observationFrame = () => ({ ...expedition, x: 15, y: 6, direction: 2 });
function stamp() {
  const actual = chroniclesRuntimeEnemyPosition(expedition, goblin);
  Object.assign(document.body.dataset, {
    qaMap: expedition.mapId,
    qaPatrolId: goblin.id,
    qaPatrolX: String(actual.x),
    qaPatrolY: String(actual.y),
    qaStep: String(count),
    qaEnemies: String(map.enemies.length),
    qaPlayX: String(expedition.x),
    qaPlayY: String(expedition.y),
    qaViewX: '15',
    qaViewY: '6',
    qaViewDirection: 'south',
    qaPhase: expedition.phase,
  });
  output.textContent = `B3 · ${count}/4 · goblin (${actual.x},${actual.y})`;
}
stamp();

engine = createChroniclesOfMatthiasGame(host, {
  initialState: observationFrame(),
  onFirstFrame: () => { document.body.dataset.qaWebglReady = 'true'; },
});
engine.renderState(observationFrame());
button.addEventListener('click', () => {
  if (count >= route.length) return;
  const before = expedition;
  expedition = chroniclesGridExplorationStep(before, 'turn-right');
  count += 1;
  const position = chroniclesRuntimeEnemyPosition(expedition, goblin);
  const expected = route[count % route.length];
  if (position.x !== expected.x || position.y !== expected.y) {
    throw new Error(`B3 patrol moved to (${position.x},${position.y}) instead of (${expected.x},${expected.y})`);
  }
  if (expedition.phase !== 'explore' || expedition.x !== before.x || expedition.y !== before.y) {
    throw new Error('B3 patrol preview unexpectedly mutated the actual expedition');
  }
  stamp();
  engine.renderState(observationFrame());
  if (count === route.length) button.disabled = true;
});
window.addEventListener('pagehide', () => engine?.destroy(), { once: true });
