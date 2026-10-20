import ChroniclesAudioControls from './ChroniclesAudioControls.jsx';

// This is the same pause/menu surface shared with the real expedition.
// Handlers deliberately stay in ChroniclesOfMatthias: no save logic lives here.
export default function ChroniclesAdventureMenu({
  onClose, onContinue, onJournal, onQuickStatus, onSave,
  onSaveExit, onAdmin, onRequestExit, onDiscardExit, onCancelExit,
  confirmExitWithoutSaving = false, saveNotice = '', saveBusy = false, isAdmin = false,
}) {
  return (
    <div className="chronicles-game-menu__panel chronicles-game-menu__panel--folio"
      role="dialog" aria-modal="true" aria-label="Menú de aventura" data-chronicles-adventure-menu>
      <div className="chronicles-game-menu__heading">
        <div className="chronicles-game-menu__crest" aria-hidden="true">♜</div>
        <div className="chronicles-game-menu__heading-copy">
          <small>CHRONICLES OF MATTHIAS · PAUSA</small>
          <strong>MENÚ DE AVENTURA</strong>
          <span>La compañía aguarda tus órdenes.</span>
        </div>
        <button type="button" className="chronicles-game-menu__close" aria-label="Cerrar menú" onClick={onClose}>×</button>
      </div>
      {saveNotice && <small className="chronicles-game-menu__notice" role="status">{saveNotice}</small>}
      <div className="chronicles-game-menu__folio-columns">
        <section className="chronicles-game-menu__folio-section" aria-label="Acciones de expedición">
          <span className="chronicles-game-menu__section-kicker">EXPEDICIÓN</span>
          <div className="chronicles-game-menu__actions">
            <button type="button" className="chronicles-game-menu__continue" onClick={onContinue}>
              <span aria-hidden="true">▶</span> Continuar
            </button>
            <button type="button" data-chronicles-menu-journal onClick={onJournal}>Crónica · J</button>
            <button type="button" data-chronicles-menu-quick-status onClick={onQuickStatus}>Estado del grupo · G</button>
            <button type="button" className="chronicles-game-menu__save" onClick={onSave} disabled={saveBusy}>
              {saveBusy ? 'Guardando…' : 'Guardar partida'}
            </button>
            <button type="button" className="chronicles-game-menu__save-exit" onClick={onSaveExit} disabled={saveBusy}>Guardar y salir</button>
            {isAdmin && (
              <button type="button" className="chronicles-game-menu__admin" onClick={onAdmin}>Modo admin</button>
            )}
            {!confirmExitWithoutSaving ? (
              <button type="button" className="chronicles-game-menu__leave" onClick={onRequestExit}>Salir sin guardar</button>
            ) : (
              <div className="chronicles-game-menu__exit-confirm" role="group" aria-label="Confirmar salida sin guardar">
                <small>Perderás lo jugado desde el último guardado o cambio de área.</small>
                <button type="button" onClick={onDiscardExit}>Sí, salir sin guardar</button>
                <button type="button" onClick={onCancelExit}>Cancelar</button>
              </div>
            )}
          </div>
        </section>
        <section className="chronicles-game-menu__folio-section chronicles-game-menu__folio-sound" aria-label="Mezclador de sonido">
          <span className="chronicles-game-menu__section-kicker">AMBIENTE</span>
          <ChroniclesAudioControls id="chronicles-audio-options"
            hint="First Verse en el libro de expediciones; Second Verse durante la aventura." />
        </section>
      </div>
      <small className="chronicles-game-menu__hint">ESC · cerrar · TAB · navegar</small>
    </div>
  );
}
