import { CHRONICLES_EQUIPMENT } from '../chronicles/chroniclesEquipment.js';
import { chroniclesShopItemArt } from '../chronicles/chroniclesShopItemArt.js';
import ChroniclesInventoryMiniature, { chroniclesInventoryMiniatureSpec } from './ChroniclesInventoryMiniature.jsx';

// Original 16px pixel silhouettes, not external emoji/fonts or MM3 assets.
// The real catalog identifies each family so a dagger is not a long sword.
const PIXELS = Object.freeze({
  sword: 'M8 1h2v3h1v2h1v2h1v1h-3v3h-2v-3H6V9h1V7h1V4h1V1ZM5 11h2v1h1v3H6v-3H5z',
  dagger: 'M8 2h2v5h2v2H6V7h2z M7 10h4v2H9v3H8v-3H7z',
  bow: 'M3 1h3v2H4v2H3v6h1v2h2v2H3v-1H2v-2H1V4h1V2h1z M5 2h1v1h1v10H6v1H5V2z M8 6h5v1h2v2h-2v1H8z',
  crossbow: 'M2 2h2v2H2z M4 4h2v2h4V4h2v2h2v3h-2v1h-2V8H6v2H4V9H2V6h2z M7 8h2v7H7z',
  sling: 'M2 2h2v4h2v2h4V6h2V2h2v5h-1v2h-2v2H6V9H4V7H2z M7 11h2v4H7z',
  staff: 'M9 1h2v13H9z M7 1h6v2H7z',
  mace: 'M7 1h5v2h2v5h-2v2H7V8H5V3h2z M9 10h2v5H9z',
  spear: 'M8 1h2v3h2v2h-2v9H8V6H6V4h2z',
  axe: 'M9 1h2v14H9z M3 2h6v7H7v2H5V9H3z',
  armor: 'M3 2h3v2h4V2h3v2h2v4h-2v7H3V8H1V4h2z M6 7h4v2H6z',
  shield: 'M3 1h10v8h-1v2h-1v2H9v2H7v-2H5v-2H4V9H3z M7 4h2v7H7z',
  other: 'M6 1h4v3h3v3h2v3h-3v3H9v2H6v-2H3v-3H1V7h2V4h3z',
});

export function chroniclesItemIconKind(item) {
  const gear = CHRONICLES_EQUIPMENT[item?.id] || item || {};
  const family = gear.baseItemId || gear.family || '';
  if (Object.hasOwn(PIXELS, family)) return family;
  if (gear.slot === 'missile') return 'bow';
  if (gear.slot === 'weapon') return 'sword';
  if (gear.slot === 'armor') return 'armor';
  if (gear.slot === 'shield') return 'shield';
  return 'other';
}

export default function ChroniclesInventoryItemIcon({ item }) {
  const kind = chroniclesItemIconKind(item);
  // Small authored item portraits convey bronze, leather and distinct weapon types;
  // unmapped loot keeps the original readable pixel silhouette.
  const art = chroniclesShopItemArt(item);
  if (art) {
    return (
      <img className="chronicles-character-sheet__illustrated-item-icon"
        src={art} width="29" height="29" alt="" aria-hidden="true"
        loading="lazy" decoding="async" draggable="false" data-item-icon={kind} />
    );
  }
  // The known catalog has material-aware miniatures for every armor and
  // weapon family. Only genuinely unknown loot uses the old pixel fallback.
  const miniature = chroniclesInventoryMiniatureSpec(item);
  if (miniature) return <ChroniclesInventoryMiniature item={item} spec={miniature} kind={kind} />;
  return (
    <svg className="chronicles-character-sheet__pixel-item-icon" viewBox="0 0 16 16"
      width="27" height="27" shapeRendering="crispEdges" aria-hidden="true" focusable="false"
      data-item-icon={kind}>
      <path d={PIXELS[kind]} fill="currentColor" />
    </svg>
  );
}
