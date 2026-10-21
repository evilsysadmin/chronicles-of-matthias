// CI-only fixture. Uses the real JournalModal and authored quest IDs/stages.
// No backend route or test controls ship in the production entrypoint.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { chroniclesJournalEntries, chroniclesReduce, createChroniclesState } from '../src/chroniclesOfMatthias.js';
import ChroniclesJournalModal from '../src/components/ChroniclesJournalModal.jsx';
import '../src/components/ChroniclesOfMatthias.css';

const source = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
const state = {
  ...source,
  // Only these receipts actually exist in this save. Merely declaring later
  // banner milestones in the authoring catalog must not display them.
  journal: [
    ...source.journal,
    { id: 'first-footstep', sigil: 'I', title: 'Primera jornada',
      body: 'La compañía partió de Swordhaven al alba.' },
    { id: 'first-book-contract-accepted', sigil: '✦', title: 'Encargo del alguacil',
      body: 'El estandarte se perdió junto al mojón sin nombre.' },
    { id: 'banner-road-captain-falls', sigil: '†', title: 'Cae Garrah',
      body: 'El jefe de los desertores ya no cobrará peaje.' },
  ],
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
      // Deliberately sorted before active quests in authoring order to prove
      // the journal always moves archived entries to its concluding appendix.
      id: 'road-bandits', status: 'completed', order: 1,
      title: 'Bandidos del Camino', objective: 'El Camino está limpio.',
    },
  },
};
function Fixture() {
  const [opened, setOpened] = useState(true);
  const [campaign, setCampaign] = useState(state);
  return <>
    <button data-test-reopen type="button" onClick={() => setOpened(true)}>Abrir crónica</button>
    <button data-test-reopen-followed type="button" onClick={() => {
      setCampaign((current) => chroniclesReduce(current, { type: 'track-quest', questId: 'names-in-wood' }));
      setOpened(true);
    }}>Volver a la misión seguida</button>
    <button data-test-another-expedition type="button" onClick={() => {
      setCampaign({
        ...source,
        quests: {
          'another-adventure': { id: 'another-adventure', status: 'active', order: 1,
            title: 'Un nuevo encargo', objective: 'Aún no hay una pista geográfica confirmada.' },
        },
      });
      setOpened(true);
    }}>Otra expedición</button>
    <button data-test-only-completed type="button" onClick={() => {
      setCampaign({
        ...source,
        quests: {
          'road-bandits': { id: 'road-bandits', status: 'completed', order: 1,
            title: 'Bandidos del Camino', objective: 'El camino está limpio.' },
        },
      });
      setOpened(true);
    }}>Compañía sin encargos pendientes</button>
    <button data-test-no-quests type="button" onClick={() => {
      setCampaign({ ...source, quests: {} });
      setOpened(true);
    }}>Compañía sin encargos</button>
    <button data-test-long-journal type="button" onClick={() => {
      const quests = Object.fromEntries(Array.from({ length: 24 }, (_, index) => [
        'regional-chore-' + index,
        { id: 'regional-chore-' + index, order: index + 1, status: 'active',
          title: 'Recado del camino ' + (index + 1),
          objective: 'Un recado pendiente de la compañía.' },
      ]));
      // The canonical quest log sorts ascending order. Put the tracked row last.
      quests['names-in-wood'] = { id: 'names-in-wood', order: 100, status: 'active',
        title: 'Los nombres del bosque', objective: 'Visita el Roble del Claro.' };
      const nextCampaign = { ...source, quests };
      setCampaign(chroniclesReduce(nextCampaign, { type: 'track-quest', questId: 'names-in-wood' }));
      setOpened(true);
    }}>Muchas misiones seguidas</button>
    <output data-test-tracked-quest hidden>{campaign.trackedQuestId || 'automatico'}</output>
    <ChroniclesJournalModal open={opened} state={campaign}
      entries={chroniclesJournalEntries(campaign)}
      narrations={[{ at: 1, text: 'El viento sopló desde el bosque.' }]}
      onTrack={(questId) => setCampaign((current) => chroniclesReduce(current, { type: 'track-quest', questId }))}
      onClose={() => setOpened(false)} />
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
