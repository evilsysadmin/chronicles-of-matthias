import {
  createChroniclesPrecipitationOverlay, chroniclesPrecipitationBudget,
} from '../src/chronicles/chroniclesPrecipitationOverlay.js';
import { chroniclesRegionalWeather, chroniclesRegionalWeatherTransition } from '../src/chronicles/chroniclesRegionalWeather.js';

const params = new URLSearchParams(location.search);
const mode = params.get('kind') === 'snow' ? 'snow' : 'rain';
const region = mode === 'rain'
  ? { mapId: 'terra-preview-marsh', regionKind: 'wilderness', biome: 'marsh' }
  : { mapId: 'terra-preview-snow', regionKind: 'wilderness', biome: 'snow' };
function findTime(kind) {
  for (let i = 0; i < 150; i += 1) {
    const minute = 90 * (6 + i) + 50;
    if (chroniclesRegionalWeather({ ...region, worldMinutes: minute })?.kind === kind) return minute;
  }
  throw Error('No ' + kind + ' weather sample');
}
const host = document.getElementById('weather-preview');
const coarse = params.get('coarse') === 'true';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const effect = createChroniclesPrecipitationOverlay(host, region, { coarse, reducedMotion });
const start = findTime(mode);
effect.sync(start);
window.__terraPrecipitation = {
  mode, coarse, budget: chroniclesPrecipitationBudget(mode, coarse, reducedMotion),
  start, clear: findTime('clear'),
  wind: chroniclesRegionalWeatherTransition({ ...region, worldMinutes: start }).wind,
  setTime: effect.sync, resize: effect.resize, setVisible: effect.setVisible, dispose: effect.dispose,
};
