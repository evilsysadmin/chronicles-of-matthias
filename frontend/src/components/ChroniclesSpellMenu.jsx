import { useEffect, useRef, useState } from 'react';
import {
  CHRONICLES_SPELL_SCHOOLS,
  chroniclesMemberMaxSp,
  chroniclesMemberSchool,
  chroniclesMemberSp,
  chroniclesMemberSpells,
} from '../chronicles/chroniclesMagic.js';
import { chroniclesCarriedConsumables } from '../chronicles/chroniclesConsumables.js';

// MM3 "Cast" and "Use": the acting hero's spellbook with the cost of each
// incantation, and the company's pack of potions and scrolls. One panel with
// two tabs, so the touch layout keeps a single MAGIA/OBJETOS button.
export default function ChroniclesSpellMenu({
  state, member, itemUser = member, onCast, onUse = () => {}, onClose, initialTab = 'spells',
}) {
  const spells = chroniclesMemberSpells(state, member);
  const items = chroniclesCarriedConsumables(state);
  const [tab, setTab] = useState(() => (initialTab === 'items' || !spells.length ? 'items' : 'spells'));
  const firstRef = useRef(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, [tab]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const sp = chroniclesMemberSp(state, member);
  const school = CHRONICLES_SPELL_SCHOOLS[chroniclesMemberSchool(member)];
  const down = member.hp <= 0;
  return (
    <section className="chronicles-spell-menu" role="dialog"
      aria-label={tab === 'items' ? `Objetos para ${member.name}` : `Hechizos de ${member.name}`}
      data-chronicles-spell-menu={member.id} data-chronicles-menu-tab={tab}>
      <header>
        <span>{tab === 'items' ? 'Mochila' : school?.label}</span>
        <strong>{tab === 'items' && itemUser ? itemUser.name : member.name}</strong>
        {tab === 'spells' && (
          <b aria-label={`Puntos de hechizo: ${sp} de ${chroniclesMemberMaxSp(state, member)}`}>
            {sp}/{chroniclesMemberMaxSp(state, member)} PH
          </b>
        )}
        <button type="button" className="chronicles-spell-menu__close" onClick={onClose} aria-label="Cerrar">✕</button>
      </header>
      {spells.length > 0 && (
        <div className="chronicles-spell-menu__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'spells'} data-chronicles-menu-tab-button="spells"
            onClick={() => setTab('spells')}>Hechizos</button>
          <button type="button" role="tab" aria-selected={tab === 'items'} data-chronicles-menu-tab-button="items"
            onClick={() => setTab('items')}>Objetos{items.length ? ` (${items.reduce((sum, entry) => sum + entry.quantity, 0)})` : ''}</button>
        </div>
      )}
      {tab === 'spells' ? (
        <ul>
          {spells.map((spell, index) => (
            <li key={spell.id}>
              <button
                ref={index === 0 ? firstRef : undefined}
                type="button"
                data-chronicles-cast={spell.id}
                disabled={sp < spell.cost || down}
                onClick={() => onCast(spell.id)}
              >
                <strong>{spell.name}</strong>
                <small>{spell.description}</small>
                <em>{spell.cost} PH</em>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          {items.map(({ item, quantity }, index) => (
            <li key={item.id}>
              <button
                ref={index === 0 ? firstRef : undefined}
                type="button"
                data-chronicles-use-item={item.id}
                disabled={!itemUser || itemUser.hp <= 0}
                onClick={() => onUse(item.id)}
              >
                <strong>{item.name}</strong>
                <small>{item.description}</small>
                <em>×{quantity}</em>
              </button>
            </li>
          ))}
          {!items.length && <li className="chronicles-spell-menu__empty">La mochila no lleva pociones ni pergaminos. El boticario de cada pueblo los vende.</li>}
        </ul>
      )}
      <footer>
        {tab === 'items'
          ? 'Usar un objeto gasta el turno de quien lo usa.'
          : 'Más hechizos en el gremio. La posada devuelve los PH.'}
      </footer>
    </section>
  );
}
