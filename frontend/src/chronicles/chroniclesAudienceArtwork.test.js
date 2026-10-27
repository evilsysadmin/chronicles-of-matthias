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
    expect(room).toContain('translate(175 28)');
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

  it('Brask has an illustrated 1600x900 garrison with his canonical silhouette', () => {
    const art = readFileSync(new URL('../assets/chronicles/ui/shops/brask-watch-illustrated.svg', import.meta.url), 'utf8');
    expect(art).toContain('viewBox="0 0 1600 900"');
    expect(art).toContain('id="g-brick"');
    expect(art).toContain('scale(3.2)');
    expect(art).toContain('translate(145 22)');
    expect(art.length).toBeGreaterThan(5000);
    expect(art).not.toMatch(/<(?:text|image|script|foreignObject)\\b/i);
    const state = { ...createChroniclesState('swordhaven-first-book'), x: 4, y: 6 };
    const dialogue = chroniclesNpcDialogueForState(state, chroniclesContextualContentAction(state));
    const html = renderToStaticMarkup(createElement(ChroniclesAudience, { dialogue, onAction: () => '', onClose: () => {} }));
    expect(html).toContain('data-chronicles-audience-room="watch-house"');
    expect(html).toContain('brask-watch-illustrated.svg');
    expect(html).toContain('Sargento Brask');
    expect(html).toContain('data-chronicles-dialogue-choice="quest"');
  });

  it('keeps Ilse temple unchanged', () => {
    for (const [x, y, room, who] of [[14, 6, 'temple', 'Sacerdotisa Ilse']]) {
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

describe('Cinematic audience layout contracts', () => {
  const css = readFileSync(new URL('../components/ChroniclesAudience.css', import.meta.url), 'utf8');

  it('shows the illustrated full-room scene beneath a right-hand dialogue panel', () => {
    expect(css).toMatch(/\.chronicles-audience__scene\s*\{[^}]*position:\s*absolute;/s);
    expect(css).toMatch(/grid-template-areas:\s*'\. head' '\. dialogue'/);
    expect(css).toMatch(/\.chronicles-audience__scene\s*\{[^}]*pointer-events:\s*none;/s);
    expect(css).toMatch(/\.chronicles-audience__scene img\s*\{[^}]*image-rendering:\s*auto;/s);
  });

  it('keeps a real visible art strip and full-sized touch actions in portrait', () => {
    expect(css).toMatch(/max-width:\s*680px\) and \(orientation:\s*portrait\)/);
    expect(css).toMatch(/grid-template-areas:\s*'scene' 'head' 'dialogue'/);
    expect(css).toMatch(/\.chronicles-audience__scene\s*\{\s*position:\s*relative;/);
    expect(css).toMatch(/\.chronicles-audience__actions button\s*\{ min-height:\s*44px;/);
  });

  it('guards the approved scene with its original local fallback on failure', () => {
    const component = readFileSync(new URL('../components/ChroniclesAudience.jsx', import.meta.url), 'utf8');
    expect(component).toContain('room.fallbackSrc && event.currentTarget.getAttribute');
    expect(component).toContain('event.currentTarget.src = room.fallbackSrc');
    expect(component).toContain('data-chronicles-audience-room={dialogue.room}');
  });
});

describe('Audience layer contract', () => {
  it('uses a body-level portal in browsers so first-person stacking cannot cover it', () => {
    const component = readFileSync(new URL('../components/ChroniclesAudience.jsx', import.meta.url), 'utf8');
    expect(component).toContain("createPortal(modal, document.body)");
    expect(component).toContain("typeof document === 'undefined' ? modal");
  });
});
