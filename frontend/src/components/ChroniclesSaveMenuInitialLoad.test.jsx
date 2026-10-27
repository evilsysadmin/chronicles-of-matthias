import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

vi.mock('./ChroniclesPlayerAdmin.jsx', () => ({ default: () => null }));
import ChroniclesSaveMenu from './ChroniclesSaveMenu.jsx';

const saves = [
  { id: 'run-1', title: 'Expedición original', remote: true, active: true, updatedAt: 1793100000000, currentMapId: 'swordhaven-first-book' },
  { id: 'run-2', title: 'Expedición alternativa', remote: true, active: false, updatedAt: 1793090000000, currentMapId: 'banner-road-first-book' },
];

describe('Chronicles save book opened from the pause menu', () => {
  it('starts directly in the existing authenticated expedition browser', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesSaveMenu, {
      saves, initialScreen: 'load', onLoad: () => {}, onRetrySync: () => {},
    }));
    expect(html).toContain('data-chronicles-save-menu="load"');
    expect(html).toContain('Cargar juego');
    expect(html).toContain('Expedición original');
    expect(html).toContain('Expedición alternativa');
    expect((html.match(/>Cargar<\/button>/g) || []).length).toBe(2);
    expect(html).not.toContain('Nueva expedición');
    expect(html).not.toContain('Eliminar definitivamente');
  });

  it('waits for server sync before allowing a save to be selected', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesSaveMenu, {
      saves, initialScreen: 'load', loading: true, onLoad: () => {}, onRetrySync: () => {},
    }));
    expect(html).toContain('Consultando expediciones del servidor');
    expect((html.match(/disabled=""[^>]*>Cargar<\/button>/g) || []).length).toBe(2);
  });

  it('retains the normal home entry when not opened for an explicit load', () => {
    const html = renderToStaticMarkup(createElement(ChroniclesSaveMenu, {
      saves, onLoad: () => {}, onNew: () => {}, onRetrySync: () => {},
    }));
    expect(html).toContain('data-chronicles-save-menu="home"');
    expect(html).toContain('Continuar expedición');
  });
});
