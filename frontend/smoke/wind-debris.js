import {
  chroniclesWindDebrisCrosswind, createChroniclesWindDebrisOverlay,
  chroniclesWindDebrisBudget,
} from '../src/chronicles/chroniclesWindDebrisOverlay.js';
import { chroniclesRegionalWeatherTransition } from '../src/chronicles/chroniclesRegionalWeather.js';

const params = new URLSearchParams(location.search);
const biome = params.get('biome') === 'ash' ? 'ash' : 'forest';
const region = {
  mapId: biome === 'forest' ? 'terra-demo-fallen-leaves' : 'terra-demo-ash-wastes',
  regionKind: 'wilderness', biome,
};
const coarse = params.get('coarse') === 'true';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function sample(predicate) {
  for (let i = 0; i < 160; i += 1) {
    const minute = 480 + i * 360 + 60;
    const weather = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: minute });
    if (predicate(weather)) return minute;
  }
  throw Error('No sampled weather in Terra');
}
const start = sample(w => ['clear', 'cloudy'].includes(w.kind)
  && Math.max(Math.abs(w.wind.east), Math.abs(w.wind.south)) >= 0.08);
const wind = chroniclesRegionalWeatherTransition({ ...region, worldMinutes: start }).wind;
const facing = Math.abs(wind.east) >= Math.abs(wind.south) ? 0 : 1;
const initialCrosswind = Math.abs(chroniclesWindDebrisCrosswind(wind, facing));
const alternate = sample(w => ['clear', 'cloudy'].includes(w.kind)
  && !w.precipitation && w.fog < 0.35
  && Math.abs(chroniclesWindDebrisCrosswind(w.wind, facing)) >= 8
  && Math.abs(Math.abs(chroniclesWindDebrisCrosswind(w.wind, facing)) - initialCrosswind) >= 12);
const disabled = sample(w => biome === 'ash' ? w.kind === 'fog' : w.kind === 'rain');
const host = document.getElementById('wind-preview');
if (biome === 'ash') {
  host.style.background = 'linear-gradient(165deg,#8b8a82 0%,#b9a99b 48%,#625347 49%,#2c2925 100%)';
}
const effect = createChroniclesWindDebrisOverlay(host, region, { coarse, reducedMotion });
effect.sync(start, facing);
window.__terraWindDebris = {
  biome, start, alternate, disabled, facing, wind,
  budget: chroniclesWindDebrisBudget(biome === 'forest' ? 'leaf' : 'ash', coarse, reducedMotion),
  cross: chroniclesWindDebrisCrosswind(wind, facing),
  setTime: effect.sync, resize: effect.resize, setVisible: effect.setVisible,
  dispose: effect.dispose,
};