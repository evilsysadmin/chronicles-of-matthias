import { useEffect, useId, useRef, useState } from 'react';
import {
  CHRONICLES_SPELL_SCHOOLS,
  chroniclesMemberMaxSp,
  chroniclesMemberSchool,
  chroniclesMemberSp,
  chroniclesMemberSpells,
} from '../chronicles/chroniclesMagic.js';
import { chroniclesCarriedConsumables } from '../chronicles/chroniclesConsumables.js';
import { chroniclesCurrentInitiativeActor } from '../chronicles/chroniclesInitiative.js';
import { chroniclesPartyHotkeyMember } from '../chronicles/chroniclesKeyboardBindings.js';

const SPELL_KINDS = Object.freeze({
  heal: { label: 'Curación', glyph: '✚' },
  attack: { label: 'Ataque', glyph: '✦' },
  detect: { label: 'Exploración', glyph: '◈' },
  paralyze: { label: 'Control', glyph: '◇' },
  ward: { label: 'Protección', glyph: '⬡' },
  scroll: { label: 'Pergamino', glyph: '✧' },
  revive: { label: 'Resurrección', glyph: '✚' },
  mana: { label: 'Maná', glyph: '✦' },
});
export function chroniclesSpellMenuKind(kind) {
  return SPELL_KINDS[kind] || { label: 'Objeto', glyph: '◇' };
}

// The page keys behave like the closed-world C/I controls: switch to the
// requested folio, or close when pressing the already-open page's key.
// Disabled for modifiers, autorepeat and editable descendants.
export function chroniclesSpellMenuPageShortcut(event, { tab, hasSpells } = {}) {
  if (!event || event.defaultPrevented || event.repeat || event.isComposing
    || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null;
  if (event.target?.isContentEditable
    || event.target?.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return null;
  const key = String(event.key || '').toLowerCase();
  const next = key === 'i' ? 'items' : key === 'c' && hasSpells ? 'spells' : null;
  return next ? next === tab ? 'close' : next : null;
}

// A single folio owns the focus while it is open. This component only
// chooses available actions; casting, inventory and turns belong to the reducer.
export default function ChroniclesSpellMenu({
  state, member, itemUser = member, onCast, onUse = () => {}, onClose,
  onOpenSheet = null, initialTab = 'spells',
}) {
  const spells = chroniclesMemberSpells(state, member);
  const items = chroniclesCarriedConsumables(state);
  const [tab, setTab] = useState(() => (initialTab === 'items' || !spells.length ? 'items' : 'spells'));
  const panelRef = useRef(null);
  const firstRef = useRef(null);
  const labelId = useId();
  const spellsTabId = useId();
  const itemsTabId = useId();
  const pageId = useId();

  useEffect(() => {
    const fallback = panelRef.current?.querySelector('[role="tab"][aria-selected="true"]')
      || panelRef.current?.querySelector('.chronicles-spell-menu__close');
    (firstRef.current && !firstRef.current.disabled ? firstRef.current : fallback)?.focus();
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

  function trapFocus(event) {
    // The open folio owns shortcuts. Inspecting another hero never
    // transfers combat initiative or unlocks their spells.
    const hero = onOpenSheet && chroniclesPartyHotkeyMember(event, state?.party);
    event.stopPropagation();
    if (hero) {
      event.preventDefault();
      onOpenSheet(hero.id);
      return;
    }
    const pageAction = chroniclesSpellMenuPageShortcut(event, {
      tab, hasSpells: spells.length > 0,
    });
    if (pageAction) {
      event.preventDefault();
      if (pageAction === 'close') onClose();
      else setTab(pageAction);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [...(panelRef.current?.querySelectorAll('button:not([disabled])') || [])];
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const sp = chroniclesMemberSp(state, member);
  const maxSp = chroniclesMemberMaxSp(state, member);
  const school = CHRONICLES_SPELL_SCHOOLS[chroniclesMemberSchool(member)];
  const down = member.hp <= 0;
  const actor = chroniclesCurrentInitiativeActor(state?.initiative);
  const canAct = !state?.initiative || (actor?.kind === 'party' && actor.id === member.id);
  const stock = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const actingMember = tab === 'items' && itemUser ? itemUser : member;

  return (
    <div className="chronicles-cast-backdrop" onPointerDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section ref={panelRef} className="chronicles-spell-menu chronicles-spell-menu--folio"
        role="dialog" aria-modal="true" aria-labelledby={labelId} onKeyDown={trapFocus}
        data-chronicles-spell-menu={member.id} data-chronicles-menu-tab={tab}>
        <header className="chronicles-spell-menu__folio-header">
          <span className="chronicles-spell-menu__seal" aria-hidden="true">✦</span>
          <div className="chronicles-spell-menu__identity">
            <span className="chronicles-spell-menu__eyebrow">{tab === 'items' ? 'LA BOTICA DE LA COMPAÑÍA' : 'EL LIBRO DE LOS CONJUROS'}</span>
            <h2 id={labelId}>{tab === 'items' ? 'Mochila de viaje' : 'Grimorio de magia'}</h2>
            <p>{actingMember.name} · {tab === 'items' ? 'Objetos de un solo uso' : school?.label || 'Magia'}</p>
          </div>
          <button type="button" className="chronicles-spell-menu__close" onClick={onClose}
            aria-label="Cerrar grimorio" title="Cerrar · Esc">✕</button>
          <div className="chronicles-spell-menu__resource">
            {tab === 'spells' ? (
              <>
                <span><b>Reserva arcana</b><strong>{sp} / {maxSp} PH</strong></span>
                <div className="chronicles-spell-menu__mana" role="progressbar"
                  aria-label="Puntos de hechizo disponibles" aria-valuemin={0}
                  aria-valuenow={sp} aria-valuemax={maxSp || 1}>
                  <i style={{ width: `${maxSp ? sp * 100 / maxSp : 0}%` }} />
                </div>
              </>
            ) : (
              <span><b>Recursos disponibles</b><strong>{stock} {stock === 1 ? 'unidad' : 'unidades'}</strong></span>
            )}
          </div>
        </header>
        {spells.length > 0 && (
          <div className="chronicles-spell-menu__tabs" role="tablist" aria-label="Páginas del grimorio">
            <button id={spellsTabId} type="button" role="tab" aria-selected={tab === 'spells'}
              aria-controls={pageId} tabIndex={tab === 'spells' ? 0 : -1}
              data-chronicles-menu-tab-button="spells" aria-keyshortcuts="C"
              title="Hechizos (C)" onClick={() => setTab('spells')}>
              ✦ Hechizos <small>{spells.length} · C</small>
            </button>
            <button id={itemsTabId} type="button" role="tab" aria-selected={tab === 'items'}
              aria-controls={pageId} tabIndex={tab === 'items' ? 0 : -1}
              data-chronicles-menu-tab-button="items" aria-keyshortcuts="I"
              title="Objetos (I)" onClick={() => setTab('items')}>
              ◈ Objetos <small>{stock} · I</small>
            </button>
          </div>
        )}
        <div id={pageId} className="chronicles-spell-menu__pages"
          role={spells.length ? 'tabpanel' : undefined}
          aria-labelledby={spells.length ? (tab === 'spells' ? spellsTabId : itemsTabId) : undefined}>
          {tab === 'spells' ? (
            <ul className="chronicles-spell-menu__entries">
              {spells.map((spell, index) => {
                const affordable = canAct && !down && sp >= spell.cost;
                const kind = chroniclesSpellMenuKind(spell.kind);
                return (
                  <li key={spell.id}>
                    <button ref={index === 0 ? firstRef : undefined} type="button"
                      data-chronicles-cast={spell.id} data-cast-kind={spell.kind}
                      disabled={!affordable} onClick={() => onCast(spell.id)}
                      title={!canAct ? 'No es el turno de este personaje' : down ? 'El personaje está fuera de combate' : sp < spell.cost ? 'No tienes suficientes PH' : `Lanzar ${spell.name}`}>
                      <span className="chronicles-spell-menu__rune" aria-hidden="true">{kind.glyph}</span>
                      <span className="chronicles-spell-menu__entry">
                        <strong>{spell.name}</strong>
                        <small>{spell.description}</small>
                        <span className="chronicles-spell-menu__kind">{kind.label}</span>
                      </span>
                      <span className="chronicles-spell-menu__cost"><b>{spell.cost} PH</b><small>{affordable ? 'LANZAR' : !canAct ? 'ESPERA' : 'SIN PH'}</small></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="chronicles-spell-menu__entries">
              {items.map(({ item, quantity }, index) => {
                const kind = chroniclesSpellMenuKind(item.kind);
                return (
                  <li key={item.id}>
                    <button ref={index === 0 ? firstRef : undefined} type="button"
                      data-chronicles-use-item={item.id} data-cast-kind={item.kind}
                      disabled={!canAct || !itemUser || itemUser.hp <= 0} onClick={() => onUse(item.id)}>
                      <span className="chronicles-spell-menu__rune" aria-hidden="true">{kind.glyph}</span>
                      <span className="chronicles-spell-menu__entry">
                        <strong>{item.name}</strong>
                        <small>{item.description}</small>
                        <span className="chronicles-spell-menu__kind">{kind.label}</span>
                      </span>
                      <span className="chronicles-spell-menu__cost"><b>×{quantity}</b><small>{canAct && itemUser?.hp > 0 ? 'USAR' : 'NO DISP.'}</small></span>
                    </button>
                  </li>
                );
              })}
              {!items.length && <li className="chronicles-spell-menu__empty">
                <span aria-hidden="true">◇</span>
                <strong>La mochila está vacía</strong>
                <small>Los boticarios de Terra venden pociones y pergaminos.</small>
              </li>}
            </ul>
          )}
        </div>
        <footer className="chronicles-spell-menu__folio-footer">
          <span>{!canAct
            ? 'Es el turno de otro combatiente: puedes consultar, no actuar.'
            : tab === 'items'
              ? 'Usar un objeto gasta el turno de quien lo usa.'
              : down ? 'El personaje no puede lanzar hechizos mientras esté caído.'
                : 'Más hechizos en el gremio. La posada devuelve los PH.'}</span>
          <kbd>{onOpenSheet ? '1–4 · FICHAS  |  ' : ''}ESC · CERRAR</kbd>
        </footer>
      </section>
    </div>
  );
}
