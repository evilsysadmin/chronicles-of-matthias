// CI-only fixture. Mounts the real shop, content and reducer with authored
// Swordhaven stock; no login, backend mock, test route, or privileged user data.
// The page lives in smoke/, outside the production entrypoint/bundle.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chroniclesReduce, createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from '../src/chronicles/chroniclesContentRuntime.js';
import ChroniclesShop from '../src/components/ChroniclesShop.jsx';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesMM3Chrome.css';

function makeState() {
  const base = chroniclesApplyContentEffects(
    createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }),
    [{ type: 'grant-gold', amount: 123 }],
  );
  // Same real merchant interaction as chroniclesShops.test.js.
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
