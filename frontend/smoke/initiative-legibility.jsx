// Chromium fixture: the production initiative rail with actual MM3 styles.
// No substituted reducer, no mocked combat rules, no remote API needed.
import React from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesInitiativeRail from '../src/components/ChroniclesInitiativeRail.jsx';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesMM3Chrome.css';

const initiative = {
  round: 3,
  cursor: 0,
  order: [
    { id: 'wraith', kind: 'enemy', name: 'Espectro', initiative: 12 },
    { id: 'matthias', kind: 'party', name: 'Matthias', initiative: 11 },
    { id: 'hildegard', kind: 'party', name: 'Hildegard', initiative: 10 },
    { id: 'aziz', kind: 'party', name: 'Aziz', initiative: 9 },
    { id: 'goblin', kind: 'enemy', name: 'Trasgo', initiative: 8 },
  ],
};
createRoot(document.getElementById('root')).render(
  <main className="chronicles" data-chronicles="true"
    style={{ position: 'relative', minHeight: '100dvh', width: '100%' }}>
    <ChroniclesInitiativeRail initiative={initiative} />
  </main>,
);
