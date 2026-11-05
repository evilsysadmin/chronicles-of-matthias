import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesNoticeBoard from '../src/components/ChroniclesNoticeBoard.jsx';
import { createChroniclesState } from '../src/chroniclesOfMatthias.js';

const mode = new URLSearchParams(location.search).get('layout');
const initial = createChroniclesState('swordhaven-first-book', null, { rules: 'mm3' });
const state = mode === 'split' ? {
  ...initial,
  quests: {
    ...initial.quests,
    'royal-search': {
      id: 'royal-search',
      title: 'El rey desaparecido',
      description: 'La Dama busca a sus caballeros desaparecidos.',
      objective: 'Preséntate al alcalde Aldric en el ayuntamiento.',
      status: 'active',
    },
  },
} : initial;

function Preview() {
  const [open, setOpen] = useState(true);
  const [accepted, setAccepted] = useState(false);
  return <div style={{ minHeight: '100dvh', background: '#16110c' }}>
    <output data-board-accepted={String(accepted)} />
    {open && <ChroniclesNoticeBoard state={state}
      onAccept={() => setAccepted(true)}
      onClose={() => setOpen(false)} />}
  </div>;
}
createRoot(document.getElementById('root')).render(<Preview />);
