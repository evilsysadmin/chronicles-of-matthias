// Stable portrait IDs are saved in existing v2 character builds.
const ORIGINAL_SEX = Object.freeze({ matthias: 'male', rook: 'female', bishop: 'male', knight: 'male' });
export const CHRONICLES_PORTRAIT_GALLERY = Object.freeze(
  ['male', 'female'].flatMap((sex) => Array.from({ length: 10 }, (_, index) => Object.freeze({
    id: `${sex}-${String(index + 1).padStart(2, '0')}`,
    sex,
    label: `${sex === 'male' ? 'Hombre' : 'Mujer'} ${index + 1}`,
  }))),
);
const PORTRAIT_SEX = Object.freeze({
  ...ORIGINAL_SEX,
  ...Object.fromEntries(CHRONICLES_PORTRAIT_GALLERY.map(({ id, sex }) => [id, sex])),
});
export function chroniclesPortraitKnown(id) {
  return typeof id === 'string' && Object.hasOwn(PORTRAIT_SEX, id);
}
export function chroniclesPortraitCompatibleWithSex(id, sex) {
  return chroniclesPortraitKnown(id) && (sex === 'unspecified' || PORTRAIT_SEX[id] === sex);
}
export function chroniclesNormalizePortraitId(id, slotId) {
  return chroniclesPortraitKnown(id) ? id : slotId;
}
