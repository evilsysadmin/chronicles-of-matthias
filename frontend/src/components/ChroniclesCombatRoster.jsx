import { CHRONICLES_DIRECTIONS, chroniclesActiveEnemies, chroniclesEnemyTargetAhead } from '../chroniclesOfMatthias.js';
import { chroniclesEnemyAttackTarget, chroniclesRuntimeEnemyPosition } from '../chroniclesOfMatthiasTurns.js';

// A directional warning is earned only by a living, engaged opponent that
// can actually attack the party from its current valid map cell (respecting
// reach and the engine's line-of-sight test). Never reveal idle map enemies.
export function chroniclesThreatBearing(state, enemy) {
  if (state?.combatRules !== 'mm3' || !state?.initiative
    || !state.initiative.order?.some(actor => actor.kind === 'enemy' && actor.id === enemy?.id)
    || !(Number(state?.[enemy?.hpKey]) > 0)) return null;
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

function EnemyList({ foes, state, targetId, bearingById }) {
  return (
    <ol aria-label="Enemigos en combate">
      {foes.map((enemy) => {
        const hp = Number(state[enemy.hpKey] || 0);
        const bearing = bearingById.get(enemy.id);
        return (
          <li key={enemy.id}
            data-band={chroniclesHealthBand(hp, enemy.maxHp)}
            data-target={enemy.id === targetId ? 'true' : undefined}
            data-threat-bearing={bearing || undefined}
            title={`${enemy.name}: ${hp}/${enemy.maxHp} PV${bearing ? ` · ${BEARING_LABEL[bearing].full}` : ''}`}>
            {enemy.name}
            <ThreatCue bearing={bearing} />
          </li>
        );
      })}
    </ol>
  );
}

export default function ChroniclesCombatRoster({ state }) {
  if (!state?.initiative) return null;
  const engaged = new Set((state.initiative.order || [])
    .filter(actor => actor.kind === 'enemy').map(actor => actor.id));
  const foes = chroniclesActiveEnemies(state)
    .filter(enemy => Number(state[enemy.hpKey] || 0) > 0
      && (!engaged.size || engaged.has(enemy.id)));
  if (!foes.length) return null;

  const targetId = chroniclesEnemyTargetAhead(state, 3)?.enemy?.id;
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
        <EnemyList foes={foes} state={state} targetId={targetId} bearingById={bearingById} />
      </div>
      <details className="chronicles-combat-roster__compact">
        <summary>
          <span className="chronicles-combat-roster__heading">
            {count}
            <ThreatCue bearing={warning} />
          </span>
          <span className="chronicles-combat-roster__chevron" aria-hidden="true">▾</span>
        </summary>
        <EnemyList foes={foes} state={state} targetId={targetId} bearingById={bearingById} />
      </details>
    </section>
  );
}
