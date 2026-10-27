import odoArmory from '../assets/chronicles/ui/shops/odo-armory.svg';
import brunnaArmory from '../assets/chronicles/ui/shops/brunna-forge.webp';
import guildArchive from '../assets/chronicles/ui/shops/guild-archive.svg';
import boticaApothecary from '../assets/chronicles/ui/shops/botica-apothecary.svg';
import { CHRONICLES_ODO_UPLOADED_ART_URL } from './chroniclesShopArt.js';

// User-supplied WebP in the Chronicles bucket. Load over the local SVG;
// the shop remains usable even if the new public origin is unavailable.
const odoR2Url = CHRONICLES_ODO_UPLOADED_ART_URL;

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
  'building-apothecary': Object.freeze({ id: 'botica-apothecary', src: boticaApothecary, alt: 'La botica de Swordhaven: boticaria tras el mostrador, hierbas secas, pociones y alambiques iluminados' }),
  'building-guild': Object.freeze({ id: 'guild-sanctum', src: guildArchive, alt: 'La biblioteca del gremio: archivista encapuchada, grimorios iluminados, vidrieras y estanterías' }),
});

export function chroniclesShopRoom(entry) {
  return ROOMS[entry?.visualType] || null;
}
