// Camera-local flight samples, independent of FPS and free of randomness.
// Shooter stagger stays subtle but lets the player read separate projectiles.
export const CHRONICLES_VOLLEY_MAX_DURATION = 0.78;

export function chroniclesVolleyFlightSample(count, index, elapsed, kind = 'bow') {
  const total = Math.max(0, Math.min(6, Math.floor(Number(count) || 0)));
  if (!Number.isInteger(index) || index < 0 || index >= total || !Number.isFinite(elapsed)) return null;
  const delay = index * 0.034;
  const duration = kind === 'sling' ? 0.57 : kind === 'crossbow' ? 0.43 : 0.49;
  const localTime = elapsed - delay;
  if (localTime < 0 || localTime > duration) return null;
  const t = Math.max(0, Math.min(1, localTime / duration));
  const forward = Math.pow(t, 0.88);
  const spread = (index - (total - 1) / 2) * 0.38;
  const sling = kind === 'sling';
  return {
    x: spread * (1 - 0.64 * forward),
    y: -0.33 + 0.24 * forward + (sling ? 0.16 * Math.sin(Math.PI * t) : -0.025 * t * t),
    z: -0.72 - 4.05 * forward,
    pitch: sling ? -0.16 + 0.27 * t : -0.025 - 0.09 * t,
    yaw: -spread * 0.09,
    roll: sling ? Math.PI * 2.2 * t : spread * 0.085,
    scale: 1 - 0.20 * t,
  };
}
