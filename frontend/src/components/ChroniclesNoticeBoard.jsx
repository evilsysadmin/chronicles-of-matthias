import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chroniclesNoticeBoardEntries } from '../chronicles/chroniclesNoticeBoardEntries.js';
import './ChroniclesNoticeBoard.css';

const STATUS = Object.freeze({
  available: 'Disponible',
  active: 'En curso',
  completed: 'Completado',
});

function QuestCard({ offer, onAccept = null }) {
  return (
    <li className="chronicles-notice-board__card"
      data-chronicles-board-quest={offer.questId || offer.id}
      data-chronicles-board-status={offer.status}>
      <div className="chronicles-notice-board__card-head">
        <strong>{offer.title}</strong>
        <span className={'is-' + offer.status}>{STATUS[offer.status] || offer.status}</span>
      </div>
      {offer.description && <p>{offer.description}</p>}
      {offer.detail && <p className="chronicles-notice-board__detail">{offer.detail}</p>}
      {offer.status !== 'available' && offer.objective && (
        <p className="chronicles-notice-board__objective">{offer.objective}</p>
      )}
      {offer.canAccept && onAccept && (
        <button type="button" data-chronicles-board-accept={offer.id}
          onClick={() => onAccept(offer.id)}>Aceptar encargo</button>
      )}
    </li>
  );
}

export default function ChroniclesNoticeBoard({ state, onAccept, onClose }) {
  const { posted, other } = chroniclesNoticeBoardEntries(state);
  const closeRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key === 'Tab') {
        const buttons = Array.from(panelRef.current?.querySelectorAll('button:not(:disabled)') || []);
        if (!buttons.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (!panelRef.current?.contains(document.activeElement)
          || (event.shiftKey && document.activeElement === first)
          || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
        return;
      }
      // Enter/Space must still activate a focused quest button natively.
      if ((event.key === 'Enter' || event.key === ' ') && panelRef.current?.contains(document.activeElement)) {
        event.stopImmediatePropagation();
        return;
      }
      // World movement and party hotkeys must not act behind this folio.
      if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      if (previous?.isConnected && typeof previous.focus === 'function') previous.focus();
    };
  }, [onClose]);

  const modal = (
    <div className="chronicles-notice-board__backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="chronicles-notice-board" ref={panelRef} role="dialog" aria-modal="true"
        aria-label="Tablón de encargos de Swordhaven" data-chronicles-notice-board>
        <header>
          <div>
            <small>SWORDHAVEN · EDICTOS Y CONTRATOS</small>
            <h2>Tablón de encargos</h2>
            <p>Consulta los avisos y decide cuáles acepta la compañía.</p>
          </div>
          <button type="button" ref={closeRef} className="chronicles-notice-board__close"
            onClick={onClose} aria-label="Cerrar tablón">✕</button>
        </header>
        <div className="chronicles-notice-board__body">
          <h3>Ofertas del tablón</h3>
          {posted.length
            ? <ul>{posted.map((offer) => <QuestCard key={offer.id} offer={offer} onAccept={onAccept} />)}</ul>
            : <p className="chronicles-notice-board__empty">No hay avisos publicados en este tablón.</p>}
          {other.length > 0 && (
            <>
              <h3>Otros encargos de la compañía</h3>
              <ul>{other.map((quest) => <QuestCard key={quest.id} offer={quest} />)}</ul>
            </>
          )}
        </div>
        <footer>Los contratos aceptados y completados permanecen consultables. La Crónica conserva su historia.</footer>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}
