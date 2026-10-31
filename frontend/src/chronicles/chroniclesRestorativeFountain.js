// A "shrine" visual is also used by quest props (e.g. the Wind Matron's
// nest). Only a genuinely restorative authored shrine is a water fountain.
export function chroniclesIsRestorativeFountain(entry) {
  if (entry?.kind !== 'lore' || entry.visualType !== 'shrine') return false;
  const effects = entry.action?.effects;
  if (!Array.isArray(effects)) return false;
  const receipt = effects.find((effect) => effect?.type === 'set'
    && typeof effect.key === 'string' && effect.value === true
    && entry.when?.some((requirement) => requirement.key === effect.key && requirement.falsy === true));
  return Boolean(receipt
    && effects.some((effect) => effect?.type === 'heal-party' && Number(effect.amount) > 0)
    && effects.some((effect) => effect?.type === 'restore-spell-points'));
}
