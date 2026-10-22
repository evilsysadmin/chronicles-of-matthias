// Authored, standalone 2D shop artwork; only exact canonical IDs receive
// material-correct sprites. All remaining items keep their existing glyph.
// No game rules, price, equipability, or item data are derived from this map.
import woodenLongbow from '../assets/chronicles/ui/items/wooden-longbow.svg';
import brassCrossbow from '../assets/chronicles/ui/items/brass-crossbow.svg';
import brassDagger from '../assets/chronicles/ui/items/brass-dagger.svg';
import bronzeSword from '../assets/chronicles/ui/items/bronze-sword.svg';

export const CHRONICLES_SHOP_ITEM_ART = Object.freeze({
  'wooden-longbow': woodenLongbow,
  'brass-crossbow': brassCrossbow,
  'brass-dagger': brassDagger,
  'bronze-sword': bronzeSword,
});

export function chroniclesShopItemArt(item) {
  return item && Object.hasOwn(CHRONICLES_SHOP_ITEM_ART, item.id)
    ? CHRONICLES_SHOP_ITEM_ART[item.id] : null;
}
