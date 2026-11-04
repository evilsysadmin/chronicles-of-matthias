// Approved attribute illustrations extracted from the existing visual concept.
// The optimized 4x2 local atlas is shipped with the game, never fetched
// from another project or generated at runtime.
export const CHRONICLES_CHARACTER_STAT_ICON_IDS = Object.freeze([
  'might', 'intellect', 'personality', 'endurance',
  'speed', 'accuracy', 'luck', 'condition',
]);

export default function ChroniclesCharacterStatIcon({ stat }) {
  if (!CHRONICLES_CHARACTER_STAT_ICON_IDS.includes(stat)) return null;
  return (
    <i className="chronicles-character-sheet__stat-icon"
      aria-hidden="true" data-stat-icon={stat} />
  );
}
