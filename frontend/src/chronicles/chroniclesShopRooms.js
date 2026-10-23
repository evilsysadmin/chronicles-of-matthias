import odoArmory from '../assets/chronicles/ui/shops/odo-armory.svg';
import brunnaArmory from '../assets/chronicles/ui/shops/brunna-forge.webp';
import guildArchive from '../assets/chronicles/ui/shops/guild-archive.svg';
import { chroniclesShopArtUrl } from './chroniclesShopArt.js';

const odoR2Url = chroniclesShopArtUrl('chronicles.shop.odo');

// MM3 shows the shopkeeper in their illustrated room. The room follows the building the
// counter belongs to (`visualType: building-<style>` on the shop entry).
const ROOMS = Object.freeze({
  'building-armor': Object.freeze({
    id: 'odo-forge',
    src: odoR2Url || odoArmory,
    fallbackSrc: odoR2Url ? odoArmory : null,
    alt: 'La armería de Odo: el armero barbudo ante el mostrador, armaduras y brasas al fondo',
  }),
  'building-forge': Object.freeze({ id: 'brunna-armory', src: brunnaArmory, alt: 'La armería: armas en los armeros y la tendera tras el mostrador' }),
  'building-guild': Object.freeze({ id: 'guild-sanctum', src: guildArchive, alt: 'La biblioteca del gremio: archivista encapuchada, grimorios iluminados, vidrieras y estanterías' }),
});

export function chroniclesShopRoom(entry) {
  return ROOMS[entry?.visualType] || null;
}
