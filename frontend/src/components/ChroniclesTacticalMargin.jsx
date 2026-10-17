import './ChroniclesTacticalMargin.css';

const TARGET_GLYPHS = Object.freeze({
  'corrupted-pawn': '♟',
  'gate-jailer': '♜',
  'spectral-bishop': '♝',
  'scavenger-knight': '♞',
});

// In turn-based combat nobody answers a blow: each creature strikes on its
// own turn, so the note shows how hard it hits (an MM3 swing is never below
// one point). Exploring, a blow in reach still draws a retaliation.
export function chroniclesRetaliationLabel(target, { combat = false } = {}) {
  if (combat) return `GOLPEA · ${Math.max(1, Number(target?.retaliation) || 0)} PV`;
  if (!target?.willRetaliate) return 'SIN REPRESALIA';
  const damage = Math.max(0, Number(target.retaliation) || 0);
  return `REPRESALIA · ${damage} PV`;
}

export default function ChroniclesTacticalMargin({ target, combat = false }) {
  if (!target) return null;
  const distanceLabel = target.distance === 1 ? '1 casilla' : `${target.distance} casillas`;

  return (
    <div className="chronicles-target-margin" aria-live="polite" data-chronicles-target={target.id}>
      <span className="chronicles-target-glyph" aria-hidden="true">{TARGET_GLYPHS[target.id] || '◆'}</span>
      <span className="chronicles-target-copy">
        <small>ANOTACIÓN TÁCTICA · {distanceLabel}</small>
        <strong>{target.name}</strong>
      </span>
      <span className="chronicles-target-hp"><small>VIDA</small><b>{target.hp}/{target.maxHp}</b></span>
      <em className={combat || target.willRetaliate ? 'is-danger' : 'is-safe'}>
        {chroniclesRetaliationLabel(target, { combat })}
      </em>
    </div>
  );
}
