// CI-only fixture. Mounts the real shop, content and reducer with authored
// Swordhaven stock; no login, backend mock, test route, or privileged user data.
// The page lives in smoke/, outside the production entrypoint/bundle.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chroniclesReduce, createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from '../src/chronicles/chroniclesContentRuntime.js';
import { chroniclesMapById } from '../src/chronicles/chroniclesMapCatalog.js';
import { chroniclesOpenShop } from '../src/chronicles/chroniclesShops.js';
import ChroniclesShop from '../src/components/ChroniclesShop.jsx';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesMM3Chrome.css';

function makeState() {
  const base = chroniclesApplyContentEffects(
    createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    [{ type: 'grant-gold', amount: 123 }],
  );
  const room = new URLSearchParams(window.location.search).get('room');
  // Directly mount other REAL Swordhaven counters for visual QA. The Brunna
  // path still goes through the actual reducer and transactional smoke.
  if (room === 'odo' || room === 'guild') {
    const id = room === 'odo' ? 'first-book-armorer' : 'first-book-guild';
    const entry = chroniclesMapById('swordhaven-first-book').interactables.find((candidate) => candidate.id === id);
    if (!entry) throw new Error('Missing authored shop: ' + id);
    return chroniclesOpenShop(base, entry);
  }
  return chroniclesReduce({ ...base, x: 7, y: 4 }, 'interact');
}

function Fixture() {
  const [state, setState] = useState(makeState);
  const [lastAction, setLastAction] = useState('');
  const action = (event) => {
    setState((current) => chroniclesReduce(current, event));
    setLastAction(event.type + ':' + event.itemId);
  };
  const close = () => setState((current) => chroniclesReduce(current, { type: 'shop-close' }));
  return (
    <>
      <button data-test-world type="button" style={{ position: 'fixed', left: 4, top: 4 }}
        onClick={() => setLastAction('world-clicked')}>WORLD UNDER SHOP</button>
      <output data-test-action style={{ position: 'fixed', left: 0, bottom: 0 }}>
        {lastAction}
      </output>
      {state.shop && <ChroniclesShop state={state} onAction={action} onClose={close} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<Fixture />);
