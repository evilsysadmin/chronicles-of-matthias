// A quest's history is a filtered view of real recorded journal receipts.
// The mapping knows which authored event IDs belong to each contract; it
// never synthesizes an event from a quest's status, inventory or map alone.
import questEventLinks from './campaign/quest-event-links.json';

export function chroniclesQuestRecordedEvents(quest, journalEntries) {
  const authored = questEventLinks[quest?.id];
  if (!Array.isArray(authored) || !Array.isArray(journalEntries)) return [];
  const allowed = new Set(authored);
  const seen = new Set();
  const history = [];
  // Preserve the chronology in the saved event log, not the catalog order.
  for (const entry of journalEntries) {
    if (!entry || !allowed.has(entry.id) || seen.has(entry.id)
      || typeof entry.title !== 'string' || typeof entry.body !== 'string') continue;
    seen.add(entry.id);
    history.push(entry);
  }
  return history;
}
