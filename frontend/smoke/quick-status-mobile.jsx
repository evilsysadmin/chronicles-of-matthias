// The real Grupo (G) modal and saved-state selectors, no mock UI or backend.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesQuickStatusRows } from '../src/chronicles/chroniclesQuickStatus.js';
import ChroniclesQuickStatus from '../src/components/ChroniclesQuickStatus.jsx';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesMM3Chrome.css';

const state = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
const rows = chroniclesQuickStatusRows(state);
function Fixture() {
  const [open, setOpen] = useState(true);
  const [opened, setOpened] = useState('');
  return <div className="chronicles" style={{ minHeight: '100dvh', background: '#10131a' }}>
    <output data-chronicles-open-sheet={opened} />
    {open && <ChroniclesQuickStatus open rows={rows} gold={26}
      onClose={() => setOpen(false)} onOpenSheet={setOpened} />}
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
