// A temporary blessing from a genuine, once-only Terra fountain. Existing
// heal/restore effects remain owned by the normal authored content reducer;
// this module observes the durable receipt after a successful interaction.
import { chroniclesMapForState } from './chroniclesMapCatalog.js';
import { chroniclesContentDefinition } from './chroniclesContentRuntime.js';
import { chroniclesIsRestorativeFountain } from './chroniclesRestorativeFountain.js';
import { chroniclesContextualContentAction } from '../chroniclesOfMatthias.js';
import {
  grantChroniclesMM3TemporaryBoon,
  reconcileChroniclesProgressionInTacticsState,
} from '../chroniclesOfMatthiasProgression.js';

export const WOLF_FOUNTAIN_BOON = Object.freeze({
  sourceId: 'terra-b2-shrine',
  receipt: 'terra_b2ShrineUsed',
  stat: 'luck',
  amount: 2,
  duration: 12,
});

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
  if (previous.mapId === 'terra-b2' && next.mapId === previous.mapId
    && previous[WOLF_FOUNTAIN_BOON.receipt] !== true
    && next[WOLF_FOUNTAIN_BOON.receipt] === true) {
    const contextual = chroniclesContextualContentAction(previous);
    const definition = chroniclesContentDefinition(chroniclesMapForState(previous), contextual?.id);
    if (contextual?.id === WOLF_FOUNTAIN_BOON.sourceId
      && !contextual.locked && chroniclesIsRestorativeFountain(definition)) {
      awarded = grantChroniclesMM3TemporaryBoon(
        progression,
        WOLF_FOUNTAIN_BOON.sourceId,
        WOLF_FOUNTAIN_BOON.stat,
        WOLF_FOUNTAIN_BOON.amount,
        nextTurn + WOLF_FOUNTAIN_BOON.duration,
      );
    }
  }

  const boon = progression?.mm3TemporaryBoon;
  const activeTurnAdvanced = boon && nextTurn !== currentTurn
    && currentTurn < boon.expiresAtTurn;
  if (!awarded?.granted && !activeTurnAdvanced) return unchanged;

  const effectiveProgression = awarded?.granted ? awarded.progression : progression;
  const refreshed = reconcileChroniclesProgressionInTacticsState(next, effectiveProgression);
  return {
    updated: true,
    granted: Boolean(awarded?.granted),
    progression: effectiveProgression,
    state: {
      ...refreshed,
      runProgression: effectiveProgression,
      ...(awarded?.granted ? {
        message: `${next.message || 'La Fuente de los Lobos os reconforta.'} La bendición del lobo otorga +2 Suerte al grupo durante 12 acciones.`,
      } : {}),
    },
  };
}
