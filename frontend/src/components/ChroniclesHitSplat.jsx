import { chroniclesSplatScale } from '../chronicles/chroniclesHitSplats.js';
import './ChroniclesHitSplat.css';

// A drop of blood with the damage on it. The parent keys it by a token so
// each blow replays the animation.
export default function ChroniclesHitSplat({ impact, className = '', style = null }) {
  if (!impact) return null;
  return (
    <span
      className={`chronicles-hit-splat ${className}`.trim()}
      style={{ '--splat-scale': chroniclesSplatScale(impact), ...style }}
      data-chronicles-hit-splat={impact.kind}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" focusable="false">
        <path d="M32 3 C 25 18, 9 30, 9 42 a 23 21 0 0 0 46 0 C 55 30, 39 18, 32 3 Z" />
        <circle cx="12" cy="18" r="3.4" />
        <circle cx="53" cy="22" r="2.6" />
        <circle cx="57" cy="52" r="2.2" />
        <circle cx="7" cy="55" r="1.8" />
      </svg>
      <b>{impact.amount}</b>
    </span>
  );
}
