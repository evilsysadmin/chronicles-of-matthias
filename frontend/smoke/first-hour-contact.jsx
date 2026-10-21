// CI-only visual fixture. Uses real authored map/targeting, real volley roster
// and real banner-contract payment from the reducer. No mocked encounters or gold.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CHRONICLES_DIRECTIONS,
  chroniclesEnemyTargetAhead,
  chroniclesOpeningVolleyShooters,
  chroniclesTileAt,
  chroniclesContextualContentAction,
  createChroniclesState,
  chroniclesReduce,
} from '../src/chroniclesOfMatthias.js';
import { chroniclesMapById } from '../src/chronicles/chroniclesMapCatalog.js';
import { chroniclesTacticsUse } from '../src/chroniclesOfMatthiasTactics.js';
import { chroniclesApplyArrival } from '../src/chronicles/chroniclesArrival.js';
import { chroniclesNpcDialogueForState } from '../src/chronicles/chroniclesNpcDialogue.js';
import { chroniclesPartyBark } from '../src/chroniclesOfMatthiasBarks.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from '../src/chronicles/chroniclesContentRuntime.js';
import { createChroniclesProgression } from '../src/chroniclesOfMatthiasProgression.js';
import ChroniclesFirstSteps from '../src/components/ChroniclesFirstSteps.jsx';
import ChroniclesFirstAudienceCue from '../src/components/ChroniclesFirstAudienceCue.jsx';
import ChroniclesFirstThreatCue from '../src/components/ChroniclesFirstThreatCue.jsx';
import ChroniclesPartyBark from '../src/components/ChroniclesPartyBark.jsx';
import ChroniclesCharacterSheet from '../src/components/ChroniclesCharacterSheet.jsx';
import ChroniclesQuickStatus from '../src/components/ChroniclesQuickStatus.jsx';
import ChroniclesJournalModal from '../src/components/ChroniclesJournalModal.jsx';
import ChroniclesAutomap from '../src/components/ChroniclesAutomap.jsx';
import ChroniclesSpellMenu from '../src/components/ChroniclesSpellMenu.jsx';
import { chroniclesCurrentInitiativeActor } from '../src/chronicles/chroniclesInitiative.js';
import { chroniclesQuickStatusRows } from '../src/chronicles/chroniclesQuickStatus.js';
import '../src/styles.css';
// Match the actual first-person game CSS imports. The isolated fixture used
// to exercise the real sheet without its base and MM3 styles, producing
// misleading screenshots despite successful equipment actions.
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesCharacterSheet.css';
import '../src/components/ChroniclesMM3Chrome.css';
import '../src/components/ChroniclesCharacterSheetMM3.css';
import '../src/components/ChroniclesQuickStatus.css';
import '../src/components/ChroniclesJournalModal.css';

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

      />
    </>
  );
}

function RealLootEquipmentFlow({ reorderParty = false }) {
  const [data, setData] = useState(() => {
    const original = actualFirstSword();
    return reorderParty
      ? { ...original, state: { ...original.state, party: [...original.state.party].reverse() } }
      : original;
  });
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState('matthias');
  const [progression] = useState(createChroniclesProgression);
  const member = data.state.party.find((entry) => entry.id === memberId);
  return (
    <>
      <ChroniclesPartyBark bark={data.bark} onOpenEquipment={() => setOpen(true)} />
      {open && <ChroniclesCharacterSheet
        state={data.state} progression={progression} member={member}
        mode="first-person" initialFolio="equipment"
        onSelectMember={(nextId) => {
          if (data.state.party.some((hero) => hero.id === nextId)) setMemberId(nextId);
        }}
        onClose={() => setOpen(false)}
        onEquipmentAction={(action) => setData((current) => ({
          ...current, state: chroniclesReduce(current.state, { ...action, memberId: member.id }),
        }))}
      />}
    </>
  );
}

// Real quick-status folio and real hero sheet, under the same callbacks as
// first-person Chronicles (the fixture does not invent party IDs or stats).
function RealQuickStatusHotkeyFlow() {
  const [state] = useState(() => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }));
  const [progression] = useState(createChroniclesProgression);
  const [open, setOpen] = useState(true);
  const [memberId, setMemberId] = useState(null);
  const member = state.party.find((hero) => hero.id === memberId);
  const openSheet = (heroId) => {
    setOpen(false);
    setMemberId(heroId);
  };
  return (
    <>
      <button type="button" data-reopen-quick-status onClick={() => { setMemberId(null); setOpen(true); }}>
        Estado del grupo (G)
      </button>
      <ChroniclesQuickStatus open={open} rows={chroniclesQuickStatusRows(state)}
        gold={chroniclesGoldBalance(state)}
        onClose={() => setOpen(false)} onOpenSheet={openSheet} />
      {member && <ChroniclesCharacterSheet state={state} progression={progression} member={member}
        mode="first-person" onClose={() => setMemberId(null)}
        onSelectMember={(id) => {
          if (state.party.some((hero) => hero.id === id)) setMemberId(id);
        }} />}
    </>
  );
}

// Real Crónica and character sheet, exercising the same single-modal
// navigation as the first-person game without changing expedition state.
function RealJournalHotkeyFlow() {
  const [state] = useState(() => createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }));
  const [progression] = useState(createChroniclesProgression);
  const [open, setOpen] = useState(true);
  const [memberId, setMemberId] = useState(null);
  const member = state.party.find((hero) => hero.id === memberId);
  const openSheet = (id) => { setOpen(false); setMemberId(id); };
  return (
    <>
      <button type="button" data-reopen-journal onClick={() => { setMemberId(null); setOpen(true); }}>
        Crónica (J)
      </button>
      <ChroniclesJournalModal open={open} state={state}
        onClose={() => setOpen(false)} onOpenSheet={openSheet} />
      {member && <ChroniclesCharacterSheet state={state} progression={progression}
        member={member} mode="first-person" onClose={() => setMemberId(null)}
        onSelectMember={(id) => {
          if (state.party.some((hero) => hero.id === id)) setMemberId(id);
        }} />}
    </>
  );
}

// Real CAST with a fixed combat initiative actor. Opening another dossier
// is inspection only; neither action requests nor the actor may change.
function RealSpellMenuHotkeyFlow({ enemyTurn = false }) {
  const [state] = useState(() => ({
    ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    initiative: { version: 1, die: '1d8', round: 1, cursor: 0,
      order: [{ kind: enemyTurn ? 'enemy' : 'party', id: enemyTurn ? 'test-enemy' : 'bishop' }] },
  }));
  const [progression] = useState(createChroniclesProgression);
  const [open, setOpen] = useState(true);
  const [memberId, setMemberId] = useState(null);
  const [requestedActions, setRequestedActions] = useState(0);
  const actor = chroniclesCurrentInitiativeActor(state.initiative);
  const caster = state.party.find((hero) => hero.id === 'bishop');
  const member = state.party.find((hero) => hero.id === memberId);
  const inspect = (id) => { setOpen(false); setMemberId(id); };
  return (
    <div data-chronicles-cast-test-actor={actor.id} data-chronicles-cast-test-actions={requestedActions}>
      <button type="button" data-reopen-cast onClick={() => { setMemberId(null); setOpen(true); }}>Abrir grimorio (C)</button>
      {open && <ChroniclesSpellMenu state={state} member={caster} itemUser={enemyTurn ? null : caster}
        onClose={() => setOpen(false)} onOpenSheet={inspect}
        onCast={() => setRequestedActions((count) => count + 1)}
        onUse={() => setRequestedActions((count) => count + 1)} />}
      {member && <ChroniclesCharacterSheet state={state} progression={progression}
        member={member} mode="first-person" onClose={() => setMemberId(null)}
        onSelectMember={(id) => {
          if (state.party.some((hero) => hero.id === id)) setMemberId(id);
        }} />}
    </div>
  );
}

// Real area/Terra map and real dossier. Initiative stays owned by Aziz:
// a map is for information, not an opportunity to move another hero.
function RealAutomapHotkeyFlow() {
  const [state] = useState(() => ({
    ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    initiative: { version: 1, die: '1d8', round: 1, cursor: 0,
      order: [{ kind: 'party', id: 'bishop' }] },
  }));
  const [progression] = useState(createChroniclesProgression);
  const [open, setOpen] = useState(true);
  const [memberId, setMemberId] = useState(null);
  const actor = chroniclesCurrentInitiativeActor(state.initiative);
  const member = state.party.find((hero) => hero.id === memberId);
  return (
    <div data-automap-actor={actor.id} data-automap-turns={state.turns}>
      <button type="button" data-reopen-automap
        onClick={() => { setMemberId(null); setOpen(true); }}>Abrir mapa (M)</button>
      <ChroniclesAutomap open={open} state={state} visitedCells={[]}
        onClose={() => setOpen(false)}
        onOpenSheet={(id) => { setOpen(false); setMemberId(id); }} />
      {member && <ChroniclesCharacterSheet state={state} progression={progression}
        member={member} mode="first-person" onClose={() => setMemberId(null)}
        onSelectMember={(id) => {
          if (state.party.some((hero) => hero.id === id)) setMemberId(id);
        }} />}
    </div>
  );
}

// Use the genuine First Book quest and the real map/NPC interaction
// resolver. The fixture only observes a click; it does not award story flags.
function actualMayorInvitation() {
  const arrived = chroniclesApplyArrival(createChroniclesState('swordhaven-first-book'));
  const state = { ...arrived, x: 11, y: 10 };
  const contextualAction = chroniclesContextualContentAction(state);
  const npc = chroniclesNpcDialogueForState(state, contextualAction);
  if (contextualAction?.id !== 'swordhaven-mayor' || npc?.id !== 'swordhaven-mayor') {
    throw new Error('No real mayor action at Swordhaven door');
  }
  return { state, contextualAction, npc };
}

const view = new URLSearchParams(location.search).get('view') || 'threat';
const stage = {
  position: 'relative', overflow: 'hidden', width: '100vw', height: '100dvh',
  background: 'radial-gradient(ellipse at 50% 48%, #233144, #0c1019 77%)',
};
let content;
if (view === 'threat') {
  const { state, target, shooters } = discoverSighting();
  content = <ChroniclesFirstThreatCue state={state} target={target}
    runId="qa-first-hour-threat" />;
  document.body.dataset.enemyId = target.enemy.id;
  document.body.dataset.realShooters = String(shooters);
} else if (view === 'mayor') {
  const { state, contextualAction, npc } = actualMayorInvitation();
  content = <ChroniclesFirstAudienceCue state={state} contextualAction={contextualAction}
    npc={npc} onTalk={() => { document.body.dataset.mayorActionRequested = 'true'; }} />;
} else if (view === 'payment') {
  const { bark, gold } = earnedPayment();
  content = <ChroniclesPartyBark bark={bark} />;
  document.body.dataset.earnedGold = String(gold);
} else if (view === 'loot' || view === 'loot-reordered') {
  content = <RealLootEquipmentFlow reorderParty={view === 'loot-reordered'} />;
} else if (view === 'quick-status') {
  content = <RealQuickStatusHotkeyFlow />;
} else if (view === 'automap') {
  content = <RealAutomapHotkeyFlow />;
} else if (view === 'journal') {
  content = <RealJournalHotkeyFlow />;
 } else if (view === 'spell-menu' || view === 'spell-menu-enemy') {
  content = <RealSpellMenuHotkeyFlow enemyTurn={view === 'spell-menu-enemy'} />;
} else if (view === 'guides') {
  content = <RealGuidesReconciliationFlow />;
} else {
  throw new Error('Unsupported smoke view');
}
createRoot(document.getElementById('root')).render(
  <main className="chronicles-stage" style={stage} data-first-hour-view={view}>{content}</main>,
);
