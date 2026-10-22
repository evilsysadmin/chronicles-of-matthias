// An offline fixture for the exact production menu components. No mocked
// network, login credentials, save mutations or data from anyone's account.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesMemberSpells } from '../src/chronicles/chroniclesMagic.js';
import ChroniclesSpellMenu from '../src/components/ChroniclesSpellMenu.jsx';
import ChroniclesAdventureMenu from '../src/components/ChroniclesAdventureMenu.jsx';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesMM3Chrome.css';
import '../src/components/ChroniclesSpellMenuFolio.css';
import '../src/components/ChroniclesAdventureMenuFolio.css';

const state = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
const caster = state.party.find((hero) => chroniclesMemberSpells(state, hero).length > 0);
const stockedState = {
  ...state,
  inventory: {
    ...state.inventory,
    'healing-potion': { id: 'healing-potion', quantity: 3 },
    'fire-scroll': { id: 'fire-scroll', quantity: 1 },
  },
};
const view = new URLSearchParams(location.search).get('view') || 'cast';
// Real first-book actors: one knocked out at 0 PV, one living wounded target.
// No mock spell implementation; this exercises the production grimoire.
const healingState = {
  ...stockedState,
  party: stockedState.party.map((hero) => (
    hero.id === 'rook' ? { ...hero, hp: 0 }
      : hero.id === 'matthias' ? { ...hero, hp: 3 } : hero
  )),
};

const reviveState = {
  ...healingState,
  inventory: {
    ...healingState.inventory,
    'revive-draught': { id: 'revive-draught', quantity: 1 },
  },
};

function Fixture() {
  const [dismissed, setDismissed] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [lastAction, setLastAction] = useState('');
  return (
    <div className="chronicles" style={{ background: '#10151d' }}>
      <div data-test-result role="status" style={{ position:'fixed',top:0,left:0,zIndex:1 }}>
        {lastAction}
      </div>
      {!dismissed && (view === 'adventure' ? (
        <details className="chronicles-game-menu" open>
          <summary>MENÚ</summary>
          <ChroniclesAdventureMenu
            onClose={() => setDismissed(true)}
            onContinue={() => setDismissed(true)}
            onJournal={() => setLastAction('journal')}
            onQuickStatus={() => setLastAction('party')}
            onSave={() => setLastAction('save')}
            onSaveExit={() => setLastAction('save-exit')}
            onRequestExit={() => setExitConfirm(true)}
            onDiscardExit={() => setLastAction('discard')}
            onCancelExit={() => setExitConfirm(false)}
            confirmExitWithoutSaving={exitConfirm}
          />
        </details>
      ) : (
        <ChroniclesSpellMenu
          state={view === 'revive' ? reviveState : view === 'healing' ? healingState : stockedState} member={caster} itemUser={caster}
          initialTab={view === 'items' || view === 'revive' ? 'items' : 'spells'}
          onCast={(id, targetId) => setLastAction('cast:' + id + (targetId ? ':' + targetId : ''))}
          onUse={(id, targetId) => setLastAction('use:' + id + (targetId ? ':' + targetId : ''))}
          onClose={() => setDismissed(true)}
        />
      ))}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
