import React from 'react';

// A single visible status per resource: the fraction sits on the actual fill bar.
function fraction(value, maximum) {
  const current = Number(value);
  const cap = Number(maximum);
  return Number.isFinite(current) && Number.isFinite(cap) && cap > 0
    ? Math.max(0, Math.min(1, current / cap))
    : 0;
}

export default function ChroniclesPartyVitals({ hp, maxHp, sp = 0, maxSp = 0, band }) {
  return (
    <span className="chronicles-party-bars" aria-hidden="true" data-band={band}>
      <i className="is-hp" style={{ '--fill': fraction(hp, maxHp) }}>
        <span>PV {hp}/{maxHp}</span>
      </i>
      {maxSp > 0 && (
        <i className="is-sp" style={{ '--fill': fraction(sp, maxSp) }} data-member-sp={sp}>
          <span>PH {sp}/{maxSp}</span>
        </i>
      )}
    </span>
  );
}
