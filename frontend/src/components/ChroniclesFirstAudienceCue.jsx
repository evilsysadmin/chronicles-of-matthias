import './ChroniclesFirstAudienceCue.css';

// Context only: the authoritative map, quest and NPC decide when the actual
// mayor conversation is possible. Never offer a synthetic shortcut from afar.
export function chroniclesCanMeetAldric(state, contextualAction, npc) {
  return state?.mapId === 'swordhaven-first-book'
    && state?.phase === 'explore'
    && !state?.initiative
    && state?.swordhavenMayorMet !== true
    && state?.quests?.['lost-king']?.status === 'active'
    && contextualAction?.id === 'swordhaven-mayor'
    && npc?.id === 'swordhaven-mayor';
}

export default function ChroniclesFirstAudienceCue({
  state, contextualAction, npc, suspended = false, onTalk = () => {},
}) {
  if (suspended || !chroniclesCanMeetAldric(state, contextualAction, npc)) return null;
  return (
    <aside className="chronicles-first-audience" data-chronicles-first-audience
      aria-label="Encuentro con el alcalde Aldric">
      <div>
        <small>AYUNTAMIENTO · SWORDHAVEN</small>
        <strong>Aldric te espera</strong>
        <span>Matthias alisa la carta. «Procura no insultar al alcalde antes de entregársela».</span>
      </div>
      <button type="button" onClick={onTalk} aria-label="Entrar y hablar con el alcalde Aldric">
        Entrar y hablar <kbd>F</kbd>
      </button>
    </aside>
  );
}
