import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeToClose } from '../useEscapeToClose.js';
import { chroniclesQuestRegionHint } from '../chronicles/chroniclesQuestRegionHint.js';
import { chroniclesQuestLogEntries } from './ChroniclesQuestLog.jsx';
import './ChroniclesJournalModal.css';

// One readable page at a time. The old side-by-side quest dashboard left half
// the screen blank when an expedition had few folios.
export default function ChroniclesJournalModal({ open, state, entries = [], narrations = [], onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const scrollRef = useRef(null);
  const [chapter, setChapter] = useState('quests');
  const [openedQuestId, setOpenedQuestId] = useState(null);
  useEscapeToClose(onClose, { disabled: !open, contextMenu: false });

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const quests = chroniclesQuestLogEntries(state);
  const active = quests.filter((quest) => quest.status === 'active');
  const selectedId = openedQuestId === null ? (active[0] || quests[0])?.id : openedQuestId;
  const foliosCount = entries.length + narrations.length;
  const changeChapter = (next) => {
    setChapter(next);
    // Each bookmark opens at its first line even after a long quest scroll.
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  return createPortal(
    <div className="chronicles-journal-modal__backdrop" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
      event.stopPropagation();
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={dialogRef} className="chronicles-journal-modal" role="dialog" aria-modal="true"
        aria-labelledby="chronicles-journal-modal-title"
        onKeyDown={(event) => {
          // The dialog intentionally blocks the parent game's shortcuts.
          // Escape must close locally because the global back-stack listener
          // sits on document and cannot see a stopped bubbling event.
          if (event.key === 'Escape' || event.key === 'j' || event.key === 'J') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          event.stopPropagation();
          if (event.key !== 'Tab') return;
          const focusable = Array.from(dialogRef.current?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <header className="chronicles-journal-modal__header">
          <span className="chronicles-journal-modal__crest" aria-hidden="true">✥</span>
          <div className="chronicles-journal-modal__heading">
            <small>EL LIBRO DE LA COMPAÑÍA</small>
            <h2 id="chronicles-journal-modal-title">Crónica de expedición</h2>
            <p>Encargos que seguimos y memoria de lo vivido.</p>
          </div>
          <button ref={closeRef} type="button" aria-label="Cerrar Crónica" title="Cerrar (J o Esc)"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>×</button>
        </header>

        <nav className="chronicles-journal-modal__chapters" aria-label="Capítulos de la crónica" role="tablist">
          <button type="button" role="tab" id="chronicles-journal-tab-quests"
            aria-controls={chapter === 'quests' ? 'chronicles-journal-panel-quests' : undefined} aria-selected={chapter === 'quests'}
            onClick={() => changeChapter('quests')}>
            <span>Encargos</span><small>{active.length} {active.length === 1 ? 'pendiente' : 'pendientes'}</small>
          </button>
          <button type="button" role="tab" id="chronicles-journal-tab-memories"
            aria-controls={chapter === 'memories' ? 'chronicles-journal-panel-memories' : undefined} aria-selected={chapter === 'memories'}
            onClick={() => changeChapter('memories')}>
            <span>Memorias</span><small>{foliosCount} {foliosCount === 1 ? 'anotación' : 'anotaciones'}</small>
          </button>
        </nav>

        <div ref={scrollRef} className="chronicles-journal-modal__scroll" tabIndex={0} role="region" aria-label="Páginas de la crónica">
          {chapter === 'quests' ? (
            <section id="chronicles-journal-panel-quests" role="tabpanel"
              aria-labelledby="chronicles-journal-tab-quests" className="chronicles-journal-modal__chapter">
              <div className="chronicles-journal-modal__chapter-head">
                <small>CAPÍTULO I</small>
                <h3>Los asuntos pendientes</h3>
                <p>Abre un encargo para leer la pista y la región donde buscar. Los lugares no revelados siguen siendo desconocidos.</p>
              </div>
              {quests.length ? (
                <ol className="chronicles-journal-modal__quest-pages" aria-label="Encargos de la compañía">
                  {quests.map((quest, index) => {
                    const expanded = selectedId === quest.id;
                    const hint = chroniclesQuestRegionHint(quest, state);
                    const detailId = `chronicles-journal-quest-${index}`;
                    return (
                      <li key={quest.id} className={`chronicles-journal-modal__quest-page${quest.status === 'completed' ? ' is-completed' : ''}`}
                        data-chronicles-quest-id={quest.id} data-chronicles-quest-status={quest.status}>
                        <button type="button" aria-expanded={expanded} aria-controls={detailId}
                          className="chronicles-journal-modal__quest-heading"
                          onClick={() => setOpenedQuestId(expanded ? '' : quest.id)}>
                          <span className="chronicles-journal-modal__quest-number" aria-hidden="true">
                            {quest.status === 'completed' ? '✓' : String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="chronicles-journal-modal__quest-heading-copy">
                            <small>{quest.main ? 'Hilo principal' : 'Encargo secundario'}
                              {quest.status === 'completed' ? ' · Resuelto' : ''}</small>
                            <strong>{quest.title}</strong>
                            {hint && <em>⌖ {hint.region}</em>}
                          </span>
                          <span aria-hidden="true" className="chronicles-journal-modal__quest-chevron">{expanded ? '−' : '+'}</span>
                        </button>
                        {expanded && (
                          <div id={detailId} className="chronicles-journal-modal__quest-detail">
                            {quest.description && <p className="chronicles-journal-modal__quest-story">{quest.description}</p>}
                            {quest.objective && <p className="chronicles-journal-modal__quest-objective">{quest.objective}</p>}
                            {hint && (
                              <aside className="chronicles-journal-modal__quest-hint">
                                <small>PISTA DEL LUGAR · {hint.kind}</small>
                                <strong>{hint.region}</strong>
                                <p>{hint.clue}</p>
                              </aside>
                            )}
                            {!hint && quest.status === 'active' &&
                              <p className="chronicles-journal-modal__quest-unknown">Aún no consta una región segura en las notas de este encargo.</p>}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="chronicles-journal-modal__empty">Todavía no hay encargos que registrar.</p>}
            </section>
          ) : (
            <section id="chronicles-journal-panel-memories" role="tabpanel"
              aria-labelledby="chronicles-journal-tab-memories" className="chronicles-journal-modal__chapter">
              <div className="chronicles-journal-modal__chapter-head">
                <small>CAPÍTULO II</small>
                <h3>Memorias del camino</h3>
                <p>Lo que la compañía descubrió, contó y sobrevivió.</p>
              </div>
              {entries.length ? (
                <ol className="chronicles-journal-modal__folios">{entries.map((entry) => (
                  <li key={entry.id}>
                    <span className="chronicles-journal-modal__folio-sigil" aria-hidden="true">{entry.sigil}</span>
                    <div><strong>{entry.title}</strong><p>{entry.body}</p></div>
                  </li>
                ))}</ol>
              ) : <p className="chronicles-journal-modal__empty">Todavía no se han escrito folios de expedición.</p>}
              <h4>Voces del viaje</h4>
              {narrations.length ? <ol className="chronicles-journal-modal__diary" data-chronicles-narration-log>{narrations.map((entry) => (
                <li key={`${entry.at}-${entry.text}`}>{entry.text}</li>
              ))}</ol> : <p className="chronicles-journal-modal__empty">Lo que cuente la crónica durante el viaje quedará aquí.</p>}
            </section>
          )}
        </div>
        <footer><span>LIBRO DE LA EXPEDICIÓN</span><span><kbd>J</kbd> / <kbd>Esc</kbd> para cerrar</span></footer>
      </section>
    </div>, document.body,
  );
}
