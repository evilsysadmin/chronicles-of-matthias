import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChroniclesAccountMenu from './ChroniclesAccountMenu.jsx';

describe('ChroniclesAccountMenu', () => {
  it('shows a closed cog on the expedition book', () => {
    const html = renderToStaticMarkup(<ChroniclesAccountMenu onLogout={() => {}} />);
    expect(html).toContain('aria-label="Cuenta y ajustes"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('Cerrar sesión');
    expect(html).not.toContain('Música de Chronicles');
  });
});
