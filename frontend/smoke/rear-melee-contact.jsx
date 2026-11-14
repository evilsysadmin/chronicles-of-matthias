// CI-only browser regression for a genuine authored Swordhaven sewer goblin.
// Uses production initiative, melee, minimap and checkpoint reducers; no
// invented enemy, damage, API data or alternative combat rules.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  chroniclesActiveEnemies, chroniclesCombatMeleeTarget,
  chroniclesReduce, createChroniclesState,
} from '../src/chroniclesOfMatthias.js';
import {
  chroniclesCurrentInitiativeActor, chroniclesStartInitiativeCombat,
} from '../src/chronicles/chroniclesInitiative.js';
import { chroniclesCombatCameraFacing } from '../src/chronicles/chroniclesCombatCameraFacing.js';
import {
  chroniclesApplyRunCheckpoint, chroniclesRunCheckpointPayload,
} from '../src/chronicles/chroniclesRunCheckpoint.js';
import ChroniclesCombatRoster from '../src/components/ChroniclesCombatRoster.jsx';
import ChroniclesMinimap from '../src/components/ChroniclesMinimap.jsx';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';

const MAP = 'swordhaven-sewers';
const ENEMY_ID = 'sewers-goblin-west';

function authoredRearContact() {
  const initial = createChroniclesState(MAP, null, { rules: 'mm3' });
  const enemies = chroniclesActiveEnemies(initial);
  const goblin = enemies.find(enemy => enemy.id === ENEMY_ID);
  if (!goblin?.hpKey || goblin.ai?.attackReach !== 1) {
    throw new Error('Real Swordhaven sewer goblin is absent or no longer melee');
  }
  // Isolate the actual goblin from its squad for one controlled contact test.
  // A playable public run is tested separately: this fixture never claims it.
  const otherDead = Object.fromEntries(enemies
    .filter(enemy => enemy.id !== ENEMY_ID).map(enemy => [enemy.hpKey, 0]));
  const contact = {
    ...initial, ...otherDead, x: 1, y: 1, direction: 0,
    enemyPositions: { [ENEMY_ID]: { x: 1, y: 2 } },
  };
  const fight = chroniclesStartInitiativeCombat(contact, [goblin], { random: () => 0 });
  if (fight.phase !== 'combat' || fight.direction !== 2
    || chroniclesCombatMeleeTarget(fight)?.enemy?.id !== ENEMY_ID) {
    throw new Error('Rear melee contact did not auto-face the genuine goblin');
  }
  const partyTurn = fight.initiative.order.findIndex(actor => actor.kind === 'party');
  if (partyTurn < 0) throw new Error('No human initiative action');
  // Start the visual probe at an actual party turn, without altering any
  // combatant, HP, damage, legal moves or attack result.
  return { ...fight, initiative: { ...fight.initiative, cursor: partyTurn } };
}

function RearContactProbe() {
  const [state, setState] = useState(authoredRearContact);
  const [restores, setRestores] = useState(0);
  const [attacks, setAttacks] = useState(0);
  const actor = chroniclesCurrentInitiativeActor(state.initiative);
  const target = chroniclesCombatMeleeTarget(state);
  const facing = chroniclesCombatCameraFacing(state);
  const tryTurn = (action) => setState(before => chroniclesReduce(before, action));
  const attack = () => {
    setState(before => {
      const current = chroniclesCurrentInitiativeActor(before.initiative);
      if (current?.kind !== 'party' || !chroniclesCombatMeleeTarget(before)) return before;
      return chroniclesReduce(before, { type: 'attack', memberId: current.id, mode: 'melee' });
    });
    setAttacks(count => count + 1);
  };
  const restore = () => {
    setState(previous => {
      const payload = JSON.parse(JSON.stringify(chroniclesRunCheckpointPayload(previous, 17)));
      return chroniclesApplyRunCheckpoint(
        createChroniclesState(MAP, null, { rules: 'mm3' }), payload,
      );
    });
    setRestores(count => count + 1);
  };
  return (
    <main className="chronicles" data-qa-rear-melee="true"
      data-qa-map={state.mapId} data-qa-enemy={ENEMY_ID}
      data-qa-facing={facing} data-qa-turns={state.turns}
      data-qa-phase={state.phase} data-qa-restores={restores}
      data-qa-attacks={attacks} data-qa-target={target?.enemy?.id || ''}
      style={{ minHeight: '100dvh', padding: 14, background: '#10171e' }}>
      <h1>Contacto trasero · alcantarillas de Swordhaven</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, position: 'relative', zIndex: 10 }}>
        <button type="button" data-qa-turn-left onClick={() => tryTurn('turn-left')}>Girar izquierda</button>
        <button type="button" data-qa-turn-right onClick={() => tryTurn('turn-right')}>Girar derecha</button>
        <button type="button" data-qa-attack disabled={actor?.kind !== 'party' || !target}
          onClick={attack}>Atacar al goblin</button>
        <button type="button" data-qa-checkpoint onClick={restore}>Restaurar checkpoint</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', marginTop: 14 }}>
        <div className="chronicles-shell" style={{ position: 'relative', minWidth: 250, maxWidth: 370 }}>
          <ChroniclesCombatRoster state={state} />
        </div>
        <div style={{ width: 240, minHeight: 220 }}>
          <ChroniclesMinimap state={state} visitedCells={['1:1', '1:2']} onExpand={() => {}} />
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<RearContactProbe />);
