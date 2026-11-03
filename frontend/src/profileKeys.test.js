import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearStorageMemoryFallback } from './safeStorage.js';
import {
  bindProfileStorageIdentity,
  clearProfileCache,
  clearProfileProgress,
  markProfileDirtyForCurrentUser,
  profileStorageIdentityMatchesCurrentUser,
  removeProfileStorageItem,
  setProfileStorageItem,
} from './profileKeys.js';

const AUTH_USERNAME_KEY = 'chess-study-auth-username';
const PROGRESSION_KEY = 'chess-study-chronicles-progression-v1';
const DIRTY_USER_KEY = 'chess-study-profile-dirty-user';

beforeEach(() => {
  clearStorageMemoryFallback();
  localStorage.clear();
  bindProfileStorageIdentity(null);
});

afterEach(() => {
  bindProfileStorageIdentity(null);
  localStorage.clear();
  clearStorageMemoryFallback();
});

function assertStaleTabCannotMutateProgress() {
  expect(profileStorageIdentityMatchesCurrentUser()).toBe(false);
  expect(setProfileStorageItem(PROGRESSION_KEY, 'overwritten')).toBe(false);
  expect(removeProfileStorageItem(PROGRESSION_KEY)).toBe(false);
  expect(clearProfileProgress()).toBe(false);
  expect(clearProfileCache()).toBe(false);
  expect(markProfileDirtyForCurrentUser(PROGRESSION_KEY)).toBe(false);
  expect(localStorage.getItem(PROGRESSION_KEY)).toBe('saved-campaign');
  expect(localStorage.getItem(DIRTY_USER_KEY)).toBeNull();
}

describe('profile storage document ownership', () => {
  it('prevents an anonymous tab from overwriting Bob after he signs in elsewhere', () => {
    // The document started without a user, then another tab signed in.
    bindProfileStorageIdentity(null);
    localStorage.setItem(AUTH_USERNAME_KEY, 'bob');
    localStorage.setItem(PROGRESSION_KEY, 'saved-campaign');
    assertStaleTabCannotMutateProgress();
  });

  it('prevents a tab bound to Alice from writing after another tab logs out', () => {
    bindProfileStorageIdentity('alice');
    // Another tab cleared auth, but this document still has callbacks in flight.
    localStorage.removeItem(AUTH_USERNAME_KEY);
    localStorage.setItem(PROGRESSION_KEY, 'saved-campaign');
    assertStaleTabCannotMutateProgress();
  });

  it('still permits writes for the same user and for genuinely anonymous preferences', () => {
    bindProfileStorageIdentity(null);
    expect(profileStorageIdentityMatchesCurrentUser()).toBe(true);
    expect(setProfileStorageItem('chess-study-ui-language', 'en')).toBe(true);

    localStorage.setItem(AUTH_USERNAME_KEY, 'alice');
    bindProfileStorageIdentity('alice');
    expect(profileStorageIdentityMatchesCurrentUser()).toBe(true);
    expect(setProfileStorageItem(PROGRESSION_KEY, 'saved-campaign')).toBe(true);
    expect(localStorage.getItem(PROGRESSION_KEY)).toBe('saved-campaign');
  });

  it('rejects a different signed-in user until this document explicitly adopts that user', () => {
    localStorage.setItem(AUTH_USERNAME_KEY, 'alice');
    bindProfileStorageIdentity('alice');
    localStorage.setItem(PROGRESSION_KEY, 'saved-campaign');

    localStorage.setItem(AUTH_USERNAME_KEY, 'bob');
    assertStaleTabCannotMutateProgress();

    bindProfileStorageIdentity('bob');
    expect(profileStorageIdentityMatchesCurrentUser()).toBe(true);
    expect(setProfileStorageItem(PROGRESSION_KEY, 'bob-campaign')).toBe(true);
    expect(localStorage.getItem(PROGRESSION_KEY)).toBe('bob-campaign');
  });
});
