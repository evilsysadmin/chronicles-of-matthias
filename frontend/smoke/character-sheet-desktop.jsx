// Production character sheet and actual first-book MM3 state; no fake character data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';
import { chroniclesApplyContentEffects } from '../src/chronicles/chroniclesContentRuntime.js';
import { CHRONICLES_EQUIPMENT } from '../src/chronicles/chroniclesEquipment.js';
import { createChroniclesProgression } from '../src/chroniclesOfMatthiasProgression.js';
import ChroniclesCharacterSheet from '../src/components/ChroniclesCharacterSheet.jsx';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesCharacterSheet.css';
import '../src/components/ChroniclesCharacterSheetMM3.css';

// Populate the real first-book campaign via the real reward reducer with
// catalog objects, so the interactive equipment desk is exercised in Chromium.
const stocked = chroniclesApplyContentEffects(
  createChroniclesState('banner-road-first-book', null, { rules: 'mm3' }),
  ['bronze-sword', 'wooden-bow', 'iron-shield'].map((itemId) => ({
    type: 'grant-item',
    itemId,
    name: CHRONICLES_EQUIPMENT[itemId].name,
    description: CHRONICLES_EQUIPMENT[itemId].description,
    quantity: 1,
  })),
);
// Legacy all-on-Matthias layout is deliberate in this visual fixture: verify
// its three visible inventory rows and the non-destructive reparto control.
const state = {
  ...stocked,
  bagOwners: {
    matthias: Object.fromEntries(['bronze-sword', 'wooden-bow', 'iron-shield'].map((id) => [id, 1])),
  },
};
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
