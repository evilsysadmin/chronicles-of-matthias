// Real Swordhaven tavern with real campaign reducer, no mock shop or API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState, chroniclesReduce } from '../src/chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from '../src/chronicles/chroniclesContentRuntime.js';
import { chroniclesMapById } from '../src/chronicles/chroniclesMapCatalog.js';
import { CHRONICLES_INN_FOOD } from '../src/chronicles/chroniclesInns.js';
import ChroniclesInn from '../src/components/ChroniclesInn.jsx';
import '../src/components/ChroniclesOfMatthias.css';

function makeState() {
  const entry = chroniclesMapById('swordhaven-first-book').interactables
    .find((item) => item.id === 'first-book-healer');
  let state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  state = chroniclesApplyContentEffects(state, [{ type: 'grant-gold', amount: 30 }]);
  state = { ...state, x: entry.x, y: entry.y,
    party: state.party.map((hero) => ({ ...hero, hp: Math.max(1, hero.hp - 3) })) };
  return chroniclesReduce(state, 'interact');
}

function Fixture() {
  const [state, setState] = useState(makeState);
  const action = (next) => setState((current) => chroniclesReduce(current, next));
  return <>
    {/* The real game shell is a fixed stacking context at z-index: 10000.
        The portal must actually clear it; a room-only smoke misses that bug. */}
    <div className="chronicles" data-inn-world-shell aria-hidden="true" />
    <button type="button" data-inn-reopen onClick={() => setState(makeState())}
      style={{ position:'fixed',bottom:0,left:0,zIndex:0 }}>REOPEN TAVERN</button>
    <output data-inn-gold style={{display:'none'}}>{chroniclesGoldBalance(state)}</output>
    <output data-inn-food-count style={{display:'none'}}>{state.inventory?.[CHRONICLES_INN_FOOD.id]?.quantity || 0}</output>
    <output data-inn-party-hp style={{display:'none'}}>{state.party.map((h) => h.hp).join(',')}</output>
    {state.inn && <ChroniclesInn state={state} onAction={action}
      onClose={() => action({ type:'inn-close' })} />}
  </>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
