import {
  CHRONICLES_DIRECTIONS, chroniclesActiveEnemies, chroniclesEnemyTargetAhead,
  chroniclesCombatMeleeTarget, chroniclesCombatMissileTarget,
  chroniclesAttackMode, chroniclesPartyAttackStats, chroniclesMM3TurnActionReady,
} from '../chroniclesOfMatthias.js';
import { chroniclesCurrentInitiativeActor } from '../chronicles/chroniclesInitiative.js';
import { chroniclesEnemyAttackTarget, chroniclesRuntimeEnemyPosition, chroniclesEnemyParalysedTurns } from '../chroniclesOfMatthiasTurns.js';

// A directional warning is earned only by a living, engaged opponent that
// can actually attack the party from its current valid map cell (respecting
// reach and the engine's line-of-sight test). Never reveal idle map enemies.
export function chroniclesThreatBearing(state, enemy) {
  if (state?.combatRules !== 'mm3' || !state?.initiative
    || !state.initiative.order?.some(actor => actor.kind === 'enemy' && actor.id === enemy?.id)
    || !(Number(state?.[enemy?.hpKey]) > 0)
    || chroniclesEnemyParalysedTurns(state, enemy) > 0) return null;
  const facing = CHRONICLES_DIRECTIONS[state.direction];
  const position = chroniclesRuntimeEnemyPosition(state, enemy);
  if (!facing || !Number.isSafeInteger(position?.x) || !Number.isSafeInteger(position?.y)
    || !Number.isSafeInteger(state.x) || !Number.isSafeInteger(state.y)
    || !chroniclesEnemyAttackTarget(state, enemy, position)) return null;
  const dx = position.x - state.x;
  const dy = position.y - state.y;
  const ahead = facing.dx * dx + facing.dy * dy;
  if (ahead < 0) return 'rear';
  if (ahead === 0 && (dx || dy)) return 'flank';
  return null;
}

export function chroniclesHealthBand(hp, maxHp) {
  const total = Number(maxHp);
  const current = Number(hp);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current) || current <= 0) return 'critical';
  if (current >= total) return 'healthy';
  if (current > total / 2) return 'hurt';
  return 'critical';
}

const BEARING_LABEL = {
  rear: { short: 'ESPALDA', full: 'Amenaza capaz de atacar desde atrás' },
  flank: { short: 'FLANCO', full: 'Amenaza capaz de atacar desde un flanco' },
};

function ThreatCue({ bearing }) {
  const label = BEARING_LABEL[bearing];
  return label ? (
    <small className="chronicles-combat-roster__bearing" data-threat-cue={bearing}
      role="note" aria-label={label.full}>⚠ {label.short}</small>
  ) : null;
}

// Reflect the active hero's actual A/S target, never merely a front-facing
// bystander. Side/rear engaged enemies can be attacked without rotating.
export function chroniclesRosterActionTargets(state) {
  if (state?.combatRules !== 'mm3' || !state?.initiative) return [];
  const actor = chroniclesCurrentInitiativeActor(state.initiative);
  if (!chroniclesMM3TurnActionReady(state, actor?.id)) return [];
  const melee = chroniclesCombatMeleeTarget(state);
  const reach = chroniclesPartyAttackStats(state, actor.id, 'missile').reach;
  // A hero without a ranged weapon has reach zero. Do not query the
  // targeting fallback or announce a shot for an unarmed missile slot.
  const missile = reach > 0 ? chroniclesCombatMissileTarget(state, reach) : null;
  return [
    ...(melee ? [{ id: melee.enemy.id, mode: 'melee' }] : []),
    ...(missile ? [{ id: missile.enemy.id, mode: 'missile' }] : []),
  ];
}

export function chroniclesRosterActionTarget(state) {
  const targets = chroniclesRosterActionTargets(state);
  if (!targets.length) return null;
  const actor = chroniclesCurrentInitiativeActor(state.initiative);
  return targets.find(target => target.mode === chroniclesAttackMode(state, actor.id)) || null;
}

function EnemyList({ foes, state, targetId, actionTargets, bearingById }) {
  return (
    <ol aria-label="Enemigos en combate">
      {foes.map((enemy) => {
        const hp = Number(state[enemy.hpKey] || 0);
        const bearing = bearingById.get(enemy.id);
        const held = chroniclesEnemyParalysedTurns(state, enemy);
        const status = held > 0 ? `Paralizado: ${held} ${held === 1 ? 'acción enemiga pendiente' : 'acciones enemigas pendientes'} sin actuar` : '';
        // Authored strike budget, not a prediction of rolls or damage.
        const strikes = Array.isArray(enemy.attacks) ? enemy.attacks.slice(0, 3) : [];
        const multi = strikes.length > 1 ? `Hasta ${strikes.length} golpes por acción: ${strikes.join(' · ')}` : '';
        const modes = actionTargets.filter(target => target.id === enemy.id).map(target => target.mode);
        return (
          <li key={enemy.id}
            data-band={chroniclesHealthBand(hp, enemy.maxHp)}
            data-target={enemy.id === targetId ? 'true' : undefined}
            data-threat-bearing={bearing || undefined}
            title={`${enemy.name}: ${hp}/${enemy.maxHp} PV${bearing ? ` · ${BEARING_LABEL[bearing].full}` : ''}${multi ? ` · ${multi}` : ''}${status ? ` · ${status}` : ''}`}>
            {enemy.name}
            <ThreatCue bearing={bearing} />
            {status && <small className="chronicles-combat-roster__bearing"
              data-chronicles-paralyzed={held} role="note" aria-label={status} title={status}>
              PARALIZADO · {held}
            </small>}
            {multi && <small className="chronicles-combat-roster__bearing"
              data-chronicles-multiattack={strikes.length} role="note" aria-label={multi} title={multi}>
              ×{strikes.length} GOLPES
            </small>}
            {modes.map(mode => <small key={mode} className="chronicles-combat-roster__bearing"
              data-chronicles-target-mode={mode} role="note">
              {mode === 'melee' ? '⚔ A · AL ALCANCE' : '➶ S · A TIRO'}
            </small>)}
          </li>
        );
      })}
    </ol>
  );
}

export default function ChroniclesCombatRoster({ state }) {
  if (!state?.initiative) return null;
  const engaged = new Set((state.initiative.order || [])
    .filter(actor => actor?.kind === 'enemy').map(actor => actor.id));
  const foes = chroniclesActiveEnemies(state)
    .filter(enemy => Number(state[enemy.hpKey] || 0) > 0
      && engaged.has(enemy.id));
  if (!foes.length) return null;

  const actionTargets = chroniclesRosterActionTargets(state);
  const actionTarget = actionTargets[0];
  const targetId = state.combatRules === 'mm3' ? actionTarget?.id
    : chroniclesEnemyTargetAhead(state, 3)?.enemy?.id;
  const count = `Combate · ${foes.length} ${foes.length === 1 ? 'enemigo' : 'enemigos'}`;
  const bearingById = new Map(foes.map(enemy => [enemy.id, chroniclesThreatBearing(state, enemy)]));
  // Prioritize a rear attacker if threats arrive from multiple directions.
  const warning = [...bearingById.values()].includes('rear') ? 'rear'
    : [...bearingById.values()].includes('flank') ? 'flank' : null;

  return (
    <section className="chronicles-combat-roster" aria-label="Combate">
      <div className="chronicles-combat-roster__desktop">
        <header className="chronicles-combat-roster__desktop-header">
          <strong>{count}</strong>
          <ThreatCue bearing={warning} />
        </header>
        <EnemyList foes={foes} state={state} targetId={targetId} actionTargets={actionTargets} bearingById={bearingById} />
      </div>
      <details className="chronicles-combat-roster__compact">
        <summary>
          <span className="chronicles-combat-roster__heading">
            {count}
            <ThreatCue bearing={warning} />
          </span>
          <span className="chronicles-combat-roster__chevron" aria-hidden="true">▾</span>
        </summary>
        <EnemyList foes={foes} state={state} targetId={targetId} actionTargets={actionTargets} bearingById={bearingById} />
      </details>
    </section>
  );
}
