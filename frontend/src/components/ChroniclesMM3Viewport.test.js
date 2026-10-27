import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./ChroniclesMM3Chrome.css', import.meta.url), 'utf8');

// Isolate the authored desktop rules so a future mobile override cannot
// accidentally become the only place where these dimensions apply.
const desktop = css.split('/* ─── Desktop / wide landscape: the full MM3 screen')[1]
  ?.split('/* ─── Isles of Terra details')[0] || '';
const details = css.split('/* ─── Isles of Terra details')[1] || '';

function declarations(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(escaped + '\\s*\\{([^}]+)\\}'))?.[1] || '';
}

describe('MM3 desktop viewport space', () => {
  it('uses compact outer edges without removing the stone frame or the portrait strip', () => {
    expect(desktop).toContain('@media (min-width: 1025px), (min-width: 801px) and (min-height: 601px)');
    const shell = declarations(desktop, '.chronicles .chronicles-shell');
    expect(shell).toContain('padding: 4px 5px 4px');
    expect(shell).toContain('gap: 8px 8px');
    expect(shell).toContain("'party party'");
    expect(shell).toContain("'view map'");
    expect(shell).toContain('clamp(244px, 21vw, 316px)');
    const stage = declarations(desktop, '.chronicles .chronicles-stage');
    expect(stage).toContain('border: 32px solid transparent');
    expect(stage).toContain('border-image: var(--mm3-frame) 16 / 32px round');
  });

  it('grows the actual minimap surface in the desktop panel, not a floating mobile overlay', () => {
    expect(details).toContain('@media (min-width: 1025px), (min-width: 801px) and (min-height: 601px)');
    const map = declarations(details, '.chronicles .chronicles-minimap');
    expect(map).toContain('grid-area: map');
    expect(map).toContain('position: relative');
    expect(map).toContain('width: auto');
    expect(map).toContain('height: clamp(230px, 43dvh, 400px)');
    expect(map).toContain('grid-template-rows: minmax(0, 1fr) 16px 22px');
    const svg = declarations(details, '.chronicles .chronicles-minimap svg');
    expect(svg).toContain('width: 100%');
    expect(svg).toContain('height: 100%');
    expect(svg).toContain('min-height: 0');
    const location = declarations(details, '.chronicles .chronicles-minimap__location');
    expect(location).toContain('grid-row: 3');
    expect(location).not.toContain('grid-row: 2');
    expect(map).not.toContain('width: 132px');
  });
});
