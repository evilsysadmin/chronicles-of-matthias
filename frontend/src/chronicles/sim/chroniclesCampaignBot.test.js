import { describe, expect, it } from 'vitest';
import { ChroniclesCampaignBot, seededRandom } from './chroniclesCampaignBot.js';
import { MAIN_ROUTE } from './campaignRoute.js';

// A quick slice of the balance bot in the regular suite: the first act must
// stay playable end to end (talk, Tobías, sewers, report, Garrah, report). The full
// campaign runs with `npm run sim`.
describe('Chronicles campaign bot', () => {
  it('plays the first act of the main story', () => {
    const original = Math.random;
    Math.random = seededRandom(1);
    try {
      const bot = new ChroniclesCampaignBot({ runId: 'sim-ci' });
      for (const [label, step] of MAIN_ROUTE.slice(0, 6)) {
        bot.currentLabel = label;
        bot.restIfHurt();
        step(bot);
      }
      expect(bot.state.swordhavenRouteReported).toBe(true);
      expect(bot.deaths).toHaveLength(0);
    } finally {
      Math.random = original;
    }
  }, 60000);
});
