// A pure, unmodified selector extracted from
// chess-studio frontend/src/chronicles/chroniclesContentRuntime.js
// (commit 80a8700a6eb8e80620d7383832f1f483a2451500).
// The rest of that runtime depends on world-map content and is intentionally
// NOT replaced or mocked here.
export function chroniclesQuestEntries(state, status = null) {
  const quests = state?.quests && typeof state.quests === 'object' ? state.quests : {};
  return Object.values(quests)
    .filter((quest) => quest && (!status || quest.status === status))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}
