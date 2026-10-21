import {
  chroniclesOpeningVolleyShooters,
  chroniclesPartyAttackStats,
  chroniclesUsesMM3Combat,
} from '../chroniclesOfMatthias.js';
import { chroniclesCurrentInitiativeActor } from './chroniclesInitiative.js';

// S means a collective volley while exploring MM3, but the active hero's
// missile attack once initiative begins. The tactical margin must report the
// SAME reachable distance as those two real reducer paths. A selected hero
// without a bow does not invalidate the rest of the company's opening volley.
export function chroniclesTacticalAttackReach(state, selectedMemberId) {
  const actor = chroniclesCurrentInitiativeActor(state?.initiative);
  const currentMemberId = actor?.kind === 'party' ? actor.id : selectedMemberId;
  const currentMember = (state?.party || []).find((member) => member.id === currentMemberId);
  const meleeReach = currentMember
    ? chroniclesPartyAttackStats(state, currentMember.id, 'melee').reach : 0;

  if (chroniclesUsesMM3Combat(state) && !state?.initiative) {
    const missileReach = Math.max(0, ...chroniclesOpeningVolleyShooters(state)
      .map((member) => chroniclesPartyAttackStats(state, member.id, 'missile').reach));
    return { meleeReach, missileReach };
  }

  // During an enemy turn there is no player missile action; never advertise S
  // as immediately available just because the last selected hero has a bow.
  const missileReach = actor?.kind === 'enemy' ? 0 : currentMember
    ? chroniclesPartyAttackStats(state, currentMember.id, 'missile').reach : 0;
  return { meleeReach, missileReach };
}
