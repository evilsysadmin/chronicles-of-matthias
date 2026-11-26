import { chroniclesCurrentInitiativeActor } from '../chronicles/chroniclesInitiative.js';

function actorLabel(actor) {
  if (!actor) return '';
  return actor.name || actor.id || 'Combatiente';
}

export default function ChroniclesInitiativeRail({ initiative }) {
  const order = Array.isArray(initiative?.order) ? initiative.order : [];
  if (!order.length) return null;

  const active = chroniclesCurrentInitiativeActor(initiative);
  // Use the same validated cursor as the combat controller, including
  // restored legacy checkpoints. Never announce one actor and highlight another.
  const activeIndex = order.indexOf(active);
  if (activeIndex < 0) return null;
  const roundValue = Number(initiative?.round || 1);
  const round = Number.isSafeInteger(roundValue) && roundValue > 0 ? roundValue : 1;
  const visible = Array.from({ length: Math.min(order.length, 5) }, (_, offset) => {
    const index = activeIndex + offset;
    return { actor: order[index % order.length], nextRound: index >= order.length,
      roundStart: index === order.length };
  });

  return (
    <section
      className={`chronicles-initiative-rail ${active?.kind === 'enemy' ? 'is-enemy-turn' : 'is-party-turn'}`}
      data-chronicles-initiative="visible"
      data-active-actor={active?.id || ''}
      role="status"
      aria-live="polite"
      aria-label={`Ronda ${round}. Turno de ${actorLabel(active)}`}
    >
      <div className="chronicles-initiative-rail__heading">
        <span>RONDA {round}</span>
        <strong>{active?.kind === 'enemy' ? 'TURNO ENEMIGO' : 'TU TURNO'}</strong>
      </div>
      <ol aria-label="Orden de iniciativa">
        {visible.map(({ actor, nextRound, roundStart }, index) => (
          <li
            key={`${actor.kind}:${actor.id}`}
            className={`${index === 0 ? 'is-active' : ''} ${actor.kind === 'enemy' ? 'is-enemy' : 'is-party'}${roundStart ? ' is-round-start' : ''}`}
            aria-current={index === 0 ? 'step' : undefined}
            aria-label={`${index === 0 ? 'Ahora' : `Después, posición ${index + 1}`}: ${actorLabel(actor)} · iniciativa ${actor.initiative}${nextRound ? ` · ronda ${round + 1}` : ''}`}
            title={nextRound ? `${actorLabel(actor)} · ronda ${round + 1}` : actorLabel(actor)}
          >
            <span aria-hidden="true">{index === 0 ? 'AHORA' : `+${index}`}</span>
            <b>{roundStart && <em className="chronicles-initiative-rail__round-marker" aria-hidden="true">R+1 </em>}{actorLabel(actor)}</b>
            <small>{actor.initiative}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
