import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesGuildCanLearn, chroniclesGuildMember, chroniclesGuildSpells } from '../chronicles/chroniclesGuild.js';
import { CHRONICLES_SPELL_SCHOOLS, chroniclesMemberKnowsSpell, chroniclesSpellAvailableTo } from '../chronicles/chroniclesMagic.js';
import { chroniclesMapForState } from '../chronicles/chroniclesMapCatalog.js';
import { chroniclesShopRoom } from '../chronicles/chroniclesShopRooms.js';
import { ShopRoomArtwork } from './ChroniclesShop.jsx';
import './ChroniclesShop.css';
import './ChroniclesGuild.css';

// The guild counter shares the shop's parchment frame: membership first,
// then one "learn" button per caster who could copy each spell.
export default function ChroniclesGuild({ state, onAction, onClose }) {
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const map = chroniclesMapForState(state);
  const entry = (map?.interactables || []).find((item) => item.id === state.guild?.id);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )].filter((node) => node.getClientRects().length > 0);
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === focusable[0] || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      } else if (!event.shiftKey && (document.activeElement === focusable[focusable.length - 1] || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        focusable[0].focus();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKey, { capture: true });
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (!entry) return null;
  const room = chroniclesShopRoom(entry);
  const gold = chroniclesGoldBalance(state);
  const member = chroniclesGuildMember(state, entry.id);
  const fee = Number(entry.guild.membership || 0);
  const allSpells = chroniclesGuildSpells(entry);
  const compatibleSpells = allSpells.filter((spell) =>
    state.party.some((hero) => chroniclesSpellAvailableTo(hero, spell.id)));
  const visibleSpells = compatibleOnly ? compatibleSpells : allSpells;

  const guildScene = (
    <div className="chronicles-shop__backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="chronicles-shop chronicles-guild"
        role="dialog"
        aria-modal="true"
        aria-label={entry.label}
        data-chronicles-guild={entry.id}
        onClick={(event) => event.stopPropagation()}
      >
        {room ? (
          <figure className="chronicles-shop__scene" data-chronicles-shop-room={room.id}>
            <ShopRoomArtwork key={room.src} room={room} onCancel={onClose} />
          </figure>
        ) : null}

        <header className="chronicles-shop__head">
          <div className="chronicles-shop__identity">
            <span>GREMIO</span>
            <h2>{entry.label}</h2>
            <p role="status" aria-live="polite">{state.message}</p>
          </div>
          <b className="chronicles-shop__purse" aria-label={`Oro de la compañía: ${gold}`}>{gold} oro</b>
          <button ref={closeRef} type="button" className="chronicles-shop__close" onClick={onClose}
            aria-label="Salir del gremio">✕</button>
        </header>

        <div className="chronicles-guild__art-space" aria-hidden="true" />
        <aside className="chronicles-guild__membership" aria-label="Afiliación al gremio">
          {!member ? (
          <div className="chronicles-shop__join">
            <p>Sólo los socios pueden comprar hechizos. La membresía vale para toda la compañía.</p>
            <button type="button" data-chronicles-guild-join disabled={gold < fee}
              onClick={() => onAction({ type: 'guild-join' })}>
              Hacerse socios · {fee} oro
            </button>
          </div>
          ) : (
            <div className="chronicles-guild__member">
              <strong>Compañía afiliada</strong>
              <p>Las estanterías están abiertas. Elige un hechizo y pulsa el nombre del personaje que lo aprenderá.</p>
            </div>
          )}
        </aside>

        <ul className="chronicles-shop__list chronicles-guild__spells" aria-label="Hechizos del gremio">
          <li className="chronicles-guild__filter-item" role="presentation">
            <div className="chronicles-guild__spell-filter">
              <span>{visibleSpells.length} de {allSpells.length} hechizos</span>
              <button type="button" aria-pressed={compatibleOnly}
                onClick={() => setCompatibleOnly((value) => !value)}>
                Solo compatibles
              </button>
            </div>
            <p>Filtra por las escuelas que estudia tu compañía, sin ocultar permanentemente el catálogo.</p>
          </li>
          {visibleSpells.length === 0 && (
            <li className="chronicles-guild__no-spells">
              Ningún personaje de la compañía estudia las escuelas de estos hechizos.
            </li>
          )}
          {visibleSpells.map((spell) => {
            const learners = state.party.filter((hero) => chroniclesGuildCanLearn(state, hero, spell.id));
            const known = state.party.filter((hero) => chroniclesMemberKnowsSpell(state, hero, spell.id));
            const anyone = state.party.some((hero) => chroniclesSpellAvailableTo(hero, spell.id));
            return (
              <li key={spell.id} data-chronicles-guild-spell={spell.id}
                data-chronicles-guild-compatible={anyone ? 'true' : 'false'}>
                <div className="chronicles-shop__item">
                  <small>{spell.schools.map((id) => CHRONICLES_SPELL_SCHOOLS[id].label).join(' · ')} · {spell.cost} PH</small>
                  <strong>{spell.name}</strong>
                  <span>{spell.description}</span>
                  <em>{known.length
                    ? `Ya lo conocen: ${known.map((hero) => hero.name).join(', ')}`
                    : anyone ? `${spell.price} oro por personaje` : 'Nadie de la compañía estudia esta fuerza'}</em>
                </div>
                <div className="chronicles-shop__learners">
                  {learners.map((hero) => (
                    <button key={hero.id} type="button"
                      data-chronicles-guild-learn={`${hero.id}:${spell.id}`}
                      disabled={!member || gold < spell.price}
                      onClick={() => onAction({ type: 'guild-learn', memberId: hero.id, spellId: spell.id })}>
                      {hero.name} · {spell.price} oro
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <footer className="chronicles-shop__foot">
          Cada hechizo se copia en el libro de un personaje. Sólo lo aprende quien sirve a su fuerza.
        </footer>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? guildScene : createPortal(guildScene, document.body);
}
