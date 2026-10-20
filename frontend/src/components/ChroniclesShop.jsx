import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { chroniclesGoldBalance } from '../chronicles/chroniclesContentRuntime.js';
import { chroniclesMemberCanEquip } from '../chronicles/chroniclesEquipment.js';
import { chroniclesShopEquipmentComparisons } from '../chronicles/chroniclesShopComparison.js';
import { chroniclesMapForState } from '../chronicles/chroniclesMapCatalog.js';
import {
  chroniclesShopSellable,
  chroniclesShopSellPrice,
  chroniclesShopStock,
} from '../chronicles/chroniclesShops.js';
import { chroniclesShopRoom } from '../chronicles/chroniclesShopRooms.js';
import { SHOP_SLOT_LABELS, SHOP_SORTS, chroniclesShopCategories, chroniclesShopSelectedOffer, chroniclesShopVisibleOffers } from '../chronicles/chroniclesShopCatalog.js';
import './ChroniclesShop.css';

const SLOT_LABEL = Object.freeze({ weapon: 'Arma', missile: 'Arma a distancia', armor: 'Armadura', shield: 'Escudo', consumable: 'Objeto' });

function ShopComparison({ state, item }) {
  const comparisons = chroniclesShopEquipmentComparisons(state, item);
  return (
    <section className="chronicles-shop__comparison" aria-label={`Comparar ${item.name} con el equipo de la compañía`}>
      <div className="chronicles-shop__comparison-head">
        <strong>Antes → después de equipar</strong>
        <span>Vista previa · comprar no equipa</span>
      </div>
      <div className="chronicles-shop__comparison-grid">
        {comparisons.map((comparison) => (
          <div key={comparison.memberId}
            className={`chronicles-shop__comparison-hero${comparison.eligible ? '' : ' is-incompatible'}`}>
            <strong>{comparison.name}</strong>
            <span className="chronicles-shop__comparison-equipped">
              {comparison.current ? `Lleva: ${comparison.current.name}` : `Sin ${SLOT_LABEL[item.slot].toLowerCase()}`}
            </span>
            {!comparison.eligible ? (
              <span className="chronicles-shop__comparison-restriction">{comparison.reason}</span>
            ) : comparison.alreadyEquipped ? (
              <span className="chronicles-shop__comparison-neutral">Ya lo lleva equipado</span>
            ) : (
              <>
                <div className="chronicles-shop__comparison-stats">
                  {comparison.stats.map((stat) => (
                    <span key={stat.key}
                      className={`chronicles-shop__comparison-stat is-${stat.delta > 0 ? 'better' : stat.delta < 0 ? 'worse' : 'equal'}`}
                      aria-label={`${stat.label}: ${stat.before} a ${stat.after}`}>
                      {stat.label} {stat.before}→{stat.after}
                      <b>({stat.delta > 0 ? '+' : ''}{stat.delta})</b>
                    </span>
                  ))}
                </div>
                {comparison.displacedShield && (
                  <span className="chronicles-shop__comparison-warning">
                    Dos manos: guarda {comparison.displacedShield.name}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// Who in the company could actually use it: MM3 class rules, same as the sheet.
function users(state, item) {
  return (state.party || []).filter((member) => chroniclesMemberCanEquip(member, item));
}

function ShopItemGlyph({ item }) {
  return (
    <svg className="chronicles-shop__glyph" viewBox="0 0 64 64" role="img" aria-label={SLOT_LABEL[item.slot] || 'Objeto'}>
      {item.slot === 'weapon' ? (
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M46 8 53 12 47 19 28 39 22 33 41 13Z" />
          <path d="m16 29 19 19M14 42l10 10M17 45l-6 6M22 49l-6 6" />
          <path d="M46 8 41 13M28 39l-5 5" />
        </g>
      ) : item.slot === 'missile' ? (
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {item.weaponFamily === 'crossbow' ? (
            <>
              <path d="M9 20Q32 4 55 20L47 27 32 22 17 27Z" />
              <path d="M9 20h46M32 22v36M26 48h12M28 53h8" />
              <path d="M32 7v19M27 12l5-5 5 5" />
            </>
          ) : item.weaponFamily === 'sling' ? (
            <>
              <path d="M22 9 32 37 45 9M32 37l-5 19M20 9q3-7 9 0M39 9q5-7 9 0" />
              <path d="M27 30q5 7 10 0" />
            </>
          ) : (
            <>
              <path d="M18 7Q49 32 18 57M18 7V57M14 32h43" />
              <path d="m49 25 8 7-8 7M47 27l10 5-10 5" />
            </>
          )}
        </g>
      ) : item.slot === 'shield' ? (
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
          <path d="M32 6 51 14 49 39Q45 51 32 58 19 51 15 39L13 14Z" />
          <path d="M32 11v39M19 23h26" />
        </g>
      ) : item.slot === 'armor' ? (
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
          <path d="M22 8 14 12 6 29l10 8 6-8v25h20V29l6 8 10-8-8-17-8-4-10 9Z" />
          <path d="M22 8 32 17 42 8M22 29h20M22 43h20" />
        </g>
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M25 7h14M28 7v15l-13 16a11 11 0 0 0 9 18h16a11 11 0 0 0 9-18L36 22V7" />
          <path d="M20 39h24M29 31h6" />
        </g>
      )}
    </svg>
  );
}

// Who can really equip the selected object: same rules as character sheet.
export default function ChroniclesShop({ state, onAction, onClose }) {
  const [tab, setTab] = useState('buy');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [selectedId, setSelectedId] = useState(null);
  const [compare, setCompare] = useState(false);
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  const detailsRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const map = chroniclesMapForState(state);
  const entry = (map?.interactables || []).find((item) => item.id === state.shop?.id);

  // The shop is a fullscreen room, portalled above the world and its canvas.
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
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
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
  const stock = chroniclesShopStock(entry);
  const sellable = chroniclesShopSellable(state, entry);
  const owned = (id) => Math.max(0, Number(state.inventory?.[id]?.quantity) || 0);
  const sellsGear = stock.some((item) => item.slot !== 'consumable');
  const allOffers = tab === 'buy'
    ? stock.map((item) => ({ item, price: item.price, quantity: owned(item.id) }))
    : sellable.map(({ item, quantity }) => ({ item, price: chroniclesShopSellPrice(item), quantity }));
  const categories = chroniclesShopCategories(allOffers);
  const offers = chroniclesShopVisibleOffers(allOffers, { category, query, sort });
  const selected = chroniclesShopSelectedOffer(offers, selectedId);
  const selectedItem = selected?.item;
  const eligible = selectedItem && selectedItem.slot !== 'consumable' ? users(state, selectedItem) : [];
  const affordable = selected && gold >= selected.price;
  // The reducer refuses sales above its hard 9,999 gold purse cap. Explain
  // that refusal before the user clicks instead of silently doing nothing.
  const saleExceedsGoldCap = tab === 'sell' && Boolean(selected) && gold + selected.price > 9999;

  const switchTab = (next) => {
    setTab(next);
    setCategory('all');
    setQuery('');
    setSelectedId(null);
    setCompare(false);
  };

  const pickItem = (id) => {
    setSelectedId(id);
    setCompare(false);
    // On phones the detail follows the catalogue, without trapping the user.
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 900px)').matches) {
      requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' }));
    }
  };

  const shop = (
    <div className="chronicles-shop__backdrop" onClick={onClose}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="chronicles-shop"
        role="dialog"
        aria-modal="true"
        aria-label={entry.label}
        data-chronicles-shop={entry.id}
        onClick={(event) => event.stopPropagation()}
      >
        {room && (
          <figure className="chronicles-shop__scene" data-chronicles-shop-room={room.id}>
            <img src={room.src} alt={room.alt} draggable="false" />
          </figure>
        )}
        <header className="chronicles-shop__head">
          <div className="chronicles-shop__identity">
            <span>COMERCIANTE · SWORDHAVEN</span>
            <h2>{entry.label}</h2>
            <p role="status" aria-live="polite">{state.message}</p>
          </div>
          <b className="chronicles-shop__purse" aria-label={'Oro de la compañía: ' + gold}>◉ {gold} oro</b>
          <button ref={closeRef} type="button" className="chronicles-shop__close" onClick={onClose}
            aria-label="Salir de la tienda">✕</button>
        </header>
        <div className="chronicles-shop__art-space" aria-hidden="true" />
        <div className="chronicles-shop__tabs" role="tablist" aria-label="Operación comercial">
          <button id="chronicles-shop-tab-buy" type="button" role="tab" aria-selected={tab === 'buy'}
            aria-controls="chronicles-shop-market"
            onClick={() => switchTab('buy')}>Comprar</button>
          {entry.shop?.buys !== false && (
            <button id="chronicles-shop-tab-sell" type="button" role="tab" aria-selected={tab === 'sell'}
              aria-controls="chronicles-shop-market"
              onClick={() => switchTab('sell')}>Vender{sellable.length ? ' (' + sellable.length + ')' : ''}</button>
          )}
        </div>
        <main className="chronicles-shop__market" id="chronicles-shop-market"
          role="tabpanel" aria-labelledby={'chronicles-shop-tab-' + tab}>
          <section className="chronicles-shop__catalog" aria-label={tab === 'buy' ? 'Artículos a la venta' : 'Objetos de tu mochila para vender'}>
            <div className="chronicles-shop__filters">
              <label className="chronicles-shop__search">
                <span>Buscar mercancía</span>
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar objeto…" />
              </label>
              <label>
                <span>Tipo</span>
                <select value={category} onChange={(e) => { setCategory(e.target.value); setCompare(false); }}>
                  <option value="all">Todos</option>
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label>
                <span>Orden</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SHOP_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            <div className="chronicles-shop__catalog-title">
              <strong>{tab === 'buy' ? 'Mercancías' : 'Tu mochila'}</strong>
              <span>{offers.length} de {allOffers.length}</span>
            </div>
            <ul className="chronicles-shop__list" aria-label="Selecciona un artículo para inspeccionarlo">
              {offers.map(({ item, price, quantity }) => (
                <li key={item.id} data-chronicles-shop-item={tab === 'buy' ? item.id : undefined}
                  data-chronicles-shop-sell={tab === 'sell' ? item.id : undefined}
                  className={selectedItem?.id === item.id ? 'is-selected' : ''}>
                  <button type="button" className="chronicles-shop__entry"
                    aria-pressed={selectedItem?.id === item.id}
                    onClick={() => pickItem(item.id)}>
                    <span className="chronicles-shop__entry-icon"><ShopItemGlyph item={item} /></span>
                    <span className="chronicles-shop__entry-description">
                      <strong>{item.name}</strong>
                      <small>{SHOP_SLOT_LABELS[item.slot] || 'Otros'}{tab === 'sell' ? ' · ×' + quantity : quantity ? ' · tienes ' + quantity : ''}</small>
                    </span>
                    <span className="chronicles-shop__entry-price">{price} <small>oro</small></span>
                  </button>
                </li>
              ))}
              {offers.length === 0 && (
                <li className="chronicles-shop__empty">
                  {allOffers.length === 0 && tab === 'sell'
                    ? (sellsGear ? 'No hay equipo disponible en la mochila. Lo equipado no se vende.' : 'No llevas pociones ni pergaminos que vender.')
                    : 'No hay objetos que coincidan con los filtros.'}
                </li>
              )}
            </ul>
          </section>
          <section ref={detailsRef} className="chronicles-shop__detail" aria-label="Detalle del artículo">
            {selected ? (
              <>
                <div className="chronicles-shop__detail-top">
                  <small>{SLOT_LABEL[selectedItem.slot] || 'Objeto'}</small>
                  <h3>{selectedItem.name}</h3>
                  <div className="chronicles-shop__item-portrait"><ShopItemGlyph item={selectedItem} /></div>
                  <p>{selectedItem.description}</p>
                  <div className="chronicles-shop__eligibility">
                    {selectedItem.slot === 'consumable'
                      ? 'Para toda la compañía · tienes ' + selected.quantity
                      : eligible.length
                        ? 'Pueden equiparlo: ' + eligible.map((member) => member.name).join(', ')
                        : 'Nadie de la compañía puede equiparlo'}
                  </div>
                  {tab === 'sell' && <p className="chronicles-shop__owned">Disponible en mochila: ×{selected.quantity}</p>}
                </div>
                {tab === 'buy' && selectedItem.slot !== 'consumable' && (
                  <div className="chronicles-shop__compare-region">
                    <button type="button" className="chronicles-shop__compare-toggle"
                      aria-expanded={compare} aria-controls="chronicles-shop-compare-selected"
                      onClick={() => setCompare((value) => !value)}>
                      {compare ? 'Ocultar comparación −' : 'Comparar con mi equipo +'}
                    </button>
                    {compare && (
                      <div id="chronicles-shop-compare-selected">
                        <ShopComparison state={state} item={selectedItem} />
                      </div>
                    )}
                  </div>
                )}
                <div className="chronicles-shop__checkout">
                  <div className="chronicles-shop__checkout-price">
                    <span>{tab === 'buy' ? 'Precio' : 'Recibirás'}</span>
                    <strong>◉ {selected.price} oro</strong>
                  </div>
                  <button type="button" className="chronicles-shop__primary"
                    disabled={(tab === 'buy' && !affordable) || saleExceedsGoldCap}
                    onClick={() => onAction({ type: tab === 'buy' ? 'shop-buy' : 'shop-sell', itemId: selectedItem.id })}>
                    {tab === 'buy' ? (affordable ? 'Comprar' : 'Oro insuficiente')
                      : saleExceedsGoldCap ? 'Bolsa de oro llena' : 'Vender una unidad'}
                  </button>
                  <small className="chronicles-shop__checkout-hint">
                    {tab === 'buy' ? 'La compra va a la mochila. Equipar es una acción aparte.'
                      : saleExceedsGoldCap
                        ? `Límite: 9.999 oro. Gasta al menos ${gold + selected.price - 9999} oro para vender este objeto.`
                        : 'Solo se venden objetos sin equipar.'}
                  </small>
                </div>
              </>
            ) : (
              <div className="chronicles-shop__detail-empty">Selecciona una mercancía para inspeccionarla.</div>
            )}
          </section>
        </main>
        <footer className="chronicles-shop__foot">
          {sellsGear
            ? 'Lo comprado va a la mochila de la compañía. Equípalo desde la ficha de cada personaje.'
            : 'Las pociones y pergaminos van a la mochila. Úsalos con MAGIA/OBJETOS (tecla I), también en combate.'}
        </footer>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? shop : createPortal(shop, document.body);
}
