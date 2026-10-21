// CI-only fixture: real character editor, canonical party and per-user draft.
// No fake game routes, backend accounts, or changes to the production bundle.
import React from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesCharacterSetup from '../src/components/ChroniclesCharacterSetup.jsx';
import { createCanonicalChroniclesCharacterBuild } from '../src/chronicles/chroniclesCharacterBuilds.js';
import { CHRONICLES_PARTY } from '../src/chroniclesOfMatthias.js';
import '../src/styles.css';

localStorage.setItem('chess-study-auth-username', 'qa-character-editor');
const build = createCanonicalChroniclesCharacterBuild(CHRONICLES_PARTY);
createRoot(document.getElementById('root')).render(
  <ChroniclesCharacterSetup
    currentBuild={build}
    onConfirm={(confirmed) => {
      document.body.dataset.confirmedParty = confirmed.characters.map((hero) => hero.name).join(' | ');
    }}
    onExit={() => { document.body.dataset.exited = 'yes'; }}
  />,
);
