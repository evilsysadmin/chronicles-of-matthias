import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ChroniclesPlayerAdmin, { chroniclesRosterStatusLabel } from './ChroniclesPlayerAdmin.jsx';
import { chroniclesValidateAdminRosterPage } from '../chronicles/chroniclesAdminRosterClient.js';
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';

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
    expect(html).toContain('Consultando censo');
    expect(html).not.toContain('0 usuarios cargados');
    expect(html).not.toContain('Eliminar usuario');
    expect(html).not.toContain('lastClientIp');
  });
});
