import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeToClose } from '../useEscapeToClose.js';
import { chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesMapForState } from '../chronicles/chroniclesMapCatalog.js';
import { CHRONICLES_PROVISIONS_PREMIUM_ART_URL } from '../chronicles/chroniclesShopArt.js';
import hallFallback from '../assets/chronicles/ui/inn/tavern-hall.svg';
import { ShopRoomArtwork } from './ChroniclesShop.jsx';
import './ChroniclesProvisions.css';

// Presentation-only storefront. A purchase is NEVER simulated here: the
// existing authoritative 'interact' reducer still owns the exchange, price,
// inventory, journal and turn cost. Entering, leaving and asking cost nothing.
export const CHRONICLES_QUARTERMASTER_ID = 'first-book-quartermaster';

export default function ChroniclesProvisions({ state, onBuy, onClose }) {
  // The back stack handles Escape at document level, before the parent's
  // window key handler. Register this modal as the topmost Back/Escape owner;
  // otherwise that parent opens the adventure menu behind the shop.
  useEscapeToClose(onClose, { contextMenu: false });
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const buyLockRef = useRef(false);
  const [purchased, setPurchased] = useState(false);
  const store = chroniclesMapForState(state)?.interactables?.find(
    (entry) => entry.id === CHRONICLES_QUARTERMASTER_ID,
  );
  const exchange = store?.action?.effects?.find((effect) =>
    effect.type === 'exchange-item' && effect.itemId === 'road-rations'
      && effect.costItemId === 'crown-gold');
  const price = exchange?.costQuantity;
  const gold = chroniclesGoldBalance(state);
  const rations = Number(state.inventory?.['road-rations']?.quantity || 0);
  const affordable = Number.isInteger(price) && price > 0 && gold >= price;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key !== 'Tab') return; // Parent handles Escape and movement.
      const buttons = [...(dialogRef.current?.querySelectorAll('button:not(:disabled)') || [])];
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === buttons.at(-1)) {
        event.preventDefault();
        buttons[0].focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, []);

  const purchase = () => {
    if (!affordable || buyLockRef.current || purchased) return;
    buyLockRef.current = true; // A rapid double click cannot buy twice.
    const before = rations;
    const next = onBuy();
    const after = Number(next?.inventory?.['road-rations']?.quantity || 0);
    if (after > before) setPurchased(true);
    else buyLockRef.current = false; // Rejected attempts remain retryable.
  };
  const buyAgain = () => {
    buyLockRef.current = false;
    setPurchased(false);
  };

  const modal = (
    <div className="chronicles-provisions__backdrop" data-chronicles-provisions="open">
      <section ref={dialogRef} className="chronicles-provisions" role="dialog" aria-modal="true"
        aria-label="Tienda de provisiones de Swordhaven">
        <div className="chronicles-provisions__scene" aria-label="Interior de la tienda del intendente">
          <ShopRoomArtwork onCancel={onClose} room={{
            src: CHRONICLES_PROVISIONS_PREMIUM_ART_URL,
            fallbackSrc: hallFallback,
            alt: 'Interior de madera de la tienda de provisiones, con mostrador y mercancías',
          }} />
        </div>
        <div className="chronicles-provisions__veil" aria-hidden="true" />
        <header className="chronicles-provisions__head">
          <div><small>SWORDHAVEN · INTENDENCIA</small><h2>Tienda de provisiones</h2>
            <p>Raciones para los caminos. Aquí no se regalan ni las migas.</p></div>
          <button ref={closeRef} type="button" aria-label="Salir de la tienda de provisiones"
            onClick={onClose}>×</button>
        </header>
        <main className="chronicles-provisions__counter">
          <div className="chronicles-provisions__offer">
            <span className="chronicles-provisions__eyebrow">ALMACÉN DE CAMPAÑA</span>
            <h3>Raciones de viaje</h3>
            <p>Provisiones para futuras incursiones. No son un consumible de combate.</p>
            <div className="chronicles-provisions__balances">
              <span data-provisions-gold>◉ {gold} oro</span>
              <span data-provisions-rations>En mochila: {rations}</span>
            </div>
            <p className="chronicles-provisions__price">1 paquete · {price ?? '—'} oro</p>
            {purchased ? (
              <div role="status" data-provisions-result="success">
                Compra completada. El intendente te entrega las raciones.
                <button type="button" onClick={buyAgain}>Comprar otro paquete</button>
              </div>
            ) : (
              <>
                {!affordable && <p role="status" data-provisions-result="insufficient">
                  {price == null ? 'El intendente no tiene existencias.' : 'No tienes suficiente oro.'}
                </p>}
                <button type="button" data-provisions-buy disabled={!affordable}
                  onClick={purchase}>Comprar raciones · {price ?? '—'} oro</button>
              </>
            )}
          </div>
        </main>
        <footer className="chronicles-provisions__foot">
          <span>Entrar y salir no consume turnos ni oro.</span>
          <button type="button" onClick={onClose}>Volver a Swordhaven · ESC</button>
        </footer>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? modal : createPortal(modal, document.body);
}
