import React from 'react';
import './ChroniclesPartyVitals.css';

// The visual fill is bounded; tooltips and the character sheet retain exact values.
function fraction(value, maximum) {
  const current = Number(value);
  const cap = Number(maximum);
  return Number.isFinite(current) && Number.isFinite(cap) && cap > 0
    ? Math.max(0, Math.min(1, current / cap))
    : 0;
}

export default function ChroniclesPartyVitals({ hp, maxHp, sp = 0, maxSp = 0, band }) {
  const hpLabel = `PV ${hp}/${maxHp}`;
  const spLabel = `PH ${sp}/${maxSp}`;
  const hasMagic = maxSp > 0;
  const summary = hasMagic ? `${hpLabel} · ${spLabel}` : hpLabel;

  return (
    <span className="chronicles-party-bars" data-band={band}
      role="group" aria-label={summary} title={summary}>
      <i className="is-hp" style={{ '--fill': fraction(hp, maxHp) }}
        title={hpLabel} aria-hidden="true">
        <span className="chronicles-vital-fill" />
      </i>
      {hasMagic && (
        <i className="is-sp" style={{ '--fill': fraction(sp, maxSp) }}
          data-member-sp={sp} title={spLabel} aria-hidden="true">
          <span className="chronicles-vital-fill" />
        </i>
      )}
    </span>
  );
}
