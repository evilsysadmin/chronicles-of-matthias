import { chroniclesActiveEnemies, chroniclesEnemyTargetAhead } from '../chroniclesOfMatthias.js';

// Desktop combat replaces the minimap with this roster, permanently expanded.
// Mobile and short landscape keep the existing compact disclosure.
export function chroniclesHealthBand(hp, maxHp) {
  const ratio = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  if (ratio > 0.5) return 'healthy';
  if (ratio > 0.25) return 'hurt';
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
  const target = foes.find(enemy => enemy.id === targetId);
  const count = `Combate · ${foes.length} ${foes.length === 1 ? 'enemigo' : 'enemigos'}`;
  const objective = target ? `Objetivo: ${target.name}` : 'Sin objetivo frontal';

  return (
    <section className="chronicles-combat-roster" aria-label="Combate">
      <div className="chronicles-combat-roster__desktop">
        <header className="chronicles-combat-roster__desktop-header">
          <strong>{count}</strong>
          <small title={target?.name || 'Ningún enemigo delante'}>{objective}</small>
        </header>
        <EnemyList foes={foes} state={state} targetId={targetId} />
      </div>
      <details className="chronicles-combat-roster__compact">
        <summary>
          <span className="chronicles-combat-roster__heading">{count}</span>
          <span className="chronicles-combat-roster__target"
            title={target?.name || 'Ningún enemigo delante'}>{objective}</span>
          <span className="chronicles-combat-roster__chevron" aria-hidden="true">▾</span>
        </summary>
        <EnemyList foes={foes} state={state} targetId={targetId} />
      </details>
    </section>
  );
}
