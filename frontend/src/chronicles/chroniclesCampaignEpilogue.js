// The end of «El rey desaparecido». The throne records one of three endings
// in `lostKingEnding`; this turns it, and what the company did on the way,
// into the closing pages of the chronicle.

export const CHRONICLES_CAMPAIGN_ENDINGS = Object.freeze(['restored', 'broken', 'regency']);

// Seen once, the epilogue does not reopen on every reload.
export const CHRONICLES_EPILOGUE_SEEN_KEY = 'lostKingEpilogueSeen';

const ENDINGS = Object.freeze({
  restored: Object.freeze({
    title: 'El Rey vuelve',
    lead: 'El rey Aurelio sube a la superficie con el juramento intacto. Swordhaven repica campanas que llevaban meses mudas y el Silencio vuelve a obedecer a un solo amo. Nadie pregunta qué precio pagará el próximo rey: hoy no es día de preguntas.',
    verdict: 'Un rey, un juramento y un Silencio con correa. He visto finales peores. También mejores, pero menos legales.',
  }),
  broken: Object.freeze({
    title: 'Sin corona',
    lead: 'Con el Pacto roto, el Silencio suelta todo lo que se había llevado. Por los caminos de Terra aparecen hombres y mujeres que nadie recordaba, con sus nombres intactos y muchas preguntas. El reino ya no tiene quien le haga olvidar a sus enemigos: tendrá que aprender a recordarlos.',
    verdict: 'Hemos roto un pacto de siete reyes con las manos. Consta en acta que nadie nos pidió permiso. Consta también que nadie lo habría dado.',
  }),
  regency: Object.freeze({
    title: 'La regencia de la Dama',
    lead: 'El rey Aurelio vive, pero no vuelve a jurar. La Dama gobierna como regente desde la Corte de Bronce, con un sello prestado y una paciencia que no lo es. El Silencio, sin rey que lo ate, duerme bajo la piedra. Por ahora.',
    verdict: 'Ni rey ni pacto: una regente con buen criterio. Sospecho que es lo más parecido a un final feliz que admite la burocracia.',
  }),
});

function questCompleted(state, questId) {
  return state?.quests?.[questId]?.status === 'completed';
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`;
}

export function chroniclesCampaignEnding(state) {
  const ending = state?.lostKingEnding;
  return CHRONICLES_CAMPAIGN_ENDINGS.includes(ending) ? ending : null;
}

// The epilogue opens once, as soon as the throne decides the ending, and
// never over a finished or lost expedition.
export function chroniclesCampaignEpiloguePending(state) {
  return Boolean(chroniclesCampaignEnding(state))
    && !state?.[CHRONICLES_EPILOGUE_SEEN_KEY]
    && state?.phase !== 'escaped'
    && state?.phase !== 'defeated';
}

export function chroniclesCampaignEpilogue(state) {
  const ending = chroniclesCampaignEnding(state);
  if (!ending) return null;
  const page = ENDINGS[ending];
  const lines = [];

  if (state.templeKnightsFreed) {
    lines.push('Los caballeros de la Dama descansan por fin. En la Corte de Bronce hay una lista con sus nombres, y la Dama la lee en voz alta cada mañana.');
  } else if (state.templeKnightHadricDown || state.templeKnightYsoldeDown) {
    lines.push('Sir Hadric y Dama Ysolde cayeron ante el trono, atados todavía a un juramento que no era suyo. La compañía devolvió sus espadas a la Corte.');
  } else {
    lines.push('Los caballeros juramentados siguen de guardia ante un trono vacío. Alguien tendrá que bajar a buscarlos.');
  }

  if (questCompleted(state, 'tax-of-the-forgotten')) {
    lines.push(ending === 'broken'
      ? 'En las Granjas del Trigo, Tesa abre la puerta a un hermano que el Canciller había borrado de los libros.'
      : 'Tesa conserva el libro de los ausentes. Gracias a él, la Corte deja de cobrar impuestos a quien nadie recuerda.');
  }
  if (state.f1BeaconChoice === 'rescue') {
    lines.push(ending === 'broken'
      ? 'El Faro Helado sigue encendido. Los barcos sin nombre ya saben volver, y esta vez alguien los espera en el muelle.'
      : 'El Faro Helado sigue encendido. Los barcos sin nombre ya saben volver.');
  } else if (state.f1BeaconChoice === 'salvage') {
    lines.push('El Faro Helado sigue a oscuras. La plata del espejo se gastó hace tiempo.');
  }
  if (questCompleted(state, 'names-in-wood')) {
    lines.push('En Rookwood, el Roble del claro luce tres placas nuevas.');
  }

  const sideQuests = Object.values(state.quests || {})
    .filter((quest) => quest?.status === 'completed' && quest.id !== 'lost-king' && quest.id !== 'lost-king-prologue');
  if (sideQuests.length) {
    lines.push(`${sideQuests.length} ${sideQuests.length === 1 ? 'encargo cumplido' : 'encargos cumplidos'} por el camino, de ${sideQuests.length === 1 ? 'un' : 'muchos'} que lo agradecen.`);
  }

  const party = Array.isArray(state.party) ? state.party : [];
  const fallen = party.filter((member) => Number(member.hp || 0) <= 0).map((member) => member.name);
  if (fallen.length) {
    lines.push(`${joinNames(fallen)} no ${fallen.length === 1 ? 'llega' : 'llegan'} a ver la luz del día. Su nombre, al menos, nadie lo va a borrar.`);
  }

  return Object.freeze({
    ending,
    title: page.title,
    lead: page.lead,
    lines: Object.freeze(lines),
    verdict: page.verdict,
  });
}
