// Trace one step of the main route:
//   SIM_STEP="Salinas Hundidas" npx vitest run --config vitest.sim.config.js debug
import fs from 'node:fs';
import { it } from 'vitest';
import { ChroniclesCampaignBot, seededRandom } from './chroniclesCampaignBot.js';
import { MAIN_ROUTE } from './campaignRoute.js';
import { chroniclesCurrentInitiativeActor } from '../chroniclesInitiative.js';
import { chroniclesRuntimeEnemyPosition } from '../../chroniclesOfMatthiasTurns.js';
import { chroniclesLivingPartyPositions } from '../../chroniclesPartyFootprint.js';

const LOG = process.env.SIM_LOG || 'sim-debug.log';
const log = (...parts) => fs.appendFileSync(LOG, `${parts.join(' ')}\n`);

it('traces one route step', () => {
  fs.writeFileSync(LOG, '');
  Math.random = seededRandom(Number(process.env.SIM_SEED || 1));
  const bot = new ChroniclesCampaignBot({ runId: `sim-${process.env.SIM_SEED || 1}` });
  const target = process.env.SIM_STEP || MAIN_ROUTE[1][0];
  const verbose = process.env.SIM_VERBOSE === '1';
  for (const [label, step] of MAIN_ROUTE) {
    bot.currentLabel = label;
    if (label === target) {
      const original = bot.act.bind(bot);
      let n = 0;
      bot.act = (action) => {
        const s = bot.state;
        n += 1;
        if (verbose || n % 25 === 0) {
          const actor = s.initiative ? chroniclesCurrentInitiativeActor(s.initiative) : null;
          const foes = bot.aliveEnemies().map((e) => `${e.id}@${JSON.stringify(chroniclesRuntimeEnemyPosition(s, e))}`).join(' ');
          log(n, s.mapId, `${s.x},${s.y} d${s.direction}`, actor?.id || '-', JSON.stringify(action), verbose ? foes : '', verbose && s.initiative ? chroniclesLivingPartyPositions(s).map((p) => `${p.memberId[0]}${p.position.x},${p.position.y}`).join(' ') : '', '|', (s.message || '').slice(0, 100));
        }
        const before = s.mapId;
        const result = original(action);
        if (bot.state.mapId !== before) log('MAP', before, '→', bot.state.mapId, `${bot.state.x},${bot.state.y}`);
        return result;
      };
    }
    bot.restIfHurt();
    try {
      step(bot);
    } catch (error) {
      log('ERR', label, error.message);
      return;
    }
    if (label === target) return;
  }
});
