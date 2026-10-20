// CI-only fixture. Uses the real JournalModal and authored quest IDs/stages.
// No backend route or test controls ship in the production entrypoint.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chroniclesReduce, createChroniclesState } from '../src/chroniclesOfMatthias.js';
import ChroniclesJournalModal from '../src/components/ChroniclesJournalModal.jsx';
import '../src/components/ChroniclesOfMatthias.css';

const source = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
const state = {
  ...source,
  quests: {
    'banner-contract': {
      id: 'banner-contract', status: 'active', order: 2,
      title: 'El estandarte perdido',
      objective: 'Busca el estandarte cerca del mojón sin nombre.',
    },
    'names-in-wood': {
      id: 'names-in-wood', status: 'active', order: 3,
      title: 'Los nombres del bosque',
      objective: 'Recupera tres placas con nombres y cuélgalas en el Roble del claro.',
    },
    'road-bandits': {
      id: 'road-bandits', status: 'completed', order: 4,
      title: 'Bandidos del Camino', objective: 'El Camino está limpio.',
    },
  },
};
function Fixture() {
  const [opened, setOpened] = useState(true);
  const [campaign, setCampaign] = useState(state);
  return <>
    <button data-test-reopen type="button" onClick={() => setOpened(true)}>Abrir crónica</button>
    <output data-test-tracked-quest hidden>{campaign.trackedQuestId || 'automatico'}</output>
    <ChroniclesJournalModal open={opened} state={campaign}
      entries={[{ id: 'first-footstep', sigil: 'I', title: 'Primera jornada',
        body: 'La compañía partió de Swordhaven al alba.' }]}
      narrations={[{ at: 1, text: 'El viento sopló desde el bosque.' }]}
      onTrack={(questId) => setCampaign((current) => chroniclesReduce(current, { type: 'track-quest', questId }))}
      onClose={() => setOpened(false)} />
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
