// CI-only fixture: real NPC script, real audience component and genuine
// first-person stacking context; no route, save, or campaign mocks.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState, chroniclesContextualContentAction } from '../src/chroniclesOfMatthias.js';
import { chroniclesNpcDialogueForState } from '../src/chronicles/chroniclesNpcDialogue.js';
import ChroniclesAudience from '../src/components/ChroniclesAudience.jsx';
import '../src/components/ChroniclesOfMatthias.css';

const NPCS = Object.freeze({ aldric: [11, 10], brask: [4, 6] });
const npc = new URLSearchParams(window.location.search).get('npc') === 'brask' ? 'brask' : 'aldric';
const [x, y] = NPCS[npc];
const state = { ...createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' }), x, y };
const dialogue = chroniclesNpcDialogueForState(state, chroniclesContextualContentAction(state));

function Fixture() {
  const [open, setOpen] = useState(true);
  const [lastAction, setLastAction] = useState('');
  return <>
    <div className="chronicles" data-audience-world-shell
      style={{ position: 'relative', zIndex: 10000, transform: 'translateZ(0)' }}>
      <p data-audience-world-marker>Exploración · Swordhaven</p>
      {open && <ChroniclesAudience dialogue={dialogue}
        onAction={(id) => { setLastAction(id); return 'Encargo recibido por la compañía.'; }}
        onClose={() => setOpen(false)} />}
    </div>
    <output data-audience-action style={{ display: 'none' }}>{lastAction}</output>
    <output data-audience-closed style={{ display: 'none' }}>{!open ? 'yes' : 'no'}</output>
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
