import { useEffect, useState } from 'react';
import { fetchMe } from '../auth.js';
import ChroniclesPlayerAdmin from './ChroniclesPlayerAdmin.jsx';
import './ChroniclesSaveMenu.css';
import { chroniclesSavedExpeditionArea } from '../chronicles/chroniclesSavedExpeditionArea.js';


function ExpeditionMenuIcon({ kind }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <span className="chronicles-save-menu__action-icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="28" height="28" {...common}>
        {kind === 'compass' && <>
          <circle cx="16" cy="16" r="12" /><circle cx="16" cy="16" r="3" />
          <path d="M16 2v28M2 16h28M20 12l-4 4-4 4 4-8z" />
        </>}
        {kind === 'scroll' && <>
          <path d="M9 7h17v16H10a4 4 0 1 1-4-4V8a3 3 0 0 1 6 0v11" />
          <path d="M12 12h10M12 16h9" />
        </>}
        {kind === 'folder' && <path d="M3 9h11l3 4h12v14H3zM3 9V6h12l3 4" />}
        {kind === 'books' && <>
          <path d="M5 5h8v22H5zM14 8h7v19h-7zM22 4l6 2-3 21-6-2z" />
          <path d="M7 11h4M16 14h3M23 11l3 1" />
        </>}
        {kind === 'castle' && <>
          <path d="M4 27V9l4 3V7l4 3 4-3 4 3 4-3v20zM2 27h28" />
          <path d="M13 27v-9h6v9M7 15h2M23 15h2" />
        </>}
      </svg>
    </span>
  );
}

function saveWhen(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return 'Fecha no disponible';
  return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ChroniclesSaveMenu({
  saves = [], onNew, onLoad, onRename, onForget, onDelete, onExit,
  loading = false, error = '', busyRunId = null, onRetrySync,
}) {
  const [screen, setScreen] = useState('home');
  const [mayViewAdmin, setMayViewAdmin] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetchMe().then((user) => {
      if (mounted) setMayViewAdmin(Boolean(user?.isAdmin));
    }).catch(() => {
      if (mounted) setMayViewAdmin(false);
    });
    return () => { mounted = false; };
  }, []);
  const [editing, setEditing] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [confirmForget, setConfirmForget] = useState(null);
  const resume = saves.find((save) => save.active) || saves[0] || null;
  // Cached metadata is safe to read during an outage, but unsafe to edit or
  // delete while the authoritative catalog is unresolved.
  const catalogUnresolved = loading || Boolean(error);
  // Absence of a local result while syncing is not proof of a new player.
  const firstExpedition = !loading && !error && !resume;

  function openList(view) {
    setEditing(null);
    setConfirmForget(null);
    setScreen(view);
  }

  return (
    <main className="chronicles-save-menu chronicles-save-menu--expedition" data-chronicles-save-menu={screen} data-chronicles-art="approved-expedition-study-v1">
      <div className="chronicles-save-menu__sky" aria-hidden="true">
        <span className="chronicles-save-menu__moon" />
        <span className="chronicles-save-menu__tower chronicles-save-menu__tower--near" />
        <span className="chronicles-save-menu__tower chronicles-save-menu__tower--far" />
      </div>
      <section className="chronicles-save-menu__panel" aria-label="Menú principal de Chronicles">
        <p className="chronicles-save-menu__kicker">EL LIBRO DE LAS EXPEDICIONES</p>
        <h1>Chronicles <span>of Matthias</span></h1>
        <p className="chronicles-save-menu__intro">
          {resume
            ? 'Tu compañía tiene una historia pendiente. Matthias aún recuerda cómo empezó.'
            : 'Tu próxima historia comienza en Terra. Matthias está preparado para juzgar tus decisiones.'}
        </p>
        {screen === 'home' && firstExpedition && (
          <div className="chronicles-save-menu__first-steps" data-testid="chronicles-home-first-steps">
            <strong>¿Tu primera expedición?</strong>
            <p>Elige un grupo preparado o crea cuatro aventureros. Después explorarás Swordhaven; podrás guardar desde el menú durante la aventura.</p>
          </div>
        )}
        {loading && <p className="chronicles-save-menu__sync" role="status">Consultando expediciones del servidor…</p>}
        {error && (
          <div className="chronicles-save-menu__sync-recovery">
            <p className="chronicles-save-menu__sync-error" role="alert">{error}</p>
            <button type="button" onClick={onRetrySync} disabled={loading || busyRunId !== null}>
              Reintentar sincronización
            </button>
          </div>
        )}

        {screen === 'home' ? (
          <nav className="chronicles-save-menu__actions" aria-label="Acciones de expedición"
            data-chronicles-primary-action={resume ? 'continue' : 'new'}>
            {resume ? (
              <button type="button" className="is-primary is-resume"
                disabled={catalogUnresolved || busyRunId !== null} onClick={() => onLoad(resume.id)}>
                <ExpeditionMenuIcon kind="compass" />
                <span className="chronicles-save-menu__action-copy">
                  Continuar expedición <small>{resume.title} · {chroniclesSavedExpeditionArea(resume)}</small>
                </span>
                <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
              </button>
            ) : (
              <button type="button" className="is-primary is-campaign"
                disabled={catalogUnresolved || busyRunId !== null}
                onClick={() => onNew('swordhaven-first-book')}>
                <ExpeditionMenuIcon kind="compass" />
                <span className="chronicles-save-menu__action-copy">Nueva expedición <small>El rey desaparecido · Elegir compañía y partir</small></span>
                <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
              </button>
            )}
            {resume && (
              <button type="button" className="is-campaign"
                disabled={catalogUnresolved || busyRunId !== null}
                onClick={() => onNew('swordhaven-first-book')}>
                <ExpeditionMenuIcon kind="scroll" />
                <span className="chronicles-save-menu__action-copy">Nueva expedición <small>Otra campaña, sin borrar la anterior</small></span>
                <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
              </button>
            )}
            {saves.length > 1 && (
              <button type="button" disabled={catalogUnresolved || busyRunId !== null}
                onClick={() => openList('load')}>
                <ExpeditionMenuIcon kind="folder" />
                <span className="chronicles-save-menu__action-copy">Elegir otra expedición <small>{saves.length} partidas registradas</small></span>
                <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
              </button>
            )}
            <details className="chronicles-save-menu__more">
              <summary>Otras opciones</summary>
              <div className="chronicles-save-menu__more-actions">
                <button type="button" onClick={() => openList('manage')}>
                  <ExpeditionMenuIcon kind="books" />
                  <span className="chronicles-save-menu__action-copy">Gestionar partidas</span>
                  <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
                </button>
                {mayViewAdmin && (
                  <button type="button" data-chronicles-admin-link onClick={() => openList('admin')}>
                    <ExpeditionMenuIcon kind="books" />
                    <span className="chronicles-save-menu__action-copy">Administrar jugadores <small>Censo de esta instancia · solo lectura</small></span>
                    <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
                  </button>
                )}
                {onExit && (
                  <button type="button" className="is-exit" onClick={onExit}>
                    <ExpeditionMenuIcon kind="castle" />
                    <span className="chronicles-save-menu__action-copy">Volver al castillo</span>
                    <span className="chronicles-save-menu__chevron" aria-hidden="true">›</span>
                  </button>
                )}
              </div>
            </details>
          </nav>
        ) : (
          <div className="chronicles-save-menu__browser">
            <div className="chronicles-save-menu__browser-heading">
              <h2>{screen === 'load' ? 'Cargar juego' : screen === 'admin' ? 'Administración' : 'Gestionar partidas'}</h2>
              <button type="button" onClick={() => openList('home')}>← Volver</button>
            </div>
            {screen === 'admin' ? (
              <ChroniclesPlayerAdmin />
            ) : saves.length === 0 ? (
              <p className="chronicles-save-menu__empty" role={error ? 'status' : undefined}>
                {loading ? 'Buscando expediciones…'
                  : error ? 'No se pudo comprobar si hay partidas en el servidor. Vuelve y reintenta la sincronización.'
                    : 'Todavía no hay expediciones guardadas.'}
              </p>
            ) : (
              <ol className="chronicles-save-menu__list">
                {saves.map((save) => (
                  <li key={save.id}>
                    <div className="chronicles-save-menu__save">
                      <strong>{save.title}</strong>
                      <span>{chroniclesSavedExpeditionArea(save)} · {saveWhen(save.updatedAt)}</span>
                      {save.active && <em>Última partida</em>}
                      {save.remote && <em>Guardada en servidor</em>}
                    </div>
                    <div className="chronicles-save-menu__row-actions">
                      <button type="button" disabled={busyRunId !== null || loading || Boolean(error)} onClick={() => onLoad(save.id)}>Cargar</button>
                      {screen === 'manage' && (
                        <>
                          <button type="button" disabled={catalogUnresolved || busyRunId !== null} onClick={() => {
                            setEditing(save.id);
                            setDraftName(save.title);
                            setConfirmForget(null);
                          }}>Renombrar</button>
                          <button type="button" disabled={catalogUnresolved || busyRunId !== null} onClick={() => {
                            setConfirmForget(save.id);
                            setEditing(null);
                          }}>Quitar</button>
                        </>
                      )}
                    </div>
                    {screen === 'manage' && editing === save.id && (
                      <form className="chronicles-save-menu__edit" onSubmit={(event) => {
                        event.preventDefault();
                        if (onRename(save.id, draftName)) setEditing(null);
                      }}>
                        <label htmlFor={'chronicles-save-name-' + save.id}>Nombre de la expedición</label>
                        <input id={'chronicles-save-name-' + save.id} value={draftName} maxLength={56} onChange={(event) => setDraftName(event.target.value)} />
                        <button type="submit" disabled={catalogUnresolved || busyRunId !== null || !draftName.trim()}>Guardar nombre</button>
                        <button type="button" onClick={() => setEditing(null)}>Cancelar</button>
                      </form>
                    )}
                    {screen === 'manage' && confirmForget === save.id && (
                      <div className="chronicles-save-menu__confirm" role="group" aria-label={'Quitar ' + save.title}>
                        <p>{save.remote
                          ? 'Se borrará definitivamente esta expedición del servidor y de todos tus dispositivos. Esta acción no se puede deshacer. La progresión de personajes se conserva aparte.'
                          : 'Se quitará la partida pendiente de este dispositivo. No existe aún un guardado remoto confirmado.'}</p>
                        <button type="button" disabled={catalogUnresolved || busyRunId !== null} onClick={async () => {
                          try {
                            const completed = await (onDelete || onForget)?.(save.id, Boolean(save.remote));
                            if (completed !== false) setConfirmForget(null);
                          } catch {
                            // Parent owns the visible server error; keep confirmation open.
                          }
                        }}>{busyRunId === save.id ? 'Procesando…' : save.remote ? 'Eliminar definitivamente' : 'Quitar del dispositivo'}</button>
                        <button type="button" onClick={() => setConfirmForget(null)}>Cancelar</button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {screen !== 'admin' && <p className="chronicles-save-menu__disclaimer">
              {catalogUnresolved
                ? 'Se muestra el índice local: puede estar incompleto o desactualizado. Las acciones de partidas estarán disponibles después de sincronizar.'
                : 'Las partidas marcadas «Guardada en servidor» se sincronizan entre dispositivos al abrir este menú. Los nombres personalizados se conservan en este dispositivo.'}
            </p>}
          </div>
        )}
      </section>
    </main>
  );
}
