import { chroniclesPartyArmorClass } from '../chroniclesOfMatthias.js';
import { chroniclesPartyCondition } from '../chroniclesOfMatthiasPartyCondition.js';
import { chroniclesEquippedItem } from './chroniclesEquipment.js';
import { chroniclesMemberMaxSp, chroniclesMemberSp } from './chroniclesMagic.js';
import { chroniclesMM3Class } from './chroniclesMM3Rules.js';
import { chroniclesArmsLabel } from './chroniclesWornGear.js';

const CONDITION_LABELS = Object.freeze({ fresh: 'Bien', worn: 'Tocado', critical: 'Grave', down: 'Caído' });

// MM3's Quick Reference: one line per hero with what matters between fights.
export function chroniclesQuickStatusRows(state, levelOf = () => 1) {
  return (state?.party || []).map((member, index) => {
    const maxSp = chroniclesMemberMaxSp(state, member);
    const condition = chroniclesPartyCondition(member);
    return {
      id: member.id,
      slot: index + 1,
      name: member.name,
      classLabel: chroniclesMM3Class(member.mm3?.classId)?.label || '—',
      level: levelOf(member.id),
      hp: Math.max(0, Number(member.hp || 0)),
      maxHp: Number(member.maxHp || 0),
      sp: maxSp > 0 ? chroniclesMemberSp(state, member) : null,
      maxSp: maxSp > 0 ? maxSp : null,
      armorClass: chroniclesPartyArmorClass(state, member.id),
      weapon: chroniclesArmsLabel(state, member.id),
      condition,
      conditionLabel: CONDITION_LABELS[condition] || condition,
    };
  });
}
