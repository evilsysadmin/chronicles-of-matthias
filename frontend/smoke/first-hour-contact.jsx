// CI-only visual fixture. Uses real authored map/targeting, real volley roster
// and real banner-contract payment from the reducer. No mocked encounters or gold.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CHRONICLES_DIRECTIONS,
  chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShooters,
  chroniclesTileAt,
  createChroniclesState,
  chroniclesReduce,
} from '../src/chroniclesOfMatthias.js';
import { chroniclesMapById } from '../src/chronicles/chroniclesMapCatalog.js';
import { chroniclesTacticsUse } from '../src/chroniclesOfMatthiasTactics.js';
import { chroniclesPartyBark } from '../src/chroniclesOfMatthiasBarks.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from '../src/chronicles/chroniclesContentRuntime.js';
import { createChroniclesProgression } from '../src/chroniclesOfMatthiasProgression.js';
import ChroniclesFirstSteps from '../src/components/ChroniclesFirstSteps.jsx';
import ChroniclesFirstThreatCue from '../src/components/ChroniclesFirstThreatCue.jsx';
import ChroniclesPartyBark from '../src/components/ChroniclesPartyBark.jsx';
import ChroniclesCharacterSheet from '../src/components/ChroniclesCharacterSheet.jsx';
import '../src/styles.css';

// Find a real, unobstructed enemy directly in front of a traversable road
// square. Coordinates are discovered from the versioned map, not fabricated.
function discoverSighting() {
  const base = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
  const grid = chroniclesMapById('banner-road-first-book').grid;
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      for (let direction = 0; direction < CHRONICLES_DIRECTIONS.length; direction += 1) {
        const state = { ...base, x, y, direction };
        if (chroniclesTileAt(x, y, state) === '#') continue;
        const target = chroniclesEnemyTargetAhead(state, 4);
        if (target?.enemy && target.distance >= 1 && Number(state[target.enemy.hpKey] || 0) > 0) {
          return { state, target, shooters: chroniclesOpeningVolleyShooters(state).length };
        }
      }
    }
  }
  throw new Error('No real forward sighting in versioned Banner Road map');
}
function earnedPayment() {
  const at = (state, x, y) => ({ ...state, x, y });
  let state = createChroniclesState('swordhaven-first-book');
  state = chroniclesTacticsUse(at(state, 11, 9), 'first-book-missing-board');
  state = chroniclesTacticsUse(at(state, 9, 1), 'to-first-book-banner-road');
  state = chroniclesTacticsUse(at(state, 9, 5), 'first-book-lost-banner');
  state = chroniclesTacticsUse(at(state, 10, 1), 'to-first-book-swordhaven');
  const previous = at(state, 11, 9);
  const next = chroniclesTacticsUse(previous, 'first-book-banner-turn-in');
  const gold = chroniclesGoldBalance(next) - chroniclesGoldBalance(previous);
  const bark = chroniclesPartyBark(previous, next);
  if (!next.claimedRewards?.includes('swordhaven:banner-contract:v1')
    || !bark || gold <= 0 || !bark.text.includes(String(gold))) {
    throw new Error('First Book payment receipt and real narration diverged');
  }
  return { bark, gold };
}

// Source-of-truth map drops, *not* generated loot. This fixture tests the
// real bark -> first-person equipment folio -> actual equip action.
function actualFirstSword() {
  const map = chroniclesMapById('banner-road-first-book');
  const enemy = map.enemies.find((entry) => entry.id === 'banner-road-deserter');
  const before = createChroniclesState(map.id);
  if (!(Number(before[enemy.hpKey]) > 0)) throw new Error('Missing live deserter');
  const state = chroniclesApplyContentEffects({
    ...before, [enemy.hpKey]: 0,
  }, enemy.onDefeat.effects);
  const bark = chroniclesPartyBark(before, state);
  if (state.inventory?.['bronze-sword']?.quantity !== 1
      || bark?.event !== 'first-book-deserter-loot') {
    throw new Error('Real deserter item reward has drifted');
  }
  return { state, bark };
}
// Stress the production sibling key contract with both real guide components
// and authored states, not a synthetic stand-in overlay.
function RealGuidesReconciliationFlow() {
  const [run, setRun] = useState(0);
  const [mode, setMode] = useState('steps');
  const [introState] = useState(() => createChroniclesState('swordhaven-first-book'));
  const [sighting] = useState(discoverSighting);
  const runId = 'qa-overlay-reconciliation-' + run;
  const firstSteps = mode === 'steps';
  const activeState = firstSteps ? introState : sighting.state;
  return (
    <>
      {/* CI controls deliberately sit above game overlays even at 360px. */}
      <div data-guide-test-controls style={{
        position: 'absolute', left: 0, top: 0, zIndex: 100,
        display: 'flex', gap: 4, background: '#101522',
      }}>
        <button type="button" data-guide-switch
          onClick={() => setMode((value) => value === 'steps' ? 'threat' : 'steps')}>
          Cambiar escena
        </button>
        <button type="button" data-guide-new-run onClick={() => setRun((value) => value + 1)}>
          Nueva expedición
        </button>
      </div>
      <ChroniclesFirstSteps
        key={`first-steps:${runId}`}
        state={activeState} runId={runId} open={firstSteps}
        onClose={() => setMode('threat')}
      />
      <ChroniclesFirstThreatCue
        key={`first-threat:${runId}`}
        state={activeState} runId={runId} target={firstSteps ? null : sighting.target}
        shooterCount={sighting.shooters}
      />
    </>
  );
}

function RealLootEquipmentFlow() {
  const [data, setData] = useState(actualFirstSword);
  const [open, setOpen] = useState(false);
  const [progression] = useState(createChroniclesProgression);
  const member = data.state.party.find((entry) => entry.id === 'matthias');
  return (
    <>
      <ChroniclesPartyBark bark={data.bark} onOpenEquipment={() => setOpen(true)} />
      {open && <ChroniclesCharacterSheet
        state={data.state} progression={progression} member={member}
        mode="first-person" initialFolio="equipment"
        onClose={() => setOpen(false)}
        onEquipmentAction={(action) => setData((current) => ({
          ...current, state: chroniclesReduce(current.state, { ...action, memberId: member.id }),
        }))}
      />}
    </>
  );
}

const view = new URLSearchParams(location.search).get('view') || 'threat';
const stage = {
  position: 'relative', overflow: 'hidden', width: '100vw', height: '100dvh',
  background: 'radial-gradient(ellipse at 50% 48%, #233144, #0c1019 77%)',
};
let content;
if (view === 'threat') {
  const { state, target, shooters } = discoverSighting();
  content = <ChroniclesFirstThreatCue state={state} target={target} shooterCount={shooters}
    runId="qa-first-hour-threat" />;
  document.body.dataset.enemyId = target.enemy.id;
  document.body.dataset.realShooters = String(shooters);
} else if (view === 'payment') {
  const { bark, gold } = earnedPayment();
  content = <ChroniclesPartyBark bark={bark} />;
  document.body.dataset.earnedGold = String(gold);
} else if (view === 'loot') {
  content = <RealLootEquipmentFlow />;
} else if (view === 'guides') {
  content = <RealGuidesReconciliationFlow />;
} else {
  throw new Error('Unsupported smoke view');
}
createRoot(document.getElementById('root')).render(
  <main className="chronicles-stage" style={stage} data-first-hour-view={view}>{content}</main>,
);
