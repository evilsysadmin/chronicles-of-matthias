import { useEffect, useRef, useState } from 'react';
import ChroniclesAudioControls from './ChroniclesAudioControls.jsx';
import ChroniclesFeedbackMailbox from './ChroniclesFeedbackMailbox.jsx';
import ChroniclesGameHelp from './ChroniclesGameHelp.jsx';
import { CHRONICLES_COMBAT_SAVE_NOTICE } from '../chronicles/chroniclesSavePolicy.js';

// This is the same pause/menu surface shared with the real expedition.
// Handlers deliberately stay in ChroniclesOfMatthias: no save logic lives here.
export default function ChroniclesAdventureMenu({
  onClose, onContinue, onJournal, onQuickStatus, onSave,
  onSaveExit, onRequestLoad, onSaveBeforeLoad, onLoadWithoutSave, onCancelLoad,
  onAdmin, onRetryAdmin, onRequestExit, onDiscardExit, onCancelExit,
  confirmExitWithoutSaving = false, confirmLoadSelection = false,
  saveNotice = '', saveBusy = false, inCombat = false, isAdmin = false, adminStatus = 'verified',
  feedbackOpen = false, onFeedbackOpenChange,
}) {
  // Keep both unsent fields across Escape/Back; a re-entry must not silently
  // turn an idea or UX report into the default bug category.
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState('bug');
  const [soundOpen, setSoundOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef(null);
  const previousHelpOpenRef = useRef(false);
  const feedbackButtonRef = useRef(null);
  const previousFeedbackOpenRef = useRef(false);
  const cancelExitRef = useRef(null);
  const requestExitRef = useRef(null);
  const wasConfirmingExitRef = useRef(false);
  const cancelLoadRef = useRef(null);
  const requestLoadRef = useRef(null);
  const wasConfirmingLoadRef = useRef(false);
  useEffect(() => {
    if (confirmExitWithoutSaving) cancelExitRef.current?.focus();
    else if (wasConfirmingExitRef.current) requestExitRef.current?.focus();
    wasConfirmingExitRef.current = confirmExitWithoutSaving;
  }, [confirmExitWithoutSaving]);
  useEffect(() => {
    if (confirmLoadSelection) cancelLoadRef.current?.focus();
    else if (wasConfirmingLoadRef.current) requestLoadRef.current?.focus();
    wasConfirmingLoadRef.current = confirmLoadSelection;
  }, [confirmLoadSelection]);
  useEffect(() => {
    if (previousHelpOpenRef.current && !helpOpen) helpButtonRef.current?.focus();
    previousHelpOpenRef.current = helpOpen;
  }, [helpOpen]);
  useEffect(() => {
    if (previousFeedbackOpenRef.current && !feedbackOpen) feedbackButtonRef.current?.focus();
    previousFeedbackOpenRef.current = feedbackOpen;
  }, [feedbackOpen]);

  return (
    <div className="chronicles-game-menu__panel chronicles-game-menu__panel--folio"
      role="dialog" aria-modal="true" aria-label="Menú de aventura" data-chronicles-adventure-menu
      data-confirming-exit={confirmExitWithoutSaving ? 'true' : 'false'}
      data-confirming-load={confirmLoadSelection ? 'true' : 'false'}>
      <div className="chronicles-game-menu__heading">
        <div className="chronicles-game-menu__crest" aria-hidden="true">♜</div>
        <div className="chronicles-game-menu__heading-copy">
          <small>CHRONICLES OF MATTHIAS · FOLIO DE PAUSA</small>
          <strong>MENÚ DE AVENTURA</strong>
          <span className="chronicles-game-menu__heading-legend">La compañía descansa. El camino sigue ahí fuera.</span>
        </div>
        <button type="button" className="chronicles-game-menu__close" aria-label="Cerrar menú"
          hidden={confirmExitWithoutSaving || confirmLoadSelection} onClick={onClose}>×</button>
      </div>
      {inCombat
        ? <small className="chronicles-game-menu__notice" role="status" data-chronicles-combat-save-notice>
          {CHRONICLES_COMBAT_SAVE_NOTICE}
        </small>
        : saveNotice && <small className="chronicles-game-menu__notice" role="status">{saveNotice}</small>}
      <div className="chronicles-game-menu__folio-columns"
        data-confirming-exit={confirmExitWithoutSaving ? 'true' : 'false'}
        data-confirming-load={confirmLoadSelection ? 'true' : 'false'}
        data-feedback-open={feedbackOpen ? 'true' : 'false'}
        data-help-open={helpOpen ? 'true' : 'false'}>
        <section className="chronicles-game-menu__folio-section" aria-label={confirmLoadSelection ? 'Confirmar cambio de partida' : helpOpen ? 'Guía del aventurero' : feedbackOpen ? 'Buzón de feedback' : 'Acciones de expedición'}>
          <span className="chronicles-game-menu__section-kicker">{confirmLoadSelection ? 'CAMBIAR PARTIDA' : helpOpen ? 'AYUDA' : feedbackOpen ? 'MENSAJERÍA' : 'EXPEDICIÓN'}</span>
          {helpOpen && !confirmExitWithoutSaving && !confirmLoadSelection && !feedbackOpen
            ? <ChroniclesGameHelp onBack={() => setHelpOpen(false)} />
            : <div className="chronicles-game-menu__actions">
            {!confirmExitWithoutSaving && !confirmLoadSelection && !feedbackOpen && !helpOpen && (
              <>
                <button type="button" className="chronicles-game-menu__continue" onClick={onContinue}>
              <span aria-hidden="true">▶</span> Continuar
            </button>
            <div className="chronicles-game-menu__action-pair">
              <button type="button" data-chronicles-menu-journal onClick={onJournal}>Crónica · J</button>
              <button type="button" data-chronicles-menu-quick-status onClick={onQuickStatus}>Estado del grupo · G</button>
            </div>
            <div className="chronicles-game-menu__action-pair">
              <button type="button" className="chronicles-game-menu__save" data-chronicles-menu-save onClick={onSave}
                disabled={saveBusy || inCombat} title={inCombat ? CHRONICLES_COMBAT_SAVE_NOTICE : undefined}>
                {saveBusy ? 'Guardando…' : 'Guardar partida · S'}
              </button>
              <button type="button" ref={requestLoadRef} className="chronicles-game-menu__load"
                data-chronicles-menu-load onClick={onRequestLoad} disabled={saveBusy}>Cargar partida</button>
              <button type="button" className="chronicles-game-menu__save-exit" onClick={onSaveExit}
                disabled={saveBusy || inCombat} title={inCombat ? CHRONICLES_COMBAT_SAVE_NOTICE : undefined}>Guardar y salir</button>
            </div>
            <div className="chronicles-game-menu__utility-row">
              <button type="button" aria-expanded={soundOpen}
                aria-controls="chronicles-menu-sound"
                onClick={() => setSoundOpen((value) => !value)}>♫ Sonido {soundOpen ? '▴' : '▾'}</button>
              <button type="button" ref={helpButtonRef} data-chronicles-menu-help
                aria-expanded={helpOpen} aria-controls="chronicles-game-help"
                onClick={() => { setSoundOpen(false); setHelpOpen(true); }}>? Ayuda</button>
              <button type="button" data-chronicles-menu-feedback ref={feedbackButtonRef}
                aria-label="Buzón de feedback"
                onClick={() => onFeedbackOpenChange?.(true)}>✉ Feedback</button>
              {isAdmin && (
                <button type="button" className="chronicles-game-menu__admin" data-chronicles-menu-admin
                  onClick={onAdmin}>Modo admin</button>
              )}
              {!isAdmin && adminStatus === 'unavailable' && (
                <button type="button" className="chronicles-game-menu__admin-retry"
                  data-chronicles-menu-admin-retry onClick={onRetryAdmin}>
                  Reintentar verificación de permisos
                </button>
              )}
            </div>
                <button type="button" className="chronicles-game-menu__leave" ref={requestExitRef} onClick={onRequestExit}>Salir sin guardar · Q</button>
              </>
            )}
            {!confirmExitWithoutSaving && !confirmLoadSelection && feedbackOpen && !helpOpen && (
              <ChroniclesFeedbackMailbox draft={feedbackDraft} onDraftChange={setFeedbackDraft}
                draftCategory={feedbackCategory} onCategoryChange={setFeedbackCategory}
                onBack={() => onFeedbackOpenChange?.(false)} />
            )}
            {confirmLoadSelection && (
              <div className="chronicles-game-menu__exit-confirm" role="group" aria-label="Confirmar cambio de partida"
                data-chronicles-load-confirm>
                <small>{inCombat
                  ? 'Estás en combate: solo puedes elegir otra partida sin guardar el enfrentamiento actual.'
                  : 'Elige una expedición guardada. Los cambios desde el último guardado o cambio de área se perderán si no guardas antes.'}</small>
                <button type="button" onClick={onSaveBeforeLoad} disabled={saveBusy || inCombat}>Guardar esta partida y elegir otra</button>
                <button type="button" onClick={onLoadWithoutSave} disabled={saveBusy}>Elegir sin guardar</button>
                <button type="button" ref={cancelLoadRef} onClick={onCancelLoad} disabled={saveBusy}>Cancelar</button>
              </div>
            )}
            {confirmExitWithoutSaving && (
              <div className="chronicles-game-menu__exit-confirm" role="group" aria-label="Confirmar salida sin guardar">
                <small>Perderás lo jugado desde el último guardado o cambio de área.</small>
                <button type="button" onClick={onDiscardExit}>Sí, salir sin guardar</button>
                <button type="button" ref={cancelExitRef} onClick={onCancelExit}>Cancelar</button>
              </div>
            )}
          </div>}
        </section>
        <section id="chronicles-menu-sound"
          className="chronicles-game-menu__folio-section chronicles-game-menu__folio-sound" aria-label="Mezclador de sonido"
          hidden={!soundOpen || confirmExitWithoutSaving || confirmLoadSelection || feedbackOpen || helpOpen}
          inert={!soundOpen || confirmExitWithoutSaving || confirmLoadSelection || feedbackOpen || helpOpen ? '' : undefined}
          aria-hidden={!soundOpen || confirmExitWithoutSaving || confirmLoadSelection || feedbackOpen || helpOpen ? 'true' : undefined}>
          <span className="chronicles-game-menu__section-kicker">AMBIENTE</span>
          <ChroniclesAudioControls id="chronicles-audio-options"
            hint="First Verse en el libro de expediciones; Second Verse durante la aventura." />
        </section>
      </div>
      <small className="chronicles-game-menu__hint">
        {confirmExitWithoutSaving
          ? 'ESC · cancelar salida · TAB · elegir respuesta'
          : confirmLoadSelection ? 'ESC · cancelar cambio de partida · TAB · elegir respuesta'
          : feedbackOpen ? 'ESC · volver al menú · TAB · navegar'
          : helpOpen ? 'TAB · recorrer ayuda · Volver al menú'
          : inCombat ? 'Guardado desactivado en combate · Q · salir sin guardar · TAB · navegar'
          : 'S · guardar · Q · salir · TAB en la gema · cerrar · TAB en controles · navegar'}
      </small>
    </div>
  );
}
