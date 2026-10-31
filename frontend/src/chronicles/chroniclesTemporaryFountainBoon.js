// A temporary blessing from a genuine, once-only Terra fountain. Existing
// heal/restore effects remain owned by the normal authored content reducer;
// this module observes the durable receipt after a successful interaction.
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesContentDefinition } from './chroniclesContentRuntime.js';
import { chroniclesIsRestorativeFountain } from './chroniclesRestorativeFountain.js';
import { CHRONICLES_MM3_STAT_LABELS } from './chroniclesMM3Rules.js';
import { chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import {
  grantChroniclesMM3TemporaryBoon,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';

export const WOLF_FOUNTAIN_BOON = Object.freeze({
  mapId: 'terra-b2',
  sourceId: 'terra-b2-shrine',
  receipt: 'terra_b2ShrineUsed',
  stat: 'luck',
  amount: 2,
  duration: 12,
  name: 'Fuente de los Lobos',
});

export const FROST_FOUNTAIN_BOON = Object.freeze({
  mapId: 'terra-e1',
  sourceId: 'terra-e1-shrine',
  receipt: 'terra_e1ShrineUsed',
  stat: 'speed',
  amount: 2,
  duration: 10,
  name: 'Fuente de Escarcha',
});

export const LIGHTHOUSE_FOUNTAIN_BOON = Object.freeze({
  mapId: 'terra-a6',
  sourceId: 'terra-a6-shrine',
  receipt: 'terra_a6ShrineUsed',
  stat: 'accuracy',
  amount: 3,
  duration: 8,
  name: 'Fuente del Faro',
});

// Only deliberately authored sources grant buffs; other restorative wells
// keep their existing heal/PH effects without gaining incidental stat boosts.
const TEMPORARY_FOUNTAINS = Object.freeze([
  WOLF_FOUNTAIN_BOON, FROST_FOUNTAIN_BOON, LIGHTHOUSE_FOUNTAIN_BOON,
]);

// Reconcile only while a prior blessing was active, or when it expires.
// That way walking/turning/combat doesn't need an extra engine or timer.
export function chroniclesResolveTemporaryFountainBoon(previous, next, progression) {
  const unchanged = { state: next, progression, granted: false, updated: false };
  if (previous?.combatRules !== 'mm3' || next?.combatRules !== 'mm3') return unchanged;
  const currentTurn = Number(previous.turns);
  const nextTurn = Number(next.turns);
  if (!Number.isSafeInteger(currentTurn) || !Number.isSafeInteger(nextTurn)
    || nextTurn < currentTurn) return unchanged;

  let awarded = null;
  let awardedSource = null;
  // A fresh authored receipt and the currently reachable contextual action
  // must agree. A restored flag, arbitrary map transition or a forged world
  // event cannot silently award a second blessing.
  const source = TEMPORARY_FOUNTAINS.find((candidate) => (
    previous.mapId === candidate.mapId && next.mapId === candidate.mapId
    && previous[candidate.receipt] !== true && next[candidate.receipt] === true
  ));
  if (source) {
    const contextual = chroniclesContextualContentAction(previous);
    const definition = chroniclesContentDefinition(chroniclesMapForState(previous), contextual?.id);
    if (contextual?.id === source.sourceId && !contextual.locked
      && definition?.id === source.sourceId && chroniclesIsRestorativeFountain(definition)) {
      awarded = grantChroniclesMM3TemporaryBoon(
        progression, source.sourceId, source.stat, source.amount,
        nextTurn + source.duration,
      );
      if (awarded.granted) awardedSource = source;
    }
  }

  const boon = progression?.mm3TemporaryBoon;
  const activeTurnAdvanced = boon && nextTurn !== currentTurn
    && currentTurn < boon.expiresAtTurn;
  if (!awarded?.granted && !activeTurnAdvanced) return unchanged;

  const effectiveProgression = awarded?.granted ? awarded.progression : progression;
  const refreshed = reconcileChroniclesProgressionInTacticsState(next, effectiveProgression);
  const replacesActive = awardedSource && boon && currentTurn < boon.expiresAtTurn;
  const blessingMessage = awardedSource
    ? `La ${awardedSource.name} concede +${awardedSource.amount} ${CHRONICLES_MM3_STAT_LABELS[awardedSource.stat]} al grupo durante ${awardedSource.duration} acciones.${replacesActive ? ' Sustituye a la bendición anterior.' : ''}`
    : null;
  return {
    updated: true,
    granted: Boolean(awarded?.granted),
    progression: effectiveProgression,
    state: {
      ...refreshed,
      runProgression: effectiveProgression,
      ...(awarded?.granted ? {
        message: `${next.message || 'El agua os reconforta.'} ${blessingMessage}`,
      } : {}),
    },
  };
}
