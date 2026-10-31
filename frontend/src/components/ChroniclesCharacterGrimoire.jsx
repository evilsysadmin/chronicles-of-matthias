import { useEffect, useRef, useState } from 'react';
import './ChroniclesCharacterGrimoire.css';
import './ChroniclesCharacterGrimoireRetro.css';
import './ChroniclesCharacterGrimoireWorkspace.css';

// Consultation-only character grimoire. The CAST (C) combat/exploration flow
// remains the only authority for spell legality, targets and spending PH.
const FILTERS = Object.freeze([
  { id: 'all', label: 'Todos' },
  { id: 'attack', label: 'Ataque' },
  { id: 'heal', label: 'Curación' },
  { id: 'other', label: 'Utilidad' },
]);

const spellType = (spell) => {
  if (spell.kind === 'heal') return 'heal';
  if (spell.kind === 'attack' || spell.kind === 'paralyze') return 'attack';
  return 'other';
};
const typeLabel = (spell) => ({
  attack: 'Ataque',
  heal: 'Curación',
  other: 'Utilidad',
})[spellType(spell)];
const typeMark = (spell) => ({
  attack: '✦',
  heal: '✚',
  other: '◇',
})[spellType(spell)];

// Arrow/Home/End operate on the currently visible spells only; no casts or
// hidden-filter entries are ever selected.
export function chroniclesGrimoireNextSelection(shown, selectedId, key) {
  if (!shown.length || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return null;
  if (key === 'Home') return shown[0].id;
  if (key === 'End') return shown[shown.length - 1].id;
  const current = shown.findIndex((spell) => spell.id === selectedId);
  const start = current < 0 ? 0 : current;
  const delta = key === 'ArrowDown' ? 1 : -1;
  return shown[(start + delta + shown.length) % shown.length].id;
}

export default function ChroniclesCharacterGrimoire({ spells = [], availableSp = 0, maxSp = 0, schoolLabel = '' }) {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const listRef = useRef(null);
  const inspectTriggerRef = useRef(null);
  const closeRef = useRef(null);
  const shown = spells.filter((spell) => filter === 'all' || spellType(spell) === filter);
  const selected = shown.find((spell) => spell.id === selectedId) || shown[0] || null;
  useEffect(() => {
    if (inspecting) closeRef.current?.focus();
  }, [inspecting]);
  const closeInspection = () => {
    setInspecting(false);
    inspectTriggerRef.current?.focus();
  };
  const handleInspectionKeys = (event) => {
    // Never leak modal keyboard actions to the parent character sheet or game.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closeInspection();
      return;
    }
    if (event.key !== 'Tab') return;
    const available = [...event.currentTarget.querySelectorAll(
      'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
    )].filter((node) => node.getClientRects().length > 0);
    if (!available.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === available[0]) {
      event.preventDefault();
      available.at(-1).focus();
    } else if (!event.shiftKey && document.activeElement === available.at(-1)) {
      event.preventDefault();
      available[0].focus();
    }
  };

  const chooseByKeyboard = (event, id) => {
    const nextId = chroniclesGrimoireNextSelection(shown, id, event.key);
    if (!nextId) return;
    event.preventDefault();
    event.stopPropagation(); // Do not accidentally trigger movement behind the dossier.
    setSelectedId(nextId);
    const index = shown.findIndex((spell) => spell.id === nextId);
    listRef.current?.querySelectorAll('[data-grimoire-spell]')?.[index]?.focus();
  };

  return (
    <div className="chronicles-sheet-grimoire" data-chronicles-grimoire>
      <div className="chronicles-sheet-grimoire__toolbar">
        <div>
          <b>HECHIZOS CONOCIDOS</b>
          <small>{schoolLabel} · {spells.length} en el grimorio</small>
        </div>
        <div className="chronicles-sheet-grimoire__filter" role="group" aria-label="Filtrar hechizos">
          {FILTERS.map((item) => (
            <button type="button" key={item.id} aria-pressed={filter === item.id}
              onClick={() => { setInspecting(false); setFilter(item.id); }}>{item.label}</button>
          ))}
        </div>
        <button ref={inspectTriggerRef} type="button"
          className="chronicles-sheet-grimoire__inspect-trigger"
          aria-haspopup="dialog" aria-expanded={inspecting}
          disabled={!selected} onClick={() => setInspecting(true)}>
          ⌕ Examinar
        </button>
      </div>
      <div className="chronicles-sheet-grimoire__body">
        <section className="chronicles-sheet-grimoire__catalog" aria-label="Lista de hechizos conocidos">
          {shown.length ? (
            <div className="chronicles-sheet-grimoire__list" ref={listRef}>
              {shown.map((spell, index) => (
                <button type="button" key={spell.id} data-grimoire-spell={spell.id}
                  tabIndex={spell.id === selected?.id ? 0 : -1}
                  aria-pressed={spell.id === selected?.id}
                  className={spell.id === selected?.id ? 'is-selected' : ''}
                  onClick={() => setSelectedId(spell.id)}
                  onKeyDown={(event) => chooseByKeyboard(event, spell.id)}>
                  <span className="chronicles-sheet-grimoire__glyph" aria-hidden="true">{typeMark(spell)}</span>
                  <span className="chronicles-sheet-grimoire__entry">
                    <b>{index + 1}. {spell.name}</b>
                    <small>{typeLabel(spell)}</small>
                  </span>
                  <span className="chronicles-sheet-grimoire__cost">{spell.cost} PH</span>
                </button>
              ))}
            </div>
          ) : <p className="chronicles-sheet-grimoire__empty">No hay hechizos de este tipo en el libro.</p>}
        </section>
        <div className="chronicles-sheet-grimoire__inspection-scrim" hidden={!inspecting}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeInspection();
          }}>
        <section className="chronicles-sheet-grimoire__detail" hidden={!inspecting}
          role="dialog" aria-modal="true"
          aria-label={selected ? `Examinar ${selected.name}` : 'Examinar hechizo'}
          onKeyDown={handleInspectionKeys}>
          <button ref={closeRef} type="button" className="chronicles-sheet-grimoire__inspection-close"
            aria-label="Cerrar inspección de hechizo" onClick={closeInspection}>×</button>
          {selected ? (
            <>
              <div className="chronicles-sheet-grimoire__detail-head">
                <span aria-hidden="true">{typeMark(selected)}</span>
                <div>
                  <small>{typeLabel(selected)} · {schoolLabel}</small>
                  <h4>{selected.name}</h4>
                </div>
              </div>
              <p>{selected.description}</p>
              <dl>
                <div><dt>Coste</dt><dd>{selected.cost} PH</dd></div>
                {Number.isFinite(selected.damage) && <div><dt>Daño base</dt><dd>{selected.damage}</dd></div>}
                {Number.isFinite(selected.amount) && <div><dt>Curación</dt><dd>{selected.amount} PV{selected.everyone ? ' · compañía' : ''}</dd></div>}
                {Number.isFinite(selected.reach) && <div><dt>Alcance</dt><dd>{selected.reach} casillas</dd></div>}
                {Number.isFinite(selected.turns) && <div><dt>Duración</dt><dd>{selected.turns} turnos (según enemigo)</dd></div>}
                {Number.isFinite(selected.armorClass) && <div><dt>Armadura</dt><dd>+{selected.armorClass}</dd></div>}
                {selected.area && <div><dt>Área</dt><dd>Salpicadura cercana</dd></div>}
              </dl>
              <div className="chronicles-sheet-grimoire__availability" data-can-afford={availableSp >= selected.cost}>
                {availableSp >= selected.cost
                  ? 'PH disponibles para el coste'
                  : 'PH insuficientes para este hechizo'}
                <small>{availableSp}/{maxSp} PH actuales</small>
              </div>
            </>
          ) : <p>Elige un tipo de hechizo para consultar sus detalles.</p>}
        </section>
        </div>
      </div>
      <p className="chronicles-sheet-grimoire__hint">Tab · entrar/salir de la lista · ↑ ↓ / Inicio / Fin · seleccionar · Examinar abre la ficha · Para lanzar, vuelve a la aventura y abre Magia (C).</p>
    </div>
  );
}
