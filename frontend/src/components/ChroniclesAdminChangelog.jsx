import { useEffect, useState } from 'react';
import { APP_RELEASE } from '../release.js';
import {
  CHRONICLES_ADMIN_CHANGELOG_LIMIT,
  chroniclesAdminChangelogBuildSha,
  chroniclesAdminChangelogUrl,
  chroniclesFetchAdminChangelog,
  chroniclesAdminCommitCategory,
  chroniclesVisibleAdminCommits,
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

  useEffect(() => {
    if (!buildSha) return undefined;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    setError('');
    setEntries(null);
    void chroniclesFetchAdminChangelog({ buildId: buildSha, signal: controller.signal })
      .then((history) => { if (active) setEntries(history); })
      .catch((cause) => {
        if (active) setError(controller.signal.aborted
          ? 'La consulta ha tardado demasiado. Puedes abrir el historial en GitHub.'
          : cause?.message || 'No se pudo consultar GitHub.');
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [buildSha, retry]);

  const historyUrl = chroniclesAdminChangelogUrl(buildSha);
  const news = chroniclesVisibleAdminCommits(entries);
  const visible = chroniclesVisibleAdminCommits(entries, showAll);

  return (
    <section className="chronicles-admin-changelog" aria-label="Cambios de esta versión" data-chronicles-admin-changelog>
      <p className="chronicles-admin-changelog__release">
        Versión cargada: <strong>{APP_RELEASE}</strong> · build <code>{buildSha?.slice(0, 12) || 'sin SHA'}</code>
      </p>
      <p className="chronicles-admin-changelog__intro">
        Resumen de los últimos {CHRONICLES_ADMIN_CHANGELOG_LIMIT} commits incluidos hasta el código que tienes abierto.
        Las fechas son las de los commits, no las del despliegue. No aparecen cambios pendientes en main.
      </p>
      {!buildSha ? (
        <p role="status">Esta compilación no incluye un SHA verificable (habitual en local).
          No se puede atribuir un historial de cambios a esta versión.</p>
      ) : (
        <>
          <div className="chronicles-admin-changelog__actions">
            <a href={historyUrl} target="_blank" rel="noopener noreferrer">Ver historial completo en GitHub</a>
            <button type="button" onClick={() => setRetry((value) => value + 1)} disabled={entries === null && !error}>
              Reintentar
            </button>
          </div>
          {error && <p role="alert" className="chronicles-player-admin__error">{error}</p>}
          {!error && entries === null && <p role="status">Consultando cambios de esta versión…</p>}
          {!error && entries?.length === 0 && <p>No hay commits disponibles para este build.</p>}
          {!error && entries?.length > 0 && (
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
            </>
          )}
        </>
      )}
    </section>
  );
}
