import { useEffect, useId, useRef, useState } from 'react';
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
import { chroniclesShopItemArt } from '../chronicles/chroniclesShopItemArt.js';
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

function ShopItemVisual({ item }) {
  const artwork = chroniclesShopItemArt(item);
  return artwork ? (
    <img className="chronicles-shop__item-sprite" src={artwork}
      alt={item.name} data-chronicles-shop-art={item.id}
      width="512" height="512" draggable="false" decoding="async" />
  ) : <ShopItemVisual item={item} />;
}

function ShopItemGlyph({ item }) {
  // Each row owns its paint servers; SVG IDs must remain unique in the DOM.
  const uid = useId().replace(/:/g, '');
  const metallic = 'url(#' + uid + '-metal)';
  const gilt = 'url(#' + uid + '-gilt)';
  const wood = 'url(#' + uid + '-wood)';
  const liquid = 'url(#' + uid + '-liquid)';
  const parchment = 'url(#' + uid + '-paper)';
  const kind = item.slot === 'consumable'
    ? (/scroll|pergamino/i.test(item.id || '') || /pergamino/i.test(item.name || '') ? 'scroll' : 'potion')
    : item.slot === 'missile' ? (['crossbow', 'sling'].includes(item.weaponFamily) ? item.weaponFamily : 'bow')
      : item.slot;
  return (
    <svg className="chronicles-shop__glyph" viewBox="0 0 64 64" role="img"
      aria-label={SLOT_LABEL[item.slot] || 'Objeto'} data-chronicles-shop-glyph={kind}>
      <defs>
        <linearGradient id={uid + '-metal'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#faf0d6" /><stop offset=".19" stopColor="#a4b5b7" />
          <stop offset=".43" stopColor="#435866" /><stop offset=".64" stopColor="#c5c8bd" />
          <stop offset="1" stopColor="#26343e" />
        </linearGradient>
        <linearGradient id={uid + '-gilt'} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor="#fff1c3" /><stop offset=".41" stopColor="#cb9650" />
          <stop offset=".72" stopColor="#76502b" /><stop offset="1" stopColor="#d5b06c" />
        </linearGradient>
        <linearGradient id={uid + '-wood'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ad7c4e" /><stop offset=".52" stopColor="#64412a" />
          <stop offset="1" stopColor="#30231d" />
        </linearGradient>
        <linearGradient id={uid + '-liquid'} x1="0" y1="0" x2=".8" y2="1">
          <stop offset="0" stopColor="#d4f7d4" /><stop offset=".42" stopColor="#67b696" />
          <stop offset="1" stopColor="#18534f" />
        </linearGradient>
        <linearGradient id={uid + '-paper'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1ce" /><stop offset=".6" stopColor="#d1b17a" />
          <stop offset="1" stopColor="#90714d" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="57" rx="20" ry="3" fill="#000" opacity=".35"/>
      {kind === 'weapon' ? (
        <g strokeLinejoin="round">
          <path d="M50 5 57 11 34 37 28 31Z" fill={metallic} stroke="#1f2f38" strokeWidth="2"/>
          <path d="M51 8 32 33" stroke="#ffefd1" strokeWidth="1.5" opacity=".75"/>
          <path d="m27 30 11 11-4 4-11-11Z" fill={gilt} stroke="#543d26" strokeWidth="1.4"/>
          <path d="m24 37-13 12 5 5 13-12Z" fill={wood} stroke="#291f20" strokeWidth="2"/>
          <path d="m12 47 6 6m-2-12 6 6" stroke="#e7b879" strokeWidth="1.5"/>
          <path d="M25 30 19 37 32 50 39 43" fill="none" stroke={gilt} strokeWidth="4"/>
        </g>
      ) : kind === 'armor' ? (
        <g strokeLinejoin="round">
          <path d="M22 8 14 12 6 29l10 8 6-8v25h20V29l6 8 10-8-8-17-8-4-10 9Z"
            fill={metallic} stroke="#23303a" strokeWidth="2.6"/>
          <path d="M22 10 32 19 42 10M22 27q10 5 20 0M22 39q10 5 20 0M32 20v33"
            fill="none" stroke="#dfd2b2" strokeWidth="2" opacity=".8"/>
          <path d="M24 23q8-6 16 0M24 47h16" fill="none" stroke={gilt} strokeWidth="2.8"/>
          <circle cx="23" cy="13" r="2" fill="#e0b46e"/><circle cx="41" cy="13" r="2" fill="#e0b46e"/>
          <path d="M15 17 11 28l6 4M49 17l4 11-6 4" fill="none" stroke="#425c66" strokeWidth="3"/>
        </g>
      ) : kind === 'shield' ? (
        <g strokeLinejoin="round">
          <path d="M32 5 53 13 50 40Q45 52 32 59 19 52 14 40L11 13Z"
            fill={metallic} stroke="#1d2c35" strokeWidth="3"/>
          <path d="M32 12 46 17 44 38Q39 46 32 51 25 46 20 38L18 17Z"
            fill={wood} stroke={gilt} strokeWidth="3"/>
          <path d="M32 13v38M21 28h22" stroke={gilt} strokeWidth="3"/>
          <path d="m32 19 6 11-6 11-6-11Z" fill={metallic} stroke="#202f37" strokeWidth="1.4"/>
          <circle cx="16" cy="15" r="2" fill="#fff0c0"/><circle cx="48" cy="15" r="2" fill="#fff0c0"/>
        </g>
      ) : kind === 'crossbow' ? (
        <g strokeLinejoin="round" strokeLinecap="round">
          <path d="M8 21Q32 4 56 21L49 29 32 23 15 29Z" fill={metallic} stroke="#2c3d46" strokeWidth="2.6"/>
          <path d="M9 20Q32 38 55 20" fill="none" stroke="#f0dcba" strokeWidth="1.6"/>
          <path d="M27 21h10l2 36H25Z" fill={wood} stroke="#271f1d" strokeWidth="2.5"/>
          <path d="M32 8v44M26 15l6-7 6 7M25 46h14" stroke={gilt} strokeWidth="3" fill="none"/>
        </g>
      ) : kind === 'sling' ? (
        <g strokeLinecap="round">
          <path d="M18 8q4 16 8 22M46 8q-5 17-8 22" stroke={wood} strokeWidth="5" fill="none"/>
          <path d="M25 27Q32 38 39 27L42 37Q32 46 22 37Z" fill={wood} stroke="#35231c" strokeWidth="2"/>
          <path d="M31 41 26 57" stroke="#d2a16b" strokeWidth="4"/>
          <ellipse cx="32" cy="32" rx="5" ry="4" fill={metallic} stroke="#475765" strokeWidth="1.4"/>
        </g>
      ) : kind === 'bow' ? (
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6Q54 32 18 58Q6 32 18 6Z" fill={wood} stroke="#35261f" strokeWidth="2"/>
          <path d="M18 6v52" stroke="#f6e7c7" strokeWidth="1.7"/>
          <path d="M11 32h45m-9-7 9 7-9 7" stroke={metallic} strokeWidth="3" fill="none"/>
          <path d="M35 27v10" stroke={gilt} strokeWidth="5"/>
        </g>
      ) : kind === 'scroll' ? (
        <g strokeLinejoin="round">
          <path d="M18 10h30q6 0 5 8v31H21q-9 0-9 7V18q0-8 6-8Z"
            fill={parchment} stroke="#69472f" strokeWidth="2"/>
          <path d="M18 11q10 6 0 12h30M18 49q10 4 0 9h34" fill="none" stroke={gilt} strokeWidth="3"/>
          <path d="M26 26h18M26 32h16M26 38h11" stroke="#98764b" strokeWidth="2"/>
          <path d="m35 21 4 4-4 4-4-4Z" fill="#568786"/>
        </g>
      ) : (
        <g strokeLinejoin="round">
          <path d="M26 6h12v9H26Z" fill={wood} stroke="#30231a" strokeWidth="2"/>
          <path d="M28 15h8v9q11 10 11 17 4 17-15 17T17 41q0-7 11-17Z"
            fill="#6f9da0" fillOpacity=".55" stroke="#b6ded4" strokeWidth="2.8"/>
          <path d="M19 41q13-7 26 0 5 15-13 15T19 41Z" fill={liquid}/>
          <path d="m25 33-3 9m17-8 3 7" stroke="#f3fff4" strokeWidth="3" strokeLinecap="round"/>
          <circle cx="31" cy="47" r="2" fill="#ddfce6"/>
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
        data-chronicles-shop-room-theme={room?.id || "none"}
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
                    <span className="chronicles-shop__entry-icon"><ShopItemVisual item={item} /></span>
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
                  <div className="chronicles-shop__item-portrait"><ShopItemVisual item={selectedItem} /></div>
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
