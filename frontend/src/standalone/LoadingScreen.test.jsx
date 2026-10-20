import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LoadingScreen from './LoadingScreen.jsx';

describe('Chronicles branded loading screen', () => {
  it('fills the waiting state with an accessible status and a no-image fallback', () => {
    const html = renderToStaticMarkup(<LoadingScreen />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('Cargando Chronicles');
    expect(html).toContain('/chronicles-loading-art.svg');
    expect(html).toContain('chronicles-loading__crest');
    expect(html).not.toContain('tournament-panel');
  });

  it('ships the approved image as a small self-contained local asset', () => {
    const asset = readFileSync(new URL('../../public/chronicles-loading-art.svg', import.meta.url), 'utf8');
    expect(asset).toContain('<svg ');
    const embeddedWebp = asset.match(/data:image\/webp;base64,([a-zA-Z0-9+/=]+)/);
    expect(embeddedWebp).not.toBeNull();
    const bytes = Buffer.from(embeddedWebp[1], 'base64');
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(bytes.length).toBeLessThan(40_000);
  });
});
