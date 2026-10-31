import { useEffect, useState } from 'react';
import { APP_RELEASE } from '../release.js';
import {
  CHRONICLES_ADMIN_CHANGELOG_LIMIT,
  CHRONICLES_ADMIN_CHANGELOG_MAX_PAGES,
  chroniclesAdminChangelogBuildSha,
  chroniclesAdminChangelogUrl,
  chroniclesFetchAdminChangelog,
  chroniclesAdminCommitCategory,
  chroniclesVisibleAdminCommits,
  chroniclesMergeAdminCommits,
} from '../chronicles/chroniclesAdminChangelog.js';

function commitDate(date) {
  return date ? new Date(date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'Fecha no disponible';
}

// Mounted only when an authenticated admin opens the "Cambios" tab.
// GitHub is read-only; errors do not affect game state or saved expeditions.
export default function ChroniclesAdminChangelog() {
  const buildSha = chroniclesAdminChangelogBuildSha();
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!buildSha) return undefined;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setError('');
    setLoading(true);
    if (page === 1) { setEntries(null); setHasMore(false); }
    void chroniclesFetchAdminChangelog({ buildId: buildSha, page, signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setEntries((current) => page === 1
          ? result.entries : chroniclesMergeAdminCommits(current, result.entries));
        setHasMore(result.hasMore);
      })
      .catch((cause) => {
        if (active) setError(controller.signal.aborted
          ? 'La consulta ha tardado demasiado. Puedes abrir el historial en GitHub.'
          : cause?.message || 'No se pudo consultar GitHub.');
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [buildSha, page, retry]);

  const historyUrl = chroniclesAdminChangelogUrl(buildSha);
  const news = chroniclesVisibleAdminCommits(entries);
  const visible = chroniclesVisibleAdminCommits(entries, showAll);

  return (
    <section className="chronicles-admin-changelog" aria-label="Cambios de esta versión" data-chronicles-admin-changelog>
      <p className="chronicles-admin-changelog__release">
        Versión cargada: <strong>{APP_RELEASE}</strong> · build <code>{buildSha?.slice(0, 12) || 'sin SHA'}</code>
      </p>
      <p className="chronicles-admin-changelog__intro">
        Historial del código que tienes abierto, cargado de {CHRONICLES_ADMIN_CHANGELOG_LIMIT} en {CHRONICLES_ADMIN_CHANGELOG_LIMIT} commits.
        Las fechas son las de los commits, no las del despliegue. No aparecen cambios pendientes en main.
      </p>
      {!buildSha ? (
        <p role="status">Esta compilación no incluye un SHA verificable (habitual en local).
          No se puede atribuir un historial de cambios a esta versión.</p>
      ) : (
        <>
          <div className="chronicles-admin-changelog__actions">
            <a href={historyUrl} target="_blank" rel="noopener noreferrer">Ver historial completo en GitHub</a>
            <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={loading}>
              Reintentar
            </button>
          </div>
          {error && <p role="alert" className="chronicles-player-admin__error">{error}</p>}
          {loading && <p role="status">{page === 1 ? 'Consultando cambios de esta versión…' : 'Cargando commits anteriores…'}</p>}
          {!loading && !error && entries?.length === 0 && <p>No hay commits disponibles para este build.</p>}
          {entries?.length > 0 && (
            <>
              <div className="chronicles-admin-changelog__filters" role="group" aria-label="Filtrar cambios">
                <button type="button" aria-pressed={!showAll} onClick={() => setShowAll(false)}>
                  Novedades ({news.length})
                </button>
                <button type="button" aria-pressed={showAll} onClick={() => setShowAll(true)}>
                  Todos los commits ({entries.length})
                </button>
              </div>
              {!visible.length ? (
                <p role="status">No hay novedades clasificables en estos {entries.length} commits.
                  Consulta «Todos los commits» para ver los cambios técnicos.</p>
              ) : (
                <ol className="chronicles-admin-changelog__entries">
                  {visible.map((entry) => (
                    <li key={entry.sha}>
                      <div className="chronicles-admin-changelog__entry-title">
                        <span className="chronicles-admin-changelog__category">{chroniclesAdminCommitCategory(entry.title).label}</span>
                        <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title}</a>
                      </div>
                      <small>{commitDate(entry.date)} · <code>{entry.sha.slice(0, 9)}</code></small>
                    </li>
                  ))}
                </ol>
              )}
              {hasMore && (
                <button type="button" className="chronicles-admin-changelog__more" disabled={loading || Boolean(error)}
                  onClick={() => setPage((current) => Math.min(current + 1, CHRONICLES_ADMIN_CHANGELOG_MAX_PAGES))}>
                  Cargar {CHRONICLES_ADMIN_CHANGELOG_LIMIT} commits anteriores
                </button>
              )}
              {!hasMore && !loading && page >= CHRONICLES_ADMIN_CHANGELOG_MAX_PAGES && (
                <p className="chronicles-admin-changelog__intro">
                  Límite de {CHRONICLES_ADMIN_CHANGELOG_LIMIT * CHRONICLES_ADMIN_CHANGELOG_MAX_PAGES} commits consultados.
                  El historial completo está disponible en GitHub.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
