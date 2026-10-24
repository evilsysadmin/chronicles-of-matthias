// An offline fixture for the exact production menu components. No mocked
// network, login credentials, save mutations or data from anyone's account.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesMemberSpells } from '../src/chronicles/chroniclesMagic.js';
import { chroniclesPartyPortraitUrl } from '../src/chronicles/chroniclesPartyPortraitAssets.js';
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

  // Structural CSS fixture for the real first-person HUD selectors, not a
  // gameplay mock. Long authored route text reproduces the reported overlap.
  // The production objective action still opens the real Crónica.
  if (view === 'objective-hud') {
    const objective = 'Busca el estandarte cerca del mojón sin nombre.';
    const route = 'DESTINO · Camino de los Estandartes · Salir al Camino de los Estandartes · por el norte';
    return (
      <div className="chronicles" data-chronicles-hud-fixture="true">
        <div className="chronicles-shell">
          <aside className="chronicles-party" aria-label="Grupo de Matthias">
            {state.party.map((member) => (
              <button key={member.id} type="button" className="chronicles-party-member"
                aria-label={`Seleccionar ${member.name}`}>
                <span className="chronicles-party-glyph has-authored-portrait">
                  <img className="chronicles-party-thumbnail" src={chroniclesPartyPortraitUrl(member)} alt="" />
                </span>
                <span><strong>{member.name}</strong></span>
                <b>{member.hp}/{member.maxHp}</b>
              </button>
            ))}
          </aside>
          <main className="chronicles-stage-wrap">
            <div className="chronicles-statusbar">
              <span hidden aria-hidden="true" className="chronicles-statusbar__retired-location" />
              <span hidden aria-hidden="true" className="chronicles-statusbar__retired-bearing" />
              <span>ACTIVO <b>Matthias</b></span>
              <span>
                <button type="button" className="chronicles-objective-trigger"
                  data-chronicles-objective title={`Objetivo: ${objective}\n${route}\nAbrir la Crónica (J)`}>
                  <small className="chronicles-objective-trigger__label">OBJETIVO</small>
                  <b>{objective}</b>
                  <small className="chronicles-route-hint">{route}</small>
                  <i className="chronicles-objective-trigger__more" aria-hidden="true">Crónica ⌄</i>
                </button>
              </span>
            </div>
            <div className="chronicles-stage" aria-hidden="true" />
          </main>
        </div>
      </div>
    );
  }
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
          state={view === 'revive' || view === 'rescue' ? reviveState : view === 'healing' ? healingState : stockedState} member={caster} itemUser={caster}
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
