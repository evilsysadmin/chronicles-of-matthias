// A real loss of enemy HP (never an attack animation or a miss) starts the
// goblin's recoil. Lethal strikes linger in the hurt frame before the corpse.
export const CHRONICLES_GOBLIN_HURT_SECONDS = 0.58;
export const CHRONICLES_GOBLIN_LETHAL_HURT_SECONDS = 0.30;

export function chroniclesGoblinHitPose({ hitElapsed = -1, deathElapsed = -1, hp = 1 } = {}) {
  const hitIsRecent = Number.isFinite(hitElapsed) && hitElapsed >= 0;
  const lethal = Number(hp) <= 0 && Number.isFinite(deathElapsed) && deathElapsed >= 0;
  const hurtSeconds = lethal ? CHRONICLES_GOBLIN_LETHAL_HURT_SECONDS : CHRONICLES_GOBLIN_HURT_SECONDS;
  const hurt = hitIsRecent && hitElapsed < hurtSeconds;
  return { hurt, dead: lethal && !hurt };
}
