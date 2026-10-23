// Hand usage mirrors MM3's combat/equipment contract, including the
// two-handed missile exception. No invented agility, reload or parry stats.
// Kept pure so merchant copy cannot silently diverge from the combat rules.
export function chroniclesShopHandlingNote(item, combatRules = 'mm3') {
  if (!item || typeof item !== 'object') return '';
  if (item.slot === 'weapon' && item.twoHanded) {
    return 'Dos manos: al equiparla, el escudo vuelve a la mochila.';
  }
  if (combatRules !== 'mm3') return '';
  if (item.slot === 'missile' && item.twoHanded) {
    return 'Disparo a dos manos: el escudo sigue equipado, pero no aporta armadura ni acierto durante el tiro o su represalia inmediata.';
  }
  if (item.slot === 'missile' && !item.twoHanded) {
    return 'Disparo a una mano: mantiene las ventajas del escudo si tu clase puede usarlo.';
  }
  if (item.slot === 'shield') {
    return 'El escudo protege al luchar normalmente; no aporta armadura ni acierto mientras disparas con arco o ballesta.';
  }
  return '';
}
