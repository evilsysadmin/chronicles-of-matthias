import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import ChroniclesPlayerAdmin from './ChroniclesPlayerAdmin.jsx';
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';

describe('Chronicles player administration', () => {
  it('does not render the administrative entry for unverified players', () => {
    const html = renderToStaticMarkup(<ChroniclesSaveMenu saves={[]} onNew={() => {}} />);
    expect(html).toContain('Otras opciones');
    expect(html).not.toContain('data-chronicles-admin-link');
    expect(html).not.toContain('Administrar jugadores');
  });

  it('shows a read-only administration shell without manufacturing user or position data', () => {
    const html = renderToStaticMarkup(<ChroniclesPlayerAdmin />);
    expect(html).toContain('data-chronicles-admin-roster');
    expect(html).toContain('Solo lectura');
    expect(html).toContain('último guardado, no a una posición en vivo');
    expect(html).toContain('Consultando jugadores');
    expect(html).not.toContain('Eliminar usuario');
    expect(html).not.toContain('lastClientIp');
  });
});
