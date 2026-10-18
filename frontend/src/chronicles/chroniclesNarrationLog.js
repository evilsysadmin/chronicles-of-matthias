import { STORAGE_SESSION, readJsonStorage, writeJsonStorage } from '../safeStorage.js';

// What the chronicle said during this run, so a line that faded from the view
// can be read again in the Crónica. Kept per run in session storage: it
// survives a reload, not a new browser session.
const KEY = 'chronicles-narration-log-v1:';
export const CHRONICLES_NARRATION_LOG_LIMIT = 60;

export function chroniclesAppendNarration(log, text, at = Date.now()) {
  const line = typeof text === 'string' ? text.trim() : '';
  const entries = Array.isArray(log) ? log : [];
  if (!line || entries[0]?.text === line) return entries;
  return [{ text: line, at }, ...entries].slice(0, CHRONICLES_NARRATION_LOG_LIMIT);
}

export function chroniclesLoadNarrationLog(runId) {
  if (!runId) return [];
  const stored = readJsonStorage(STORAGE_SESSION, `${KEY}${runId}`, { fallback: [] });
  return Array.isArray(stored)
    ? stored.filter((entry) => typeof entry?.text === 'string').slice(0, CHRONICLES_NARRATION_LOG_LIMIT)
    : [];
}

export function chroniclesSaveNarrationLog(runId, log) {
  if (runId) writeJsonStorage(STORAGE_SESSION, `${KEY}${runId}`, log);
}

// Long enough to read: about 70 ms per character, between 4 and 12 seconds.
export function chroniclesNarrationDurationMs(text) {
  return Math.max(4000, Math.min(12000, String(text || '').length * 70));
}
