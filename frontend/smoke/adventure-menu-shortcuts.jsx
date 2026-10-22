// CI-only menu interaction fixture. It mounts the actual ChroniclesAdventureMenu
// and uses the very same keyboard resolver as the production first-person view.
// Callback counters are intents, NOT mock confirmations of a remote save.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ChroniclesAdventureMenu from '../src/components/ChroniclesAdventureMenu.jsx';
import { chroniclesAdventureMenuShortcut, chroniclesContainAdventureMenuTab, chroniclesRestoreAdventureMenuFocus, chroniclesReleaseAdventureMenuFocus, chroniclesBlockAdventureMenuBackgroundEvent, chroniclesPartyHotkeyMember } from '../src/chronicles/chroniclesKeyboardBindings.js';
import { useEscapeToClose } from '../src/useEscapeToClose.js';
import '../src/styles.css';
import '../src/components/ChroniclesOfMatthias.css';
import '../src/components/ChroniclesAdventureMenuFolio.css';

function MenuShortcutFixture() {
  const [open, setOpen] = useState(true);
  const [confirmExitWithoutSaving, setConfirmExitWithoutSaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveRequests, setSaveRequests] = useState(0);
  const [exitRequests, setExitRequests] = useState(0);
  const [journalRequests, setJournalRequests] = useState(0);
  const [statusRequests, setStatusRequests] = useState(0);
  const [mapRequests, setMapRequests] = useState(0);
  const [discardRequests, setDiscardRequests] = useState(0);
  const [backgroundActions, setBackgroundActions] = useState(0);
  // Only this CI fixture offers direct state setters for controls that become
  // physically unreachable behind an open modal.
  useEffect(() => {
    window.__chroniclesMenuFixture = { setSaveBusy };
    return () => { delete window.__chroniclesMenuFixture; };
  }, []);
  const [selectedHero, setSelectedHero] = useState('matthias');
  const [globalEscapeCount, setGlobalEscapeCount] = useState(0);

  // Mirrors the production back stack, which captures Escape on document
  // before our window-level keyboard handler can see it. Earlier smoke
  // fixtures omitted this hook and missed a real double-dismissal bug.
  useEscapeToClose(() => {
    setGlobalEscapeCount((count) => count + 1);
    if (open && confirmExitWithoutSaving) {
      setConfirmExitWithoutSaving(false);
      return;
    }
    if (open && feedbackOpen) {
      setFeedbackOpen(false);
      return;
    }
    if (open) chroniclesReleaseAdventureMenuFocus(document.querySelector('details.chronicles-game-menu'));
    else document.querySelector('.chronicles-game-menu > summary')?.focus();
    setOpen((value) => !value);
  }, { contextMenu: false });

  // Mirror the production focus boundary: a touch/open from an external
  // control must enter the modal before Tab or S/Q can be interpreted.
  useEffect(() => {
    if (!open) return undefined;
    const menu = document.querySelector('details.chronicles-game-menu');
    if (!menu?.open) return undefined;
    const onFocus = (event) => { chroniclesRestoreAdventureMenuFocus(menu, event.target); };
    document.addEventListener('focusin', onFocus);
    chroniclesRestoreAdventureMenuFocus(menu, document.activeElement);
    return () => document.removeEventListener('focusin', onFocus);
  }, [open, confirmExitWithoutSaving]);

  useEffect(() => {
    const keyDown = (event) => {
      // The same selection resolver as the game must NOT mutate the active
      // hero while an unrelated menu (especially Q's prompt) is open.
      const hero = chroniclesPartyHotkeyMember(event, [
        { id: 'matthias' }, { id: 'rook' }, { id: 'bishop' }, { id: 'knight' },
      ], { menuOpen: open });
      if (hero) {
        setSelectedHero(hero.id);
        return;
      }
      const action = chroniclesAdventureMenuShortcut(event, {
        menuOpen: open, saveBusy, confirmExitWithoutSaving,
        subpageOpen: feedbackOpen,
      });
      // Match the first-person view: outside the modal, Tab opens the menu;
      // after Esc releases focus, the next Tab must still be usable.
      if (!action && event.key === 'Tab' && !open && !event.shiftKey
        && !event.target?.closest?.('.chronicles-game-menu')) {
        event.preventDefault();
        if (!event.repeat) {
          setOpen(true);
          document.querySelector('.chronicles-game-menu > summary')?.focus();
        }
        return;
      }
      if (!action) {
        // Mirror the real J/G/M world-level handlers: never route them from
        // any control of the nested feedback page or its outer gem.
        if (open && feedbackOpen) return;
        if (event.target?.closest?.('input, textarea, select')) return;
        if (event.key === 'j' || event.key === 'J') {
          setJournalRequests((n) => n + 1);
          setOpen(false);
        } else if (event.key === 'g' || event.key === 'G') {
          setStatusRequests((n) => n + 1);
          setOpen(false);
        } else if (event.key === 'm' || event.key === 'M') {
          setMapRequests((n) => n + 1);
          setOpen(false);
        }
        return;
      }
      event.preventDefault();
      if (action === 'save') setSaveRequests((n) => n + 1);
      if (action === 'request-exit') {
        setExitRequests((n) => n + 1);
        setConfirmExitWithoutSaving(true);
      }
      if (action === 'cancel-exit') setConfirmExitWithoutSaving(false);
      if (action === 'back-feedback') setFeedbackOpen(false);
      if (action === 'close') {
        chroniclesReleaseAdventureMenuFocus(document.querySelector('details.chronicles-game-menu'));
        setConfirmExitWithoutSaving(false);
        setOpen(false);
      }
    };
    window.addEventListener('keydown', keyDown);
    return () => window.removeEventListener('keydown', keyDown);
  }, [open, saveBusy, confirmExitWithoutSaving, feedbackOpen]);

  return (
    <main className="chronicles" style={{
      position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden',
      background: '#101720', color: '#f2e4c8',
    }}
      data-shortcut-menu-open={String(open)}
      data-shortcut-confirm={String(confirmExitWithoutSaving)}
      data-shortcut-hero={selectedHero}
      data-shortcut-global-esc={globalEscapeCount}
      data-shortcut-feedback-open={String(feedbackOpen)}
      onPointerDownCapture={(event) => { chroniclesBlockAdventureMenuBackgroundEvent(event, open); }}
      onClickCapture={(event) => { chroniclesBlockAdventureMenuBackgroundEvent(event, open); }}
      onTouchStartCapture={(event) => { chroniclesBlockAdventureMenuBackgroundEvent(event, open); }}>
      <div className="chronicles-stage" style={{ height: '100%', minHeight: 0 }}>
        <div style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 1, display: 'grid', gap: 6 }}>
          <label>Campo de texto ajeno al menú
            <input type="text" data-shortcut-text-input aria-label="Campo de texto de prueba" />
          </label>
          <button type="button" data-shortcut-busy-toggle
            onClick={() => setSaveBusy((value) => !value)}>Alternar guardado en curso</button>
          <button type="button" data-shortcut-background-action
            onClick={() => setBackgroundActions((n) => n + 1)}>Acción del mundo</button>
          <output data-shortcut-background-actions>{backgroundActions}</output>
          <button type="button" data-shortcut-reopen onClick={() => setOpen(true)} disabled={open}>
            Reabrir menú
          </button>
          <output data-shortcut-save-requests>{saveRequests}</output>
          <output data-shortcut-exit-requests>{exitRequests}</output>
          <output data-shortcut-journal-requests>{journalRequests}</output>
          <output data-shortcut-status-requests>{statusRequests}</output>
          <output data-shortcut-map-requests>{mapRequests}</output>
          <output data-shortcut-discard-requests>{discardRequests}</output>
        </div>
        <div style={{ position: 'absolute', top: 4, right: 8, zIndex: 50, height: 44 }}>
          <details className="chronicles-game-menu" open={open}
            onKeyDown={(event) => { chroniclesContainAdventureMenuTab(event, event.currentTarget); }}
            onToggle={(event) => {
              setOpen(event.currentTarget.open);
              if (!event.currentTarget.open) {
                chroniclesReleaseAdventureMenuFocus(event.currentTarget);
                setConfirmExitWithoutSaving(false);
                setFeedbackOpen(false);
              }
            }}>
            <summary aria-label="Abrir o cerrar menú de aventura">MENÚ</summary>
            <ChroniclesAdventureMenu
              feedbackOpen={feedbackOpen} onFeedbackOpenChange={setFeedbackOpen}
              onClose={() => {
                chroniclesReleaseAdventureMenuFocus(document.querySelector('details.chronicles-game-menu'));
                setOpen(false);
              }}
              onContinue={() => {
                chroniclesReleaseAdventureMenuFocus(document.querySelector('details.chronicles-game-menu'));
                setOpen(false);
              }}
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
