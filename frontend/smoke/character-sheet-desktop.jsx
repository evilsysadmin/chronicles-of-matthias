// Production character sheet and actual first-book MM3 state; no fake character data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { createChroniclesProgression } from '../src/chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from '../src/components/ChroniclesCharacterSheet.jsx';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesCharacterSheet.css';
import '../src/components/ChroniclesCharacterSheetMM3.css';

const state = createChroniclesState('banner-road-first-book', null, { rules: 'mm3' });
const progression = createChroniclesProgression();

function Fixture() {
  const [selected, setSelected] = useState(state.party[0].id);
  const [open, setOpen] = useState(true);
  const hero = state.party.find((member) => member.id === selected);
  return (
    <div className="chronicles">
      {open && <ChroniclesCharacterSheet state={state} progression={progression}
        member={hero} mode="mm3" onClose={() => setOpen(false)}
        onSelectMember={setSelected} />}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
