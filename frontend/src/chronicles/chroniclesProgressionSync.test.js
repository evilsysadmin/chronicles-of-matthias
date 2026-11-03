import { describe, expect, it } from 'vitest';
import {
  createChroniclesProgression,
  grantChroniclesXp,
  spendChroniclesAttributePoint,
  unlockChroniclesSkill,
} from '../chroniclesOfMatthiasProgression.js';
import { chroniclesPickProgression } from './chroniclesProgressionSync.js';

const withXp = (xp) => {
  const progression = createChroniclesProgression();
  return { ...progression, heroes: { ...progression.heroes, matthias: { ...progression.heroes.matthias, xp } } };
};

describe('Chronicles progression across devices', () => {
  it('keeps the more advanced progression, whichever device has it', () => {
    expect(chroniclesPickProgression(withXp(10), withXp(200)).from).toBe('remote');
    expect(chroniclesPickProgression(withXp(300), withXp(200)).from).toBe('local');
    expect(chroniclesPickProgression(withXp(300), withXp(200)).progression.heroes.matthias.xp).toBe(300);
  });


  it('preserves a valid local skill unlock and spent attribute at the same XP', () => {
    const remote = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:level-two').progression;
    const allocated = spendChroniclesAttributePoint(remote, 'knight', 'vigor');
    const skilled = unlockChroniclesSkill(allocated.progression, 'knight', 'knight-double-quiver');
    expect(allocated.spent).toBe(true);
    expect(skilled.unlocked).toBe(true);

    const picked = chroniclesPickProgression(skilled.progression, remote);
    expect(picked.from).toBe('local');
    expect(picked.progression.heroes.knight.skills).toEqual(['knight-double-quiver']);
    expect(picked.progression.heroes.knight.attributes.vigor).toBe(1);
    expect(picked.progression.heroes.knight.xp).toBe(50);
  });

  it('preserves the newer server spend when local has the same XP and unspent points', () => {
    const local = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:level-two').progression;
    const remote = unlockChroniclesSkill(local, 'knight', 'knight-double-quiver').progression;
    expect(chroniclesPickProgression(local, remote).from).toBe('remote');
  });

  it('does not merge conflicting skill doctrines or attribute choices', () => {
    const base = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:level-two').progression;
    const skillA = unlockChroniclesSkill(base, 'knight', 'knight-double-quiver');
    const competingSkill = 'knight-heavy-bolts';
    // Both locally selected skills are separate possible choices, not a
    // descendant of one another. Never combine conflicting doctrine paths.
    const skillB = unlockChroniclesSkill(base, 'knight', competingSkill);
    expect(skillA.unlocked).toBe(true);
    expect(skillB.unlocked).toBe(true);
    expect(chroniclesPickProgression(skillA.progression, skillB.progression).from).toBe('conflict');

    const local = spendChroniclesAttributePoint(base, 'knight', 'vigor').progression;
    const remote = spendChroniclesAttributePoint(base, 'knight', 'agility').progression;
    expect(chroniclesPickProgression(local, remote).from).toBe('conflict');
  });

  it('does not confuse equal total XP with each character having equal XP', () => {
    const left = withXp(70);
    const right = withXp(40);
    right.heroes.rook.xp = 30;
    expect(chroniclesPickProgression(left, right).from).toBe('conflict');
  });

  it('flags a local skill and a remote receipt as divergent without dropping either', () => {
    const base = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:level-two').progression;
    const local = unlockChroniclesSkill(base, 'knight', 'knight-double-quiver').progression;
    const remote = {
      ...base,
      claimedAwards: [...base.claimedAwards, 'fixture:remote-receipt'],
    };
    const picked = chroniclesPickProgression(local, remote);
    expect(picked.from).toBe('conflict');
    expect(picked.progression.heroes.knight.skills).toContain('knight-double-quiver');
    expect(remote.claimedAwards).toContain('fixture:remote-receipt');
    expect(local.claimedAwards).not.toContain('fixture:remote-receipt');
  });

  it('does not choose an impossible local unlock from a competing doctrine', () => {
    // Level 4 legitimately has two skill points, but two skills in the
    // same doctrine group still cannot be learned together.
    const base = grantChroniclesXp(createChroniclesProgression(), 'knight', 250, 'fixture:level-four').progression;
    const legitimate = unlockChroniclesSkill(base, 'knight', 'knight-double-quiver').progression;
    const invalid = {
      ...legitimate,
      heroes: {
        ...legitimate.heroes,
        knight: {
          ...legitimate.heroes.knight,
          skills: ['knight-double-quiver', 'knight-heavy-bolts'],
          skillPoints: 0,
        },
      },
    };
    expect(chroniclesPickProgression(invalid, base).from).toBe('conflict');
  });

  it('does not claim a divergence when the server is demonstrably newer at the same XP', () => {
    const local = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:newer-server').progression;
    const remote = spendChroniclesAttributePoint(local, 'knight', 'vigor').progression;
    const chosen = chroniclesPickProgression(local, remote);
    expect(chosen.from).toBe('remote');
    expect(chosen.progression.heroes.knight.attributes.vigor).toBe(1);
  });

  it('uses the remote save on a new device with no local copy even when builds could differ', () => {
    const remote = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:fresh-device').progression;
    const unsavedDefault = createChroniclesProgression();
    expect(chroniclesPickProgression(unsavedDefault, remote, { hasLocalCopy: false }).from).toBe('remote');
    // Never trust the unsaved default as a higher-XP record.
    expect(chroniclesPickProgression(withXp(200), remote, { hasLocalCopy: false }).progression.heroes.knight.xp).toBe(50);
  });

  it('preserves unsynchronized local choices on a conflict rather than mutating either input', () => {
    const base = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:conflicting-choices').progression;
    const local = unlockChroniclesSkill(base, 'knight', 'knight-double-quiver').progression;
    const remote = unlockChroniclesSkill(base, 'knight', 'knight-heavy-bolts').progression;
    const left = JSON.stringify(local);
    const right = JSON.stringify(remote);
    const picked = chroniclesPickProgression(local, remote);
    expect(picked.from).toBe('conflict');
    expect(picked.progression.heroes.knight.skills).toEqual(['knight-double-quiver']);
    expect(JSON.stringify(local)).toBe(left);
    expect(JSON.stringify(remote)).toBe(right);
  });

  it('prefers the server on a tie and uses the local copy when the server has none', () => {
    expect(chroniclesPickProgression(withXp(50), withXp(50)).from).toBe('remote');
    expect(chroniclesPickProgression(withXp(50), null).from).toBe('local');
  });
});
