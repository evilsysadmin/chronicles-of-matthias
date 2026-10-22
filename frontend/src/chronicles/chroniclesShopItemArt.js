// Authored, standalone 2D shop artwork; only exact canonical IDs receive
// material-correct sprites. All remaining items keep their existing glyph.
// No game rules, price, equipability, or item data are derived from this map.
import woodenLongbow from '../assets/chronicles/ui/items/wooden-longbow.svg';
import brassCrossbow from '../assets/chronicles/ui/items/brass-crossbow.svg';
import brassDagger from '../assets/chronicles/ui/items/brass-dagger.svg';
import bronzeSword from '../assets/chronicles/ui/items/bronze-sword.svg';
import woodenShield from '../assets/chronicles/ui/items/wooden-shield.svg';
import leatherCuirass from '../assets/chronicles/ui/items/leather-cuirass.svg';
import brassShield from '../assets/chronicles/ui/items/brass-shield.svg';
import brassRingmail from '../assets/chronicles/ui/items/brass-ringmail.svg';
import brassScalemail from '../assets/chronicles/ui/items/brass-scalemail.svg';
import leatherGambeson from '../assets/chronicles/ui/items/leather-gambeson.svg';
import roadwatchVest from '../assets/chronicles/ui/items/roadwatch-guard-vest.svg';

export const CHRONICLES_SHOP_ITEM_ART = Object.freeze({
  'wooden-longbow': woodenLongbow,
  'brass-crossbow': brassCrossbow,
  'brass-dagger': brassDagger,
  'bronze-sword': bronzeSword,
  'wooden-shield': woodenShield,
  'leather-leather': leatherCuirass,
  'brass-shield': brassShield,
  'brass-ring': brassRingmail,
  'brass-scale': brassScalemail,
  'leather-padded': leatherGambeson,
  'roadwatch-vest': roadwatchVest,
});

export function chroniclesShopItemArt(item) {
  return item && Object.hasOwn(CHRONICLES_SHOP_ITEM_ART, item.id)
    ? CHRONICLES_SHOP_ITEM_ART[item.id] : null;
}
