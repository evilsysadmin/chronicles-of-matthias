// Visual/interaction fixture: actual target banner and MM3 party/menu styling.
// No game rules or remote state is replaced; only callbacks are counted.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChroniclesSpellTargetBanner } from '../src/components/ChroniclesSpellMenu.jsx';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesMM3Chrome.css';

const heroes = ['Matthias', 'Hildegard', 'Aziz', 'Faust'];
function Fixture() {
  const caster = Math.max(0, Math.min(3, Number(new URLSearchParams(location.search).get('caster')) || 0));
  const [pending, setPending] = useState(true);
  const [cancelCount, setCancelCount] = useState(0);
  return (
    <div className="chronicles" data-chronicles-targeting={pending ? 'first-aid' : undefined}>
      <div className="chronicles-shell">
        <aside className="chronicles-party" aria-label="Grupo de Matthias">
          {pending && <ChroniclesSpellTargetBanner spellId="first-aid" onCancel={() => {
            setPending(false); setCancelCount((count) => count + 1);
          }} />}
          {heroes.map((name, i) => <button className={`chronicles-party-member ${i === caster ? 'is-selected' : ''} ${i === 1 ? 'is-spell-target-valid' : ''}`}
            type="button" key={name} data-fixture-member={i}>
            <span className="chronicles-party-glyph has-authored-portrait" aria-hidden="true">♟</span>
            <span><strong>{i + 1}. {name}</strong><small>Nv 5 · FRENTE</small></span>
            <span className="chronicles-party-bars" aria-hidden="true"><i className="is-hp" style={{ '--fill': 1 }}/></span>
            <b>7/10</b>
          </button>)}
          {[1, 2].map(i=><div className="chronicles-party-hireling" key={i}><span className="chronicles-party-hireling__face" /><span className="chronicles-party-hireling__label">Plaza libre</span></div>)}
        </aside>
        <main className="chronicles-stage-wrap">
          <section className="chronicles-stage" aria-label="Escenario de juego" style={{ minHeight: 0 }} />
          <details className="chronicles-game-menu"><summary aria-label="Abrir menú de Chronicles"><span className="chronicles-menu-gem__hint">MENÚ</span></summary></details>
        </main>
      </div>
      <output data-cancel-count={cancelCount} />
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Fixture/>);
