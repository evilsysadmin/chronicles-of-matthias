// Compact merchant summaries are derived from the actual comparison deltas,
// never from item labels, price, guessed equipment or class assumptions.
// Identical *changes* can share one line even when the heroes' baseline
// values differ. Keep restrictions and shield displacement separate.
export function chroniclesCompactShopComparisonGroups(comparisons = []) {
  const grouped = new Map();
  for (const comparison of comparisons) {
    const changes = (comparison.stats || [])
      .filter((stat) => stat.delta !== 0)
      .map(({ key, label, delta }) => ({ key, label, delta }));
    const shield = comparison.displacedShield?.name || null;
    const signature = JSON.stringify([
      comparison.eligible, comparison.alreadyEquipped,
      comparison.reason || null, shield,
      changes.map(({ key, delta }) => [key, delta]),
    ]);
    if (!grouped.has(signature)) {
      grouped.set(signature, {
        names: [],
        eligible: comparison.eligible,
        alreadyEquipped: comparison.alreadyEquipped,
        reason: comparison.reason,
        changes,
        displacedShieldName: shield,
      });
    }
    grouped.get(signature).names.push(comparison.name);
  }
  return [...grouped.values()];
}
