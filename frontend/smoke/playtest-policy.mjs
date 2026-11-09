// Reproducible, bounded Playwright player. Input comes from visible game DOM,
// never hidden React state, Mongo internals, combat RNG, or authored FEN/map.
export const PLAYTEST_PROFILES = Object.freeze(['aggressive', 'cautious']);
export const PLAYTEST_MAX_COMBAT_ACTIONS = 32;
export const PLAYTEST_MAX_EXPLORATION_ACTIONS = 8;

export function playtestAction({ profile, observed, explorationActions = 0,
  combatActions = 0, blocked = 0, seed = 0 }) {
  if (!PLAYTEST_PROFILES.includes(profile)) throw new Error('Unknown playtest profile');
  if (!observed || ['defeated', 'escaped'].includes(observed.phase)) return null;
  if (observed.initiative) {
    if (observed.enemyTurn) return null; // no turn-stealing or repeated input
    if (!observed.meleeReady) return 'b';
    // A conservative player occasionally blocks a legal adjacent attack.
    // Stable seed changes the cadence; no LLM or uncontrolled random calls.
    if (profile === 'cautious' && (combatActions + seed) % 3 === 0) return 'b';
    return 'a';
  }
  if (explorationActions === 0) return 's'; // the real collective opening volley
  if (blocked >= 2) return 'ArrowRight'; // recover from a wall, never spin forever
  return 'ArrowUp';
}

export function playtestOutcome({ observed, enemyHp, combatEntered,
  explorationActions, combatActions, startHp, endHp }) {
  const actions = explorationActions + combatActions;
  const hpLost = Math.max(0, startHp - endHp);
  const outcome = observed.phase === 'defeated' || endHp <= 0 ? 'defeat'
    : enemyHp === 0 ? 'victory'
      : !combatEntered ? 'no-contact' : 'unfinished';
  const warnings = [];
  if (outcome === 'defeat') warnings.push('party-defeated');
  if (outcome === 'no-contact') warnings.push('enemy-unreachable');
  if (outcome === 'unfinished') warnings.push('encounter-not-resolved');
  if (startHp > 0 && hpLost >= startHp * 0.7) warnings.push('party-lost-70pct-hp');
  if (combatActions > 20) warnings.push('long-combat');
  return { outcome, warnings, hpLost, actions };
}

export function playtestSummary(episodes) {
  if (!Array.isArray(episodes) || !episodes.length) throw new Error('No playtest episodes');
  return {
    episodes: episodes.length,
    wins: episodes.filter(episode => episode.outcome === 'victory').length,
    defeats: episodes.filter(episode => episode.outcome === 'defeat').length,
    unresolved: episodes.filter(episode => !['victory', 'defeat'].includes(episode.outcome)).length,
    averageHpLost: Number((episodes.reduce((sum, episode) => sum + episode.hpLost, 0) / episodes.length).toFixed(2)),
    averageActions: Number((episodes.reduce((sum, episode) => sum + episode.actions, 0) / episodes.length).toFixed(2)),
  };
}
