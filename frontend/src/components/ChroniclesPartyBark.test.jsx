import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import ChroniclesPartyBark from './ChroniclesPartyBark.jsx';

describe('ChroniclesPartyBark compact commentary', () => {
  const bark = {
    token: 'sample',
    speakerId: 'rook',
    speaker: 'Hildegard',
    glyph: '⚔',
    text: 'La calle parece segura. Eso suele durar poco.',
  };

  it('keeps the 3D view clear with a small expandable, keyboard-accessible speaker tab', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyBark bark={bark} />);
    expect(html).toContain('class="chronicles-party-bark__trigger"');
    expect(html).toContain('class="chronicles-party-bark__details"');
    expect(html).toContain('data-expanded="false"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls=');
    expect(html).toContain('type="button"');
    expect(html).toContain('Comentario de Hildegard. Leer');
    expect(html).toContain(bark.text);
    expect(html).toContain('role="status"');
  });

  it('preserves the real equipment action inside the expanded content', () => {
    const html = renderToStaticMarkup(<ChroniclesPartyBark
      bark={{ ...bark, event: 'first-book-deserter-loot' }}
      onOpenEquipment={() => {}}
    />);
    expect(html).toContain('Revisar equipo');
    expect(html).toContain('chronicles-party-bark__action');
    expect(html).toContain('type="button"');
  });

  it('does not add controls or text when there is no narration', () => {
    expect(renderToStaticMarkup(<ChroniclesPartyBark bark={null} />)).toBe('');
    expect(renderToStaticMarkup(<ChroniclesPartyBark bark={{ speaker: 'Matthias' }} />)).toBe('');
  });
});
