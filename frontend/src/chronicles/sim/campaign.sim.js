// Balance simulation: `npm run sim`. Not part of the regular test run.
import fs from 'node:fs';
import { describe, it } from 'vitest';
import { BotError, ChroniclesCampaignBot, seededRandom } from './chroniclesCampaignBot.js';
import { MAIN_ROUTE } from './campaignRoute.js';


export function runCampaign({ seed = 1, route = MAIN_ROUTE } = {}) {
  const original = Math.random;
  Math.random = seededRandom(seed);
  const bot = new ChroniclesCampaignBot({ runId: `sim-${seed}` });
  let failure = null;
  try {
    for (const [label, step] of route) {
      bot.currentLabel = label;
      bot.restIfHurt();
      step(bot);
      bot.milestone(label);
    }
  } catch (error) {
    if (!(error instanceof BotError)) throw error;
    failure = { step: bot.currentLabel, reason: error.message };
    bot.milestone(`✗ ${bot.currentLabel}`);
  } finally {
    Math.random = original;
  }
  return { seed, failure, bot };
}

function report(results) {
  const lines = ['# Simulación de campaña', ''];
  const done = results.filter((result) => !result.failure).length;
  const fights = results.flatMap((result) => result.bot.fights);
  const deaths = results.reduce((sum, result) => sum + result.bot.deaths.length, 0);
  lines.push(`${done}/${results.length} campañas completadas · ${fights.length} peleas · `
    + `${fights.filter((fight) => fight.lowest < 0.5).length} bajan de 50% PV · ${fights.filter((fight) => fight.lowest < 0.25).length} de 25% · ${deaths} caídos.`, '');
  for (const { seed, failure, bot } of results) {
    lines.push(`## Semilla ${seed}`, '');
    lines.push(failure ? `**Se detiene en «${failure.step}»**: ${failure.reason}` : '**Campaña completada.**', '');
    lines.push('| Paso | Niveles M/H/A/F | PV | CA | Ataque | Oro | Peleas | Muertes | Descansos |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const m of bot.milestones) {
      const lv = ['matthias', 'rook', 'bishop', 'knight'].map((id) => m.levels[id]).join('/');
      const hp = ['matthias', 'rook', 'bishop', 'knight'].map((id) => m.hp[id]).join(' ');
      const ac = ['matthias', 'rook', 'bishop', 'knight'].map((id) => m.ac[id]).join('/');
      const toHit = ['matthias', 'rook', 'bishop', 'knight'].map((id) => m.toHit[id]).join('/');
      lines.push(`| ${m.label} | ${lv} | ${hp} | ${ac} | ${toHit} | ${m.gold} | ${m.fights} | ${m.deaths} | ${m.rests} |`);
    }
    const pct = (value) => `${Math.round(value * 100)}%`;
    const turns = bot.fights.map((fight) => fight.partyTurns).sort((a, b) => a - b);
    const median = turns.length ? turns[Math.floor(turns.length / 2)] : 0;
    const close = bot.fights.filter((fight) => fight.lowest < 0.5).length;
    const brink = bot.fights.filter((fight) => fight.lowest < 0.25).length;
    lines.push('', `Peleas: ${bot.fights.length} · mediana ${median} turnos del grupo · ${close} bajan al grupo de 50% PV · ${brink} de 25%.`);
    const worst = [...bot.fights].sort((a, b) => a.lowest - b.lowest).slice(0, 5);
    lines.push('', 'Peleas más duras (PV del grupo en su peor momento):');
    worst.forEach((fight) => lines.push(`- ${fight.step} · ${fight.mapId}: ${pct(fight.lowest)}, ${fight.partyTurns} turnos (${fight.enemies.length} enemigos)`));
    lines.push('', 'Golpes enemigos por paso (aciertos/intentos · daño medio por acierto):');
    lines.push(Object.entries(bot.swings).map(([step, tally]) => `${step} ${tally.hits}/${tally.swings} · ${tally.hits ? (tally.damage / tally.hits).toFixed(1) : '-'}`).join(' | '));
    lines.push('', `Doctrinas: ${bot.skills.map((skill) => `${skill.skillId}@${skill.step}`).join(', ') || 'ninguna'}.`);
    const spent = bot.purchases.reduce((sum, purchase) => sum + purchase.price, 0);
    lines.push('', `Compras (${spent} oro): ${bot.purchases.map((purchase) => `${purchase.itemId} ${purchase.price}@${purchase.step}`).join(', ') || 'ninguna'}.`);
    lines.push('', `Muertes: ${bot.deaths.map((d) => `${d.memberId}@${d.step}`).join(', ') || 'ninguna'}. Resurrecciones: ${bot.revives}. Oro en curas: ${bot.restGold}. Acciones: ${bot.actions}.`, '');
  }
  return lines.join('\n');
}

describe('Chronicles campaign simulation', () => {
  it('plays the main story and writes sim-report.md', () => {
    const seeds = String(process.env.SIM_SEEDS || '1,2,3').split(',').map(Number).filter(Number.isFinite);
    const results = seeds.map((seed) => runCampaign({ seed }));
    const text = report(results);
    fs.writeFileSync('sim-report.md', text);
  }, 600000);
});
