import { useEffect, useState } from 'react';
import { chroniclesAdminRoster } from '../chronicles/chroniclesAdminRosterClient.js';
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

function dateLabel(raw) {
  const date = new Date(raw);
  return raw && Number.isFinite(date.getTime())
    ? date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
    : 'Sin registro';
}

export default function ChroniclesPlayerAdmin() {
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

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const environment = hostname.startsWith('staging.') ? 'STAGING'
    : hostname === 'chronicles.shadowops.dpdns.org' ? 'PRODUCCIÓN' : 'LOCAL';

  return (
    <section className="chronicles-player-admin" aria-label="Administración de Chronicles" data-chronicles-admin-roster>
      <p className="chronicles-player-admin__intro">
        <strong>{environment} · Solo lectura</strong>
        <span>Datos de esta instancia. La zona corresponde al último guardado, no a una posición en vivo.</span>
      </p>
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
      <ul className="chronicles-player-admin__users">
        {users.map((user) => (
          <li key={user.username}>
            <div className="chronicles-player-admin__identity">
              <strong>{user.username}</strong>
              <span className={user.online ? 'is-online' : ''}>
                {user.online ? 'En línea' : 'Sin conexión'}
              </span>
            </div>
            <p className="chronicles-player-admin__metadata">
              Última actividad: {dateLabel(user.lastActivity)} · Alta: {dateLabel(user.createdAt)}
            </p>
            <p className="chronicles-player-admin__metadata">
              Última zona guardada: {user.mapId ? chroniclesSavedExpeditionArea({ currentMapId: user.mapId }) : 'Sin expedición guardada'}
              {user.savedAt ? ` · ${dateLabel(user.savedAt)}` : ''}
            </p>
            <div className="chronicles-player-admin__levels" aria-label="Niveles de los héroes">
              {Object.entries(names).map(([id, name]) => (
                <span key={id}>{chroniclesRosterHeroLabel(user, id, name)}: <b>{chroniclesRosterHeroLevel(user, id)}</b></span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {nextAfter && <button type="button" onClick={more} disabled={loading}>Cargar más jugadores</button>}
      <p className="chronicles-player-admin__note">
        Los niveles son la última progresión sincronizada de la cuenta; una expedición sin guardar puede llevar cambios pendientes.
      </p>
    </section>
  );
}
