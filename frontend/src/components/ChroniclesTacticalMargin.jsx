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

// Explain why A seems inert when a sprite fills the corridor but the hero
// still stands two or three grid cells away. Never claim missile reach when
// the hero is carrying no ranged weapon.
export function chroniclesTargetReachLabel(target, { meleeReach = 1, missileReach = 0 } = {}) {
  if (!target || target.distance <= meleeReach) return null;
  if (missileReach >= target.distance) return 'A: FUERA DE ALCANCE · S: A TIRO';
  return 'FUERA DE ALCANCE · ACÉRCATE PARA ATACAR';
}

export default function ChroniclesTacticalMargin({ target, combat = false, meleeReach = 1, missileReach = 0 }) {
  if (!target) return null;
  const distanceLabel = target.distance === 1 ? '1 casilla' : `${target.distance} casillas`;
  const rangeHint = chroniclesTargetReachLabel(target, { meleeReach, missileReach });

  return (
    <div className="chronicles-target-margin" aria-live="polite" data-chronicles-target={target.id}>
      <span className="chronicles-target-glyph" aria-hidden="true">{TARGET_GLYPHS[target.id] || '◆'}</span>
      <span className="chronicles-target-copy">
        <small>ANOTACIÓN TÁCTICA · {distanceLabel}</small>
        <strong>{target.name}</strong>
      </span>
      <span className="chronicles-target-hp"><small>VIDA</small><b>{target.hp}/{target.maxHp}</b></span>
      <em className={rangeHint ? 'is-danger' : combat || target.willRetaliate ? 'is-danger' : 'is-safe'}>
        {rangeHint || chroniclesRetaliationLabel(target, { combat })}
      </em>
    </div>
  );
}
