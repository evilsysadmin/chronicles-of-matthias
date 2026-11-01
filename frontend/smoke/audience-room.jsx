// CI-only fixture: real NPC script, real audience component and genuine
// first-person stacking context; no route, save, or campaign mocks.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState, chroniclesContextualContentAction, chroniclesReduce, chroniclesPartyArmorClass } from '../src/chroniclesOfMatthias.js';
import { chroniclesNpcDialogueForState } from '../src/chronicles/chroniclesNpcDialogue.js';
import ChroniclesAudience from '../src/components/ChroniclesAudience.jsx';
import '../src/components/ChroniclesOfMatthias.css';

const NPCS = Object.freeze({ aldric: [11, 10], brask: [4, 6], ilse: [14, 6] });
const requestedNpc = new URLSearchParams(window.location.search).get('npc');
const npc = Object.hasOwn(NPCS, requestedNpc) ? requestedNpc : 'aldric';
const [x, y] = NPCS[npc];
const base = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
const initial = { ...base, x, y, inventory: {
  'crown-gold': { id: 'crown-gold', name: 'Oro', quantity: 40 },
}, party: base.party.map((member, index) => ({
  ...member, hp: index === 0 ? 1 : index === 1 ? 0 : member.maxHp,
})) };

function Fixture() {
  const [open, setOpen] = useState(true);
  const [lastAction, setLastAction] = useState('');
  const [expedition, setExpedition] = useState(initial);
  const dialogue = chroniclesNpcDialogueForState(expedition, chroniclesContextualContentAction(expedition));
  return <>
    <div className="chronicles" data-audience-world-shell
      style={{ position: 'relative', zIndex: 10000, transform: 'translateZ(0)' }}>
      <p data-audience-world-marker>Exploración · Swordhaven</p>
      {open && <ChroniclesAudience dialogue={dialogue}
        onAction={(id, kind) => {
          if (kind === 'temple-service') {
            const next = chroniclesReduce(expedition, { type: 'temple-service', serviceId: id });
            if (next !== expedition) {
              setExpedition(next);
              setLastAction('temple:' + id);
            }
            return next.message;
          }
          setLastAction(id);
          return 'Encargo recibido por la compañía.';
        }}
        onClose={() => setOpen(false)} />}
    </div>
    <output data-audience-action style={{ display: 'none' }}>{lastAction}</output>
    <output data-audience-gold style={{ display: 'none' }}>{expedition.inventory?.['crown-gold']?.quantity || 0}</output>
    <output data-audience-hp style={{ display: 'none' }}>{expedition.party.map(m => m.hp).join(',')}</output>
    <output data-audience-armor style={{ display: 'none' }}>{chroniclesPartyArmorClass(expedition, expedition.party[0].id)}</output>
    <output data-audience-closed style={{ display: 'none' }}>{!open ? 'yes' : 'no'}</output>
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
