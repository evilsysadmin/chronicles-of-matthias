import { useEffect, useState } from 'react';
import { chroniclesAdminRoster } from '../chronicles/chroniclesAdminRosterClient.js';
import ChroniclesAdminChangelog from './ChroniclesAdminChangelog.jsx';
import { chroniclesSavedExpeditionArea } from '../chronicles/chroniclesSavedExpeditionArea.js';
import './ChroniclesPlayerAdmin.css';

const names = { matthias: 'Matthias', rook: 'Rook', bishop: 'Bishop', knight: 'Knight' };

// Older saved progressions/API versions contain no heroNames; never fabricate
// a custom label or try to render malformed objects as React children.
export function chroniclesRosterHeroLabel(user, id, fallback = names[id]) {
  const name = user?.heroNames?.[id];
  return typeof name === 'string' && name.trim() ? name.trim() : fallback;
}

// Only show a measured, valid level. Unexpected nested data must not become
// a React child and crash the whole roster during a rolling API upgrade.
export function chroniclesRosterHeroLevel(user, id) {
  const level = user?.levels?.[id];
  return Number.isInteger(level) && level >= 1 && level <= 12 ? level : '—';
}

// An unsuccessful request must never look like an empty player database.
export function chroniclesRosterStatusLabel({ hasLoaded, loading, loadingMore = false, error, count, hasMore }) {
  if (!hasLoaded) return loading ? 'Consultando censo…' : 'Censo no disponible';
  const noun = count === 1 ? '1 usuario cargado' : `${count} usuarios cargados`;
  const pages = hasMore ? ' · hay más' : '';
  if (error) return `${noun}${pages} · datos de la última consulta correcta`;
  if (loading) return `${noun}${pages} · ${loadingMore ? 'cargando más…' : 'actualizando…'}`;
  return `${noun}${pages}`;
}

// Technical IDs are useful for support, not as the primary visual name.
// Central Identity does not yet provide a trusted human-readable alias here.
export function chroniclesRosterPlayerLabel(user) {
  const username = typeof user?.username === 'string' ? user.username : '';
  if (username.startsWith('browser-journey-')) return `Navegador · ${username.slice(-10)}`;
  if (/^shadowops:staging:[0-9a-f-]{36}$/.test(username)) {
    return `ShadowOps ID · ${username.slice(-8)}`;
  }
  return username || 'Cuenta sin nombre';
}

export function chroniclesRosterRunLabel(user) {
  if (!user?.mapId) return 'Sin expedición guardada';
  if (user.runStatus === 'active') return 'Expedición en curso';
  if (user.runStatus === 'completed') return 'Expedición completada';
  return 'Última expedición guardada';
}

export function chroniclesRosterMatches(user, query) {
  const term = String(query || '').trim().toLocaleLowerCase('es');
  if (!term) return true;
  const labels = Object.values(user?.heroNames && typeof user.heroNames === 'object'
    && !Array.isArray(user.heroNames) ? user.heroNames : {});
  return [user?.username, ...labels].some((value) =>
    typeof value === 'string' && value.toLocaleLowerCase('es').includes(term));
}

function dateLabel(raw) {
  const date = new Date(raw);
  return raw && Number.isFinite(date.getTime())
    ? date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    : 'Sin registro';
}

export default function ChroniclesPlayerAdmin() {
  const [section, setSection] = useState('players');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [nextAfter, setNextAfter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoadingMore(false);
    setLoading(true);
    setError('');
    chroniclesAdminRoster('', { signal: controller.signal }).then((page) => {
      if (controller.signal.aborted) return;
      setUsers(page.users);
      setNextAfter(page.nextAfter);
      setHasLoaded(true);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause?.message || 'No se pudo consultar el censo.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [refresh]);

  async function more() {
    if (!nextAfter || loading) return;
    setLoadingMore(true);
    setLoading(true);
    setError('');
    try {
      const page = await chroniclesAdminRoster(nextAfter);
      setUsers((current) => [...current, ...page.users]);
      setNextAfter(page.nextAfter);
    } catch (cause) {
      setError(cause?.message || 'No se pudo continuar la consulta.');
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  }

  const visibleUsers = users.filter((user) => chroniclesRosterMatches(user, query));

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const environment = hostname.startsWith('staging.') ? 'STAGING'
    : hostname === 'chronicles.shadowops.dpdns.org' ? 'PRODUCCIÓN' : 'LOCAL';

  return (
    <section className="chronicles-player-admin" aria-label="Administración de Chronicles" data-chronicles-admin-roster>
      <p className="chronicles-player-admin__intro">
        <strong>{environment} · Solo lectura</strong>
        <span>Datos de esta instancia. La zona corresponde al último guardado, no a una posición en vivo.</span>
      </p>
      <div className="chronicles-player-admin__tabs" role="tablist" aria-label="Secciones de administración">
        <button type="button" role="tab" aria-selected={section === 'players'}
          onClick={() => setSection('players')}>Jugadores</button>
        <button type="button" role="tab" aria-selected={section === 'changes'}
          onClick={() => setSection('changes')}>Cambios de versión</button>
      </div>
      {section === 'changes' ? (
        <ChroniclesAdminChangelog />
      ) : (
        <>
      <div className="chronicles-player-admin__toolbar">
        <span aria-live="polite">{chroniclesRosterStatusLabel({
          hasLoaded, loading, loadingMore, error, count: users.length, hasMore: Boolean(nextAfter),
        })}</span>
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading}>
          Actualizar
        </button>
      </div>
      {error && <p role="alert" className="chronicles-player-admin__error">{error}</p>}
      {loading && <p role="status">{loadingMore ? 'Cargando más jugadores…' : 'Consultando jugadores…'}</p>}
      {!loading && !error && hasLoaded && users.length === 0 && <p>Aún no hay jugadores en esta instancia.</p>}
      <label className="chronicles-player-admin__search">
        Buscar jugador o héroe
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o identificador…" />
      </label>
      {hasLoaded && query.trim() && <p className="chronicles-player-admin__metadata" role="status">
        {visibleUsers.length} coincidencias entre {users.length} usuarios cargados
        {nextAfter ? ' · puede haber más usuarios sin cargar' : ''}
      </p>}
      <ul className="chronicles-player-admin__users">
        {visibleUsers.map((user) => (
          <li key={user.username}>
            <div className="chronicles-player-admin__identity">
              <strong>{chroniclesRosterPlayerLabel(user)}</strong>
              <span className={user.online ? 'is-online' : ''}>
                {user.online ? 'En línea' : 'Sin conexión'}
              </span>
            </div>
            <p className="chronicles-player-admin__metadata">
              {chroniclesRosterRunLabel(user)}
              {user.mapId ? ` · ${chroniclesSavedExpeditionArea({ currentMapId: user.mapId })}` : ''}
            </p>
            {typeof user.mainObjective === 'string' && user.mainObjective.trim() && (
              <p className="chronicles-player-admin__objective">
                <strong>Historia:</strong> {user.mainObjective}
              </p>
            )}
            <p className="chronicles-player-admin__metadata">
              Última actividad: {dateLabel(user.lastActivity)}
              {user.savedAt ? ` · Guardado: ${dateLabel(user.savedAt)}` : ''}
            </p>
            <details className="chronicles-player-admin__details">
              <summary>Ver ficha del jugador</summary>
              <div className="chronicles-player-admin__detail-body">
                <p className="chronicles-player-admin__metadata">
                  Cuenta: <code>{user.username}</code>
                </p>
                <p className="chronicles-player-admin__metadata">
                  Alta: {dateLabel(user.createdAt)}
                  {user.runStatus ? ` · Estado guardado: ${chroniclesRosterRunLabel(user)}` : ''}
                </p>
                {(Number.isInteger(user.activeQuests) || Number.isInteger(user.completedQuests)) && (
                  <p className="chronicles-player-admin__metadata">
                    Encargos del último guardado: {user.activeQuests || 0} activos · {user.completedQuests || 0} completados
                  </p>
                )}
                <div className="chronicles-player-admin__levels" aria-label="Niveles de los héroes">
                  {Object.entries(names).map(([id, name]) => (
                    <span key={id}>{chroniclesRosterHeroLabel(user, id, name)}: <b>{chroniclesRosterHeroLevel(user, id)}</b></span>
                  ))}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {nextAfter && <button type="button" onClick={more} disabled={loading}>Cargar más jugadores</button>}
      <p className="chronicles-player-admin__note">
        Zona y encargos: último guardado, no posición en vivo. Niveles: última progresión sincronizada; pueden existir cambios sin guardar.
      </p>
        </>
      )}
    </section>
  );
}
