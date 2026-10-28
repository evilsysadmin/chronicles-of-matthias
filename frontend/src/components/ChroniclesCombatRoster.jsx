import { chroniclesActiveEnemies, chroniclesEnemyTargetAhead } from '../chroniclesOfMatthias.js';

// Desktop combat replaces the minimap with this roster, permanently expanded.
// Mobile and short landscape keep the existing compact disclosure.
export function chroniclesHealthBand(hp, maxHp) {
  const total = Number(maxHp);
  const current = Number(hp);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(current) || current <= 0) return 'critical';
  // An undamaged foe is green; injured foes are yellow until half health,
  // then red. Never label a damaged enemy "healthy".
  if (current >= total) return 'healthy';
  if (current > total / 2) return 'hurt';
  return 'critical';
}

function EnemyList({ foes, state, targetId }) {
  return (
    <ol aria-label="Enemigos en combate">
      {foes.map((enemy) => {
        const hp = Number(state[enemy.hpKey] || 0);
        return (
          <li key={enemy.id}
            data-band={chroniclesHealthBand(hp, enemy.maxHp)}
            data-target={enemy.id === targetId ? 'true' : undefined}
            title={`${enemy.name}: ${hp}/${enemy.maxHp} PV`}>
            {enemy.name}
          </li>
        );
      })}
    </ol>
  );
}

export default function ChroniclesCombatRoster({ state }) {
  if (!state?.initiative) return null;
  // The initiative order is authoritative; unrelated enemies stay hidden.
  const engaged = new Set((state.initiative.order || [])
    .filter(actor => actor.kind === 'enemy').map(actor => actor.id));
  const foes = chroniclesActiveEnemies(state)
    .filter(enemy => Number(state[enemy.hpKey] || 0) > 0
      && (!engaged.size || engaged.has(enemy.id)));
  if (!foes.length) return null;

  const targetId = chroniclesEnemyTargetAhead(state, 3)?.enemy?.id;
  const count = `Combate · ${foes.length} ${foes.length === 1 ? 'enemigo' : 'enemigos'}`;

  return (
    <section className="chronicles-combat-roster" aria-label="Combate">
      <div className="chronicles-combat-roster__desktop">
        <header className="chronicles-combat-roster__desktop-header">
          <strong>{count}</strong>
        </header>
        <EnemyList foes={foes} state={state} targetId={targetId} />
      </div>
      <details className="chronicles-combat-roster__compact">
        <summary>
          <span className="chronicles-combat-roster__heading">{count}</span>
          <span className="chronicles-combat-roster__chevron" aria-hidden="true">▾</span>
        </summary>
        <EnemyList foes={foes} state={state} targetId={targetId} />
      </details>
    </section>
  );
}
