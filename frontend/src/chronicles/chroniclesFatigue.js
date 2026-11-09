import { chroniclesWorldMinutes } from './chroniclesWorldTime.js';

// A day in Terra is the only fatigue clock. Browser tab time, turns, and
// checkpoint age never affect this rule.
export const CHRONICLES_FATIGUE_THRESHOLD_MINUTES = 16 * 60;

// Older runs have no sleep receipt. Treat their currently restored Terra time
// as a fresh baseline rather than retroactively punishing old expeditions.
export function chroniclesLastRestWorldMinutes(state) {
  const now = chroniclesWorldMinutes(state?.worldMinutes);
  const saved = state?.lastRestWorldMinutes;
  return Number.isSafeInteger(saved) && saved >= 0 && saved <= now ? saved : now;
}

export function chroniclesFatigueStatus(state) {
  const awakeMinutes = state?.combatRules === 'mm3'
    ? chroniclesWorldMinutes(state.worldMinutes) - chroniclesLastRestWorldMinutes(state)
    : 0;
  const tired = awakeMinutes >= CHRONICLES_FATIGUE_THRESHOLD_MINUTES;
  return {
    tired,
    awakeMinutes,
    // Temporary effective combat statistics. Never mutate permanent hero stats
    // or double-charge existing speed/progression modifiers.
    attackPenalty: tired ? 1 : 0,
    armorClassPenalty: tired ? 1 : 0,
    initiativePenalty: tired ? 2 : 0,
  };
}
