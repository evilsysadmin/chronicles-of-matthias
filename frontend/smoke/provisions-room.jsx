// Real map, authoritative reducer and price: no stubbed purchases.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState, chroniclesContextualContentAction, chroniclesReduce } from '../src/chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects, chroniclesGoldBalance } from '../src/chronicles/chroniclesContentRuntime.js';
import { chroniclesMapById } from '../src/chronicles/chroniclesMapCatalog.js';
import ChroniclesProvisions, { CHRONICLES_QUARTERMASTER_ID } from '../src/components/ChroniclesProvisions.jsx';
import { useEscapeToClose } from '../src/useEscapeToClose.js';
import '../src/components/ChroniclesOfMatthias.css';

function initial() {
  const entry = chroniclesMapById('swordhaven-first-book').interactables
    .find((e) => e.id === CHRONICLES_QUARTERMASTER_ID);
  let state = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
  state = chroniclesApplyContentEffects(state, [{ type: 'grant-gold', amount: 40 }]);
  const facing = [0,1,2,3].find((direction) =>
    chroniclesContextualContentAction({ ...state, x: entry.x, y: entry.y, direction })?.id === entry.id);
  if (facing == null) throw new Error('Quartermaster storefront is not an authored interaction');
  return { ...state, x: entry.x, y: entry.y, direction: facing };
}
function Fixture() {
  const [state, setState] = useState(initial);
  const stateRef = useRef(state);
  // Mount the world first, then open its shop. The world owns a lower-priority
  // Back/Escape handler that must never dismiss the game underneath the shop.
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [backgroundBacks, setBackgroundBacks] = useState(0);
  useEscapeToClose(() => setBackgroundBacks((count) => count + 1), { contextMenu: false });
  const purchase = () => {
    const current = stateRef.current;
    if (chroniclesContextualContentAction(current)?.id !== CHRONICLES_QUARTERMASTER_ID) return current;
    const next = chroniclesReduce(current, { type: 'interact' });
    stateRef.current = next;
    setState(next);
    setAttempts((a) => a + 1);
    return next;
  };
  return <>
    <div className="chronicles" data-provisions-world-shell aria-hidden="true" />
    {!open && <button type="button" data-provisions-reopen onClick={() => setOpen(true)}
      style={{ position: 'fixed', left: 0, bottom: 0, zIndex: 10000 }}>REOPEN</button>}
    <output data-provisions-fixture-gold style={{display:'none'}}>{chroniclesGoldBalance(state)}</output>
    <output data-provisions-fixture-rations style={{display:'none'}}>{state.inventory?.['road-rations']?.quantity || 0}</output>
    <output data-provisions-fixture-turns style={{display:'none'}}>{state.turns}</output>
    <output data-provisions-fixture-attempts style={{display:'none'}}>{attempts}</output>
    <output data-provisions-fixture-background-backs style={{display:'none'}}>{backgroundBacks}</output>
    {open && <ChroniclesProvisions state={state} onBuy={purchase} onClose={() => setOpen(false)} />}
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
