import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesMapForState } from '../chronicles/chroniclesMapCatalog.js';
import { CHRONICLES_INN_FOOD, chroniclesInnEntry, chroniclesInnName, chroniclesInnRestPrice, chroniclesInnRumors } from '../chronicles/chroniclesInns.js';
import scene from '../assets/chronicles/ui/inn/tavern-hall.svg';
import { CHRONICLES_TAVERN_PREMIUM_ART_URL } from '../chronicles/chroniclesShopArt.js';
import { ShopRoomArtwork } from './ChroniclesShop.jsx';
import './ChroniclesInn.css';

export default function ChroniclesInn({ state, onAction, onClose }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const entry = chroniclesInnEntry(state, chroniclesMapForState(state));
  useEffect(() => {
    if (!entry) return undefined;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCloseRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled)') || [])
        .filter((element) => element.getClientRects().length > 0);
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) {
        event.preventDefault();
        buttons[0].focus();
      }
    };
    window.addEventListener('keydown', keydown, { capture: true });
    return () => {
      window.removeEventListener('keydown', keydown, { capture: true });
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [Boolean(entry)]);

  if (!entry) return null;
  const gold = chroniclesGoldBalance(state);
  const restPrice = chroniclesInnRestPrice(entry);
  const rumorIndex = state.inn?.rumorIndex ?? -1;
  const rumors = chroniclesInnRumors(entry);
  const heard = rumorIndex >= 0 ? rumors[rumorIndex % rumors.length] : null;
  const rations = Math.max(0, state.inventory?.[CHRONICLES_INN_FOOD.id]?.quantity || 0);
  return createPortal(
    <div className="chronicles-inn__backdrop" data-chronicles-inn-room={entry.id}>
      <section ref={dialogRef} className="chronicles-inn" role="dialog" aria-modal="true"
        aria-label={`Taberna ${chroniclesInnName(entry)}`}>
        <div className="chronicles-inn__scene" data-chronicles-inn-art="tavern">
          <ShopRoomArtwork room={{
            src: CHRONICLES_TAVERN_PREMIUM_ART_URL,
            fallbackSrc: scene,
            alt: 'Interior de taberna medieval con vigas, chimenea encendida, mesas y mostrador de roble',
          }} />
        </div>
        <header className="chronicles-inn__heading">
          <div><small>{entry.id === 'first-book-healer' ? 'TABERNA · SWORDHAVEN' : 'POSADA · TERRA'}</small>
            <h2>{chroniclesInnName(entry)}</h2>
            <p>«Pasa, viajero. Aquí el fuego no pregunta de dónde vienes».</p>
          </div>
          <div className="chronicles-inn__heading-actions">
            <b aria-label={`Oro de la compañía: ${gold}`}>◉ {gold} oro</b>
            <button ref={closeRef} type="button" aria-label="Salir de la taberna" onClick={onClose}>×</button>
          </div>
        </header>
        <main className="chronicles-inn__activities">
          <div className="chronicles-inn__intro">
            <span className="chronicles-inn__eyebrow">LA POSADERA OFRECE</span>
            <h3>Reposo, avituallamiento y noticias del camino.</h3>
            <p>La compañía puede quedarse junto al fuego sin gastar ni una moneda.</p>
          </div>
          <div className="chronicles-inn__choices">
            <article>
              <span aria-hidden="true" className="chronicles-inn__icon">☾</span>
              <div><h4>Descansar</h4>
                <p>Recupera la vida de los compañeros en pie y sus puntos de hechizo. No resucita a los caídos.</p>
                <button type="button" data-inn-action="rest" disabled={restPrice === null || gold < restPrice}
                  onClick={() => onAction({ type: 'inn-rest' })}>
                  Descansar · {restPrice ?? '—'} oro
                </button>
              </div>
            </article>
            <article>
              <span aria-hidden="true" className="chronicles-inn__icon">♨</span>
              <div><h4>Comprar provisiones</h4>
                <p>{CHRONICLES_INN_FOOD.description} En la mochila: {rations}.</p>
                <button type="button" data-inn-action="food" disabled={gold < CHRONICLES_INN_FOOD.price}
                  onClick={() => onAction({ type: 'inn-buy-food' })}>
                  Comprar raciones · {CHRONICLES_INN_FOOD.price} oro
                </button>
              </div>
            </article>
            <article className="chronicles-inn__rumor">
              <span aria-hidden="true" className="chronicles-inn__icon">✦</span>
              <div><h4>Escuchar rumores</h4>
                <p>{heard ? `«${heard}»` : 'Los parroquianos hablan de caminos, problemas y oportunidades. ¿Escuchamos?'}</p>
                <button type="button" data-inn-action="rumor" onClick={() => onAction({ type: 'inn-rumor' })}>
                  {heard ? 'Escuchar otro rumor' : 'Acercarse a escuchar'} · Gratis
                </button>
              </div>
            </article>
          </div>
        </main>
        <footer className="chronicles-inn__footer">
          <span>Al salir vuelves al mismo punto de Swordhaven.</span>
          <button type="button" onClick={onClose}>Volver a la calle · ESC</button>
        </footer>
      </section>
    </div>, document.body,
  );
}
