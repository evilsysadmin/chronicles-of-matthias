import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesPartyAvatarButton from '../src/components/ChroniclesPartyAvatarButton.jsx';

function TestRoster() {
  const [selected, setSelected] = useState('matthias');
  const [opened, setOpened] = useState(null);
  const [targeting, setTargeting] = useState(false);
  const [targetCount, setTargetCount] = useState(0);
  const [selectionCount, setSelectionCount] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  return (
    <main style={{ padding: 30 }}>
      <button type="button" data-test-targeting onClick={() => setTargeting(true)}>Elegir objetivo</button>
      <div role="group" aria-label="Grupo de Matthias">
        {['matthias', 'rook', 'bishop', 'faust'].map((hero) => (
          <ChroniclesPartyAvatarButton
            key={hero}
            aria-label={`Seleccionar ${hero}`}
            aria-pressed={selected === hero}
            targeting={targeting}
            onTarget={() => { setTargetCount((n) => n + 1); setTargeting(false); }}
            onSelect={() => { setSelected(hero); setSelectionCount((n) => n + 1); }}
            onOpen={() => { setOpened(hero); setOpenCount((n) => n + 1); }}
            style={{ margin: 8, minWidth: 110, minHeight: 52, touchAction: 'manipulation' }}
          >{hero}</ChroniclesPartyAvatarButton>
        ))}
      </div>
      <output data-test-selection-count>{selectionCount}</output>
      <output data-test-target-count>{targetCount}</output>
      <output data-test-open-count>{openCount}</output>
      {opened && <section role="dialog" aria-label={`Ficha de ${opened}`}>
        <button type="button" onClick={() => setOpened(null)}>Cerrar ficha</button>
      </section>}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<TestRoster />);
