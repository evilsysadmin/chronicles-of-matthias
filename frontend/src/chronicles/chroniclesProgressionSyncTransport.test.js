import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestJson, identity } = vi.hoisted(() => ({
  requestJson: vi.fn(),
  identity: { username: null },
}));

// The real profile loader and game rules stay in place; only the network
// transport and current account identity are controlled by these fixtures.
vi.mock('../auth.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getUsername: () => identity.username,
  authHeader: () => ({ Authorization: `Bearer ${identity.username}` }),
}));
vi.mock('../http.js', async (importOriginal) => ({
  ...(await importOriginal()),
  requestJson,
}));

import { createChroniclesProgression, grantChroniclesXp, unlockChroniclesSkill } from '../chroniclesOfMatthiasProgression.js';
import { chroniclesPullProgression, chroniclesPushProgression } from './chroniclesProgressionSync.js';

let caseNumber = 0;

function withXp(xp) {
  const base = createChroniclesProgression();
  return {
    ...base,
    heroes: { ...base.heroes, matthias: { ...base.heroes.matthias, xp } },
  };
}

function pushedBaseRevision(callIndex) {
  const [url, options] = requestJson.mock.calls[callIndex];
  expect(url).toMatch(/\/chronicles\/progression$/);
  expect(options.method).toBe('PUT');
  return JSON.parse(options.body).baseRevision;
}

beforeEach(() => {
  requestJson.mockReset();
  caseNumber += 1;
  identity.username = `alice-${caseNumber}`;
});

describe('Chronicles progression revision ownership', () => {
  it('does not reuse Alice\'s server revision on Bob\'s first push', async () => {
    requestJson.mockResolvedValueOnce({ revision: 19, progression: withXp(50) });
    await chroniclesPullProgression(withXp(25));

    identity.username = `bob-${caseNumber}`;
    requestJson.mockResolvedValueOnce({ revision: 1 });
    await chroniclesPushProgression(withXp(10));

    expect(pushedBaseRevision(1)).toBe(0);
    expect(requestJson.mock.calls[1][1].headers.Authorization).toBe(`Bearer bob-${caseNumber}`);
  });

  it('ignores a late Alice pull rather than overwriting Bob\'s revision', async () => {
    let resolveOldPull;
    requestJson.mockImplementationOnce(() => new Promise((resolve) => { resolveOldPull = resolve; }));
    const oldPull = chroniclesPullProgression(withXp(20));

    identity.username = `bob-${caseNumber}`;
    requestJson.mockResolvedValueOnce({ revision: 7, progression: withXp(30) });
    const bobPull = await chroniclesPullProgression(withXp(25));
    expect(bobPull.from).toBe('remote');

    resolveOldPull({ revision: 99, progression: withXp(40) });
    await expect(oldPull).rejects.toMatchObject({ name: 'AbortError' });

    requestJson.mockResolvedValueOnce({ revision: 8 });
    await chroniclesPushProgression(withXp(35));
    expect(pushedBaseRevision(2)).toBe(7);
  });

  it('ignores a late Alice push success rather than changing Bob\'s revision', async () => {
    requestJson.mockResolvedValueOnce({ revision: 4, progression: withXp(20) });
    await chroniclesPullProgression(withXp(20));

    let resolveOldPush;
    requestJson.mockImplementationOnce(() => new Promise((resolve) => { resolveOldPush = resolve; }));
    const oldPush = chroniclesPushProgression(withXp(30));

    identity.username = `bob-${caseNumber}`;
    requestJson.mockResolvedValueOnce({ revision: 7, progression: withXp(15) });
    await chroniclesPullProgression(withXp(10));

    resolveOldPush({ revision: 100 });
    await expect(oldPush).rejects.toMatchObject({ name: 'AbortError' });

    requestJson.mockResolvedValueOnce({ revision: 8 });
    await chroniclesPushProgression(withXp(20));
    expect(pushedBaseRevision(3)).toBe(7);
  });

  it('pushes a valid local skill spent at equal XP when the server pull is behind', async () => {
    const remote = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:skill-tie').progression;
    const local = unlockChroniclesSkill(remote, 'knight', 'knight-double-quiver').progression;

    requestJson.mockResolvedValueOnce({ revision: 11, progression: remote });
    const pulled = await chroniclesPullProgression(local);
    expect(pulled.from).toBe('local');
    expect(pulled.needsPush).toBe(true);

    requestJson.mockResolvedValueOnce({ revision: 12 });
    await chroniclesPushProgression(pulled.progression);
    expect(pushedBaseRevision(1)).toBe(11);
    expect(JSON.parse(requestJson.mock.calls[1][1].body).progression.heroes.knight.skills)
      .toContain('knight-double-quiver');
  });

  it('retries a same-XP skill upgrade after a concurrent 409 without losing the unlock', async () => {
    const remote = grantChroniclesXp(createChroniclesProgression(), 'knight', 50, 'fixture:skill-409').progression;
    const local = unlockChroniclesSkill(remote, 'knight', 'knight-double-quiver').progression;
    requestJson.mockRejectedValueOnce(Object.assign(new Error('conflict'), {
      status: 409,
      body: { revision: 5, progression: remote },
    }));
    requestJson.mockResolvedValueOnce({ revision: 6 });

    const result = await chroniclesPushProgression(local);
    expect(result.pushed).toBe(true);
    expect(result.progression.heroes.knight.skills).toContain('knight-double-quiver');
    expect(pushedBaseRevision(0)).toBe(0);
    expect(pushedBaseRevision(1)).toBe(5);
  });

  it('keeps the existing same-user 409 conflict retry behavior', async () => {
    requestJson.mockRejectedValueOnce(Object.assign(new Error('conflict'), {
      status: 409,
      body: { revision: 5, progression: withXp(3) },
    }));
    requestJson.mockResolvedValueOnce({ revision: 6 });

    const result = await chroniclesPushProgression(withXp(50));
    expect(result.pushed).toBe(true);
    expect(pushedBaseRevision(0)).toBe(0);
    expect(pushedBaseRevision(1)).toBe(5);
  });
});
