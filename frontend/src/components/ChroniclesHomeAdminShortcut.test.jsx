import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const access = vi.hoisted(() => ({ isAdmin: false, status: 'verified' }));
vi.mock('../chronicles/useChroniclesAdminAccess.js', () => ({
  useChroniclesAdminAccess: () => ({
    isAdmin: access.isAdmin, status: access.status, retry: vi.fn(),
  }),
}));
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';

function render() {
  return renderToStaticMarkup(
    <ChroniclesSaveMenu saves={[]} onNew={() => {}} onLoad={() => {}} />,
  );
}

describe('Chronicles home administration shortcut', () => {
  it('does not expose the shortcut to regular users or unverified sessions', () => {
    access.isAdmin = false;
    for (const status of ['verified', 'checking', 'denied', 'unavailable']) {
      access.status = status;
      expect(render()).not.toContain('data-chronicles-admin-shortcut');
      expect(render()).not.toContain('data-chronicles-admin-link');
    }
  });

  it('puts verified admin access on Home before the collapsed other-options menu', () => {
    access.isAdmin = true;
    access.status = 'verified';
    try {
      const html = render();
      expect(html).toContain('data-chronicles-admin-shortcut');
      expect(html).toContain('Administración');
      expect(html).toContain('Jugadores · Progreso · Cambios de versión');
      expect(html.indexOf('data-chronicles-admin-shortcut'))
        .toBeLessThan(html.indexOf('<summary>Otras opciones</summary>'));
      expect(html.match(/data-chronicles-admin-link/g)).toHaveLength(1);
    } finally {
      access.isAdmin = false;
    }
  });
});
