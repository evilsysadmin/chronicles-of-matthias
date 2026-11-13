// Reproducible, bounded Playwright player. Input comes from visible game DOM,
// never hidden React state, Mongo internals, combat RNG, or authored FEN/map.
export const PLAYTEST_PROFILES = Object.freeze(['aggressive', 'cautious']);
export const PLAYTEST_MAX_COMBAT_ACTIONS = 32;
export const PLAYTEST_MAX_EXPLORATION_ACTIONS = 8;

// Whitelisted physical controls exposed by the MM3 HUD. In initiative the
// left/right touch slots become lateral Q/E steps (no camera rotation).
export const PLAYTEST_MOBILE_TOUCH_ACTIONS = Object.freeze({
  ArrowUp: 'forward',
  ArrowDown: 'backward',
  ArrowLeft: 'turn-left',
  ArrowRight: 'turn-right',
  q: 'strafe-left',
  e: 'strafe-right',
  a: 'attack',
  b: 'block',
  s: 'attack',
});
export function playtestMobileTouchAction(action, { initiative = false } = {}) {
  const control = Object.hasOwn(PLAYTEST_MOBILE_TOUCH_ACTIONS, action)
    ? PLAYTEST_MOBILE_TOUCH_ACTIONS[action] : null;
  // Reorientation is valid while exploring but categorically forbidden
  // during MM3 initiative; sidesteps are separate Q/E actions.
  if (initiative && (control === 'turn-left' || control === 'turn-right')) return null;
  return control;
}

export function playtestAction({ profile, observed, explorationActions = 0,
  combatActions = 0, blocked = 0, repositionSteps = 0, seed = 0 }) {
  if (!PLAYTEST_PROFILES.includes(profile)) throw new Error('Unknown playtest profile');
  if (!observed || ['defeated', 'escaped'].includes(observed.phase)) return null;
  if (observed.initiative) {
    if (observed.enemyTurn) return null; // no turn-stealing or repeated input
    if (!observed.meleeReady) {
      // In MM3 initiative the party cannot rotate, but may spend an action
      // moving one square. Probe cardinal movement from the live UI rather
      // than blocking forever when the enemy is behind or not yet adjacent.
      const steps = profile === 'aggressive'
        ? ['ArrowUp', 'ArrowDown', 'q', 'e']
        : ['ArrowDown', 'ArrowUp', 'e', 'q'];
      if (blocked >= steps.length) return 'b'; // all probes rejected; defend
      // Continue the chosen heading across several successful actions;
      // otherwise forward/backward oscillation never reaches a ranged foe.
      return steps[(Math.floor(repositionSteps / 3) + blocked) % steps.length];
    }
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
  explorationActions, combatActions, startHp, endHp,
  meleeOpportunities = null, rejectedCombatMoves = 0 }) {
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
  // Only report this if the bot measured legal melee opportunities in the
  // real DOM. Twelve committed actions without one is suspicious, but not
  // proof of a softlock: map geometry and ranged threats require review.
  if (combatEntered && outcome !== 'victory' && combatActions >= 12
    && meleeOpportunities === 0) warnings.push('no-melee-access-after-12-actions');
  if (rejectedCombatMoves >= 8) warnings.push('repeated-rejected-combat-moves');
  return { outcome, warnings, hpLost, actions };
}

// Keep runtime failures separate from observed gameplay outcomes. Otherwise a
// failed browser/login test becomes an artificial zero-action, zero-damage run
// and silently improves the average combat metrics.
export function playtestSummary(episodes) {
  if (!Array.isArray(episodes) || !episodes.length) throw new Error('No playtest episodes');
  const measured = episodes.filter(episode => episode.outcome !== 'error');
  const mean = (field) => measured.length
    ? Number((measured.reduce((sum, episode) => sum + episode[field], 0)
      / measured.length).toFixed(2))
    : null;
  return {
    episodes: episodes.length,
    measuredEpisodes: measured.length,
    errors: episodes.length - measured.length,
    wins: measured.filter(episode => episode.outcome === 'victory').length,
    defeats: measured.filter(episode => episode.outcome === 'defeat').length,
    unresolved: measured.filter(episode => !['victory', 'defeat'].includes(episode.outcome)).length,
    averageHpLost: mean('hpLost'),
    averageActions: mean('actions'),
  };
}

// A bounded, credential-free trace for failed staging runs. It records only
// observable gameplay state, never credentials, fetch bodies, or token values.
export function playtestFailureEpisode({ profile, seed, viewport, lastObserved = null,
  trace = [], error = '' }) {
  const attempts = Array.isArray(trace) ? trace : [];
  const recent = attempts.slice(-24).map(entry => ({
    action: String(entry.action ?? '').slice(0, 40),
    turns: Number.isFinite(entry.turns) ? entry.turns : null,
    partyHp: Number.isFinite(entry.partyHp) ? entry.partyHp : null,
    initiative: entry.initiative === true,
    phase: entry.phase ?? null,
    elapsedMs: Number.isFinite(entry.elapsedMs) ? entry.elapsedMs : null,
  }));
  return {
    profile, seed, viewport,
    mapId: lastObserved?.mapId ?? null,
    outcome: 'error',
    warnings: ['bot-execution-failed'],
    // Null denotes unmeasured, not a pristine 0-damage encounter.
    hpLost: null, actions: null,
    attemptedInputs: attempts.length,
    retainedTraceLength: recent.length,
    lastTurn: lastObserved?.turns ?? null,
    lastPhase: lastObserved?.phase ?? null,
    lastPartyHp: lastObserved?.partyHp ?? null,
    trace: recent,
    error: String(error).slice(0, 480),
  };
}

/**
 * Verify both server snapshots after a real UI save + F5.
 * A loss in combat must not allow the bot to skip this persistence gate.
 * The authoritative server, not a mock or client-only state, supplies both.
 */
export function verifyPlaytestCheckpoint({ runId, mapId, turns, saved, restored }) {
  for (const [stage, payload] of [['saved', saved], ['restored', restored]]) {
    if (payload?.runId !== runId) throw new Error('BOT_CHECKPOINT_' + stage + '_RUN_MISMATCH');
    if (payload?.currentMapId !== mapId) throw new Error('BOT_CHECKPOINT_' + stage + '_MAP_MISMATCH');
    if (payload?.worldFlags?.['__chrRuntime.turns'] !== turns) {
      throw new Error('BOT_CHECKPOINT_' + stage + '_TURNS_MISMATCH');
    }
  }
  const enemyHp = Number(saved.worldFlags?.enemyHp);
  if (!Number.isInteger(enemyHp) || enemyHp < 0) {
    throw new Error('BOT_CHECKPOINT_INVALID_ENEMY_HP');
  }
  if (Number(restored.worldFlags?.enemyHp) !== enemyHp) {
    throw new Error('BOT_CHECKPOINT_ENEMY_HP_MISMATCH');
  }
  return { enemyHp };
}
