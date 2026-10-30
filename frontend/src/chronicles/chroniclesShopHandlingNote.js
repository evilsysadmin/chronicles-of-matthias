// Hand usage mirrors MM3's independent ranged slot and shield hand.
// Kept pure so merchant copy cannot silently diverge from combat rules.
export function chroniclesShopHandlingNote(item, combatRules = 'mm3') {
  if (!item || typeof item !== 'object') return '';
  if (item.slot === 'weapon' && item.twoHanded) {
    return 'Dos manos: al equiparla, el escudo vuelve a la mochila.';
  }
  if (combatRules !== 'mm3') return '';
  if (item.slot === 'missile') {
    return 'Ranura independiente: puedes llevar proyectiles, arma de mano y escudo a la vez; el escudo mantiene sus bonificaciones.';
  }
  if (item.slot === 'shield') {
    return 'Compatible con arma de mano y arco, ballesta u honda. Solo un arma cuerpo a cuerpo a dos manos impide llevarlo.';
  }
  return '';
}
