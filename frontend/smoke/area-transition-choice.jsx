// CI-only fixture mounts the REAL threshold modal, no mocked keyboard widget.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesAreaTransitionDialog from '../src/components/ChroniclesAreaTransitionDialog.jsx';

function Fixture() {
  const [open, setOpen] = useState(true);
  const [decision, setDecision] = useState('none');
  const [leaked, setLeaked] = useState(0);
  useEffect(() => {
    const onKeyDown = (event) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Escape','s','S','a','A'].includes(event.key)) {
        setLeaked((count) => count + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  return <>
    <button data-travel-reopen type="button" onClick={() => { setOpen(true); setDecision('none'); }}>
      Volver a abrir la decisión
    </button>
    <output data-travel-decision>{decision}</output>
    <output data-travel-leaked>{leaked}</output>
    {open && <ChroniclesAreaTransitionDialog question="¿Viajar al siguiente territorio?"
      onAccept={() => { setDecision('yes'); setOpen(false); }}
      onCancel={() => { setDecision('no'); setOpen(false); }} />}
  </>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
