import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chroniclesQuestEntries } from '../src/chronicles/chroniclesQuestEntries.js';

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('authored quest selector retains ordered and status-filtered quest behavior', () => {
  const original = {
    quests: {
      finished: { id: 'finished', order: 1, status: 'completed' },
      side: { id: 'side', order: 5, status: 'active' },
      main: { id: 'lost-king-prologue', order: 0, status: 'active' },
    },
  };
  assert.deepEqual(chroniclesQuestEntries(original).map(q => q.id),
    ['lost-king-prologue', 'finished', 'side']);
  assert.deepEqual(chroniclesQuestEntries(original, 'active').map(q => q.id),
    ['lost-king-prologue', 'side']);
  assert.deepEqual(chroniclesQuestEntries({}), []);
  assert.deepEqual(chroniclesQuestEntries(null, 'active'), []);
});

test('original modal and authored quest presentation actually join the React app', () => {
  const modal = read('../src/components/ChroniclesJournalModal.jsx');
  const quest = read('../src/components/ChroniclesQuestLog.jsx');
  const styles = read('../src/components/ChroniclesJournalModal.css');
  const app = read('../src/App.jsx');
  assert.match(modal, /export default function ChroniclesJournalModal/);
  assert.match(modal, /createPortal\(/);
  assert.match(modal, /role="dialog" aria-modal="true"/);
  assert.match(modal, /Crónica de expedición/);
  assert.match(modal, /Cerrar Crónica/);
  assert.match(modal, /role="region"/);
  assert.match(quest, /from '..\/chronicles\/chroniclesQuestEntries.js'/);
  assert.match(quest, /chroniclesQuestLogEntries/);
  assert.match(quest, /lost-king-prologue|intro.questId/);
  assert.ok(styles.length > 10000);
  assert.match(app, /import ChroniclesJournalModal/);
  assert.match(app, /<ChroniclesJournalModal/);
  assert.match(app, /entries=\{state.journal\}/);
  assert.match(app, /event.key.toLowerCase\(\) !== 'j'/);
  assert.match(app, /onClose=\{\(\) => setJournalOpen\(false\)\}/);
});

test('standalone escape adapter avoids Chess Studio global navigation and data services', () => {
  const hook = read('../src/useEscapeToClose.js');
  const modal = read('../src/components/ChroniclesJournalModal.jsx');
  assert.match(hook, /export function useEscapeToClose/);
  assert.match(hook, /event.key !== 'Escape'/);
  assert.match(hook, /addEventListener\('keydown'/);
  assert.doesNotMatch(hook, /backNavigationStack|pushState|history.back|chess-study/i);
  assert.match(modal, /useEscapeToClose\(onClose/);
  for (const code of [modal, read('../src/chronicles/chroniclesQuestEntries.js')]) {
    assert.doesNotMatch(code, /\bfetch\s*\(|localStorage|chess-studio\.shadowops/i);
  }
});
