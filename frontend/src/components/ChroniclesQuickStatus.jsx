import { useEffect, useRef } from 'react';
import { useEscapeToClose } from '../useEscapeToClose.js';
import { chroniclesPartyHotkeyMember } from '../chronicles/chroniclesKeyboardBindings.js';
import './ChroniclesQuickStatus.css';

// MM3's quick reference (G): the whole company at a glance. A row opens
// that hero's sheet.
export default function ChroniclesQuickStatus({ open, rows, gold, onClose, onOpenSheet }) {
  const closeRef = useRef(null);
  useEscapeToClose(onClose, { disabled: !open, contextMenu: false });
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => previous?.isConnected && previous.focus?.();
  }, [open]);
  if (!open) return null;

  return (
    <div className="chronicles-quick-status__backdrop" onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="chronicles-quick-status" role="dialog" aria-modal="true" aria-labelledby="chronicles-quick-status-title"
        onKeyDown={(event) => {
          // A React modal stops key bubbling before the document Back handler
          // can see it. Handle Escape locally, just like the Journal/dossier,
          // so one press closes only this topmost layer (never the game menu).
          if (event.key === 'Escape' || event.key === 'g' || event.key === 'G') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
            return;
          }
          event.stopPropagation();
          // Directly open the matching dossier from G, including during
          // initiative: inspecting a member never transfers their turn.
          const hero = chroniclesPartyHotkeyMember(event, rows);
          if (hero) { event.preventDefault(); onOpenSheet(hero.id); }
        }}>
        <header>
          <div>
            <small>CHRONICLES OF MATTHIAS</small>
            <h2 id="chronicles-quick-status-title">ESTADO DEL GRUPO</h2>
          </div>
          <button ref={closeRef} type="button" className="chronicles-quick-status__close" aria-label="Cerrar estado del grupo" title="Cerrar (G o Esc)" onClick={onClose}>×</button>
        </header>
        <div className="chronicles-quick-status__table" role="table" aria-label="Estado de cada héroe">
          <div role="row" className="is-head">
            <span role="columnheader">#</span>
            <span role="columnheader">Héroe</span>
            <span role="columnheader">Nv</span>
            <span role="columnheader">PV</span>
            <span role="columnheader">PH</span>
            <span role="columnheader">CA</span>
            <span role="columnheader" className="is-weapon">Arma</span>
            <span role="columnheader">Estado</span>
          </div>
          {rows.map((row) => (
            <button key={row.id} type="button" role="row" className="chronicles-quick-status__row" data-condition={row.condition}
              aria-label={`Tecla ${row.slot}: ${row.name}: ${row.hp} de ${row.maxHp} PV. Abrir ficha`} onClick={() => onOpenSheet(row.id)}>
              <span role="cell">{row.slot}</span>
              <span role="cell" className="is-name"><b>{row.name}</b><small>{row.classLabel}</small></span>
              <span role="cell">{row.level}</span>
              <span role="cell" className="is-hp">{row.hp}/{row.maxHp}</span>
              <span role="cell" className="is-sp">{row.maxSp === null ? '—' : `${row.sp}/${row.maxSp}`}</span>
              <span role="cell">{row.armorClass}</span>
              <span role="cell" className="is-weapon">{row.weapon}</span>
              <span role="cell" className="is-condition">{row.conditionLabel}</span>
            </button>
          ))}
        </div>
        <footer>
          <span>ORO <b>{gold}</b></span>
          <small>Toca un héroe o pulsa 1–4 para ver su ficha · G o Esc para cerrar</small>
        </footer>
      </section>
    </div>
  );
}
