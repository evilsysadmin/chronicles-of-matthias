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
  const area = typeof user?.mapId === 'string' && user.mapId.trim()
    ? chroniclesSavedExpeditionArea({ currentMapId: user.mapId }) : '';
  return [user?.username, ...labels, area, user?.mainObjective].some((value) =>
    typeof value === 'string' && value.toLocaleLowerCase('es').includes(term));
}

// These are client-side facets over the already loaded page(s). Never imply
// that the totals cover the database while a nextAfter cursor still exists.
// A missing count is unknown, not proof of zero. Never coerce malformed or
// oversized numbers supplied by an older or broken API response.
export function chroniclesRosterSavedExpeditionsLabel(user) {
  const count = user?.savedExpeditions;
  if (!Number.isSafeInteger(count) || count < 1) return null;
  return count === 1 ? '1 expedición guardada' : `${count} expediciones guardadas`;
}

export function chroniclesRosterHasSave(user) {
  return typeof user?.mapId === 'string' && Boolean(user.mapId.trim());
}

// Presence is a snapshot, not a live feed. The API expires activity after
// 150 seconds (with a 5-second future clock tolerance). Never keep a green
// status indefinitely when the admin tab remains open or a refresh fails.
export function chroniclesRosterPresenceState(user, { nowMs = Date.now(), unavailable = false } = {}) {
  if (unavailable) return 'unconfirmed';
  if (user?.online !== true) return 'offline';
  const stamp = Date.parse(user?.lastActivity);
  if (!Number.isFinite(stamp) || !Number.isFinite(nowMs)) return 'unconfirmed';
  const age = nowMs - stamp;
  return age >= -5000 && age <= 150000 ? 'online' : 'unconfirmed';
}

export function chroniclesRosterPresenceLabel(state) {
  if (state === 'online') return 'En línea';
  if (state === 'offline') return 'Sin conexión al consultar';
  return 'Estado sin confirmar';
}

export function chroniclesRosterFacetCounts(users, query = '', presence = {}) {
  const matching = (Array.isArray(users) ? users : [])
    .filter((user) => chroniclesRosterMatches(user, query));
  return {
    all: matching.length,
    online: matching.filter((user) => chroniclesRosterPresenceState(user, presence) === 'online').length,
    saved: matching.filter(chroniclesRosterHasSave).length,
    unsaved: matching.filter((user) => !chroniclesRosterHasSave(user)).length,
  };
}

export function chroniclesRosterVisibleUsers(users, { query = '', filter = 'all', order = 'recent', nowMs = Date.now(), unavailable = false } = {}) {
  const matching = (Array.isArray(users) ? users : [])
    .filter((user) => chroniclesRosterMatches(user, query))
    .filter((user) => {
      if (filter === 'online') return chroniclesRosterPresenceState(user, { nowMs, unavailable }) === 'online';
      if (filter === 'saved') return chroniclesRosterHasSave(user);
      if (filter === 'unsaved') return !chroniclesRosterHasSave(user);
      return true;
    });
  const lastSeen = (user) => {
    const timestamp = Date.parse(user?.lastActivity);
    return Number.isFinite(timestamp) ? timestamp : -Infinity;
  };
  return matching.sort((left, right) => {
    if (order === 'recent') {
      const difference = lastSeen(right) - lastSeen(left);
      // Subtracting two missing dates is NaN; use the stable name fallback.
      if (Number.isFinite(difference) && difference !== 0) return difference;
      if (lastSeen(right) !== lastSeen(left)) return lastSeen(right) > lastSeen(left) ? 1 : -1;
    }
    return String(left?.username || '').localeCompare(String(right?.username || ''), 'es');
  });
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
  const [filter, setFilter] = useState('all');
  const [order, setOrder] = useState('recent');
  const [users, setUsers] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [nextAfter, setNextAfter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    setLoadingMore(false);
    setLoading(true);
    setError('');
    chroniclesAdminRoster('', { signal: controller.signal }).then((page) => {
      if (controller.signal.aborted) return;
      setUsers(page.users);
      setNowMs(Date.now());
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
      setNowMs(Date.now());
      setNextAfter(page.nextAfter);
    } catch (cause) {
      setError(cause?.message || 'No se pudo continuar la consulta.');
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  }

  // Reassess the received timestamps locally; this never contacts the API.
  // Also tick when the browser returns from a suspended/background tab.
  useEffect(() => {
    if (section !== 'players' || !hasLoaded) return undefined;
    const tick = () => setNowMs(Date.now());
    const timer = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [section, hasLoaded]);

  const presence = { nowMs, unavailable: Boolean(error) };
  const counts = chroniclesRosterFacetCounts(users, query, presence);
  const visibleUsers = chroniclesRosterVisibleUsers(users, { query, filter, order, ...presence });

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
        Buscar jugador, héroe, zona u objetivo
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre, Swordhaven, misión…" />
      </label>
      <div className="chronicles-player-admin__filters" role="group" aria-label="Filtrar jugadores">
        {[
          ['all', 'Todos'], ['online', 'En línea'],
          ['saved', 'Con expedición'], ['unsaved', 'Sin expedición'],
        ].map(([value, label]) => (
          <button type="button" key={value} aria-pressed={filter === value}
            onClick={() => setFilter(value)}>{label} · {counts[value]}</button>
        ))}
      </div>
      <div className="chronicles-player-admin__sort">
        <label htmlFor="chronicles-roster-order">Ordenar por</label>
        <select id="chronicles-roster-order" value={order} onChange={(event) => setOrder(event.target.value)}>
          <option value="recent">Actividad más reciente</option>
          <option value="name">Nombre de cuenta</option>
        </select>
      </div>
      {hasLoaded && <p className="chronicles-player-admin__metadata" role="status">
        Mostrando {visibleUsers.length} de {users.length} usuarios cargados
        {nextAfter ? ' · los filtros y recuentos solo incluyen los cargados' : ''}
      </p>}
      {hasLoaded && !loading && visibleUsers.length === 0 && users.length > 0 && (
        <p className="chronicles-player-admin__empty">No hay jugadores que coincidan con estos filtros.</p>
      )}
      <ul className="chronicles-player-admin__users">
        {visibleUsers.map((user) => (
          <li key={user.username}>
            <div className="chronicles-player-admin__identity">
              <strong>{chroniclesRosterPlayerLabel(user)}</strong>
              <span className={chroniclesRosterPresenceState(user, presence) === 'online' ? 'is-online' : ''}>
                {chroniclesRosterPresenceLabel(chroniclesRosterPresenceState(user, presence))}
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
                {chroniclesRosterSavedExpeditionsLabel(user) && (
                  <p className="chronicles-player-admin__metadata">
                    {chroniclesRosterSavedExpeditionsLabel(user)}
                  </p>
                )}
                {chroniclesRosterHasSave(user) && (
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
        Zona y encargos: último guardado, no posición en vivo. Niveles: última progresión sincronizada; pueden existir cambios sin guardar. Presencia: «En línea» caduca tras 150 s; «Estado sin confirmar» requiere pulsar Actualizar.
      </p>
        </>
      )}
    </section>
  );
}
