import { describe, expect, it } from 'vitest';
import {
  CHRONICLES_ADMIN_CHANGELOG_LIMIT,
  chroniclesAdminChangelogBuildSha,
  chroniclesAdminChangelogUrl,
  chroniclesAdminCommitUrl,
  chroniclesFetchAdminChangelog,
  chroniclesNormalizeAdminCommits,
  chroniclesAdminCommitCategory,
  chroniclesVisibleAdminCommits,
} from './chroniclesAdminChangelog.js';

const deployed = 'b654709d068424a979ff73d0fd3b2b072b2609b3';
const newer = 'e59b87b69dec940741eca694f4f5731e74c2c3b1';

describe('admin changelog of the deployed bundle', () => {
  it('never substitutes main, a release label or an invalid reference for the build SHA', () => {
    expect(chroniclesAdminChangelogBuildSha(deployed)).toBe(deployed);
    expect(chroniclesAdminChangelogBuildSha('v16.6dm46zfrv')).toBeNull();
    expect(chroniclesAdminChangelogBuildSha('main')).toBeNull();
    expect(chroniclesAdminChangelogBuildSha('f'.repeat(40) + '/../../issues')).toBeNull();
    expect(chroniclesAdminChangelogUrl('main')).toBeNull();
    expect(chroniclesAdminChangelogUrl(deployed)).toBe(
      `https://github.com/evilsysadmin/chronicles-of-matthias/commits/${deployed}`,
    );
    expect(chroniclesAdminCommitUrl(newer)).toBe(
      `https://github.com/evilsysadmin/chronicles-of-matthias/commit/${newer}`,
    );
  });

  it('keeps only valid GitHub commit subjects, dates and source-owned links', () => {
    const entries = chroniclesNormalizeAdminCommits([
      { sha: deployed, commit: { message: 'fix(MM3): daño correcto (#1012)\n\nDetalles', committer: { date: '2026-10-31T10:00:00Z' } } },
      { sha: newer, commit: { message: 'feat: nueva aventura', author: { date: 'invalid' } }, html_url: 'https://evil.invalid/' },
      { sha: 'bogus', commit: { message: 'falso' } },
      { sha: newer, commit: { message: '' } },
      null,
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      sha: deployed, title: 'fix(MM3): daño correcto (#1012)', date: '2026-10-31T10:00:00Z',
      url: chroniclesAdminCommitUrl(deployed),
    });
    expect(entries[1].date).toBeNull();
    expect(entries[1].url).toBe(chroniclesAdminCommitUrl(newer));
    expect(() => chroniclesNormalizeAdminCommits({ message: 'Rate limited' })).toThrow('historial válido');
  });

  it.each([
    ['feat(Swordhaven): nuevas murallas (#100)', 'Novedad', true],
    ['fix(MM3): daño correcto (#101)', 'Corrección', true],
    ['perf: movimientos fluidos', 'Rendimiento', true],
    ['feat!: cambia el combate', 'Novedad', true],
    ['fix(ci): ajustar pipeline', 'Técnico', false],
    ['feat(deps): nueva dependencia', 'Técnico', false],
    ['perf(infra): optimizar deploy', 'Técnico', false],
    ['refactor(tactics): extraer helpers', 'Técnico', false],
    ['ci: checks', 'Técnico', false],
    ['cualquier otro mensaje', 'Técnico', false],
    [null, 'Técnico', false],
  ])('classifies "%s" without inventing player-facing changes', (title, label, userFacing) => {
    expect(chroniclesAdminCommitCategory(title)).toEqual({ label, userFacing });
  });

  it('keeps all historical commits reachable in the complete view', () => {
    const commits = [
      { sha: deployed, title: 'feat(MM3): nuevo equipo' },
      { sha: newer, title: 'ci: optimizar workflows' },
      { sha: 'a'.repeat(40), title: 'fix(api): problemas de guardado' },
      { sha: 'b'.repeat(40), title: 'build(deps): bump react' },
    ];
    expect(chroniclesVisibleAdminCommits(commits)).toEqual([commits[0], commits[2]]);
    expect(chroniclesVisibleAdminCommits(commits, true)).toEqual(commits);
    expect(chroniclesVisibleAdminCommits(null, true)).toEqual([]);
    expect(chroniclesVisibleAdminCommits(commits.slice(1, 2))).toEqual([]);
  });

  it('queries only history reachable from this build, with no unauthenticated fallback to HEAD', async () => {
    const calls = [];
    const commits = [{ sha: deployed, commit: { message: 'fix: desplegado' } }];
    const fetchImpl = async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => commits };
    };
    expect(await chroniclesFetchAdminChangelog({ buildId: deployed, fetchImpl })).toEqual(
      chroniclesNormalizeAdminCommits(commits),
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(`?sha=${deployed}&per_page=${CHRONICLES_ADMIN_CHANGELOG_LIMIT}`);
    expect(calls[0].options.method).toBe('GET');
    expect(calls[0].options.headers.Accept).toBe('application/vnd.github+json');
  });

  it('fails visibly on no build identity and GitHub errors, rather than showing a fabricated empty history', async () => {
    let fetched = false;
    await expect(chroniclesFetchAdminChangelog({
      buildId: 'v16.6dm46zfrv',
      fetchImpl: async () => { fetched = true; },
    })).rejects.toThrow('SHA verificable');
    expect(fetched).toBe(false);
    await expect(chroniclesFetchAdminChangelog({
      buildId: deployed, fetchImpl: async () => ({ ok: false, status: 403 }),
    })).rejects.toThrow('GitHub');
    await expect(chroniclesFetchAdminChangelog({
      buildId: deployed, fetchImpl: async () => ({ ok: true, json: async () => ({ error: true }) }),
    })).rejects.toThrow('historial válido');
  });
});
