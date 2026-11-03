import { describe, expect, it } from 'vitest';
import { createChroniclesProgression, grantChroniclesXp, unlockChroniclesSkill } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesProgressionConflictBundle } from './chroniclesProgressionConflictBackup.js';

function divergentCopies() {
  const base = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:backup').progression;
  return {
    local: unlockChroniclesSkill(base, 'knight', 'knight-double-quiver').progression,
    remote: unlockChroniclesSkill(base, 'knight', 'knight-heavy-bolts').progression,
  };
}

describe('Chronicles conflicting progression backup', () => {
  it('exports BOTH incompatible choices without overwriting or merging either', () => {
    const { local, remote } = divergentCopies();
    const originalLocal = JSON.stringify(local);
    const originalRemote = JSON.stringify(remote);
    const bundle = chroniclesProgressionConflictBundle({
      owner: ' Alice ', local, remote, revision: 27,
      capturedAt: '2026-11-03T14:20:00.000Z',
    });
    const recovered = JSON.parse(JSON.stringify(bundle));

    expect(recovered).toMatchObject({
      format: 'chronicles-progression-conflict-backup',
      version: 1,
      account: 'alice',
      capturedAt: '2026-11-03T14:20:00.000Z',
      serverRevision: 27,
    });
    expect(recovered.localProgression.heroes.knight.skills).toEqual(['knight-double-quiver']);
    expect(recovered.serverProgression.heroes.knight.skills).toEqual(['knight-heavy-bolts']);
    expect(JSON.stringify(local)).toBe(originalLocal);
    expect(JSON.stringify(remote)).toBe(originalRemote);
    expect(recovered).not.toHaveProperty('token');
    expect(recovered).not.toHaveProperty('authorization');
  });

  it('refuses to create a misleading one-sided backup or attach it to an unknown identity', () => {
    const { local, remote } = divergentCopies();
    const valid = { owner: 'alice', local, remote, revision: 0, capturedAt: '2026-11-03' };
    expect(() => chroniclesProgressionConflictBundle({ ...valid, remote: null })).toThrow();
    expect(() => chroniclesProgressionConflictBundle({ ...valid, local: null })).toThrow();
    expect(() => chroniclesProgressionConflictBundle({ ...valid, owner: '' })).toThrow();
    expect(() => chroniclesProgressionConflictBundle({ ...valid, revision: -1 })).toThrow();
    expect(() => chroniclesProgressionConflictBundle({ ...valid, revision: 2.5 })).toThrow();
    expect(chroniclesProgressionConflictBundle(valid).serverRevision).toBe(0);
  });
});
