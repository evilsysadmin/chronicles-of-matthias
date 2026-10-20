// Geographical notes for authored first-book contracts. This is presentation
// only: no quest state, fog-of-war, coordinates or save contract is changed.
// A missing/unknown quest deliberately has no speculative destination.
import { chroniclesMapById } from './chroniclesMapCatalog.js';

const ZONE = Object.freeze({
  town: 'swordhaven-first-book',
  road: 'banner-road-first-book',
  wood: 'rookwood-first-book',
  crypt: 'crypt-eight-squares',
  gallery: 'gallery-of-forks',
});

function hasItem(state, id) {
  return Number(state?.inventory?.[id]?.quantity || 0) > 0;
}

function questDestination(quest, state) {
  if (!quest || quest.status !== 'active') return null;
  switch (quest.id) {
    case 'banner-contract':
      return state?.bannerFound || hasItem(state, 'knight-banner')
        ? [ZONE.town, 'Entrega el estandarte en el tablón de encargos.']
        : [ZONE.road, 'Busca cerca del mojón sin nombre.'];
    case 'names-in-wood':
      return [ZONE.wood, 'Busca las placas y llévalas al Roble del Claro.'];
    case 'road-bandits':
      return state?.bannerRoadDeserterDefeated && state?.bannerRoadCaptainDefeated
        ? [ZONE.town, 'Informa a la guardia de que el camino está libre.']
        : [ZONE.road, 'Busca a los desertores y su capitán.'];
    case 'weaver-silk':
      return hasItem(state, 'weaver-silk')
        ? [ZONE.town, 'Entrega la seda a Ilse en el templo.']
        : [ZONE.wood, 'Busca la seda de la tejedora.'];
    case 'lost-king-prologue': {
      const objective = String(quest.objective || '');
      if (objective.includes('Regresa a Swordhaven')) {
        return ['swordhaven-square', 'Informa del hallazgo del sello.'];
      }
      if (objective.includes('Puerta Negra') && objective.includes('Galería')) {
        return [ZONE.gallery, 'Sigue el rastro documental de la galería.'];
      }
      if (objective.includes('Cripta de las Ocho Casillas')) {
        return [ZONE.crypt, 'Investiga el antiguo sello.'];
      }
      return null;
    }
    default:
      return null;
  }
}

export function chroniclesQuestRegionHint(quest, state) {
  const destination = questDestination(quest, state);
  if (!destination) return null;
  const map = chroniclesMapById(destination[0]);
  if (!map?.title) return null;
  return {
    mapId: map.id,
    region: String(map.title).split(' · ')[0],
    clue: destination[1],
    kind: map.regionKind === 'settlement' ? 'Pueblo'
      : map.regionKind === 'wilderness' ? 'Exterior' : 'Mazmorra',
  };
}
