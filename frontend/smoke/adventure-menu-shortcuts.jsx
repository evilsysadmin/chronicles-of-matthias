// CI-only menu interaction fixture. It mounts the actual ChroniclesAdventureMenu
// and uses the very same keyboard resolver as the production first-person view.
// Callback counters are intents, NOT mock confirmations of a remote save.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesAdventureMenu from '../src/components/ChroniclesAdventureMenu.jsx';
import { chroniclesAdventureMenuShortcut, chroniclesContainAdventureMenuTab } from '../src/chronicles/chroniclesKeyboardBindings.js';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesAdventureMenuFolio.css';

function MenuShortcutFixture() {
  const [open, setOpen] = useState(true);
  const [confirmExitWithoutSaving, setConfirmExitWithoutSaving] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveRequests, setSaveRequests] = useState(0);
  const [exitRequests, setExitRequests] = useState(0);
  const [discardRequests, setDiscardRequests] = useState(0);

  useEffect(() => {
    const keyDown = (event) => {
      const action = chroniclesAdventureMenuShortcut(event, {
        menuOpen: open, saveBusy, confirmExitWithoutSaving,
      });
      if (!action) return;
      event.preventDefault();
      if (action === 'save') setSaveRequests((n) => n + 1);
      if (action === 'request-exit') {
        setExitRequests((n) => n + 1);
        setConfirmExitWithoutSaving(true);
      }
      if (action === 'cancel-exit') setConfirmExitWithoutSaving(false);
      if (action === 'close') {
        setConfirmExitWithoutSaving(false);
        setOpen(false);
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [open, saveBusy, confirmExitWithoutSaving]);

  return (
    <main className="chronicles" style={{
      position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden',
      background: '#101720', color: '#f2e4c8',
    }}
      data-shortcut-menu-open={String(open)}
      data-shortcut-confirm={String(confirmExitWithoutSaving)}>
      <div className="chronicles-stage" style={{ height: '100%', minHeight: 0 }}>
        <div style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 1, display: 'grid', gap: 6 }}>
          <label>Campo de texto ajeno al menú
            <input type="text" data-shortcut-text-input aria-label="Campo de texto de prueba" />
          </label>
          <button type="button" data-shortcut-busy-toggle
            onClick={() => setSaveBusy((value) => !value)}>Alternar guardado en curso</button>
          <button type="button" data-shortcut-reopen onClick={() => setOpen(true)} disabled={open}>
            Reabrir menú
          </button>
          <output data-shortcut-save-requests>{saveRequests}</output>
          <output data-shortcut-exit-requests>{exitRequests}</output>
          <output data-shortcut-discard-requests>{discardRequests}</output>
        </div>
        <div style={{ position: 'absolute', top: 4, right: 8, zIndex: 50, height: 44 }}>
          <details className="chronicles-game-menu" open={open}
            onKeyDown={(event) => { chroniclesContainAdventureMenuTab(event, event.currentTarget); }}
            onToggle={(event) => {
              setOpen(event.currentTarget.open);
              if (!event.currentTarget.open) setConfirmExitWithoutSaving(false);
            }}>
            <summary aria-label="Abrir o cerrar menú de aventura">MENÚ</summary>
            <ChroniclesAdventureMenu
              onClose={() => setOpen(false)}
              onContinue={() => setOpen(false)}
              onJournal={() => setOpen(false)}
              onQuickStatus={() => setOpen(false)}
              onSave={() => setSaveRequests((n) => n + 1)}
              onSaveExit={() => setSaveRequests((n) => n + 1)}
              onAdmin={() => {}}
              onRequestExit={() => {
                setExitRequests((n) => n + 1);
                setConfirmExitWithoutSaving(true);
              }}
              onDiscardExit={() => setDiscardRequests((n) => n + 1)}
              onCancelExit={() => setConfirmExitWithoutSaving(false)}
              confirmExitWithoutSaving={confirmExitWithoutSaving}
              saveBusy={saveBusy}
            />
          </details>
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<MenuShortcutFixture />);
