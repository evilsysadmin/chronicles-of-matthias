import matthiasPortrait from '../assets/chronicles/matthias-chronicles-canonical-v3.webp';
import hildegardPortrait from '../assets/chronicles/hildegard-canonical-v2.webp';
import azizPortrait from '../assets/chronicles/aziz-canonical-v2.webp';
import faustPortrait from '../assets/chronicles/faust-canonical-v2.webp';
import portrait_male_01 from '../assets/chronicles/portraits/male-01.webp';
import portrait_male_02 from '../assets/chronicles/portraits/male-02.webp';
import portrait_male_03 from '../assets/chronicles/portraits/male-03.webp';
import portrait_male_04 from '../assets/chronicles/portraits/male-04.webp';
import portrait_male_05 from '../assets/chronicles/portraits/male-05.webp';
import portrait_male_06 from '../assets/chronicles/portraits/male-06.webp';
import portrait_male_07 from '../assets/chronicles/portraits/male-07.webp';
import portrait_male_08 from '../assets/chronicles/portraits/male-08.webp';
import portrait_male_09 from '../assets/chronicles/portraits/male-09.webp';
import portrait_male_10 from '../assets/chronicles/portraits/male-10.webp';
import portrait_female_01 from '../assets/chronicles/portraits/female-01.webp';
import portrait_female_02 from '../assets/chronicles/portraits/female-02.webp';
import portrait_female_03 from '../assets/chronicles/portraits/female-03.webp';
import portrait_female_04 from '../assets/chronicles/portraits/female-04.webp';
import portrait_female_05 from '../assets/chronicles/portraits/female-05.webp';
import portrait_female_06 from '../assets/chronicles/portraits/female-06.webp';
import portrait_female_07 from '../assets/chronicles/portraits/female-07.webp';
import portrait_female_08 from '../assets/chronicles/portraits/female-08.webp';
import portrait_female_09 from '../assets/chronicles/portraits/female-09.webp';
import portrait_female_10 from '../assets/chronicles/portraits/female-10.webp';

export const CHRONICLES_PARTY_PORTRAITS = Object.freeze({
  matthias: matthiasPortrait,
  rook: hildegardPortrait,
  bishop: azizPortrait,
  knight: faustPortrait,
});
export const CHRONICLES_GALLERY_PORTRAITS = Object.freeze({
  'male-01': portrait_male_01,
  'male-02': portrait_male_02,
  'male-03': portrait_male_03,
  'male-04': portrait_male_04,
  'male-05': portrait_male_05,
  'male-06': portrait_male_06,
  'male-07': portrait_male_07,
  'male-08': portrait_male_08,
  'male-09': portrait_male_09,
  'male-10': portrait_male_10,
  'female-01': portrait_female_01,
  'female-02': portrait_female_02,
  'female-03': portrait_female_03,
  'female-04': portrait_female_04,
  'female-05': portrait_female_05,
  'female-06': portrait_female_06,
  'female-07': portrait_female_07,
  'female-08': portrait_female_08,
  'female-09': portrait_female_09,
  'female-10': portrait_female_10,
});

// Existing slot-ID callers remain valid; resolved heroes carry portraitId.
export function chroniclesPartyPortraitUrl(memberOrId) {
  const member = memberOrId && typeof memberOrId === 'object' ? memberOrId : null;
  const id = member?.portraitId || member?.characterBuild?.portraitId ||
    (typeof memberOrId === 'string' ? memberOrId : member?.slotId || member?.id);
  const slot = member?.slotId || member?.id;
  return CHRONICLES_GALLERY_PORTRAITS[id] || CHRONICLES_PARTY_PORTRAITS[id] ||
    CHRONICLES_PARTY_PORTRAITS[slot] || matthiasPortrait;
}
