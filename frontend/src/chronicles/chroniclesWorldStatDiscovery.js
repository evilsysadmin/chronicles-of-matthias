// World-discovered MM3 stats. This is a deliberate interaction, never a
// side-effect of walking, reloading a save or opening the character sheet.
import { CHRONICLES_MM3_STATS, CHRONICLES_MM3_STAT_LABELS } from './chroniclesMM3Rules.js';
import { chroniclesContentDefinition, chroniclesApplyContentAction } from './chroniclesContentRuntime.js';
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import {
  grantChroniclesMM3WorldStat,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';

// The only accepted world stat award is an authored, visible pickup with a
// single matching, persistent boolean set receipt. Arbitrary map effects
// cannot silently edit an account's character build or award more resources.
export function chroniclesMM3WorldStatOffer(state) {
  if (state?.combatRules !== 'mm3' || state.phase !== 'explore' || state.initiative) return null;
  const contextual = chroniclesContextualContentAction(state);
  if (!contextual || contextual.locked) return null;
  const definition = chroniclesContentDefinition(chroniclesMapForState(state), contextual.id);
  const stat = definition?.mm3WorldStat;
  const effect = definition?.action?.effects?.[0];
  if (definition?.kind !== 'pickup' || !CHRONICLES_MM3_STATS.includes(stat)
    || definition?.action?.effects?.length !== 1
    || effect?.type !== 'set' || effect.value !== true
    || !definition.when?.some((requirement) => requirement.key === effect.key && requirement.falsy === true)) return null;
  if (state.runProgression?.claimedWorldStatSources?.includes(definition.id)) return null;
  return { id: definition.id, label: definition.label, visualType: definition.visualType || null,
    stat, statLabel: CHRONICLES_MM3_STAT_LABELS[stat] };
}

export function chroniclesClaimMM3WorldStat(state, progression, sourceId, memberId) {
  const failed = { state, progression, granted: false };
  const offer = chroniclesMM3WorldStatOffer(state);
  if (!offer || offer.id !== sourceId || !state.party?.some((member) => member.id === memberId && member.hp > 0)) return failed;
  // Refuse duplicate claims even when only one of the two save receipts was
  // restored; the expedition's progression ledger is the authority.
  const awarded = grantChroniclesMM3WorldStat(progression, memberId, offer.stat, offer.id);
  if (!awarded.granted) return failed;
  const definition = chroniclesContentDefinition(chroniclesMapForState(state), offer.id);
  const claimedState = chroniclesApplyContentAction(state, definition.action);
  const next = reconcileChroniclesProgressionInTacticsState(claimedState, awarded.progression);
  const hero = next.party.find((member) => member.id === memberId);
  return {
    granted: true,
    progression: awarded.progression,
    state: {
      ...next,
      runProgression: awarded.progression,
      message: `${hero.name} recibe +1 ${offer.statLabel} de ${offer.label.split(' · ')[0]}. El hallazgo queda grabado en su historia.`,
    },
  };
}
