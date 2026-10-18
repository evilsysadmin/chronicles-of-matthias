import { useEffect, useRef } from 'react';
import { chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesMapForState } from '../chronicles/chroniclesMapCatalog.js';
import { chroniclesShopRoom } from '../chronicles/chroniclesShopRooms.js';
import { CHRONICLES_MAX_RATIONS, chroniclesRations, chroniclesTavernPrice } from '../chronicles/chroniclesTavern.js';
import './ChroniclesShop.css';

// MM3's tavern screen, in the shop's parchment frame: sleep, food for the
// road, a round, and a coin on the bar for what people are saying.
export default function ChroniclesTavern({ state, onAction, onClose }) {
  const closeRef = useRef(null);
  const map = chroniclesMapForState(state);
  const entry = (map?.interactables || []).find((item) => item.id === state.tavern?.id);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  if (!entry) return null;
  const room = chroniclesShopRoom(entry);
  const gold = chroniclesGoldBalance(state);
  const rations = chroniclesRations(state);
  const price = (what) => chroniclesTavernPrice(entry, what);
  const standing = state.party.filter((member) => member.hp > 0).length;
  const options = [
    {
      id: 'rest', title: 'Dormir', cost: price('rest'), action: { type: 'tavern-rest' }, label: `Dormir · ${price('rest')} oro`,
      text: 'Todos los héroes en pie despiertan con la vida y los hechizos al máximo. A los caídos solo los alza el templo.',
    },
    {
      id: 'rations', title: 'Raciones para el camino', cost: price('ration'), text: `Acampar fuera de los pueblos gasta una por héroe en pie (${standing} ahora). Lleváis ${rations} de ${CHRONICLES_MAX_RATIONS}.`,
      buttons: [1, 5].map((quantity) => ({
        key: quantity, label: `${quantity === 1 ? 'Una' : quantity} · ${price('ration') * quantity} oro`,
        action: { type: 'tavern-rations', quantity }, cost: price('ration') * quantity, disabled: rations >= CHRONICLES_MAX_RATIONS,
      })),
    },
    {
      id: 'drink', title: 'Una ronda', cost: price('drink'), action: { type: 'tavern-drink' }, label: `Invitar · ${price('drink')} oro`,
      text: 'Una jarra para cada uno: +2 PV a quien siga en pie, y algo que contar.',
    },
    {
      id: 'tip', title: 'Propina al tabernero', cost: price('tip'), action: { type: 'tavern-tip' }, label: `Escuchar · ${price('tip')} oro`,
      text: `${entry.tavern.keeper || 'El tabernero'} cuenta lo que se dice en la barra. Los rumores quedan en la Crónica.`,
    },
  ];

  return (
    <div className="chronicles-shop__backdrop" onClick={onClose}>
      <section
        className="chronicles-shop"
        role="dialog"
        aria-modal="true"
        aria-label={entry.tavern.name || entry.label}
        data-chronicles-tavern={entry.id}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="chronicles-shop__head">
          <div>
            <span>TABERNA</span>
            <h2>{entry.tavern.name || entry.label}</h2>
            <p>{state.message}</p>
          </div>
          <b aria-label={`Oro de la compañía: ${gold}`}>{gold} oro</b>
          <button ref={closeRef} type="button" className="chronicles-shop__close" onClick={onClose}
            aria-label="Salir de la taberna">✕</button>
        </header>

        {room ? (
          <figure className="chronicles-shop__scene" data-chronicles-shop-room={room.id}>
            <img src={room.src} alt={room.alt} draggable="false" />
          </figure>
        ) : null}

        <ul className="chronicles-shop__list">
          {options.map((option) => (
            <li key={option.id} data-chronicles-tavern-option={option.id}>
              <div className="chronicles-shop__item">
                <strong>{option.title}</strong>
                <span>{option.text}</span>
              </div>
              <div className="chronicles-shop__learners">
                {(option.buttons || [{ key: option.id, label: option.label, action: option.action, cost: option.cost }]).map((button) => (
                  <button key={button.key} type="button"
                    data-chronicles-tavern-action={`${option.id}:${button.key}`}
                    disabled={button.disabled || gold < button.cost}
                    onClick={() => onAction(button.action)}>
                    {button.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <footer className="chronicles-shop__foot">
          Fuera de los pueblos, «Acampar» (tecla R o el menú) gasta raciones y recupera la mitad. Cuidado: hay criaturas que no duermen.
        </footer>
      </section>
    </div>
  );
}
