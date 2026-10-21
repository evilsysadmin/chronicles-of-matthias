import { chroniclesGoldBalance } from './chronicles/chroniclesContentRuntime.js';

function speakerFromParty(state, preferredId) {
  const party = Array.isArray(state?.party) ? state.party : [];
  const preferred = party.find((member) => member.id === preferredId && member.hp > 0);
  const speaker = preferred || party.find((member) => member.hp > 0);
  if (!speaker) return null;
  return { speakerId: speaker.id, speaker: speaker.name, glyph: speaker.glyph };
}

function bark(state, preferredId, text, event) {
  const speaker = speakerFromParty(state, preferredId);
  return speaker ? { ...speaker, text, event } : null;
}

export function chroniclesPartyBark(previous, next) {
  if (!previous || !next) return null;

  const fallen = next.party?.find((member) => {
    const before = previous.party?.find((candidate) => candidate.id === member.id);
    return before && before.hp > 0 && member.hp <= 0;
  });
  if (fallen) {
    const preferred = fallen.id === 'matthias' ? 'rook' : 'matthias';
    return bark(next, preferred, `${fallen.name} ha caído. Seguimos vivos primero; la épica ya rellenará el informe.`, `down:${fallen.id}`);
  }

  // The First Book's banner contract is paid exactly once by the authored
  // action. A newly recorded receipt (not a guessed quest status or location)
  // makes a useful first reward moment without changing the economy.
  const firstBannerReceipt = 'swordhaven:banner-contract:v1';
  if (next.mapId === 'swordhaven-first-book'
    && next.quests?.['banner-contract']?.status === 'completed'
    && next.claimedRewards?.includes(firstBannerReceipt)
    && !previous.claimedRewards?.includes(firstBannerReceipt)) {
    const paid = chroniclesGoldBalance(next) - chroniclesGoldBalance(previous);
    return bark(next, 'matthias',
      paid > 0
        ? `El contrato ha pagado ${paid} monedas de oro. La intendencia de Swordhaven puede equiparnos para la próxima salida.`
        : 'Contrato entregado. Antes de regresar al camino, revisemos el equipo en la intendencia de Swordhaven.',
      'first-book-banner-paid');
  }

  if (!previous.sigilAwake && next.sigilAwake) {
    return bark(next, 'bishop', 'Ese sello no estaba dormido. Sólo estaba esperando público.', 'sigil-awake');
  }
  if (previous.enemyHp > 0 && next.enemyHp <= 0) {
    return bark(next, 'rook', 'Uno menos. Si alguien quiere pronunciar un discurso, que lo haga andando.', 'corrupted-pawn-down');
  }
  if (previous.spectralBishopHp > 0 && next.spectralBishopHp <= 0) {
    return bark(next, 'bishop', 'Mi farol. La próxima vez que una aparición lo robe, pienso cobrar alquiler.', 'spectral-bishop-down');
  }
  if (previous.jailerHp > 0 && next.jailerHp <= 0) {
    return bark(next, 'rook', 'La torre ha cedido. No confundáis una puerta abierta con una invitación.', 'gate-jailer-down');
  }
  if (previous.scavengerHp > 0 && next.scavengerHp <= 0) {
    return bark(next, 'knight', 'Llave recuperada. Inventario reconciliado. Milagro logístico certificado.', 'scavenger-knight-down');
  }
  if (previous.phase !== 'escaped' && next.phase === 'escaped') {
    return bark(next, 'matthias', 'Consta en acta: salir con piezas todavía enteras cuenta como brillante estrategia.', 'escaped');
  }
  // A refused step or use (a locked grate, a missing key, an unpaid inn):
  // the reason used to land only in the folded chronicle, so on a phone the
  // door simply did nothing. Say it out loud.
  if (refusal(previous, next)) {
    return bark(next, 'matthias', next.message, `refused:${next.message}`);
  }
  return null;
}

const ROUTINE_MESSAGES = [/^Hay una pared/i, /^Giras a la /i, /contra absolutamente nada/i];

// Time passing (a turn, creatures shuffling about) is all a refusal changes;
// anything else (a flag, an item, a quest) means the action did something.
const TIME_KEYS = new Set(['message', 'turns', 'enemyPositions', 'explorationEnemySteps', 'enemyAwareness', 'round', 'turnPhase', 'enemyTurnEvents']);

function refusal(previous, next) {
  if (next.initiative || previous.initiative) return false;
  if (!next.message || next.message === previous.message) return false;
  if (ROUTINE_MESSAGES.some((pattern) => pattern.test(next.message))) return false;
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (!TIME_KEYS.has(key) && previous[key] !== next[key]) return false;
  }
  return true;
}
