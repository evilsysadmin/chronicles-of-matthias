import test from 'node:test';
import assert from 'node:assert/strict';
import { getChroniclesFxVolume, setChroniclesFxVolume } from '../src/chronicles/chroniclesAudioSettings.js';
import { getStorageItem, setStorageItem, STORAGE_LOCAL } from '../src/safeStorage.js';

test('audio settings work without a browser', () => {
  assert.equal(getChroniclesFxVolume(), 1);
  assert.equal(setChroniclesFxVolume(1.5), 1);
  assert.equal(setChroniclesFxVolume(-4), 0);
  assert.equal(getStorageItem(STORAGE_LOCAL, 'absent'), null);
  assert.equal(setStorageItem(STORAGE_LOCAL, 'x', 'y'), false);
});
