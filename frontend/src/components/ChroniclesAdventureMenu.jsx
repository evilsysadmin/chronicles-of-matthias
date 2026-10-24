import { useEffect, useRef, useState } from 'react';
import ChroniclesAudioControls from './ChroniclesAudioControls.jsx';
import ChroniclesFeedbackMailbox from './ChroniclesFeedbackMailbox.jsx';

// This is the same pause/menu surface shared with the real expedition.
// Handlers deliberately stay in ChroniclesOfMatthias: no save logic lives here.
export default function ChroniclesAdventureMenu({
  onClose, onContinue, onJournal, onQuickStatus, onSave,
  onSaveExit, onAdmin, onRequestExit, onDiscardExit, onCancelExit,
  confirmExitWithoutSaving = false, saveNotice = '', saveBusy = false, isAdmin = false,
  feedbackOpen = false, onFeedbackOpenChange,
}) {
  // Keep both unsent fields across Escape/Back; a re-entry must not silently
  // turn an idea or UX report into the default bug category.
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('bug');
  const [soundOpen, setSoundOpen] = useState(false);
  const feedbackButtonRef = useRef(null);
  const previousFeedbackOpenRef = useRef(false);
  const cancelExitRef = useRef(null);
  const requestExitRef = useRef(null);
  const wasConfirmingExitRef = useRef(false);
  useEffect(() => {
    if (confirmExitWithoutSaving) cancelExitRef.current?.focus();
    else if (wasConfirmingExitRef.current) requestExitRef.current?.focus();
    wasConfirmingExitRef.current = confirmExitWithoutSaving;
  }, [confirmExitWithoutSaving]);
  useEffect(() => {
    if (previousFeedbackOpenRef.current && !feedbackOpen) feedbackButtonRef.current?.focus();
    previousFeedbackOpenRef.current = feedbackOpen;
  }, [feedbackOpen]);

  return (
    <div className="chronicles-game-menu__panel chronicles-game-menu__panel--folio"
      role="dialog" aria-modal="true" aria-label="Menú de aventura" data-chronicles-adventure-menu
      data-confirming-exit={confirmExitWithoutSaving ? 'true' : 'false'}>
      <div className="chronicles-game-menu__heading">
        <div className="chronicles-game-menu__crest" aria-hidden="true">♜</div>
        <div className="chronicles-game-menu__heading-copy">
          <small>CHRONICLES OF MATTHIAS · FOLIO DE PAUSA</small>
          <strong>MENÚ DE AVENTURA</strong>
          <span className="chronicles-game-menu__heading-legend">La compañía descansa. El camino sigue ahí fuera.</span>
        </div>
        <button type="button" className="chronicles-game-menu__close" aria-label="Cerrar menú"
          hidden={confirmExitWithoutSaving} onClick={onClose}>×</button>
      </div>
      {saveNotice && <small className="chronicles-game-menu__notice" role="status">{saveNotice}</small>}
      <div className="chronicles-game-menu__folio-columns"
        data-confirming-exit={confirmExitWithoutSaving ? 'true' : 'false'}
        data-feedback-open={feedbackOpen ? 'true' : 'false'}>
        <section className="chronicles-game-menu__folio-section" aria-label={feedbackOpen ? 'Buzón de feedback' : 'Acciones de expedición'}>
          <span className="chronicles-game-menu__section-kicker">{feedbackOpen ? 'MENSAJERÍA' : 'EXPEDICIÓN'}</span>
          <div className="chronicles-game-menu__actions">
            {!confirmExitWithoutSaving && !feedbackOpen && (
              <>
                <button type="button" className="chronicles-game-menu__continue" onClick={onContinue}>
              <span aria-hidden="true">▶</span> Continuar
            </button>
            <div className="chronicles-game-menu__action-pair">
              <button type="button" data-chronicles-menu-journal onClick={onJournal}>Crónica · J</button>
              <button type="button" data-chronicles-menu-quick-status onClick={onQuickStatus}>Estado del grupo · G</button>
            </div>
            <div className="chronicles-game-menu__action-pair">
              <button type="button" className="chronicles-game-menu__save" data-chronicles-menu-save onClick={onSave} disabled={saveBusy}>
                {saveBusy ? 'Guardando…' : 'Guardar partida · S'}
              </button>
              <button type="button" className="chronicles-game-menu__save-exit" onClick={onSaveExit} disabled={saveBusy}>Guardar y salir</button>
            </div>
            <div className="chronicles-game-menu__utility-row">
              <button type="button" aria-expanded={soundOpen}
                aria-controls="chronicles-menu-sound"
                onClick={() => setSoundOpen((value) => !value)}>♫ Sonido {soundOpen ? '▴' : '▾'}</button>
              <button type="button" data-chronicles-menu-feedback ref={feedbackButtonRef}
                aria-label="Buzón de feedback"
                onClick={() => onFeedbackOpenChange?.(true)}>✉ Feedback</button>
              {isAdmin && (
                <button type="button" className="chronicles-game-menu__admin" onClick={onAdmin}>Modo admin</button>
              )}
            </div>
                <button type="button" className="chronicles-game-menu__leave" ref={requestExitRef} onClick={onRequestExit}>Salir sin guardar · Q</button>
              </>
            )}
            {!confirmExitWithoutSaving && feedbackOpen && (
              <ChroniclesFeedbackMailbox draft={feedbackDraft} onDraftChange={setFeedbackDraft}
                draftCategory={feedbackCategory} onCategoryChange={setFeedbackCategory}
                onBack={() => onFeedbackOpenChange?.(false)} />
            )}
            {confirmExitWithoutSaving && (
              <div className="chronicles-game-menu__exit-confirm" role="group" aria-label="Confirmar salida sin guardar">
                <small>Perderás lo jugado desde el último guardado o cambio de área.</small>
                <button type="button" onClick={onDiscardExit}>Sí, salir sin guardar</button>
                <button type="button" ref={cancelExitRef} onClick={onCancelExit}>Cancelar</button>
              </div>
            )}
          </div>
        </section>
        <section id="chronicles-menu-sound"
          className="chronicles-game-menu__folio-section chronicles-game-menu__folio-sound" aria-label="Mezclador de sonido"
          hidden={!soundOpen || confirmExitWithoutSaving || feedbackOpen}
          inert={!soundOpen || confirmExitWithoutSaving || feedbackOpen ? '' : undefined}
          aria-hidden={!soundOpen || confirmExitWithoutSaving || feedbackOpen ? 'true' : undefined}>
          <span className="chronicles-game-menu__section-kicker">AMBIENTE</span>
          <ChroniclesAudioControls id="chronicles-audio-options"
            hint="First Verse en el libro de expediciones; Second Verse durante la aventura." />
        </section>
      </div>
      <small className="chronicles-game-menu__hint">
        {confirmExitWithoutSaving
          ? 'ESC · cancelar salida · TAB · elegir respuesta'
          : feedbackOpen ? 'ESC · volver al menú · TAB · navegar'
          : 'S · guardar · Q · salir · TAB en la gema · cerrar · TAB en controles · navegar'}
      </small>
    </div>
  );
}
