import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesPartyBark from '../src/components/ChroniclesPartyBark.jsx';

// Mount the real interactive component on a fixed 3D-like viewport. This
// checks the production CSS and React focus/touch behavior, not a drawn mock.
const sample = {
  token: 'bark-readability',
  speakerId: 'rook',
  speaker: 'Hildegard',
  glyph: '⚔',
  event: 'first-book-deserter-loot',
  text: 'Revisa bien los suministros antes de cruzar el puente. Si nos quedamos sin vendas, el siguiente encuentro puede acabar bastante mal.',
};

function Fixture() {
  const [opened, setOpened] = useState(0);
  return (
    <main data-smoke-stage style={{
      position: 'relative', boxSizing: 'border-box', width: '100%', height: '100dvh',
      overflow: 'hidden', background: '#181510', color: '#e8d9bc',
    }}>
      <div data-smoke-touch-controls style={{
        position: 'absolute', bottom: 8, right: 8, width: 132, height: 106,
        pointerEvents: 'none',
      }} />
      <output data-smoke-open-count style={{ position: 'absolute', top: 10, left: 10 }}>
        {opened}
      </output>
      <ChroniclesPartyBark bark={sample} onOpenEquipment={() => setOpened((n) => n + 1)} />
    </main>
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
