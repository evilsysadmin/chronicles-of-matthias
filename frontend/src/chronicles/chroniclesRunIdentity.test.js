import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { clearStorageMemoryFallback } from '../safeStorage.js';
import {
  CHRONICLES_FIRST_PERSON_RUN_STORAGE_KEY,
  CHRONICLES_RUN_STORAGE_KEY,
  CHRONICLES_ISOLATED_TACTICS_RUN_STORAGE_KEY,
  CHRONICLES_TACTICS_RUN_STORAGE_KEY,
  beginChroniclesRun,
  ensureChroniclesRun,
  finishChroniclesRun,
  renewChroniclesRun,
  chroniclesRunEntryMapId,
  CHRONICLES_SAVE_CATALOG_KEY,
  chroniclesListSavedRuns,
  chroniclesMergeRemoteSavedRuns,
  chroniclesRecoverLegacySavedRunIds,
  chroniclesMarkSavedRunRemote,
  chroniclesSaveCatalogOwner,
  chroniclesSelectedRunIsRemote,
  chroniclesSelectSavedRun,
  chroniclesRenameSavedRun,
  chroniclesForgetSavedRun,
  chroniclesNoteSavedRunCheckpoint,
} from './chroniclesRunIdentity.js';

describe('Chronicles isolated run identity', () => {
  beforeEach(() => {
    clearStorageMemoryFallback();
    localStorage.clear();
    localStorage.setItem('chess-study-auth-username', 'alice');
  });

  it('uses one canonical active expedition across first person and Tactics', () => {
    const first = ensureChroniclesRun('first-person');
    const tactical = ensureChroniclesRun('tactics');
    expect(tactical).not.toBe(first);
    expect(CHRONICLES_RUN_STORAGE_KEY).toBe('chess-study-chronicles-run-v1');
    expect(CHRONICLES_ISOLATED_TACTICS_RUN_STORAGE_KEY).toBe('chess-study-chronicles-tactics-run-v3');
    expect(JSON.parse(localStorage.getItem(CHRONICLES_RUN_STORAGE_KEY)).id).toBe(first);
    expect(JSON.parse(localStorage.getItem(CHRONICLES_ISOLATED_TACTICS_RUN_STORAGE_KEY)).id).toBe(tactical);
    expect(ensureChroniclesRun('first-person')).toBe(first);
    expect(ensureChroniclesRun('tactics')).toBe(tactical);
    expect(chroniclesListSavedRuns('first-person').map(row => row.id)).toEqual([first]);
    expect(chroniclesListSavedRuns('tactics').map(row => row.id)).toEqual([tactical]);
  });

  it('starts fresh first-person expeditions in Swordhaven and shares the map identity', () => {
    const first = ensureChroniclesRun('first-person');
    expect(chroniclesRunEntryMapId('first-person')).toBe('swordhaven-first-book');
    expect(ensureChroniclesRun('tactics')).not.toBe(first);
    expect(chroniclesRunEntryMapId('tactics')).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHRONICLES_RUN_STORAGE_KEY)))
      .toMatchObject({ id: first, entryMapId: 'swordhaven-first-book' });
  });

  it('uses the same Swordhaven for default and explicit fresh campaign starts', () => {
    const first = beginChroniclesRun('first-person');
    const second = beginChroniclesRun('first-person', { entryMapId: 'swordhaven-first-book' });
    expect(second).not.toBe(first);
    expect(ensureChroniclesRun('tactics')).not.toBe(second);
    expect(chroniclesRunEntryMapId('first-person')).toBe('swordhaven-first-book');
    expect(chroniclesListSavedRuns('first-person')).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first, entryMapId: 'swordhaven-first-book' }),
      expect.objectContaining({ id: second, entryMapId: 'swordhaven-first-book' }),
    ]));
    expect(chroniclesSelectSavedRun('first-person', first)).toBe(true);
  });

  it('rejects unsupported fresh-run map choices before changing the selected save', () => {
    const current = beginChroniclesRun('first-person');
    expect(() => beginChroniclesRun('first-person', { entryMapId: 'crypt-eight-squares' })).toThrow(RangeError);
    expect(() => beginChroniclesRun('first-person', { entryMapId: 'unknown' })).toThrow(RangeError);
    for (const retired of ['swordhaven-campaign', 'swordhaven-square']) {
      expect(() => beginChroniclesRun('first-person', { entryMapId: retired })).toThrow(RangeError);
    }
    expect(() => beginChroniclesRun('tactics', { entryMapId: 'swordhaven-first-book' })).toThrow(RangeError);
    expect(ensureChroniclesRun('first-person')).toBe(current);
    expect(chroniclesListSavedRuns('first-person')).toHaveLength(1);
  });

  it('keeps fresh Tactics-first expeditions on the dungeon route for both adapters', () => {
    const tactical = ensureChroniclesRun('tactics');
    expect(chroniclesRunEntryMapId('tactics')).toBeNull();
    const first = ensureChroniclesRun('first-person');
    expect(first).not.toBe(tactical);
    expect(chroniclesRunEntryMapId('first-person')).toBe('swordhaven-first-book');
  });

  it('preserves legacy crypt run identity and server idempotency fingerprint', () => {
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: 'legacy-active', owner: 'alice', ended: false,
    }));
    expect(ensureChroniclesRun('first-person')).toBe('legacy-active');
    expect(chroniclesRunEntryMapId('first-person')).toBeNull();
  });

  it('migrates the active legacy identity from the adapter entered first', () => {
    localStorage.setItem(CHRONICLES_FIRST_PERSON_RUN_STORAGE_KEY, JSON.stringify({
      id: 'legacy-first-person', owner: 'alice', ended: false,
    }));
    localStorage.setItem(CHRONICLES_TACTICS_RUN_STORAGE_KEY, JSON.stringify({
      id: 'legacy-tactics', owner: 'alice', ended: false,
    }));
    expect(ensureChroniclesRun('first-person')).toBe('legacy-first-person');
    const tactics = ensureChroniclesRun('tactics');
    expect(tactics).not.toBe('legacy-first-person');
    expect(tactics).not.toBe('legacy-tactics');
  });

  it('can migrate a Tactics-only legacy expedition into the shared identity', () => {
    localStorage.setItem(CHRONICLES_TACTICS_RUN_STORAGE_KEY, JSON.stringify({
      id: 'legacy-tactics', owner: 'alice', ended: false,
    }));
    const tactics = ensureChroniclesRun('tactics');
    expect(tactics).not.toBe('legacy-tactics');
    expect(ensureChroniclesRun('first-person')).toBe('legacy-tactics');
    expect(ensureChroniclesRun('tactics')).toBe(tactics);
  });

  it('keeps one active expedition across remounts', () => {
    const first = beginChroniclesRun('first-person');
    const tactical = beginChroniclesRun('tactics');
    expect(ensureChroniclesRun('first-person')).toBe(first);
    expect(ensureChroniclesRun('tactics')).toBe(tactical);
  });

  it('finishes an expedition so the next entry gets a fresh shared identity', () => {
    const first = beginChroniclesRun('first-person');
    const tactical = beginChroniclesRun('tactics');
    expect(finishChroniclesRun('tactics', tactical)).toBe(true);
    const next = ensureChroniclesRun('tactics');
    expect(next).not.toBe(tactical);
    expect(finishChroniclesRun('tactics', first)).toBe(false);
    expect(ensureChroniclesRun('first-person')).toBe(first);
  });

  it('renews a stale identity once without clobbering a newer replacement', () => {
    const first = beginChroniclesRun('first-person');
    const stale = beginChroniclesRun('tactics');
    const replacement = renewChroniclesRun('tactics', stale);
    expect(replacement).not.toBe(stale);
    expect(ensureChroniclesRun('first-person')).toBe(first);
    expect(renewChroniclesRun('tactics', stale)).toBe(replacement);
  });

  it('preserves the authored campaign route when renewing a stale first-person run', () => {
    const stale = beginChroniclesRun('first-person', { entryMapId: 'swordhaven-first-book' });
    const renewed = renewChroniclesRun('first-person', stale);
    expect(renewed).not.toBe(stale);
    expect(chroniclesRunEntryMapId('first-person')).toBe('swordhaven-first-book');
    expect(chroniclesListSavedRuns('first-person').map((run) => run.id)).toContain(renewed);
  });

  it('indexes old runs without changing their idempotent server IDs', () => {
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: 'old-run', owner: 'alice', ended: false,
    }));
    const saves = chroniclesListSavedRuns('first-person');
    expect(saves).toHaveLength(1);
    expect(saves[0]).toMatchObject({ id: 'old-run', entryMapId: null, active: true });
    expect(ensureChroniclesRun('first-person')).toBe('old-run');
  });

  it('preserves separate expeditions when switching and starting new ones', () => {
    const first = beginChroniclesRun('first-person');
    chroniclesRenameSavedRun('first-person', first, 'Campaña de Hildegard');
    chroniclesNoteSavedRunCheckpoint('first-person', first, 'crypt-eight-squares');
    const second = beginChroniclesRun('first-person');
    const saves = chroniclesListSavedRuns('first-person');
    expect(saves.map(run => run.id)).toEqual(expect.arrayContaining([first, second]));
    expect(saves.find(run => run.id === first)).toMatchObject({
      title: 'Campaña de Hildegard', currentMapId: 'crypt-eight-squares', active: false,
    });
    expect(chroniclesSelectSavedRun('first-person', first)).toBe(true);
    expect(ensureChroniclesRun('tactics')).not.toBe(first);
    expect(chroniclesRunEntryMapId('first-person')).toBe('swordhaven-first-book');
    expect(chroniclesListSavedRuns('first-person').find(run => run.id === first).active).toBe(true);
  });

  it('removes only the chosen local slot without touching another run', () => {
    const first = beginChroniclesRun('first-person');
    const second = beginChroniclesRun('first-person');
    expect(chroniclesForgetSavedRun('first-person', second)).toBe(true);
    expect(chroniclesListSavedRuns('first-person').map((row) => row.id)).toEqual([first]);
    expect(ensureChroniclesRun('first-person')).not.toBe(second);
    expect(chroniclesSelectSavedRun('first-person', first)).toBe(true);
    expect(chroniclesForgetSavedRun('first-person', 'not-my-slot')).toBe(false);
  });

  it('cannot list, load, rename or forget a different account’s saves', () => {
    const aliceId = beginChroniclesRun('first-person');
    localStorage.setItem('chess-study-auth-username', 'bob');
    expect(chroniclesListSavedRuns('first-person')).toEqual([]);
    expect(chroniclesSelectSavedRun('first-person', aliceId)).toBe(false);
    expect(chroniclesRenameSavedRun('first-person', aliceId, 'Malicious')).toBe(false);
    expect(chroniclesForgetSavedRun('first-person', aliceId)).toBe(false);
    expect(JSON.parse(localStorage.getItem(CHRONICLES_SAVE_CATALOG_KEY)).owner).toBe('alice');
  });

  it('treats corrupt catalog data as empty and keeps old runs migratable', () => {
    localStorage.setItem(CHRONICLES_SAVE_CATALOG_KEY, 'not-json');
    localStorage.setItem(CHRONICLES_FIRST_PERSON_RUN_STORAGE_KEY, JSON.stringify({
      id: 'legacy-one', owner: 'alice', ended: false,
    }));
    expect(chroniclesListSavedRuns('first-person').map((row) => row.id)).toEqual(['legacy-one']);
    expect(chroniclesRenameSavedRun('first-person', 'legacy-one', '   ')).toBe(false);
  });


  it('reconciles cross-device server runs, preserves local labels and uses GET selection', () => {
    const pendingId = beginChroniclesRun('first-person');
    const remoteId = 'remote-owned-1';
    const rows = [{ runId: remoteId, currentMapId: 'crypt-eight-squares', status: 'active', updatedAtMs: 1760000000000 }];
    const merged = chroniclesMergeRemoteSavedRuns('first-person', rows);
    expect(merged.map((save) => save.id)).toContain(remoteId);
    expect(merged.map((save) => save.id)).toContain(pendingId);
    expect(merged.find((save) => save.id === remoteId)).toMatchObject({
      remote: true, currentMapId: 'crypt-eight-squares', updatedAt: 1760000000000,
    });
    expect(chroniclesSelectSavedRun('first-person', remoteId)).toBe(true);
    expect(chroniclesSelectedRunIsRemote('first-person', remoteId)).toBe(true);
    expect(chroniclesRenameSavedRun('first-person', remoteId, 'Mi expedición remota')).toBe(true);
    expect(chroniclesMergeRemoteSavedRuns('first-person', rows).find((save) => save.id === remoteId).title).toBe('Mi expedición remota');
    // Server no longer reports the run: a complete list removes its stale slot.
    expect(chroniclesMergeRemoteSavedRuns('first-person', []).some((save) => save.id === remoteId)).toBe(false);
    expect(chroniclesSelectedRunIsRemote('first-person', remoteId)).toBe(false);
  });

  it('never accepts malformed remote inventories or leaks them across owners', () => {
    expect(() => chroniclesMergeRemoteSavedRuns('first-person', {})).toThrow(TypeError);
    chroniclesMergeRemoteSavedRuns('first-person', [{
      runId: 'alice-remote', status: 'active', updatedAtMs: 1760000000000,
    }]);
    localStorage.setItem('chess-study-auth-username', 'bob');
    expect(chroniclesListSavedRuns('first-person')).toEqual([]);
    chroniclesMergeRemoteSavedRuns('first-person', [{
      runId: 'bob-remote', status: 'active', updatedAtMs: 1760000000000,
    }]);
    expect(chroniclesListSavedRuns('first-person').map((save) => save.id)).toEqual(['bob-remote']);
  });

  it('discards a delayed catalog response when the authenticated owner changes', () => {
    const alice = chroniclesSaveCatalogOwner();
    localStorage.setItem('chess-study-auth-username', 'bob');
    expect(chroniclesMergeRemoteSavedRuns('first-person', [
      { runId: 'alice-id', currentMapId: 'swordhaven-square', status: 'active' },
    ], { expectedOwner: alice })).toEqual([]);
    expect(chroniclesListSavedRuns('first-person')).toEqual([]);
  });

  it('reads old unmarked save IDs without ever treating them as new POST slots', () => {
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: 'old-authoritative-run', owner: 'alice', ended: false,
    }));
    const saves = chroniclesListSavedRuns('first-person');
    expect(saves[0]).toMatchObject({ id: 'old-authoritative-run', pending: false });
    expect(chroniclesSelectedRunIsRemote('first-person', 'old-authoritative-run')).toBe(true);
    expect(chroniclesSelectSavedRun('first-person', 'old-authoritative-run')).toBe(true);
    expect(chroniclesSelectedRunIsRemote('first-person', 'old-authoritative-run')).toBe(true);
  });

  it('creates only explicit pending runs, then switches to read-only GET after server confirmation', () => {
    const id = beginChroniclesRun('first-person');
    expect(chroniclesSelectedRunIsRemote('first-person', id)).toBe(false);
    expect(chroniclesListSavedRuns('first-person')[0].pending).toBe(true);
    chroniclesMarkSavedRunRemote('first-person', id);
    expect(chroniclesSelectedRunIsRemote('first-person', id)).toBe(true);
    expect(chroniclesListSavedRuns('first-person')[0]).toMatchObject({
      id, remote: true, pending: false,
    });
  });

  it('rekeys a new POST to the authoritative server UUID and preserves the local save name', () => {
    const provisional = beginChroniclesRun('first-person');
    expect(chroniclesRenameSavedRun('first-person', provisional, 'Swordhaven · día uno')).toBe(true);
    const id = 'uuid5-owner-key-from-server';
    expect(chroniclesMarkSavedRunRemote('first-person', provisional, id)).toBe(id);
    expect(ensureChroniclesRun('tactics')).not.toBe(id);
    expect(chroniclesRunEntryMapId('tactics')).toBeNull();
    expect(chroniclesListSavedRuns('first-person')).toEqual([
      expect.objectContaining({ id, title: 'Swordhaven · día uno', remote: true, pending: false, active: true }),
    ]);
    expect(chroniclesSelectedRunIsRemote('first-person', id)).toBe(true);
    expect(chroniclesMarkSavedRunRemote('tactics', id, id)).toBeNull();
    expect(ensureChroniclesRun('first-person')).toBe(id);
  });

  it('never changes a newer run or an established remote ID on a late POST response', () => {
    const oldPending = beginChroniclesRun('first-person');
    const newest = beginChroniclesRun('first-person');
    expect(chroniclesMarkSavedRunRemote('first-person', oldPending, 'stale-server-run')).toBeNull();
    expect(ensureChroniclesRun('first-person')).toBe(newest);
    expect(chroniclesListSavedRuns('first-person').map((row) => row.id))
      .toEqual(expect.arrayContaining([oldPending, newest]));

    expect(chroniclesMarkSavedRunRemote('first-person', newest, 'server-current')).toBe('server-current');
    expect(chroniclesMarkSavedRunRemote('first-person', 'server-current', 'different-server'))
      .toBeNull();
    expect(ensureChroniclesRun('first-person')).toBe('server-current');
  });

  it('cannot commit a pending run after switching authenticated owners', () => {
    const alicePending = beginChroniclesRun('first-person');
    localStorage.setItem('chess-study-auth-username', 'bob');
    expect(chroniclesMarkSavedRunRemote('first-person', alicePending, 'alice-server')).toBeNull();
    expect(chroniclesListSavedRuns('first-person')).toEqual([]);
    localStorage.setItem('chess-study-auth-username', 'alice');
    expect(ensureChroniclesRun('first-person')).toBe(alicePending);
    expect(chroniclesSelectedRunIsRemote('first-person', alicePending)).toBe(false);
  });

  it('recovers a saved expedition with an old UUIDv4 pointer from a verified server inventory', async () => {
    const provisional = '550e8400-e29b-41d4-a716-446655440000';
    const canonical = 'ca1e8e12-21c6-598a-96b9-6e11c722428e';
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: provisional, owner: 'alice', ended: false, entryMapId: 'swordhaven-square',
      remote: true, pending: false,
    }));
    chroniclesListSavedRuns('first-person');
    chroniclesRenameSavedRun('first-person', provisional, 'Mi Swordhaven');
    vi.stubGlobal('crypto', webcrypto);
    try {
      const remoteRuns = [{ runId: canonical, status: 'active', currentMapId: 'crypt-eight-squares' }];
      expect(await chroniclesRecoverLegacySavedRunIds('first-person', remoteRuns)).toBe(1);
      const saves = chroniclesMergeRemoteSavedRuns('first-person', remoteRuns);
      expect(saves).toHaveLength(1);
      expect(saves[0]).toMatchObject({
        id: canonical, title: 'Mi Swordhaven',
        remote: true, pending: false, active: true,
        currentMapId: 'crypt-eight-squares',
      });
      expect(ensureChroniclesRun('first-person')).toBe(canonical);
      expect(chroniclesSelectedRunIsRemote('first-person', canonical)).toBe(true);
      expect(await chroniclesRecoverLegacySavedRunIds('first-person', remoteRuns)).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('also repairs pre-catalog saves without a remote flag after exact server confirmation', async () => {
    const provisional = '11111111-1111-4111-8111-111111111111';
    const canonical = '55a7760a-cdd8-5717-bd0f-5c34c4aa7100';
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: provisional, owner: 'alice', ended: false,
    }));
    chroniclesListSavedRuns('first-person');
    vi.stubGlobal('crypto', webcrypto);
    try {
      const remote = [{ runId: canonical, status: 'active', currentMapId: 'ash-vault' }];
      expect(await chroniclesRecoverLegacySavedRunIds('first-person', remote)).toBe(1);
      const saves = chroniclesMergeRemoteSavedRuns('first-person', remote);
      expect(saves).toHaveLength(1);
      expect(saves[0]).toMatchObject({ id: canonical, remote: true, pending: false, active: true });
      expect(ensureChroniclesRun('first-person')).toBe(canonical);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not claim to recover a legacy save without an exact remote match or after abort', async () => {
    const provisional = '550e8400-e29b-41d4-a716-446655440000';
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: provisional, owner: 'alice', ended: false, remote: true, pending: false,
    }));
    chroniclesListSavedRuns('first-person');
    vi.stubGlobal('crypto', webcrypto);
    try {
      expect(await chroniclesRecoverLegacySavedRunIds('first-person', [
        { runId: 'some-other-server-run', status: 'active' },
      ])).toBe(0);
      const controller = new AbortController();
      controller.abort();
      expect(await chroniclesRecoverLegacySavedRunIds('first-person', [
        { runId: 'ca1e8e12-21c6-598a-96b9-6e11c722428e', status: 'active' },
      ], { signal: controller.signal })).toBe(0);
      expect(ensureChroniclesRun('first-person')).toBe(provisional);
      localStorage.setItem('chess-study-auth-username', 'bob');
      expect(await chroniclesRecoverLegacySavedRunIds('first-person', [
        { runId: 'ca1e8e12-21c6-598a-96b9-6e11c722428e', status: 'active' },
      ], { expectedOwner: 'alice' })).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps remote checkpoints and save book entries scoped to their actual mode', () => {
    const mm3 = beginChroniclesRun('first-person');
    expect(chroniclesMarkSavedRunRemote('first-person', mm3, 'mm3-server')).toBe('mm3-server');
    const tactics = beginChroniclesRun('tactics');
    expect(chroniclesMarkSavedRunRemote('tactics', tactics, 'tactics-server')).toBe('tactics-server');
    expect(ensureChroniclesRun('first-person')).toBe('mm3-server');
    expect(ensureChroniclesRun('tactics')).toBe('tactics-server');
    expect(chroniclesSelectSavedRun('first-person', 'tactics-server')).toBe(false);
    expect(chroniclesSelectSavedRun('tactics', 'mm3-server')).toBe(false);
    expect(chroniclesNoteSavedRunCheckpoint('tactics', 'mm3-server', 'rookwood-first-book')).toBe(false);
    expect(chroniclesRenameSavedRun('tactics', 'mm3-server', 'overwrite')).toBe(false);
    expect(chroniclesForgetSavedRun('tactics', 'mm3-server')).toBe(false);
    expect(finishChroniclesRun('tactics', 'mm3-server')).toBe(false);
    expect(chroniclesListSavedRuns('first-person').map(x => x.id)).toEqual(['mm3-server']);
    expect(chroniclesListSavedRuns('tactics').map(x => x.id)).toEqual(['tactics-server']);
  });

  it('does not adopt legacy shared MM3 checkpoints into the isolated tactical mode', () => {
    localStorage.setItem(CHRONICLES_RUN_STORAGE_KEY, JSON.stringify({
      id: 'shared-server', owner: 'alice', remote: true, ended: false, entryMapId: 'swordhaven-first-book',
    }));
    localStorage.setItem(CHRONICLES_TACTICS_RUN_STORAGE_KEY, JSON.stringify({
      id: 'shared-server', owner: 'alice', remote: true, ended: false,
    }));
    const tactical = ensureChroniclesRun('tactics');
    expect(tactical).not.toBe('shared-server');
    expect(chroniclesSelectedRunIsRemote('tactics', tactical)).toBe(false);
    expect(ensureChroniclesRun('first-person')).toBe('shared-server');
    expect(chroniclesSelectedRunIsRemote('first-person', 'shared-server')).toBe(true);
  });

  it('never inherits an active expedition across authenticated users', () => {
    const first = beginChroniclesRun('first-person');
    localStorage.setItem('chess-study-auth-username', 'bob');
    const tactical = ensureChroniclesRun('tactics');
    expect(tactical).not.toBe(first);
    expect(JSON.parse(localStorage.getItem(CHRONICLES_ISOLATED_TACTICS_RUN_STORAGE_KEY)).owner).toBe('bob');
    expect(JSON.parse(localStorage.getItem(CHRONICLES_RUN_STORAGE_KEY)).owner).toBe('alice');
  });

});
