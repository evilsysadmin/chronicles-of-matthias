// Camera-local flight samples, independent of FPS and free of randomness.
// Shooter stagger stays subtle but lets the player read separate projectiles.
export const CHRONICLES_VOLLEY_MAX_DURATION = 0.78;

// Leading visual extent measured from the camera-space projectile root:
// bow cone is 0.425 + 0.07 m ahead, crossbow 0.268 + 0.08 m, and sling
// stone ~0.12 m. Include a slight raster/pitch tolerance, then apply the
// sampled scale. Collision concerns the leading tip, not the root centre.
export const CHRONICLES_VOLLEY_NOSE_REACH = Object.freeze({
  bow: 0.52,
  crossbow: 0.37,
  sling: 0.14,
});

// The authored grid is also the 3D town's collision mask: '#' is a real
// solid house, facade, wall, tree or dungeon block. Shoot from the centre of
// the party's tile toward its facing wall and stop just before its near face.
// A 4 m tile starts 2 m ahead. Inset by 8 cm for flat dungeon walls,
// or more for three-dimensional shop doors and projecting settlement facades.
// Volley sprites are mounted in camera-local space to give each real shooter
// a readable first-person shot. A later turn/move must not rotate or drag
// those already-launched sprites through nearby solid walls.
export function chroniclesVolleyMatchesLaunchPose(launchPose, state) {
  if (!launchPose || !state) return false;
  return Number.isInteger(launchPose.x) && Number.isInteger(launchPose.y)
    && Number.isInteger(launchPose.direction)
    && state.x === launchPose.x && state.y === launchPose.y
    && state.direction === launchPose.direction;
}

export function chroniclesVolleyObstacleDistance(grid, origin, facing, cellSize = 4, facadeInset = 0.08) {
  if (!Array.isArray(grid) || !Number.isInteger(origin?.x) || !Number.isInteger(origin?.y)
    || !Number.isInteger(facing?.dx) || !Number.isInteger(facing?.dy)
    || Math.abs(facing.dx) + Math.abs(facing.dy) !== 1
    || !Number.isFinite(cellSize) || cellSize <= 0) return Infinity;
  const clearance = Number.isFinite(facadeInset) && facadeInset >= 0
    ? Math.min(facadeInset, cellSize / 2)
    : 0.08;
  for (let distance = 1; distance <= 4; distance += 1) {
    const x = origin.x + facing.dx * distance;
    const y = origin.y + facing.dy * distance;
    const tile = grid[y]?.[x];
    if (tile === '#' || tile === undefined) {
      return Math.max(0, (distance - 0.5) * cellSize - clearance);
    }
  }
  return Infinity;
}

// The flight is sampled in camera-local space. The same shot is never moved
// through a solid building facade after it reaches the front of that wall.
// Null means the pooled arrow is hidden, not that a hit/damage was created.
export function chroniclesVolleyVisibleFlight(count, index, elapsed, kind = 'bow', stopDistance = Infinity) {
  const flight = chroniclesVolleyFlightSample(count, index, elapsed, kind);
  if (!flight) return null;
  const noseReach = CHRONICLES_VOLLEY_NOSE_REACH[kind] ?? CHRONICLES_VOLLEY_NOSE_REACH.bow;
  const leadingDistance = -flight.z + noseReach * flight.scale;
  return Number.isFinite(stopDistance) && leadingDistance >= stopDistance ? null : flight;
}

export function chroniclesVolleyFlightSample(count, index, elapsed, kind = 'bow') {
  const total = Math.max(0, Math.min(6, Math.floor(Number(count) || 0)));
  if (!Number.isInteger(index) || index < 0 || index >= total || !Number.isFinite(elapsed)) return null;
  const delay = index * 0.034;
  const duration = kind === 'sling' ? 0.57 : kind === 'crossbow' ? 0.43 : 0.49;
  const localTime = elapsed - delay;
  if (localTime < 0 || localTime > duration) return null;
  const t = Math.max(0, Math.min(1, localTime / duration));
  const forward = Math.pow(t, 0.88);
  const spread = (index - (total - 1) / 2) * 0.46;
  const sling = kind === 'sling';
  // Bow and crossbow projectiles fly along an actual straight 3D line.
  // This derivative is independent of the time-easing factor: an arrow
  // points from its fletching toward its *next* position, never sideways
  // toward the player just to expose the shaft's silhouette.
  const travelX = -0.64 * spread;
  const travelY = 0.24;
  const travelZ = -4.05;
  // The models' positive longitudinal direction is local -Z.
  // Match the renderer's existing XYZ Euler order (no scene refactor):
  // yaw controls the sideways -Z component; pitch fixes the vertical one.
  // Together they rotate local -Z exactly onto the normalized velocity.
  const arrowYaw = Math.asin(-travelX / Math.hypot(travelX, travelY, travelZ));
  const arrowPitch = Math.atan2(travelY, -travelZ);
  return {
    x: spread * (1 - 0.64 * forward),
    y: -0.33 + 0.24 * forward + (sling ? 0.16 * Math.sin(Math.PI * t) : 0),
    z: -0.72 - 4.05 * forward,
    // The tip faces the velocity vector throughout flight. No cinematic
    // banking, side profile or end-over-end rotation for physical arrows.
    pitch: sling ? -0.16 + 0.27 * t : arrowPitch,
    yaw: sling ? -spread * 0.09 : arrowYaw,
    roll: sling ? Math.PI * 2.2 * t : 0,
    scale: 1 - 0.20 * t,
  };
}
