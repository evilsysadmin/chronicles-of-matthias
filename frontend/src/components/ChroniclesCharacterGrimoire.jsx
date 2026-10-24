import { useRef, useState } from 'react';
import './ChroniclesCharacterGrimoire.css';

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
  const listRef = useRef(null);
  const shown = spells.filter((spell) => filter === 'all' || spellType(spell) === filter);
  const selected = shown.find((spell) => spell.id === selectedId) || shown[0] || null;

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
              onClick={() => setFilter(item.id)}>{item.label}</button>
          ))}
        </div>
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
        <section className="chronicles-sheet-grimoire__detail" aria-label="Detalle del hechizo seleccionado">
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
      <p className="chronicles-sheet-grimoire__hint">Tab · entrar/salir de la lista · ↑ ↓ / Inicio / Fin · seleccionar · Para lanzar hechizos, vuelve a la aventura y abre Magia (C).</p>
    </div>
  );
}
