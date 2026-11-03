import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearStorageMemoryFallback } from './safeStorage.js';
import {
  bindProfileStorageIdentity,
  clearProfileCache,
  clearProfileDirty,
  clearLocalUserState,
  clearProfileProgress,
  dirtyProfileKeysForCurrentUser,
  hasDirtyProfileForCurrentUser,
  markProfileDirtyForCurrentUser,
  profileStorageIdentityMatchesCurrentUser,
  profileDirtyStateForCurrentUser,
  removeProfileStorageItem,
  setProfileStorageItem,
} from './profileKeys.js';

const AUTH_USERNAME_KEY = 'chess-study-auth-username';
const PROGRESSION_KEY = 'chess-study-chronicles-progression-v1';
const DIRTY_USER_KEY = 'chess-study-profile-dirty-user';
const DIRTY_KEYS_KEY = 'chess-study-profile-dirty-keys';
const LEGACY_SESSION_KEY = 'chess-study-active-game-session-v1';

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
  expect(clearLocalUserState()).toBe(false);
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

  it('a stale Alice tab cannot inspect or clear Bob\'s pending journal and session', () => {
    bindProfileStorageIdentity('alice');
    localStorage.setItem(AUTH_USERNAME_KEY, 'bob');
    localStorage.setItem(PROGRESSION_KEY, 'bob-campaign');
    localStorage.setItem(DIRTY_USER_KEY, 'bob');
    localStorage.setItem(DIRTY_KEYS_KEY, JSON.stringify([PROGRESSION_KEY]));
    localStorage.setItem(LEGACY_SESSION_KEY, 'bob-active-game');

    expect(profileDirtyStateForCurrentUser()).toEqual({ dirty: false, valid: true, keys: [] });
    expect(dirtyProfileKeysForCurrentUser()).toEqual([]);
    expect(hasDirtyProfileForCurrentUser()).toBe(false);
    expect(clearProfileDirty()).toBe(false);
    expect(clearLocalUserState()).toBe(false);
    expect(localStorage.getItem(DIRTY_USER_KEY)).toBe('bob');
    expect(localStorage.getItem(DIRTY_KEYS_KEY)).toBe(JSON.stringify([PROGRESSION_KEY]));
    expect(localStorage.getItem(PROGRESSION_KEY)).toBe('bob-campaign');
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBe('bob-active-game');

    // The actual Bob document still sees its journal and can clean it normally.
    bindProfileStorageIdentity('bob');
    expect(hasDirtyProfileForCurrentUser()).toBe(true);
    expect(profileDirtyStateForCurrentUser()).toEqual({
      dirty: true, valid: true, keys: [PROGRESSION_KEY],
    });
    expect(clearProfileDirty()).toBe(true);
    expect(hasDirtyProfileForCurrentUser()).toBe(false);
    expect(localStorage.getItem(PROGRESSION_KEY)).toBe('bob-campaign');
  });

  it('a guest document cannot clear a user journal after another tab signs in', () => {
    bindProfileStorageIdentity(null);
    localStorage.setItem(AUTH_USERNAME_KEY, 'bob');
    localStorage.setItem(DIRTY_USER_KEY, 'bob');
    localStorage.setItem(DIRTY_KEYS_KEY, '*');
    localStorage.setItem(LEGACY_SESSION_KEY, 'bob-game');

    expect(profileDirtyStateForCurrentUser()).toEqual({ dirty: false, valid: true, keys: [] });
    expect(clearProfileDirty()).toBe(false);
    expect(clearLocalUserState()).toBe(false);
    expect(localStorage.getItem(DIRTY_KEYS_KEY)).toBe('*');
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBe('bob-game');
  });

  it('logout cleanup of the authenticated document still clears its own journal and session', () => {
    localStorage.setItem(AUTH_USERNAME_KEY, 'alice');
    bindProfileStorageIdentity('alice');
    expect(setProfileStorageItem(PROGRESSION_KEY, 'alice-campaign')).toBe(true);
    localStorage.setItem(LEGACY_SESSION_KEY, 'alice-game');

    expect(hasDirtyProfileForCurrentUser()).toBe(true);
    expect(clearLocalUserState()).toBe(true);
    expect(localStorage.getItem(PROGRESSION_KEY)).toBeNull();
    expect(localStorage.getItem(DIRTY_USER_KEY)).toBeNull();
    expect(localStorage.getItem(DIRTY_KEYS_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_SESSION_KEY)).toBeNull();
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
