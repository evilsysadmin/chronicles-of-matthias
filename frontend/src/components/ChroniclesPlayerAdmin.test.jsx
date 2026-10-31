import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ChroniclesPlayerAdmin, { chroniclesRosterStatusLabel, chroniclesRosterHeroLabel, chroniclesRosterHeroLevel, chroniclesRosterPlayerLabel, chroniclesRosterMatches, chroniclesRosterRunLabel } from './ChroniclesPlayerAdmin.jsx';
import { chroniclesValidateAdminRosterPage } from '../chronicles/chroniclesAdminRosterClient.js';
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';
import ChroniclesAdminChangelog from './ChroniclesAdminChangelog.jsx';

describe('Chronicles player administration', () => {
  it('accepts genuine empty and populated pages from the Chronicles API', () => {
    expect(chroniclesValidateAdminRosterPage({ users: [] })).toEqual({ users: [], nextAfter: '' });
    const users = [
      { username: 'alice', online: true, levels: { matthias: 3 } },
      { username: 'bob', online: false },
    ];
    expect(chroniclesValidateAdminRosterPage({ users, nextAfter: 'bob' })).toEqual({
      users, nextAfter: 'bob',
    });
  });

  it.each([
    null,
    {},
    { users: null },
    { users: [null] },
    { users: ['alice'] },
    { users: [{ username: '' , online: false }] },
    { users: [{ username: 22, online: true }] },
    { users: [{ username: 'alice' }] },
    { users: [{ username: 'alice', online: 'true' }] },
    { users: [], nextAfter: null },
    { users: [], nextAfter: 123 },
  ])('reports invalid roster payload rather than crashing React for %j', (payload) => {
    expect(() => chroniclesValidateAdminRosterPage(payload))
      .toThrow('Respuesta de administración no válida.');
  });

  it('uses a real saved hero name, with safe legacy and malformed-data fallback', () => {
    const user = { heroNames: { matthias: '  Éowyn  ', bishop: {}, knight: '' } };
    expect(chroniclesRosterHeroLabel(user, 'matthias')).toBe('Éowyn');
    expect(chroniclesRosterHeroLabel(user, 'rook')).toBe('Rook');
    expect(chroniclesRosterHeroLabel(user, 'bishop')).toBe('Bishop');
    expect(chroniclesRosterHeroLabel(user, 'knight')).toBe('Knight');
    expect(chroniclesRosterHeroLabel({ heroNames: null }, 'matthias')).toBe('Matthias');
  });

  it.each([
    [3, 3], [1, 1], [12, 12],
    [undefined, '—'], [null, '—'], [0, '—'], [13, '—'],
    [2.5, '—'], ['4', '—'], [{ level: 4 }, '—'], [[4], '—'],
  ])('only renders valid measured hero levels (input %j)', (value, expected) => {
    const user = { levels: { matthias: value } };
    expect(chroniclesRosterHeroLevel(user, 'matthias')).toBe(expected);
    expect(chroniclesRosterHeroLevel(user, 'rook')).toBe('—');
  });

  it('keeps the roster display safe when progression is absent or malformed', () => {
    expect(chroniclesRosterHeroLevel({}, 'matthias')).toBe('—');
    expect(chroniclesRosterHeroLevel({ levels: null }, 'matthias')).toBe('—');
    expect(chroniclesRosterHeroLevel({ levels: 'bogus' }, 'matthias')).toBe('—');
  });

  it('distinguishes technical IDs from player names without inventing an Identity alias', () => {
    expect(chroniclesRosterPlayerLabel({ username: 'alice' })).toBe('alice');
    expect(chroniclesRosterPlayerLabel({ username: 'browser-journey-75bb33628d' }))
      .toBe('Navegador · 75bb33628d');
    expect(chroniclesRosterPlayerLabel({ username: 'shadowops:staging:11111111-1111-4111-8111-111111111111' }))
      .toBe('ShadowOps ID · 11111111');
    expect(chroniclesRosterPlayerLabel({ username: '' })).toBe('Cuenta sin nombre');
  });

  it('searches by account and genuine saved hero names, not invented labels', () => {
    const user = { username: 'alice', heroNames: { matthias: 'Éowyn' } };
    expect(chroniclesRosterMatches(user, ' ALI ')).toBe(true);
    expect(chroniclesRosterMatches(user, 'éOW')).toBe(true);
    expect(chroniclesRosterMatches(user, 'no-existe')).toBe(false);
    expect(chroniclesRosterMatches({ username: 'bob', heroNames: { rook: {} } }, 'bob')).toBe(true);
  });

  it('reports only documented latest run status, not an imagined live position', () => {
    expect(chroniclesRosterRunLabel({})).toBe('Sin expedición guardada');
    expect(chroniclesRosterRunLabel({ mapId: 'swordhaven', runStatus: 'active' }))
      .toBe('Expedición en curso');
    expect(chroniclesRosterRunLabel({ mapId: 'swordhaven', runStatus: 'completed' }))
      .toBe('Expedición completada');
    expect(chroniclesRosterRunLabel({ mapId: 'swordhaven', runStatus: 'unknown' }))
      .toBe('Última expedición guardada');
  });

  it('does not render the administrative entry for unverified players', () => {
    const html = renderToStaticMarkup(<ChroniclesSaveMenu saves={[]} onNew={() => {}} />);
    expect(html).toContain('Otras opciones');
    expect(html).not.toContain('data-chronicles-admin-link');
    expect(html).not.toContain('Administrar jugadores');
  });

  it.each([
    [{ hasLoaded: false, loading: true, error: '', count: 0, hasMore: false }, 'Consultando censo…'],
    [{ hasLoaded: false, loading: false, error: 'Red caída', count: 0, hasMore: false }, 'Censo no disponible'],
    [{ hasLoaded: true, loading: false, error: '', count: 0, hasMore: false }, '0 usuarios cargados'],
    [{ hasLoaded: true, loading: false, error: '', count: 1, hasMore: false }, '1 usuario cargado'],
    [{ hasLoaded: true, loading: false, error: '', count: 4, hasMore: true }, '4 usuarios cargados · hay más'],
    [{ hasLoaded: true, loading: true, error: '', count: 2, hasMore: false }, '2 usuarios cargados · actualizando…'],
    [{ hasLoaded: true, loading: true, loadingMore: true, error: '', count: 40, hasMore: true }, '40 usuarios cargados · hay más · cargando más…'],
    [{ hasLoaded: true, loading: false, error: 'Red caída', count: 2, hasMore: true }, '2 usuarios cargados · hay más · datos de la última consulta correcta'],
  ])('reports honest census state for %j', (state, expected) => {
    expect(chroniclesRosterStatusLabel(state)).toBe(expected);
  });

  it('shows a read-only administration shell without manufacturing user or position data', () => {
    const html = renderToStaticMarkup(<ChroniclesPlayerAdmin />);
    expect(html).toContain('data-chronicles-admin-roster');
    expect(html).toContain('Solo lectura');
    expect(html).toContain('último guardado, no a una posición en vivo');
    expect(html).toContain('Consultando jugadores');
    expect(html).toContain('Cambios de versión');
    expect(html).toContain('Buscar jugador o héroe');
    expect(html).toContain('Ver ficha del jugador') === false;

    expect(html).not.toContain('data-chronicles-admin-changelog');
    expect(html).toContain('Consultando censo');
    expect(html).not.toContain('0 usuarios cargados');
    expect(html).not.toContain('Eliminar usuario');
    expect(html).not.toContain('lastClientIp');
  });
  it('keeps the version-history feature inside admin and does not guess a build SHA in dev', () => {
    const html = renderToStaticMarkup(<ChroniclesAdminChangelog />);
    expect(html).toContain('data-chronicles-admin-changelog');
    expect(html).toContain('Cambios de esta versión');
    expect(html).toContain('sin SHA');
    expect(html).not.toContain('Ver historial completo en GitHub');
  });

});
