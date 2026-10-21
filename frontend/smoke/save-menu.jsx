// CI-only fixture. Uses the real expedition menu and static catalog metadata;
// never connects to a user account, mutates a server run or fakes game state.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesSaveMenu from '../src/components/ChroniclesSaveMenu.jsx';
import '../src/styles.css';

const query = new URLSearchParams(location.search);
const initialStatus = query.get('status') || 'error';
const initialSaves = query.get('count') === '0' ? [] : [
  { id: 'cached-run', active: true, remote: true, title: 'La torre del este',
    currentMapId: 'swordhaven-first-book', updatedAt: 1760000000000 },
];

function Fixture() {
  const [status, setStatus] = useState(initialStatus);
  return (
    <ChroniclesSaveMenu
      saves={initialSaves}
      loading={status === 'loading'}
      error={status === 'error' ? 'No se pudo consultar el servidor.' : ''}
      onRetrySync={() => setStatus('ok')}
      onNew={() => { document.body.dataset.action = 'new'; }}
      onLoad={() => { document.body.dataset.action = 'load'; }}
      onRename={() => { document.body.dataset.action = 'rename'; return true; }}
      onDelete={() => { document.body.dataset.action = 'delete'; return true; }}
    />
  );
}
createRoot(document.getElementById('root')).render(<Fixture />);
