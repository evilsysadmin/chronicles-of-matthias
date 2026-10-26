import React from 'react';
import { chroniclesQuestEntries } from '../chronicles/chroniclesContentRuntime.js';

// The main storyline is the authored «El rey desaparecido» thread; every
// other quest a region hands out is a side contract.
const MAIN_QUEST_IDS = new Set(['lost-king']);

export function chroniclesQuestLogEntries(state) {
  const quests = chroniclesQuestEntries(state);
  const rank = (quest) => (quest.status === 'active' ? 0 : 1);
  return quests
    .map((quest) => ({ ...quest, main: MAIN_QUEST_IDS.has(quest.id) }))
    .sort((left, right) => rank(left) - rank(right)
      || Number(right.main) - Number(left.main)
      || Number(left.order || 0) - Number(right.order || 0));
}

export default function ChroniclesQuestLog({ state, onTrack = null }) {
  const quests = chroniclesQuestLogEntries(state);
  // The quest OBJETIVO follows: the chosen one, else the first active one.
  const active = quests.filter((quest) => quest.status === 'active');
  const followed = active.find((quest) => quest.id === state?.trackedQuestId)?.id || null;
  if (!quests.length) return null;
  return (
    <section className="chronicles-quest-log" aria-label="Encargos">
      <h3>Encargos</h3>
      <ul>
        {quests.map((quest) => (
          <li
            key={quest.id}
            className={`chronicles-quest-log__quest is-${quest.status}${quest.main ? ' is-main' : ''}${followed === quest.id ? ' is-tracked' : ''}`}
            data-chronicles-quest-id={quest.id}
            data-chronicles-quest-status={quest.status}
          >
            <span aria-hidden="true">{quest.status === 'completed' ? '✓' : quest.main ? '♛' : '◆'}</span>
            <div>
              <small>{quest.main ? 'Historia' : 'Side quest'}{quest.status === 'completed' ? ' · completado' : ''}</small>
              <strong>{quest.title}</strong>
              {quest.objective && <p>{quest.objective}</p>}
              {onTrack && quest.status === 'active' && active.length > 1 && (
                <button type="button" className="chronicles-quest-log__track"
                  data-chronicles-track-quest={quest.id} aria-pressed={followed === quest.id}
                  onClick={() => onTrack(followed === quest.id ? null : quest.id)}>
                  {followed === quest.id ? '★ Siguiendo · dejar de seguir' : '☆ Seguir esta misión'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
