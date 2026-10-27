import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChroniclesAudience from '../components/ChroniclesAudience.jsx';
import { chroniclesNpcDialogueForState } from './chroniclesNpcDialogue.js';
import { chroniclesContextualContentAction, createChroniclesState } from '../chroniclesOfMatthias.js';

describe('Swordhaven audience premium environment', () => {
  const room = readFileSync(new URL('../assets/chronicles/ui/shops/aldric-hall-illustrated.svg', import.meta.url), 'utf8');

  it('mayor has a clean panoramic high-resolution illustrated room with canonical person', () => {
    expect(room).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(room).toContain('viewBox="0 0 1600 900"');
    expect(room).toContain('scale(3.4)');
    expect(room).toContain('id="office-stone"');
    expect(room).toContain('url(#robe)');
    expect(room.length).toBeGreaterThan(10000);
    expect(room.length).toBeLessThan(180000);
    expect(room).not.toMatch(/<(?:text|script|image|foreignObject|a)\b|\bonload\s*=|href\s*=/i);
  });

  it("renders Aldric\'s independent room instead of the old pixelated sprite", () => {
    const state = { ...createChroniclesState('swordhaven-first-book'), x: 11, y: 10 };
    const dialogue = chroniclesNpcDialogueForState(state, chroniclesContextualContentAction(state));
    const html = renderToStaticMarkup(createElement(ChroniclesAudience, {
      dialogue, onAction: () => '', onClose: () => {},
    }));
    expect(html).toContain('data-chronicles-audience-room="aldric-hall"');
    expect(html).toContain('aldric-hall-illustrated.svg');
    expect(html).toContain('Alcalde Aldric');
    expect(html).toContain('Presentar la carta de la Dama');
    expect(html).toContain('data-chronicles-dialogue-choice="quest"');
  });

  it('keeps Brask and Ilse existing interiors and choices intact', () => {
    for (const [x, y, room, who] of [[4, 6, 'watch-house', 'Sargento Brask'], [14, 6, 'temple', 'Sacerdotisa Ilse']]) {
      const state = { ...createChroniclesState('swordhaven-first-book'), x, y };
      const dialogue = chroniclesNpcDialogueForState(state, chroniclesContextualContentAction(state));
      const html = renderToStaticMarkup(createElement(ChroniclesAudience, { dialogue, onAction: () => '', onClose: () => {} }));
      // Vite may inline small legacy SVGs as data: URIs, so check the
      // actual room contract and preserved NPC identity, not a filename.
      expect(html).toContain('data-chronicles-audience-room="' + room + '"');
      expect(html).toContain(who);
      expect(html).toContain('role="dialog"');
    }
  });
});
