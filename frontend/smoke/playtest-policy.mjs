// Reproducible, bounded Playwright player. Input comes from visible game DOM,
// never hidden React state, Mongo internals, combat RNG, or authored FEN/map.
export const PLAYTEST_PROFILES = Object.freeze(['aggressive', 'cautious']);
export const PLAYTEST_MAX_COMBAT_ACTIONS = 32;
export const PLAYTEST_MAX_EXPLORATION_ACTIONS = 24;

// Fresh first-person Chronicles expeditions start in Swordhaven. The old
// eight-square crypt remains legacy content, never the public campaign entry.
export const PLAYTEST_CAMPAIGN_ENTRY_MAP_ID = 'swordhaven-first-book';

// Canonical first-hour story beat: reach the sealed letter from Swordhaven's
// authored (9,7), north-facing spawn, then use the real F/touch control.
// Positions below are observed and asserted, not teleports or engine writes.
export const PLAYTEST_OPENING_ROUTE = Object.freeze([
  Object.freeze({ action: 'ArrowUp', x: 9, y: 6 }),
  Object.freeze({ action: 'ArrowUp', x: 9, y: 5 }),
  Object.freeze({ action: 'ArrowLeft', x: 9, y: 5 }),
  Object.freeze({ action: 'ArrowUp', x: 8, y: 5 }),
]);
export const PLAYTEST_OPENING_FLAG = 'commission-received';

// Turns alone do not prove travel: turning on the spot also advances the
// counter. Publicly rendered grid coordinates let browser tests distinguish
// accepted movement, rotation and a colliding wall without React internals.
export function playtestTileKey(observed) {
  if (!Number.isInteger(observed?.x) || !Number.isInteger(observed?.y)) return null;
  return observed.x + ',' + observed.y;
}
export function playtestMovedBetweenTiles(before, after) {
  const from = playtestTileKey(before);
  const to = playtestTileKey(after);
  if (from === null || to === null) throw new Error('BOT_MISSING_VISIBLE_PARTY_TILE');
  if (before.mapId !== after.mapId) throw new Error('BOT_UNEXPECTED_MAP_TRANSITION');
  const distance = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
  if (distance > 1) throw new Error('BOT_NONLOCAL_EXPLORATION_MOVEMENT');
  return distance === 1;
}

// The cautious profile must exercise an actual small landscape phone.
// A portrait-only viewport triggers the game's rotate guard, while testing
// a narrow width in landscape without emulating touch tests a desktop.
export const PLAYTEST_VIEWPORTS = Object.freeze({
  aggressive: Object.freeze({ width: 1280, height: 800, touch: false }),
  cautious: Object.freeze({ width: 844, height: 390, touch: true }),
});
export function playtestViewport(profile) {
  if (!PLAYTEST_PROFILES.includes(profile)) throw new Error('Unknown playtest profile');
  return PLAYTEST_VIEWPORTS[profile];
}

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
  // Swordhaven starts in a peaceful town square, not within shooting range
  // of the old crypt pawn. Walking first exercises the genuine opening.
  if (blocked >= 2) return 'ArrowRight'; // recover from a wall, never spin forever
  return 'ArrowUp';
}

export function playtestOutcome({ observed, enemyHp, combatEntered,
  explorationActions, combatActions, startHp, endHp,
  meleeOpportunities = null, rejectedCombatMoves = 0, scenario = 'combat' }) {
  const actions = explorationActions + combatActions;
  const hpLost = Math.max(0, startHp - endHp);
  const outcome = observed.phase === 'defeated' || endHp <= 0 ? 'defeat'
    : enemyHp === 0 ? 'victory'
      : !combatEntered ? (scenario === 'campaign-start' ? 'exploration' : 'no-contact')
        : 'unfinished';
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

/**
 * The public staging journey must begin in the canonical Swordhaven campaign,
 * restore an authoritative checkpoint and actually advance exploration.
 * Combat is optional here: the town enemy is not next to the spawn point.
 * A different combat-specific scenario may require contact separately.
 */
export function playtestAcceptance(episodes) {
  const reasons = [];
  if (!Array.isArray(episodes)) {
    return { passed: false, reasons: ['missing-episodes'] };
  }
  for (const profile of PLAYTEST_PROFILES) {
    const matching = episodes.filter(episode => episode?.profile === profile);
    if (matching.length !== 1) {
      reasons.push(matching.length ? 'duplicate-profile:' + profile : 'missing-profile:' + profile);
      continue;
    }
    const episode = matching[0];
    if (episode.outcome === 'error') {
      reasons.push('bot-execution-failed:' + profile);
      continue;
    }
    if (episode.mapId !== PLAYTEST_CAMPAIGN_ENTRY_MAP_ID) {
      reasons.push('wrong-campaign-entry:' + profile);
    }
    if (episode.saved !== true || episode.restored !== true
      || episode.preCombatSaved !== true || episode.preCombatRestored !== true) {
      reasons.push('checkpoint-not-verified:' + profile);
    }
    // Rotation increments turns too. Require actual, distinct traversed
    // tiles rather than a bot endlessly spinning beside a wall.
    if (episode.combatEntered !== true
      && !(Number.isInteger(episode.explorationMoves)
        && episode.explorationMoves >= 2
        && Number.isInteger(episode.distinctExplorationTiles)
        && episode.distinctExplorationTiles >= 3)) {
      reasons.push('no-exploration-progress:' + profile);
    }
    if (episode.combatEntered !== true && episode.outcome !== 'exploration') {
      reasons.push('invalid-campaign-opening-outcome:' + profile);
    }
    if (episode.combatEntered !== true
      && (episode.postCombatSaved !== true || episode.postCombatRestored !== true)) {
      reasons.push('post-exploration-checkpoint-missing:' + profile);
    }
  }
  for (const episode of episodes) {
    if (!PLAYTEST_PROFILES.includes(episode?.profile)) reasons.push('unexpected-profile');
  }
  return { passed: reasons.length === 0, reasons };
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
    explorationEpisodes: measured.filter(episode => episode.outcome === 'exploration').length,
    unresolved: measured.filter(episode => !['victory', 'defeat', 'exploration'].includes(episode.outcome)).length,
    averageHpLost: mean('hpLost'),
    averageActions: mean('actions'),
  };
}

// A bounded, credential-free trace for failed staging runs. It records only
// observable gameplay state, never credentials, fetch bodies, or token values.
export function playtestFailureEpisode({ profile, seed, viewport, viewportHeight = null,
  inputMode = null, lastObserved = null, trace = [], error = '' }) {
  const attempts = Array.isArray(trace) ? trace : [];
  const recent = attempts.slice(-24).map(entry => ({
    action: String(entry.action ?? '').slice(0, 40),
    turns: Number.isFinite(entry.turns) ? entry.turns : null,
    partyHp: Number.isFinite(entry.partyHp) ? entry.partyHp : null,
    x: Number.isInteger(entry.x) ? entry.x : null,
    y: Number.isInteger(entry.y) ? entry.y : null,
    initiative: entry.initiative === true,
    phase: entry.phase ?? null,
    elapsedMs: Number.isFinite(entry.elapsedMs) ? entry.elapsedMs : null,
  }));
  return {
    profile, seed, viewport, viewportHeight, inputMode,
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
  // The crypt fixture has a single enemyHp flag; Swordhaven uses individual
  // named HP flags instead. Preserve every present monster HP value across
  // reload without inventing a crypt enemy in the town.
  const savedFlags = saved.worldFlags || {};
  const restoredFlags = restored.worldFlags || {};
  const hpKeys = [...new Set([
    ...Object.keys(savedFlags), ...Object.keys(restoredFlags),
  ].filter(key => key === 'enemyHp' || /Hp$/.test(key)))];
  if (mapId !== PLAYTEST_CAMPAIGN_ENTRY_MAP_ID && !hpKeys.includes('enemyHp')) {
    throw new Error('BOT_CHECKPOINT_INVALID_ENEMY_HP');
  }
  for (const key of hpKeys) {
    const hp = savedFlags[key];
    if (!Number.isInteger(hp) || hp < 0) {
      throw new Error('BOT_CHECKPOINT_INVALID_ENEMY_HP');
    }
    if (restoredFlags[key] !== hp) {
      throw new Error('BOT_CHECKPOINT_ENEMY_HP_MISMATCH');
    }
  }
  const enemyHp = hpKeys.includes('enemyHp') ? savedFlags.enemyHp : null;
  return { enemyHp };
}
